const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    async execute(interaction) {
        if (interaction.user.id !== '853496137130835970') {
            return await interaction.reply({
                content: "You're not allowed to use this command...",
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('alertModal')
            .setTitle('Create Alert');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const firstRow = new ActionRowBuilder().addComponents(titleInput);
        const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
    }
};
