const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendOrFallback } = require('../../../utils/safeReply');

function buildHistoryPage(history, page) {
    const totalPages = history.length;
    if (page < 1 || page > totalPages || totalPages === 0) {
        return null;
    }

    const alertIndex = totalPages - page;
    const alert = history[alertIndex];
    const timestamp = `<t:${Math.floor(alert.timestamp / 1000)}:R>`;

    const container = new ContainerBuilder().setAccentColor(0xFF6B00);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 📜 ${alert.title}`)
    );
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(alert.description)
    );
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Alert ${page} of ${totalPages} • Posted ${timestamp}`)
    );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`alert_history_prev:${page}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId('alert_history_goto_page')
                .setLabel('Go To Page')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`alert_history_next:${page}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages)
        );

    return { container, buttons };
}

module.exports = {
    async execute(interaction) {
        try {
            const alertsPath = path.join(__dirname, '../../../data/alert/alerts.json');

            if (!fs.existsSync(alertsPath)) {
                return await sendOrFallback(interaction, {
                    content: 'No alert history found.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));
            const history = alerts.history || [];

            if (history.length === 0) {
                return await sendOrFallback(interaction, {
                    content: 'No alert history found.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const page = 1;
            const result = buildHistoryPage(history, page);

            if (!result) {
                return await sendOrFallback(interaction, {
                    content: 'Error loading alert history.',
                    flags: MessageFlags.Ephemeral
                });
            }

            return await sendOrFallback(interaction, {
                components: [result.container, result.buttons],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        } catch (err) {
            console.error('Error viewing alert history:', err);
            return await sendOrFallback(interaction, {
                content: 'An error occurred while viewing the alert history.',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    buildHistoryPage
};
