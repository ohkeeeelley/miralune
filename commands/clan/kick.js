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
  const clan = checkClanAccess(interaction, profile);
  if (!clan) return;

  const target = interaction.options.getUser('user');
  if (!target) {
    return await sendOrFallback(interaction, {
      content: 'User not found',
      flags: MessageFlags.Ephemeral
    });
  }

  const role = clan.roles && clan.roles[interaction.user.id];
  if (interaction.user.id !== clan.ownerId && role !== 'co') {
    return await sendOrFallback(interaction, {
      content: 'Only the owner or COs can kick members.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (target.id === clan.ownerId) {
    return await sendOrFallback(interaction, {
      content: 'You cannot kick the clan owner.',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    ClansManager.kickMember(clan.id, interaction.user.id, target.id);

    const tp = getProfile(target.id);
    if (tp) {
      tp.ClanId = null;
      tp.ClanRole = null;
      updateProfile(target.id, {
        ClanId: null,
        ClanRole: null
      });
    }

    await sendOrFallback(interaction, {
      content: `👢 ${target.tag} has been kicked from the clan.`
    });
  } catch (e) {
    await sendOrFallback(interaction, {
      content: `Could not kick member: ${e.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = { execute };
