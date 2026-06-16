const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildBakeryEmbed, loadBakeries } = require('./_bakeryUtils');
const { getProfile } = require('../../utils/profileManager');
const { sendOrFallback, MessageFlags } = require('../../utils/safeReply');
const { updateBakeryProduction } = require('../../utils/bakeryProduction');
const { sendNoProfile } = require('../../utils/noProfileResponse');

module.exports = {
  data: new SlashCommandBuilder().setName('bakery').setDescription('Show your bakery stats'),
  async execute(interaction) {
    if (!interaction.guild) return await sendOrFallback(interaction, { content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    try {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* */ }
      await interaction.editReply({ content: '<a:loading:1488385574405406751> Loading Bakery...' }).catch(() => {});
      updateBakeryProduction(userId, interaction.client, false);
      const profile = getProfile(userId);
      if (!profile) return await sendNoProfile(interaction);
      if (!profile.balances) profile.balances = { bits: 0, harmony: 0, diamonds: 0, crates: 0, keys: 0, loyalty: 0 };
      const bakeriesMeta = loadBakeries();
      const result = await buildBakeryEmbed(profile, bakeriesMeta, interaction, { omitViewButton: true });
      if (!result) return await sendOrFallback(interaction, { content: 'An error occurred while showing your bakery.', flags: MessageFlags.Ephemeral });

      const files = result.files || [];
      try {
        if (result.v2Containers && result.v2Containers.length > 0) {

          const v2Payload = {
            files,
            components: result.v2Containers.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c),
            flags: MessageFlags.IsComponentsV2
          };
          if (interaction.deferred && !interaction.replied) {
            await interaction.editReply(v2Payload);
          } else {
            await sendOrFallback(interaction, v2Payload);
          }
        } else {

          const legacyPayload = {
            files,
            embeds: result.embed ? [result.embed] : []
          };
          if (interaction.deferred && !interaction.replied) {
            await interaction.editReply(legacyPayload);
          } else {
            await sendOrFallback(interaction, legacyPayload);
          }
        }
      } catch (e) {
        console.error('Failed to send /bakery response, falling back:', e);

        await sendOrFallback(interaction, {
          files,
          embeds: result.embed ? [result.embed] : []
        });
      }

    } catch (err) {
      console.error('bakery command error', err);
      await sendOrFallback(interaction, { content: 'An error occurred while showing your bakery.', flags: MessageFlags.Ephemeral });
    }
  }
};
