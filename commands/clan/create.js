const { MessageFlags, EmbedBuilder } = require('discord.js');
const ClansManager = require('../../model/ClansManager');
const { updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { Colors } = require('./utils');
const { sendNoProfile } = require('../../utils/noProfileResponse');

async function execute(interaction, profile) {
  try {
    await interaction.deferReply().catch(() => {});
    await interaction.editReply({ content: '<a:loading:1488385574405406751> Creating Clan...' }).catch(() => {});
  } catch (e) { }
  if (!profile) {
    return await sendNoProfile(interaction);
  }

  const name = interaction.options.getString('name');
  const cost = 50000;
  const fee = 250;
  const totalCost = cost + fee;

  if ((profile.balances?.bits || 0) < totalCost) {
    return await sendOrFallback(interaction, {
      content: `You need ${totalCost.toLocaleString()} bits to create a clan (${cost.toLocaleString()} + ${fee} bits fee).`,
      flags: MessageFlags.Ephemeral
    });
  }

  if (profile.ClanId) {
    return await sendOrFallback(interaction, {
      content: 'You are already in a clan and cannot create one.',
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    const clan = ClansManager.createClan(interaction.user.id, name);
    profile.balances.bits = (profile.balances.bits || 0) - totalCost;
    profile.ClanId = clan.id;
    profile.ClanRole = 'owner';

    updateProfile(interaction.user.id, {
      balances: profile.balances,
      ClanId: clan.id,
      ClanRole: 'owner'
    });

    const embed = new EmbedBuilder()
      .setTitle('🏰 Clan Created')
      .setDescription(
        `You have successfully created **${clan.name}** — welcome to your clan!

Next steps:
• Use \`/clans\` to view and manage your clans.
• Use \`/clans invite\` to invite members (or send invites via DM).
• Use \`/clans promote\` to promote trusted members to COs.`
      )
      .setColor(Colors.SUCCESS)
      .addFields(
        { name: 'Owner', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Cost', value: `${totalCost.toLocaleString()} bits`, inline: true }
      )
      .setFooter({ text: 'Tip: Use /clans to view and manage your clan.' });

    await sendOrFallback(interaction, { embeds: [embed] });
  } catch (e) {
    return await sendOrFallback(interaction, {
      content: `Could not create clan: ${e.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = { execute };
