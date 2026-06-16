const { MessageFlags } = require('discord.js');
const ClansManager = require('../../model/ClansManager');
const { checkClanAccess } = require('./utils');
const { updateProfile, getProfile } = require('../../utils/profileManager');
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
    ClansManager.demoteMember(clan.id, target.id);
    const tp = getProfile(target.id);
    if (tp) {
      updateProfile(target.id, {
        ClanId: clan.id,
        ClanRole: 'member'
      });
    }

    await sendOrFallback(interaction, {
      content: `👥 ${target.tag} has been demoted to member.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (e) {
    await sendOrFallback(interaction, {
      content: `Could not demote member: ${e.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = { execute };
