const { MessageFlags, EmbedBuilder } = require('discord.js');
const ClansManager = require('../../model/ClansManager');
const { checkClanAccess } = require('./utils');
const { updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');

async function execute(interaction, profile) {
  try {
    await interaction.deferReply().catch(() => {});
    await interaction.editReply({ content: '<a:loading:1488385574405406751> Loading Clan...' }).catch(() => {});
  } catch (e) { }
  const clan = checkClanAccess(interaction, profile, true);
  if (!clan) return;

  const target = interaction.options.getUser('user');
  if (!target) {
    return await sendOrFallback(interaction, {
      content: 'User not found',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    ClansManager.promoteMember(clan.id, target.id);
    try {
      updateProfile(target.id, {
        ClanId: clan.id,
        ClanRole: 'co'
      });
    } catch (e) {
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Member Promoted')
      .setDescription(`${target.tag} has been promoted to Co-Owner (CO) in **${clan.name}**.`)
      .addFields(
        { name: 'Promoted By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'New Role', value: 'CO', inline: true }
      )
      .setColor(0x00FF00);

    await sendOrFallback(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (e) {
    await sendOrFallback(interaction, {
      content: `Could not promote member: ${e.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = { execute };
