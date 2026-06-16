const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { getProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create your profile'),
  modal: true,

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) {
      await sendOrFallback(interaction, { content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const userId = interaction.user.id;
    const profile = getProfile(userId);
    if (profile) {
      await sendOrFallback(interaction, { content: "You already have a profile! Use /profile to view it.", flags: MessageFlags.Ephemeral });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('create_profile')
      .setTitle('Create your Profile');

    const egNameInput = new TextInputBuilder()
      .setCustomId('eg_name')
      .setLabel('Choose your EG Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Twilight Sparkle')
      .setRequired(true)
      .setMaxLength(32);

    const bakeryNameInput = new TextInputBuilder()
      .setCustomId('bakery_name')
      .setLabel('Give your bakery a name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('My Amazing Bakery')
      .setRequired(true)
      .setMaxLength(32);

    const ageInput = new TextInputBuilder()
      .setCustomId('eg_age')
      .setLabel('EG Age')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Choose your age')
      .setRequired(true)
      .setMaxLength(32);

    const descInput = new TextInputBuilder()
      .setCustomId('eg_description')
      .setLabel('EG Description')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('A short description about your Equestria Girls character')
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(egNameInput),
      new ActionRowBuilder().addComponents(bakeryNameInput),
      new ActionRowBuilder().addComponents(ageInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    try {
      await interaction.showModal(modal);
    } catch (err) {
      console.error('Failed to show modal', err);

      await sendOrFallback(interaction, { content: 'Could not open the profile modal. Try again later.', flags: MessageFlags.Ephemeral });
    }
  }
};
