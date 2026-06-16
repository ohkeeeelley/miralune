const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MediaGalleryBuilder, MediaGalleryItemBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const emojiRarity = require('../../model/EmojiRarity');
const allPonies = require('../../model/MyLittlePonies');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback, MessageFlags } = require('../../utils/safeReply');
const { sendNoProfile } = require('../../utils/noProfileResponse');
const { describePonyBakeryBonus } = require('../../utils/ponyProgressionManager');

const TOTAL_PONIES = allPonies.length;
const PAGE_SIZE = 15;

function rarityEmoji(rarity) {
  if (!rarity) return '⭐';
  const normalized = String(rarity).charAt(0).toUpperCase() + String(rarity).slice(1).toLowerCase();
  const entry = emojiRarity[normalized];
  if (!entry) return '⭐';
  if (Array.isArray(entry)) return entry.join('') || '⭐';
  return String(entry) || '⭐';
}
function capitalize(s) { if (!s) return s; return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

function categorySortOrder(item) {
  if (item?.category === 'Pony') return 0;
  if (item?.category === 'Equestria Girls') return 1;
  return 2;
}

function sortCollectionItems(items, sortById = false) {
  return items.sort((a, b) => {
    const categoryDiff = categorySortOrder(a) - categorySortOrder(b);
    if (categoryDiff !== 0) return categoryDiff;

    if (sortById) return (a.id || 0) - (b.id || 0);
    return 0;
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collections')
    .setDescription('View your Equestria Girls collection'),

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;
    try {
      await interaction.deferReply();
      await interaction.editReply({ content: '<a:loading:1488385574405406751> Loading Collection...' }).catch(() => {});
    } catch (e) { }
    const userId = interaction.user.id;
    const profile = getProfile(userId);
    if (!profile) {
      return sendNoProfile(interaction);
    }

    const ownedCollection = Array.isArray(profile.collection) ? profile.collection.slice() : [];
    const deduped = [];
    const seen = new Set();
    for (const c of ownedCollection) {
      if (!c || typeof c.id === 'undefined') continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      deduped.push(c);
    }
    const ownedIds = new Set(deduped.map(c => c.id));

    const befriended = Array.isArray(profile.befriendedPonies) ? profile.befriendedPonies : [];
    if (!Array.isArray(profile.favs)) profile.favs = [];

    let page = 0;
    let rarityFilter = 'All';
    let familyFilter = 'all_families';
    let categoryFilter = 'all_categories';
    let sortById = false;
    let showFavoritesOnly = false;
    let viewMode = 'grid';
    let detailIndex = 0;
    let searchQuery = '';

    function getFiltered() {

      let items = allPonies.slice();

      if (rarityFilter === 'owned') {
        items = items.filter(p => ownedIds.has(p.id));
      } else if (rarityFilter === 'missing') {
        items = items.filter(p => !ownedIds.has(p.id));
      } else if (rarityFilter !== 'All') {
        items = items.filter(i => String(i.rarity || '').toLowerCase() === rarityFilter.toLowerCase());
      }

      if (categoryFilter === 'equestria_girls') {
        items = items.filter(i => i.category === 'Equestria Girls');
      } else if (categoryFilter === 'pony') {
        items = items.filter(i => i.category === 'Pony');
      }

      if (familyFilter !== 'all_families') {
        items = items.filter(i => i.family && i.family.toLowerCase() === familyFilter.toLowerCase());
      }

      if (showFavoritesOnly) items = items.filter(i => profile.favs.includes(i.id));
      return sortCollectionItems(items, sortById);
    }

    function getSearchResults() {
      if (!searchQuery) return [];
      const q = searchQuery.toLowerCase();
      const matched = allPonies.filter(i => i.name && i.name.toLowerCase().includes(q));
      return sortCollectionItems(matched, sortById);
    }

    function getRecentlyAdded() {
      const withTime = befriended.filter(b => b.befriendedAt).sort((a, b) => new Date(b.befriendedAt) - new Date(a.befriendedAt));
      const recentIds = new Set();
      const recent = [];
      for (const b of withTime) {
        if (recentIds.has(b.id)) continue;
        recentIds.add(b.id);
        recent.push(b);
        if (recent.length >= 30) break;
      }
      return recent;
    }

    /* ── Grid View ── */
    function buildGridView() {
      const filtered = getFiltered();
      const total = filtered.length;
      const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
      if (page > maxPage) page = maxPage;
      const start = page * PAGE_SIZE;
      const pageItems = filtered.slice(start, start + PAGE_SIZE);

      const container = new ContainerBuilder().setAccentColor(0xAA55DD);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 🦄 Friendship Collection\n**${deduped.length}**/${TOTAL_PONIES} ponies owned`
      ));
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      if (pageItems.length === 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No ponies found for the current filter.'));
      } else {
        const lines = pageItems.map(i => {
          const rarity = capitalize(i.rarity || 'Unknown');
          const emoji = rarityEmoji(rarity);
          const owned = ownedIds.has(i.id) ? '<:checkmark1:1490897821044576266>' : '🔒';
          const fav = profile.favs.includes(i.id) ? ' ❤️' : '';
          return `${emoji} ${owned} ${i.name}${fav}`;
        }).join('\n');
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
      }

      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*Page ${page + 1}/${maxPage + 1} · ${total} ponies*`));

      const rarityOptions = [
        { label: 'All Ponies', value: 'All', description: 'Show all ponies' },
        { label: 'Owned Ponies', value: 'owned', description: 'Ponies you have' },
        { label: 'Missing Ponies', value: 'missing', description: 'Ponies you need' },
        { label: 'Common', value: 'Common' }, { label: 'Rare', value: 'Rare' },
        { label: 'Epic', value: 'Epic' }, { label: 'Majestic', value: 'Majestic' },
        { label: 'Legend', value: 'Legend' }, { label: 'Goddess', value: 'Goddess' },
        { label: 'Secret', value: 'Secret' }, { label: 'Radiance', value: 'Radiance' }
      ].map(o => ({ ...o, default: o.value === rarityFilter }));
      const rarityPlaceholder = rarityOptions.find(o => o.default)?.label || 'Filter by Rarity...';
      const raritySelect = new StringSelectMenuBuilder()
        .setCustomId('col:filter_rarity')
        .setPlaceholder(rarityPlaceholder)
        .addOptions(rarityOptions);
      container.addActionRowComponents(ar => ar.addComponents(raritySelect));

      const familySet = new Set();
      for (const p of allPonies) { if (p.family) familySet.add(p.family); }
      const familyOptions = [{ label: 'All Families', value: 'all_families', description: 'Show all families' }];
      for (const fam of [...familySet].sort()) {
        if (familyOptions.length >= 25) break;
        familyOptions.push({ label: fam, value: fam.toLowerCase() });
      }
      const familyOptionsWithDefault = familyOptions.map(o => ({ ...o, default: o.value === familyFilter }));
      const familyPlaceholder = familyOptionsWithDefault.find(o => o.default)?.label || 'Filter by Family...';
      const familySelect = new StringSelectMenuBuilder()
        .setCustomId('col:filter_family')
        .setPlaceholder(familyPlaceholder)
        .addOptions(familyOptionsWithDefault);
      container.addActionRowComponents(ar => ar.addComponents(familySelect));

      const categoryOptions = [
        { label: 'All Categories', value: 'all_categories', description: 'Show all characters' },
        { label: 'Equestria Girls', value: 'equestria_girls', description: 'Equestria Girls characters' },
        { label: 'Ponies', value: 'pony', description: 'Pony characters' }
      ].map(o => ({ ...o, default: o.value === categoryFilter }));
      const categoryPlaceholder = categoryOptions.find(o => o.default)?.label || 'Filter by Category...';
      const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('col:filter_category')
        .setPlaceholder(categoryPlaceholder)
        .addOptions(categoryOptions);
      container.addActionRowComponents(ar => ar.addComponents(categorySelect));

      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('col:first').setLabel('≪').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('col:prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('col:detailed').setLabel('🔍 Detailed View').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('col:next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage),
        new ButtonBuilder().setCustomId('col:last').setLabel('≫').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage)
      ));

      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('col:search').setLabel('🔎 Search').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('col:recent').setLabel('🆕 Recently Added').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('col:rarity_info').setLabel('📊 Rarity Info').setStyle(ButtonStyle.Secondary)
      ));

      return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
    }

    /* ── Detail View ── */
    function buildDetailView(items, label) {
      if (!items || items.length === 0) {
        const container = new ContainerBuilder().setAccentColor(0xAA55DD);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🦄 No ponies to display'));
        container.addActionRowComponents(ar => ar.setComponents(
          new ButtonBuilder().setCustomId('col:backgrid').setLabel('📋 Back to Grid').setStyle(ButtonStyle.Primary)
        ));
        return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
      }

      const maxIdx = items.length - 1;
      if (detailIndex > maxIdx) detailIndex = maxIdx;
      if (detailIndex < 0) detailIndex = 0;
      const pony = items[detailIndex];

      const fullPony = allPonies.find(p => p.id === pony.id) || pony;
      const owned = ownedIds.has(pony.id);
      const isFav = profile.favs.includes(pony.id);

      const container = new ContainerBuilder().setAccentColor(0xAA55DD);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${owned ? '✅' : '🔒'} ${pony.name}`
      ));

      let hasImage = false;
      let imagePath = null;
      const attachName = fullPony.png ? `pony_${fullPony.id}.png` : null;
      if (fullPony.png) {
        const imgFolder = fullPony.category === 'Equestria Girls' ? 'equestria_girls' : 'pony';
        imagePath = path.join(__dirname, '..', '..', 'assets', 'ponies_assets', imgFolder, fullPony.png);
        if (!fs.existsSync(imagePath)) {

          const altFolder = imgFolder === 'equestria_girls' ? 'pony' : 'equestria_girls';
          const altPath = path.join(__dirname, '..', '..', 'assets', 'ponies_assets', altFolder, fullPony.png);
          if (fs.existsSync(altPath)) imagePath = altPath;
        }
        if (fs.existsSync(imagePath)) {
          hasImage = true;
          try {
            const gallery = new MediaGalleryBuilder().addItems(
              new MediaGalleryItemBuilder().setURL(`attachment://${attachName}`)
            );
            container.addMediaGalleryComponents(gallery);
          } catch (e) { hasImage = false; }
        }
      }

      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      const favCount = profile.favs.filter(id => ownedIds.has(id)).length;
      const bakeryBonusText = describePonyBakeryBonus(fullPony) || "This pony doesn't drop any bonuses";
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**Rarity:** ${rarityEmoji(pony.rarity)} ${capitalize(pony.rarity || 'Unknown')}\n` +
        `**Status:** ${owned ? '<:checkmark1:1490897821044576266> Owned' : '🔒 Not Owned'}\n` +
        `**Favorite:** ${isFav ? '❤️ Yes' : '🤍 No'}\n` +
        `**Bakery Bonus:** ${bakeryBonusText}\n` +
        (fullPony.family ? `**Family:** ${fullPony.family}\n` : '') +
        (fullPony.category ? `**Category:** ${fullPony.category}\n` : '') +
        `**Favorited:** ${favCount}\n` +
        (fullPony.description ? `\n*${fullPony.description}*` : '')
      ));

      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*${label} ${detailIndex + 1} of ${items.length}*`));

      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('col:djumpback').setLabel('<<').setStyle(ButtonStyle.Secondary).setDisabled(detailIndex === 0),
        new ButtonBuilder().setCustomId('col:dprev').setLabel('<').setStyle(ButtonStyle.Secondary).setDisabled(detailIndex === 0),
        new ButtonBuilder().setCustomId('col:backgrid').setLabel('📋 Back to Grid').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('col:dnext').setLabel('>').setStyle(ButtonStyle.Secondary).setDisabled(detailIndex >= maxIdx),
        new ButtonBuilder().setCustomId('col:djumpnext').setLabel('>>').setStyle(ButtonStyle.Secondary).setDisabled(detailIndex >= maxIdx)
      ));

      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('col:search').setLabel('🔎 Search').setStyle(ButtonStyle.Danger)
      ));

      const startSel = Math.max(0, detailIndex - 12);
      const endSel = Math.min(items.length, startSel + 25);
      const selectItems = items.slice(startSel, endSel);
      if (selectItems.length > 0) {
        const select = new StringSelectMenuBuilder()
          .setCustomId('col:dselect')
          .setPlaceholder(pony.name)
          .addOptions(selectItems.map((p, idx) => ({
            label: p.name,
            value: String(startSel + idx),
            description: `${capitalize(p.rarity || 'Unknown')} · ${ownedIds.has(p.id) ? 'Owned' : 'Not Owned'}`,
            default: (startSel + idx) === detailIndex
          })));
        container.addActionRowComponents(ar => ar.addComponents(select));
      }

      const result = { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
      if (hasImage && imagePath && attachName) {
        result.files = [new AttachmentBuilder(imagePath, { name: attachName })];
      }
      return result;
    }

    /* ── Recently Added View ── */
    function buildRecentView() {
      const recent = getRecentlyAdded();
      if (recent.length === 0) {
        const container = new ContainerBuilder().setAccentColor(0x2ECC71);
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🆕 Recently Added\nYou haven\'t befriended any ponies yet!'));
        container.addActionRowComponents(ar => ar.setComponents(
          new ButtonBuilder().setCustomId('col:backgrid').setLabel('📋 Back to Grid').setStyle(ButtonStyle.Primary)
        ));
        return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
      }

      const container = new ContainerBuilder().setAccentColor(0x2ECC71);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🆕 Recently Added\nYour latest befriended ponies:'));
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

      const lines = recent.map((p, idx) => {
        const emoji = rarityEmoji(p.rarity);
        const date = p.befriendedAt ? `<t:${Math.floor(new Date(p.befriendedAt).getTime() / 1000)}:R>` : 'Unknown';
        return `${emoji} **${p.name}** — ${date}`;
      }).join('\n');
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));

      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('col:backgrid').setLabel('📋 Back to Grid').setStyle(ButtonStyle.Primary)
      ));

      return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
    }

    /* ── Search Results View ── */
    function buildSearchResults() {
      const results = getSearchResults();
      const container = new ContainerBuilder().setAccentColor(0xE74C3C);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 🔎 Search Results\nQuery: **${searchQuery}** — ${results.length} result(s)`
      ));
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

      if (results.length === 0) {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No ponies found matching your search.'));
      } else {
        const lines = results.slice(0, 25).map(p => {
          const emoji = rarityEmoji(p.rarity);
          const fav = profile.favs.includes(p.id) ? ' ❤️' : '';
          return `${emoji} ${p.name}${fav}`;
        }).join('\n');
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
        if (results.length > 25) {
          container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*...and ${results.length - 25} more*`));
        }
      }

      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('col:backgrid').setLabel('📋 Back to Grid').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('col:search').setLabel('🔎 Search Again').setStyle(ButtonStyle.Danger)
      ));

      if (results.length > 0 && results.length <= 25) {
        const select = new StringSelectMenuBuilder()
          .setCustomId('col:search_select')
          .setPlaceholder('View pony details...')
          .addOptions(results.map(p => ({
            label: p.name,
            value: String(p.id),
            description: `${capitalize(p.rarity || 'Unknown')} · ${ownedIds.has(p.id) ? 'Owned' : 'Not Owned'}`
          })));
        container.addActionRowComponents(ar => ar.addComponents(select));
      }

      return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
    }

    /* ── Rarity Info View ── */
    function buildRarityInfo() {
      const rarityCounts = {};
      for (const p of allPonies) {
        const r = capitalize(p.rarity || 'Unknown');
        rarityCounts[r] = (rarityCounts[r] || 0) + 1;
      }
      const ownedByRarity = {};
      for (const p of deduped) {
        const r = capitalize(p.rarity || 'Unknown');
        ownedByRarity[r] = (ownedByRarity[r] || 0) + 1;
      }

      const order = ['Common', 'Rare', 'Epic', 'Majestic', 'Legend', 'Goddess', 'Secret', 'Radiance'];
      const lines = order.filter(r => rarityCounts[r]).map(r => {
        const emoji = rarityEmoji(r);
        const owned = ownedByRarity[r] || 0;
        const total = rarityCounts[r] || 0;
        return `${emoji} **${r}** — ${owned}/${total}`;
      }).join('\n');

      const container = new ContainerBuilder().setAccentColor(0x9B59B6);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 📊 Rarity Breakdown'));
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines || 'No data available.'));
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('col:backgrid').setLabel('📋 Back to Grid').setStyle(ButtonStyle.Primary)
      ));

      return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
    }

    /* ── Render ── */
    function render() {
      if (viewMode === 'detail') return buildDetailView(getFiltered(), 'Pony');
      if (viewMode === 'recent') return buildRecentView();
      if (viewMode === 'search') return buildSearchResults();
      if (viewMode === 'rarity_info') return buildRarityInfo();
      if (viewMode === 'search_detail') return buildDetailView(getSearchResults(), 'Result');
      return buildGridView();
    }

    try {
      await sendOrFallback(interaction, render());
    } catch (e) { console.error('collections send err', e); }

    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 600_000, filter: i => i.user.id === userId });

    collector.on('collect', async (i) => {
      try {
        const cid = i.customId;

        if (cid === 'col:search') {
          const modal = new ModalBuilder()
            .setCustomId('col:search_modal')
            .setTitle('Search Ponies')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('col:search_input')
                  .setLabel('Pony Name')
                  .setStyle(TextInputStyle.Short)
                  .setPlaceholder('Enter pony name...')
                  .setRequired(true)
                  .setMaxLength(100)
              )
            );
          await i.showModal(modal);
          try {
            const submitted = await i.awaitModalSubmit({ time: 60_000, filter: m => m.customId === 'col:search_modal' && m.user.id === userId });
            searchQuery = submitted.fields.getTextInputValue('col:search_input').trim();
            viewMode = 'search';
            page = 0;
            await submitted.update(render());
          } catch (_) { /* modal timeout */ }
          return;
        }

        if (cid === 'col:backgrid') {
          viewMode = 'grid';
          await i.update(render());
          return;
        }

        if (cid === 'col:recent') {
          viewMode = 'recent';
          await i.update(render());
          return;
        }

        if (cid === 'col:rarity_info') {
          viewMode = 'rarity_info';
          await i.update(render());
          return;
        }

        if (cid === 'col:detailed') {
          viewMode = 'detail';
          detailIndex = page * PAGE_SIZE;
          await i.deferUpdate();
          await i.editReply(render());
          return;
        }

        if (cid === 'col:first') { page = 0; await i.update(render()); return; }
        if (cid === 'col:prev') { page = Math.max(0, page - 1); await i.update(render()); return; }
        if (cid === 'col:next') {
          const total = getFiltered().length;
          const maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
          page = Math.min(maxPage, page + 1);
          await i.update(render());
          return;
        }
        if (cid === 'col:last') {
          const total = getFiltered().length;
          page = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
          await i.update(render());
          return;
        }

        if (cid === 'col:dprev') {
          detailIndex = Math.max(0, detailIndex - 1);
          await i.deferUpdate();
          await i.editReply(render());
          return;
        }

        if (cid === 'col:djumpback') {
          detailIndex = Math.max(0, detailIndex - 50);
          await i.deferUpdate();
          await i.editReply(render());
          return;
        }

        if (cid === 'col:djumpnext') {
          const currentItems = (viewMode === 'search_detail') ? getSearchResults() : getFiltered();
          const maxIdx = Math.max(0, currentItems.length - 1);
          detailIndex = Math.min(maxIdx, detailIndex + 50);
          await i.deferUpdate();
          await i.editReply(render());
          return;
        }

        if (cid === 'col:dnext') {
          detailIndex++;
          await i.deferUpdate();
          await i.editReply(render());
          return;
        }

        if (cid === 'col:dselect') {
          detailIndex = Number(i.values[0]);
          await i.deferUpdate();
          await i.editReply(render());
          return;
        }

        if (cid === 'col:search_select') {
          const ponyId = Number(i.values[0]);
          const results = getSearchResults();
          const idx = results.findIndex(p => p.id === ponyId);
          if (idx >= 0) {
            detailIndex = idx;
            viewMode = 'search_detail';
          }
          await i.deferUpdate();
          await i.editReply(render());
          return;
        }

        if (cid === 'col:filter_rarity') {
          rarityFilter = i.values[0];
          page = 0;
          await i.update(render());
          return;
        }

        if (cid === 'col:filter_family') {
          familyFilter = i.values[0];
          page = 0;
          await i.update(render());
          return;
        }

        if (cid === 'col:filter_category') {
          categoryFilter = i.values[0];
          page = 0;
          await i.update(render());
          return;
        }

      } catch (err) {
        console.error('collections collector err:', err);
        try { if (!i.replied && !i.deferred) await i.deferUpdate(); } catch (_) {}
      }
    });

    collector.on('end', async () => {
      try { await message.edit({ components: [] }).catch(() => {}); } catch {}
    });
  }
};
