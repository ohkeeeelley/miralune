const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendOrFallback } = require('../../../utils/safeReply');

module.exports = {
    async execute(interaction) {
        try {
            const alertsPath = path.join(__dirname, '../../../data/alert/alerts.json');

            if (!fs.existsSync(alertsPath)) {
                return await sendOrFallback(interaction, {
                    content: 'No alerts have been created yet.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));

            if (!alerts.currentAlert) {
                return await sendOrFallback(interaction, {
                    content: 'No alerts are currently active.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const alert = alerts.currentAlert;
            const date = new Date(alert.timestamp);
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
                new TextDisplayBuilder().setContent(`-# Posted ${timestamp}`)
            );

            return await sendOrFallback(interaction, {
                components: [container],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        } catch (err) {
            console.error('Error viewing alert:', err);
            return await sendOrFallback(interaction, {
                content: 'An error occurred while viewing the alert.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
