const { SlashCommandBuilder, AttachmentBuilder, StringSelectMenuBuilder, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const { getAllProfiles } = require('../../utils/profileManager');
const LeaderboardRenderer = require('../../model/LeaderboardRenderer');
const fs = require('fs');
const path = require('path');

const CATEGORIES = {
  richest_bits: {
    label: '💰 Top 10 Richest (Bits)',
    title: 'Top 10 Richest (Bits)',
    getValue: (p) => (p.wallet?.bits || 0) + (p.wallet?.bank?.bits || 0),
    format: (v) => v.toLocaleString() + ' Bits'
  },
  highest_level: {
    label: '⭐ Top 10 Highest Level',
    title: 'Top 10 Highest Level',
    getValue: (p) => p.bakery?.level || 1,
    format: (v) => 'Level ' + v
  },
  all_time: {
    label: '🏆 All Time Top 10',
    title: 'All Time Top 10 (Bits Earned)',
    getValue: null,
    format: (v) => v.toLocaleString() + ' Bits'
  },
  ponies_collected: {
    label: '🦄 Top 10 Ponies Collected',
    title: 'Top 10 Ponies Collected',
    getValue: (p) => (p.global?.collection || []).length,
    format: (v) => v + ' Ponies'
  },
  bakeries_sold: {
    label: '🧁 Top 10 Bakeries Sold',
    title: 'Top 10 Bakeries Sold',
    getValue: (p) => p.stats?.allTimeSold || 0,
    format: (v) => v.toLocaleString() + ' Sold'
  },
  best_streak: {
    label: '🔥 Top 10 Best Streak',
    title: 'Top 10 Best Streak',
    getValue: (p) => p.stats?.beststreak || 0,
    format: (v) => v + ' Days'
  }
};

async function buildLeaderboard(category, client) {
  const cat = CATEGORIES[category];
  if (!cat) return null;

  let ranked;

  if (category === 'all_time') {
    const lbPath = path.join(__dirname, '../../data/allTimeLeaderboard.json');
    let lbData = {};
    try { lbData = JSON.parse(fs.readFileSync(lbPath, 'utf8')); } catch { }
    ranked = Object.entries(lbData)
      .map(([uid, val]) => ({ uid, value: val }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  } else {
    const profiles = getAllProfiles();
    ranked = Object.entries(profiles)
      .map(([uid, p]) => ({ uid, value: cat.getValue(p) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  const entries = [];
  for (const r of ranked) {
    let username = 'Unknown User';
    try {
      const user = await client.users.fetch(r.uid).catch(() => null);
      if (user) username = user.username;
    } catch { }
    entries.push({
      rank: entries.length + 1,
      username,
      value: cat.format(r.value)
    });
  }

  const buf = await LeaderboardRenderer.generateLeaderboardImage(cat.title, entries);
  return buf;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the Top 10 leaderboards'),

  async execute(interaction) {
    await interaction.reply({
      content: '<a:loading:1488385574405406751> Loading Leaderboard...',
      ephemeral: false
    });

    try {
      const defaultCategory = 'richest_bits';
      const buf = await buildLeaderboard(defaultCategory, interaction.client);
      const attachment = new AttachmentBuilder(buf, { name: 'leaderboard.png' });

      const container = new ContainerBuilder();

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('**🏆 Leaderboard**')
      );
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

      const gallery = new MediaGalleryBuilder();
      gallery.addItems(new MediaGalleryItemBuilder().setURL('attachment://leaderboard.png'));
      container.addMediaGalleryComponents(gallery);

      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

      const select = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_select')
        .setPlaceholder('Select a category')
        .addOptions(
          Object.entries(CATEGORIES).map(([value, cat]) => ({
            label: cat.label,
            value,
            default: value === defaultCategory
          }))
        );

      container.addActionRowComponents(ar => ar.setComponents(select));

      await interaction.editReply({
        content: '',
        files: [attachment],
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      console.error('Leaderboard render failed:', err);
      try {
        await interaction.editReply({ content: 'Failed to load leaderboard. Please try again later.', components: [] });
      } catch { }
    }
  },

  CATEGORIES,
  buildLeaderboard
};
