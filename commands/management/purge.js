const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete messages from a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(opt => opt
            .setName('amount')
            .setDescription('Number of messages to delete (1–500)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(500)),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
        }
        
        // Check if moderation is enabled
        const { isModerationEnabled } = require('../../utils/serverSettings');
        if (!isModerationEnabled(interaction.guild.id)) {
            return interaction.reply({ 
                content: '\u274c Moderation tools are disabled on this server. An administrator can enable them using `/settings`.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const amount  = interaction.options.getInteger('amount');
        const channel = interaction.channel;
        let deleted   = 0;
        let remaining = amount;

        await interaction.editReply({ content: `<a:loading:1488385574405406751> Deleting Messages...` });

        while (remaining > 0) {
            const batch = Math.min(remaining, 100);

            const messages = await channel.messages.fetch({ limit: batch });
            if (messages.size === 0) break;

            const now       = Date.now();
            const twoWeeks  = 14 * 24 * 60 * 60 * 1000;
            const recent    = messages.filter(m => now - m.createdTimestamp < twoWeeks);
            const old       = messages.filter(m => now - m.createdTimestamp >= twoWeeks);

            if (recent.size > 0) {
                try {
                    const result = await channel.bulkDelete(recent, true);
                    deleted += result.size;
                } catch {

                    for (const msg of recent.values()) {
                        try { await msg.delete(); deleted++; } catch { /* skip undeletable */ }
                    }
                }
            }

            for (const msg of old.values()) {
                try { await msg.delete(); deleted++; } catch { /* skip undeletable */ }
            }

            remaining -= messages.size;

            if (messages.size < batch) break;
        }

        const container = new ContainerBuilder().setAccentColor(0x57F287);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 🧹 Purge Complete\n\nDeleted **${deleted}** message${deleted !== 1 ? 's' : ''} from ${channel}.`
        ));

        await interaction.editReply({ content: '', components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    },
};
