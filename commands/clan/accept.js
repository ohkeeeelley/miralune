const { MessageFlags, EmbedBuilder } = require('discord.js');
const ClansManager = require('../../model/ClansManager');
const { updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { Colors } = require('./utils');

async function execute(interaction, profile) {
  try {
    await interaction.deferReply().catch(() => {});
    await interaction.editReply({ content: '<a:loading:1488385574405406751> Accepting Invite...' }).catch(() => {});
  } catch (e) { }
  const pending = Array.from(ClansManager.pendingInvites.entries())
    .find(([, v]) => v.toUserId === interaction.user.id);

  if (!pending) {
    return await sendOrFallback(interaction, {
      content: '❌ No pending clan invites found.',
      flags: MessageFlags.Ephemeral
    });
  }

  const [key, inv] = pending;

  try {
    const clan = ClansManager.acceptInvite(key);
    updateProfile(interaction.user.id, {
      ClanId: clan.id,
      ClanRole: 'member'
    });

    const embed = new EmbedBuilder()
      .setTitle('🎉 Welcome to the Clan!')
      .setDescription(
        `You have joined **${clan.name}**!

Welcome aboard — we hope you bake and grow together.

You can view your clan and its stats with \`/clans\`.`
      )
      .setColor(Colors.SUCCESS)
      .addFields(
        { name: 'Owner', value: `<@${clan.ownerId}>`, inline: true },
        { name: 'Members', value: `${clan.members.length}`, inline: true },
        { name: 'Your Role', value: 'Member', inline: true }
      )
      .setFooter({ text: 'Use /clans to see your clan details and members.' });

    await sendOrFallback(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (e) {
    await sendOrFallback(interaction, {
      content: `Could not accept invite: ${e.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = { execute };
