const { EmbedBuilder, MessageFlags } = require('discord.js');
const { Colors } = require('../commands/clan/utils');
const ClansManager = require('../model/ClansManager');

async function handleClanTop10Button(interaction) {
  const top = ClansManager.getTopClans(10);
  const embed = new EmbedBuilder()
    .setTitle('🏆 Top 10 Clans')
    .setColor(Colors.PRIMARY)
    .setDescription(
      top.length ?
      top.map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${medal} **${c.name}**\n⠀⠀• Total Baked: \`${(c.total || 0).toLocaleString()}\`\n⠀⠀• Members: \`${c.members?.length || 0}\``;
      }).join('\n\n') :
      'No clans yet'
    )
    .setFooter({ text: 'Updated hourly' });

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}

async function handleClanAllTimeButton(interaction) {
  const topUsers = ClansManager.getTopAllTimeUsers(10);
  const embed = new EmbedBuilder()
    .setTitle('👑 Top All-Time Bakers')
    .setColor(Colors.PRIMARY)
    .setDescription(
      topUsers.length ?
      topUsers.map((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `${medal} <@${u.uid}>\n⠀⠀• All-Time Baked: \`${(u.total || 0).toLocaleString()}\``;
      }).join('\n\n') :
      'No data yet'
    )
    .setFooter({ text: 'Updated hourly' });

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral
  });
}

async function handleClanRefreshButton(interaction, clanId) {
  const clan = ClansManager.getClanById(clanId);
  if (!clan) {
    await interaction.reply({
      content: 'Could not find clan to refresh.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const embed = createClanEmbed(clan);

  const statsPanel = new EmbedBuilder()
    .setTitle('📊 Clan Statistics')
    .setColor(Colors.PRIMARY)
    .addFields(
      {
        name: 'Weekly Progress',
        value: `Total Baked This Week: \`${(clan.WeeklyBaked || 0).toLocaleString()}\`\nRank: \`#${clan.WeeklyRank || 'N/A'}\``,
        inline: true
      },
      {
        name: 'Monthly Progress',
        value: `Total Baked This Month: \`${(clan.MonthlyBaked || 0).toLocaleString()}\`\nRank: \`#${clan.MonthlyRank || 'N/A'}\``,
        inline: true
      }
    );

  await interaction.update({
    embeds: [makeClanMainEmbed(clan), statsPanel]
  });
}

function makeClanMainEmbed(clan) {
  const embed = new EmbedBuilder()
    .setTitle(`🏰 Clan — ${clan.name}`)
    .setDescription(`👑 Owner: <@${clan.ownerId}>`)
    .setColor(Colors.INFO)
    .addFields(
      { name: '👥 Members', value: `\`${clan.members.length}\``, inline: true },
      { name: '🎰 Total Clan Baked', value: `\`${(clan.TotalClanBaked || 0).toLocaleString()}\``, inline: true },
      { name: '📈 All Time Baked', value: `\`${(clan.AllTimeBaked || 0).toLocaleString()}\``, inline: true }
    );

  const memberLines = clan.members.map(m => {
    const p = require('../utils/profileManager').getProfile(m) || {};
    const baked = p.ClanMemberBaked || 0;
    const role = (clan.roles && clan.roles[m]) || 'member';
    const roleEmoji = role === 'owner' ? '👑' : role === 'co' ? '⭐' : '👤';
    return `${roleEmoji} <@${m}>\n⠀⠀• Baked: \`${baked.toLocaleString()}\`\n⠀⠀• Role: \`${role}\``;
  });

  if (memberLines.length) {
    embed.addFields({
      name: '👥 Members List',
      value: memberLines.join('\n').slice(0, 1024),
      inline: false
    });
  }

  return embed;
}

module.exports = {
  handleClanTop10Button,
  handleClanAllTimeButton,
  handleClanRefreshButton
};
