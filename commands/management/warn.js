const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');
const { addWarn, getWarns, removeWarn, clearWarns, setMaxWarns, loadModData } = require('../../utils/moderationManager');
const { getLogChannel } = require('../../utils/logsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn system for the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Warn a user')
            .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for the warn').setRequired(false)))

        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('View warnings for a user')
            .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a specific warning')
            .addUserOption(opt => opt.setName('user').setDescription('User to remove warn from').setRequired(true))
            .addIntegerOption(opt => opt.setName('id').setDescription('Warning ID to remove').setRequired(true).setMinValue(1)))

        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('Clear all warnings for a user')
            .addUserOption(opt => opt.setName('user').setDescription('User to clear warns for').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('config')
            .setDescription('Set max warnings before auto-ban')
            .addIntegerOption(opt => opt.setName('max').setDescription('Max warnings (1–5)').setRequired(true).setMinValue(1).setMaxValue(5))),

    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        
        // Check if moderation is enabled
        const { isModerationEnabled } = require('../../utils/serverSettings');
        if (!isModerationEnabled(interaction.guild.id)) {
            return interaction.reply({ 
                content: '❌ Moderation tools are disabled on this server. An administrator can enable them using `/settings`.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'add') {
            await interaction.deferReply();
            const target = interaction.options.getMember('user');
            const user   = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No reason provided';

            if (!target) return interaction.editReply({ content: 'User not found in this server.' });
            if (target.id === interaction.user.id) return interaction.editReply({ content: "You can't warn yourself." });
            if (target.user.bot) return interaction.editReply({ content: "You can't warn a bot." });

            const { warn, total, max } = addWarn(guildId, user.id, reason, interaction.user.id);

            const c = new ContainerBuilder().setAccentColor(0xFFD700);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## ⚠️ Warning Issued\n\n**User:** ${user.username}\n**Reason:** ${reason}\n**Warns:** ${total}/${max}\n**By:** ${interaction.user}`
            ));

            if (total >= max) {
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                try {
                    await target.send(`## 🔨 You have been banned\n\nYou have been **banned** from **${interaction.guild.name}** for reaching **${max}** warnings.\n\n-# If you believe this was a mistake, please contact the server moderators.`).catch(() => {});
                    await interaction.guild.members.ban(user.id, { reason: `Auto-ban: reached ${max} warnings` });
                    clearWarns(guildId, user.id);
                    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `## 🔨 Auto-Banned\n\n**${user.username}** has reached the maximum of **${max}** warnings and has been banned.`
                    ));
                } catch (err) {
                    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `## ❌ Auto-Ban Failed\n\n**${user.username}** reached **${max}** warns but I couldn't ban them: ${err.message}`
                    ));
                }
            }

            const logCh = await getLogChannel(interaction.guild, 'moderation');
            if (logCh) {
                const lc = new ContainerBuilder().setAccentColor(0xFFD700);
                lc.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## ⚠️ Warn\n\n**User:** ${user.username} (${user.id})\n**Reason:** ${reason}\n**Warns:** ${total}/${max}\n**Moderator:** ${interaction.user.username}\n\n-# <t:${Math.floor(Date.now() / 1000)}:R>`
                ));
                logCh.send({ components: [lc.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }

            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'list') {
            await interaction.deferReply();
            const user  = interaction.options.getUser('user');
            const warns = getWarns(guildId, user.id);
            const data  = loadModData(guildId);

            if (warns.length === 0) {
                const c = new ContainerBuilder().setAccentColor(0x57F287);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 📋 Warnings for ${user.username}\n\nNo warnings on record.`
                ));
                return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
            }

            const list = warns.map(w => {
                const date = new Date(w.timestamp).toLocaleDateString();
                return `**#${w.id}** — ${w.reason}\n> By <@${w.by}> on ${date}`;
            }).join('\n\n');

            const c = new ContainerBuilder().setAccentColor(0xFFD700);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 📋 Warnings for ${user.username}\n**${warns.length}/${data.maxWarns}** warnings`
            ));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(list));

            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'remove') {
            await interaction.deferReply();
            const user   = interaction.options.getUser('user');
            const warnId = interaction.options.getInteger('id');

            const removed = removeWarn(guildId, user.id, warnId);
            const color   = removed ? 0x57F287 : 0xEB4145;
            const text    = removed
                ? `## ✅ Warning Removed\n\nRemoved warning **#${warnId}** from **${user.username}**.`
                : `## ❌ Not Found\n\nNo warning with ID **#${warnId}** for **${user.username}**.`;

            const c = new ContainerBuilder().setAccentColor(color);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'clear') {
            await interaction.deferReply();
            const user    = interaction.options.getUser('user');
            const cleared = clearWarns(guildId, user.id);

            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 🗑️ Warnings Cleared\n\nCleared **${cleared}** warning(s) from **${user.username}**.`
            ));
            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'config') {
            await interaction.deferReply();
            const max = interaction.options.getInteger('max');
            setMaxWarns(guildId, max);

            const c = new ContainerBuilder().setAccentColor(0x63B3ED);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## ⚙️ Warning Config Updated\n\nMax warnings before auto-ban: **${max}**`
            ));
            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }
    },
};
