const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');
const { addBlacklist, removeBlacklist, loadModData } = require('../../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage the server blacklist')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)

        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Blacklist a user (bans and prevents rejoin)')
            .addUserOption(opt => opt.setName('user').setDescription('User to blacklist').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false)))

        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a user from the blacklist and unban them')
            .addStringOption(opt => opt.setName('userid').setDescription('User ID to remove').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('View all blacklisted users')),

    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'add') {
            await interaction.deferReply();
            const user   = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Blacklisted';

            if (user.id === interaction.user.id) return interaction.editReply({ content: "You can't blacklist yourself." });
            if (user.bot) return interaction.editReply({ content: "You can't blacklist a bot." });

            const added = addBlacklist(guildId, user.id);
            if (!added) return interaction.editReply({ content: `**${user.username}** is already blacklisted.` });

            try {
                await user.send(`## 🚫 You have been blacklisted\n\nYou have been **blacklisted** from **${interaction.guild.name}**.\n\n**Reason:** ${reason}\n\n-# You will be automatically banned if you attempt to rejoin this server.`).catch(() => {});
                await interaction.guild.members.ban(user.id, { reason: `Blacklisted: ${reason}` });
            } catch { /* may already be banned */ }

            const c = new ContainerBuilder().setAccentColor(0xFF0000);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 🚫 User Blacklisted\n\n**User:** ${user.username} (${user.id})\n**Reason:** ${reason}\n**By:** ${interaction.user}\n\n-# This user will be auto-banned if they try to rejoin.`
            ));
            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'remove') {
            await interaction.deferReply();
            const userId = interaction.options.getString('userid').trim();

            const removed = removeBlacklist(guildId, userId);
            if (!removed) {
                const c = new ContainerBuilder().setAccentColor(0xEB4145);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## ❌ Not Found\n\nUser ID **${userId}** is not blacklisted.`
                ));
                return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
            }

            try { await interaction.guild.members.unban(userId, 'Removed from blacklist'); } catch { /* may not be banned */ }

            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## ✅ Removed from Blacklist\n\nUser **${userId}** has been removed and unbanned.`
            ));
            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'list') {
            await interaction.deferReply();
            const data = loadModData(guildId);

            if (data.blacklist.length === 0) {
                const c = new ContainerBuilder().setAccentColor(0x57F287);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 📋 Blacklist\n\nNo users are blacklisted.`
                ));
                return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
            }

            const list = data.blacklist.map(id => `<@${id}>`).join(' · ');
            const c = new ContainerBuilder().setAccentColor(0xFF0000);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📋 Blacklist — ${data.blacklist.length} user(s)`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(list));
            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }
    },
};
