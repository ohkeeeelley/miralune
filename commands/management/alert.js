const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const alertsPath = path.join(__dirname, '../../data/alert/alerts.json');
const alertsDir = path.dirname(alertsPath);

if (!fs.existsSync(alertsDir)) {
    fs.mkdirSync(alertsDir, { recursive: true });
}

if (!fs.existsSync(alertsPath)) {
    fs.writeFileSync(alertsPath, JSON.stringify({
        currentAlert: null,
        readBy: [],
        history: []
    }));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alert')
        .setDescription('Alert system commands')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create an alert message for all users (Admin only)'))
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current alert'))
        .addSubcommand(sub =>
            sub.setName('myhistory')
                .setDescription('View your personal letter history')),

    modal: true,

    async execute(interaction) {
        let sub = null;
        try { sub = interaction.options.getSubcommand(false); } catch (e) { sub = null; }

        if (sub !== 'create') {
            try {
                await interaction.deferReply({ ephemeral: true }).catch(() => {});
            } catch (e) { }
        }

        if (!sub) {
            try {
                const handler = require(`./alert/view.js`);
                await handler.execute(interaction);
                return;
            } catch (err) {
                console.error('Error executing default alert view handler:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
                }
                return;
            }
        }

        try {
            const handler = require(`./alert/${sub}.js`);
            await handler.execute(interaction);
        } catch (err) {
            console.error(`Error executing alert/${sub} handler:`, err);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
            }
        }
    }
};
