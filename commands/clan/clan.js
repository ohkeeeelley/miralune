const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getProfile } = require('../../utils/profileManager.js');
const { checkSupportServerMembership } = require('./utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Clans related commands')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a clan (cost: 50,000 bits + 250 bits)')
        .addStringOption(o =>
          o.setName('name')
            .setDescription('Clan name')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View your clan'))
    .addSubcommand(sub =>
      sub.setName('invite')
        .setDescription('Invite a user to your clan')
        .addUserOption(o =>
          o.setName('user')
            .setDescription('User to invite')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('accept')
        .setDescription('Accept a pending clan invite'))
    .addSubcommand(sub =>
      sub.setName('kick')
        .setDescription('Kick a clan member')
        .addUserOption(o =>
          o.setName('user')
            .setDescription('Member to kick')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('promote')
        .setDescription('Promote a clan member to CO')
        .addUserOption(o =>
          o.setName('user')
            .setDescription('Member to promote')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('demote')
        .setDescription('Demote a CO to member')
        .addUserOption(o =>
          o.setName('user')
            .setDescription('Member to demote')
            .setRequired(true))),

  async execute(interaction) {
    try {

      await interaction.reply({
        content: 'Sorry, clans are still being made, you did not get charged',
        flags: MessageFlags.Ephemeral
      });
      return;

      let sub = null;
      try { sub = interaction.options.getSubcommand(false); } catch (e) { sub = null; }

      const profile = getProfile(interaction.user.id);

      if (!await checkSupportServerMembership(interaction, profile)) {
        return;
      }

      if (!sub) {
        try {
          const handler = require(`./view.js`);
          await handler.execute(interaction, profile);
          return;
        } catch (err) {
          console.error('Error executing default clan view handler:', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
          }
          return;
        }
      }

      try {
        const handler = require(`./clan/${sub}.js`);
        await handler.execute(interaction, profile);
      } catch (err) {
        console.error(`Error executing clan ${sub} command:`, err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'An error occurred while processing your request.',
            flags: MessageFlags.Ephemeral
          });
        } else {
          await interaction.followUp({
            content: 'An error occurred while processing your request.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

    } catch (err) {
      console.error('Clan command error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred.',
          flags: MessageFlags.Ephemeral
        });
      } else {
        await interaction.followUp({
          content: 'An error occurred.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  }
};
