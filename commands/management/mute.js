const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');
const { getLogChannel } = require('../../utils/logsManager');

const DURATIONS = {
    '1m':  60_000,
    '5m':  300_000,
    '10m': 600_000,
    '30m': 1_800_000,
    '1h':  3_600_000,
    '6h':  21_600_000,
    '12h': 43_200_000,
    '1d':  86_400_000,
    '3d':  259_200_000,
    '7d':  604_800_000,
    '14d': 1_209_600_000,
    '28d': 2_419_200_000,
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
        .addStringOption(opt => opt
            .setName('duration')
            .setDescription('How long to mute')
            .setRequired(true)
            .addChoices(
                { name: '1 minute',  value: '1m' },
                { name: '5 minutes', value: '5m' },
                { name: '10 minutes', value: '10m' },
                { name: '30 minutes', value: '30m' },
                { name: '1 hour',    value: '1h' },
                { name: '6 hours',   value: '6h' },
                { name: '12 hours',  value: '12h' },
                { name: '1 day',     value: '1d' },
                { name: '3 days',    value: '3d' },
                { name: '7 days',    value: '7d' },
                { name: '14 days',   value: '14d' },
                { name: '28 days',   value: '28d' },
            ))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for the mute').setRequired(false)),

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

        const target   = interaction.options.getMember('user');
        const duration = interaction.options.getString('duration');
        const reason   = interaction.options.getString('reason') || 'No reason provided';
        const ms       = DURATIONS[duration];

        if (!target) {
            return interaction.editReply({ content: 'User not found in this server.', flags: MessageFlags.Ephemeral });
        }
        if (!target.moderatable) {
            return interaction.editReply({ content: "I can't mute this user. They may have a higher role than me.", flags: MessageFlags.Ephemeral });
        }
        if (target.id === interaction.user.id) {
            return interaction.editReply({ content: "You can't mute yourself.", flags: MessageFlags.Ephemeral });
        }

        try {
            const label = Object.entries(DURATIONS).find(([, v]) => v === ms)?.[0] || duration;
            
            // Try to DM the user before muting
            try {
                await target.send(`## 🔇 You have been muted\n\nYou have been **muted** in **${interaction.guild.name}** for **${label}**.\n\n**Reason:** ${reason}\n\n-# You will not be able to send messages until the timeout expires.`).catch(() => {});
            } catch (dmErr) {
                // User has DMs disabled or blocked the bot
            }
            
            await target.timeout(ms, reason);

            const c = new ContainerBuilder().setAccentColor(0xFFA500);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 🔇 Member Muted\n\n**User:** ${target.user.username}\n**Duration:** ${label}\n**Reason:** ${reason}\n**By:** ${interaction.user}`
            ));

            const logCh = await getLogChannel(interaction.guild, 'moderation');
            if (logCh) {
                const lc = new ContainerBuilder().setAccentColor(0xFFA500);
                lc.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 🔇 Mute\n\n**User:** ${target.user.username} (${target.user.id})\n**Duration:** ${label}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.username}\n\n-# <t:${Math.floor(Date.now() / 1000)}:R>`
                ));
                logCh.send({ components: [lc.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }

            return interaction.editReply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            return interaction.editReply({ content: `Failed to mute: ${err.message}` });
        }
    },
};
