const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const ClansManager = require('../../model/ClansManager');
const { checkClanAccess, createClanEmbed, Colors } = require('./utils');
const ClanUIRenderer = require('../../model/ClanUIRenderer');
const { sendOrFallback } = require('../../utils/safeReply');

async function execute(interaction, profile) {
  try {
    await interaction.deferReply().catch(() => {});
    await interaction.editReply({ content: '<a:loading:1488385574405406751> Loading Clan...' }).catch(() => {});
  } catch (e) { }
  let attachment;
  try {
    const clan = checkClanAccess(interaction, profile);
    if (!clan) return;
    const memberProfiles = await Promise.all(clan.members.map(async (userId) => {
      try {
        const member = await interaction.guild.members.fetch(userId);
        return {
          id: userId,
          displayName: member.displayName,
          avatarURL: member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) || member.user?.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }) || null,
          clanBaked: clan.memberContributions[userId] || 0,
          role: clan.roles[userId] || 'member'
        };
      } catch (e) {
        console.error('Error fetching member:', e);
        return null;
      }
    }));

    const validProfiles = memberProfiles
      .filter(p => p)
      .sort((a, b) => (b.clanBaked || 0) - (a.clanBaked || 0));

    const clanImage = await ClanUIRenderer.renderClanImage(clan, validProfiles);
    let attachment = null;
    if (clanImage) {
      attachment = new AttachmentBuilder(clanImage, { name: 'clan-view.png' });
    }
  const embed = createClanEmbed(clan)
    .setImage('attachment://clan-view.png');

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('clans_top10')
      .setLabel('Top 10 Clans')
      .setEmoji('🏆')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`clan_refresh_${clan.id}`)
      .setLabel('Refresh')
      .setEmoji('🔄')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    const payload = { embeds: [embed], components: [actionRow] };
    if (attachment) payload.files = [attachment];
    await sendOrFallback(interaction, payload);
  } catch (e) {
    console.error('Failed to send clan view reply via safeReply:', e);
  }
  } catch (error) {
    console.error('Error in clan view command:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred while processing your request.',
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.editReply({
        content: 'An error occurred while processing your request.',
        embeds: [],
        components: [],
        files: []
      });
    }
  }
}

module.exports = { execute };
