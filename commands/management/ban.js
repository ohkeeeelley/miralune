const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');
const { getLogChannel } = require('../../utils/logsManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ban').setRequired(false))
        .addIntegerOption(opt => opt.setName('days').setDescription('Days of messages to delete (0–7)').setMinValue(0).setMaxValue(7).setRequired(false)),

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
        
        await interaction.deferReply();

        const target = interaction.options.getMember('user');
        const user   = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const days   = interaction.options.getInteger('days') ?? 0;

        if (target) {
            if (!target.bannable) {
                return interaction.editReply({ content: "I can't ban this user. They may have a higher role than me.", flags: MessageFlags.Ephemeral });
            }
            if (target.id === interaction.user.id) {
                return interaction.editReply({ content: "You can't ban yourself.", flags: MessageFlags.Ephemeral });
            }
        }

        try {
            // Try to DM the user before banning
            try {
                await user.send(`## 🔨 You have been banned\n\nYou have been **banned** from **${interaction.guild.name}**.\n\n**Reason:** ${reason}\n\n-# If you believe this was a mistake, please contact the server moderators.`).catch(() => {});
            } catch (dmErr) {
                // User has DMs disabled or blocked the bot
            }
            
            await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds: days * 86400 });

            const c = new ContainerBuilder().setAccentColor(0xFF0000);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 🔨 Member Banned\n\n**User:** ${user.username}\n**Reason:** ${reason}\n**Messages Deleted:** ${days} day(s)\n**By:** ${interaction.user}`
            ));

            const logCh = await getLogChannel(interaction.guild, 'moderation');
            if (logCh) {
                const lc = new ContainerBuilder().setAccentColor(0xFF0000);
                lc.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 🔨 Ban\n\n**User:** ${user.username} (${user.id})\n**Reason:** ${reason}\n**Messages Deleted:** ${days} day(s)\n**Moderator:** ${interaction.user.username}\n\n-# <t:${Math.floor(Date.now() / 1000)}:R>`
                ));
                logCh.send({ components: [lc.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }

            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            return interaction.editReply({ content: `Failed to ban: ${err.message}` });
        }
    },
};
