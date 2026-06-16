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
        .setName('kick')
        .setDescription('Kick a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the kick').setRequired(false)),

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
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) {
            return interaction.editReply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
        }
        if (!target.kickable) {
            return interaction.editReply({ content: "I can't kick this user. They may have a higher role than me.", flags: MessageFlags.Ephemeral });
        }
        if (target.id === interaction.user.id) {
            return interaction.editReply({ content: "You can't kick yourself.", flags: MessageFlags.Ephemeral });
        }

        try {
            // Try to DM the user before kicking
            try {
                await target.send(`## 👢 You have been kicked\n\nYou have been **kicked** from **${interaction.guild.name}**.\n\n**Reason:** ${reason}\n\n-# You can rejoin the server if you have an invite link.`).catch(() => {});
            } catch (dmErr) {
                // User has DMs disabled or blocked the bot
            }
            
            await target.kick(reason);

            const c = new ContainerBuilder().setAccentColor(0xFFA500);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 👢 Member Kicked\n\n**User:** ${target.user.username}\n**Reason:** ${reason}\n**By:** ${interaction.user}`
            ));

            const logCh = await getLogChannel(interaction.guild, 'moderation');
            if (logCh) {
                const lc = new ContainerBuilder().setAccentColor(0xFFA500);
                lc.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 👢 Kick\n\n**User:** ${target.user.username} (${target.user.id})\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.username}\n\n-# <t:${Math.floor(Date.now() / 1000)}:R>`
                ));
                logCh.send({ components: [lc.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }

            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            return interaction.editReply({ content: `Failed to kick: ${err.message}` });
        }
    },
};
