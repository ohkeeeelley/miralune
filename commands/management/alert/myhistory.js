const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendOrFallback } = require('../../../utils/safeReply');

function buildMyHistoryPage(alerts, page) {
    const totalPages = alerts.length;
    if (page < 1 || page > totalPages || totalPages === 0) {
        return null;
    }

    const alertIndex = totalPages - page;
    const alert = alerts[alertIndex];
    const postedTimestamp = `<t:${Math.floor(alert.timestamp / 1000)}:R>`;
    const readTimestamp = alert.readAt ? `<t:${Math.floor(alert.readAt / 1000)}:R>` : 'Unknown';

    const container = new ContainerBuilder().setAccentColor(0xFFD700);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 📬 ${alert.title}`)
    );
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(alert.description)
    );
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Alert ${page} of ${totalPages} • Posted ${postedTimestamp} • Read ${readTimestamp}`)
    );

    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`my_alert_prev:${page}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId(`my_alert_next:${page}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages)
        );

    return { container, buttons };
}

module.exports = {
    async execute(interaction) {
        try {
            const historyPath = path.join(__dirname, '../../../data/alert/alerthistory.json');

            if (!fs.existsSync(historyPath)) {
                return await sendOrFallback(interaction, {
                    content: 'You haven\'t opened any letters yet.',
                    flags: MessageFlags.Ephemeral
                });
            }

            let userHistory = {};
            try { userHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch { userHistory = {}; }

            const alerts = userHistory[interaction.user.id] || [];

            if (alerts.length === 0) {
                return await sendOrFallback(interaction, {
                    content: 'You haven\'t opened any letters yet. When you receive a letter, click **Open** to save it here!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const page = 1;
            const result = buildMyHistoryPage(alerts, page);

            if (!result) {
                return await sendOrFallback(interaction, {
                    content: 'Error loading your alert history.',
                    flags: MessageFlags.Ephemeral
                });
            }

            return await sendOrFallback(interaction, {
                components: [result.container, result.buttons],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        } catch (err) {
            console.error('Error viewing user alert history:', err);
            return await sendOrFallback(interaction, {
                content: 'An error occurred while viewing your alert history.',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    buildMyHistoryPage
};
