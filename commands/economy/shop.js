const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  StringSelectMenuBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  AttachmentBuilder
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const { sendOrFallback } = require('../../utils/safeReply');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendNoProfile } = require('../../utils/noProfileResponse');
const AssetManager = require('../../model/AssetManager');
const { BITS, HARMONY } = require('./currencyEmojis');

const BAKERY_PAGE_SIZE = 6;

function loadBakeries() {
  try { return require('../../model/BakeryShop.js'); } catch { return {}; }
}
function loadLocations() {
  try { return require('../../model/LocationShop.js'); } catch { return {}; }
}
function loadThemes() {
  try { return require('../../model/ThemesShop.js'); } catch { return {}; }
}

/* ── Main Menu ── */
function buildMainMenu() {
  const container = new ContainerBuilder()
    .setAccentColor(0xFF6B9D)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🪄 The Enchanted Shop\nBrowse our collection of bakeries, locations, and themes!'))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      '🥐 **Bakeries** — Unique templates with different earning rates\n' +
      '📍 **Locations** — Travel to new regions in Equestria\n' +
      '🎨 **Themes** — Personalize your profile with exclusive looks'
    ))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('💡 Choose a category below to browse items. Use `/buy <id>` to purchase!'))
    .addActionRowComponents(ar => ar.setComponents(
      new ButtonBuilder().setCustomId('shop:bakeries').setLabel('🥐 Bakeries').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('shop:locations').setLabel('📍 Locations').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('shop:themes').setLabel('🎨 Themes').setStyle(ButtonStyle.Danger)
    ));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/* ── Bakeries Category ── */
function buildBakeriesPage(page, ownedIds) {
  const all = Object.values(loadBakeries()).filter(b => b && b.shop !== false);
  const maxPage = Math.max(0, Math.ceil(all.length / BAKERY_PAGE_SIZE) - 1);
  page = Math.min(Math.max(0, page), maxPage);
  const pageItems = all.slice(page * BAKERY_PAGE_SIZE, (page + 1) * BAKERY_PAGE_SIZE);

  const container = new ContainerBuilder().setAccentColor(0xF1C40F);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## ✨ Bakeries Market\nBrowse bakery templates available for purchase.'));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (pageItems.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No bakeries available.'));
  } else {
    const lines = pageItems.map(b => {
      const emoji = AssetManager.getBakeryEmoji(b.emoji || b.name);
      const owned = ownedIds.includes(b.id) ? ' ✅' : '';
      return `${emoji} **${b.name}** — ID ${b.id}${owned}\n${BITS} ${b.price.toLocaleString()} bits · 📊 ${b.min}-${b.max} bits/cycle · ⏱️ ${b.bakeTime}m`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Page ${page + 1}/${maxPage + 1} · ${all.length} items`));
  container.addActionRowComponents(ar => ar.setComponents(
    new ButtonBuilder().setCustomId('shop:bk:prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
    new ButtonBuilder().setCustomId('shop:bk:next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage),
    new ButtonBuilder().setCustomId('shop:bk:detail').setLabel('🔍 Detailed View').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('shop:back').setLabel('🏠 Back').setStyle(ButtonStyle.Primary)
  ));

  if (pageItems.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('shop:bk:select')
      .setPlaceholder('Select a bakery to view details...')
      .addOptions(pageItems.map(b => {
        const owned = ownedIds.includes(b.id) ? ' ✅' : '';
        return {
          label: `${b.name}${owned}`,
          value: String(b.id),
          description: `${b.price.toLocaleString()} bits · ${b.min}-${b.max}/cycle · ${b.bakeTime}m`,
          emoji: { id: (AssetManager.getBakeryEmoji(b.emoji || b.name).match(/:(\d+)>/) || [])[1] }
        };
      }).filter(o => o.emoji.id));
    container.addActionRowComponents(ar => ar.setComponents(select));
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
}

/* ── Bakery Detail View ── */
function buildBakeryDetailPage(bakeryId, ownedIds) {
  const allBakeries = loadBakeries();
  const shopItems = Object.values(allBakeries).filter(b => b && b.shop !== false);
  const b = allBakeries[String(bakeryId)];

  const container = new ContainerBuilder().setAccentColor(0xF1C40F);

  if (!b) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## ❌ Bakery Not Found'));
    container.addActionRowComponents(ar => ar.setComponents(
      new ButtonBuilder().setCustomId('shop:bk:backtolist').setLabel('◀ Back to List').setStyle(ButtonStyle.Primary)
    ));
    return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
  }

  const emoji = AssetManager.getBakeryEmoji(b.emoji || b.name);
  const owned = ownedIds.includes(b.id);

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${owned ? '✅' : emoji} ${b.name}`));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(b.description || 'No description available.'));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `**Price:** ${BITS} ${b.price.toLocaleString()} bits\n` +
    `**Earnings:** 📊 ${b.min}–${b.max} bits per cycle\n` +
    `**Bake Time:** ⏱️ ${b.bakeTime} minutes\n` +
    `**Status:** ${owned ? '✅ Owned' : '🔒 Not Owned'}`
  ));

  const shopIdx = shopItems.findIndex(s => s.id === b.id);
  const prevItem = shopIdx > 0 ? shopItems[shopIdx - 1] : null;
  const nextItem = shopIdx < shopItems.length - 1 ? shopItems[shopIdx + 1] : null;

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`*Bakery ${shopIdx + 1} of ${shopItems.length}*`));

  container.addActionRowComponents(ar => ar.setComponents(
    new ButtonBuilder().setCustomId('shop:bk:dprev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(!prevItem),
    new ButtonBuilder().setCustomId('shop:bk:dnext').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(!nextItem),
    new ButtonBuilder().setCustomId('shop:bk:backtolist').setLabel('📋 Back to List').setStyle(ButtonStyle.Primary)
  ));

  return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
}

/* ── Locations Category ── */
function buildLocationsPage() {
  const all = Object.values(loadLocations()).filter(l => l && l.shop !== false);

  const container = new ContainerBuilder().setAccentColor(0x3498DB);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## 📍 Locations Market\nTravel to new bakery locations in Equestria!'));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (all.length === 0) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('No locations available for purchase right now.'));
  } else {
    const lines = all.map(l => {
      return `${l.emoji || '📍'} **${l.name}** — ID ${l.id}\n${BITS} ${l.price ? l.price.toLocaleString() + ' bits' : 'Free'}\n${l.description || ''}`;
    });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${all.length} location(s) available`));
  container.addActionRowComponents(ar => ar.setComponents(
    new ButtonBuilder().setCustomId('shop:back').setLabel('🏠 Back').setStyle(ButtonStyle.Primary)
  ));

  return { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
}

/* ── Themes Category ── */
function buildThemesPage(page, categoryKey) {
  const themesShop = loadThemes();
  const categories = Object.keys(themesShop);
  if (!categories.includes(categoryKey)) categoryKey = categories[0] || 'profiles';
  const items = (themesShop[categoryKey] || []).filter(i => i && typeof i === 'object');
  const maxPage = Math.max(0, items.length - 1);
  page = Math.min(Math.max(0, page), maxPage);
  const currentItem = items[page];

  const container = new ContainerBuilder().setAccentColor(0xFF1493);

  let hasPreview = false;
  let previewPath = null;

  if (!currentItem) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎨 ${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} Themes`));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent("No themes available for this category yet. Check back soon!"));
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎨 ${currentItem.name}`));

    if (currentItem.previewFile) {
      previewPath = path.join(__dirname, '..', '..', 'assets', currentItem.previewFile);
      if (fs.existsSync(previewPath)) {
        hasPreview = true;
        try {
          const gallery = new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL('attachment://theme_preview.png')
          );
          container.addMediaGalleryComponents(gallery);
        } catch (e) { /* preview not supported */ }
      }
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `${currentItem.description || 'No description available.'}\n\n` +
      `${BITS} ${(currentItem.priceBits || 0).toLocaleString()} bits · ${HARMONY} ${(currentItem.priceHarmony || 0).toLocaleString()} harmony`
    ));

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Item ${page + 1}/${items.length}`));
  }

  const catsWithItems = categories.filter(c => (themesShop[c] || []).length > 0 || c === categoryKey);
  if (catsWithItems.length > 1) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('shop:th:cat')
      .setPlaceholder('Select theme category...')
      .addOptions(catsWithItems.map(c => ({
        label: c.charAt(0).toUpperCase() + c.slice(1),
        value: c,
        description: `Browse ${c} themes`,
        default: c === categoryKey
      })));
    container.addActionRowComponents(ar => ar.setComponents(select));
  }

  container.addActionRowComponents(ar => ar.setComponents(
    new ButtonBuilder().setCustomId('shop:th:prev').setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0 || !currentItem),
    new ButtonBuilder().setCustomId('shop:th:next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage || !currentItem),
    new ButtonBuilder().setCustomId('shop:back').setLabel('🏠 Back').setStyle(ButtonStyle.Primary)
  ));

  if (currentItem) {
    container.addActionRowComponents(ar => ar.setComponents(
      new ButtonBuilder().setCustomId('shop:th:buybits').setEmoji('1427177661142405150').setLabel(`${(currentItem.priceBits || 0).toLocaleString()} Bits`).setStyle(ButtonStyle.Success).setDisabled(!currentItem.priceBits),
      new ButtonBuilder().setCustomId('shop:th:buyharmony').setEmoji('1426268627790725160').setLabel(`${(currentItem.priceHarmony || 0).toLocaleString()} Harmony`).setStyle(ButtonStyle.Success).setDisabled(!currentItem.priceHarmony)
    ));
  }

  const result = { components: [container], flags: MessageFlags.IsComponentsV2, files: [] };
  if (hasPreview && previewPath) {
    result.files = [new AttachmentBuilder(previewPath, { name: 'theme_preview.png' })];
  }
  return result;
}

module.exports = {
  data: new SlashCommandBuilder().setName('shop').setDescription('Browse and purchase bakeries, locations, and themes'),
  useGlobalLoader: false,
  async execute(interaction) {
    if (!interaction.guild) return await sendOrFallback(interaction, { content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });

    const isButton = interaction.isButton?.() || interaction.isStringSelectMenu?.();
    try {
      if (isButton) {
        await interaction.update(buildMainMenu());
      } else {
        await interaction.reply(buildMainMenu());
      }
    } catch (e) {
      console.error('shop send error:', e);
      return;
    }

    const msg = isButton ? interaction.message : await interaction.fetchReply();
    const userId = interaction.user.id;

    let bakeryPage = 0;
    let themePage = 0;
    let themeCategory = 'profiles';
    let detailBakeryId = null;

    const collector = msg.createMessageComponentCollector({ time: 300_000, filter: i => i.user.id === userId });
    collector.on('collect', async (i) => {
      try {
        const cid = i.customId;

        if (cid === 'shop:bakeries') {
          bakeryPage = 0;
          const profile = getProfile(userId);
          const owned = profile?.bakeriesowned || [];
          await i.update(buildBakeriesPage(bakeryPage, owned));
          return;
        }
        if (cid === 'shop:locations') {
          await i.update(buildLocationsPage());
          return;
        }
        if (cid === 'shop:themes') {
          themePage = 0;
          themeCategory = 'profiles';
          await i.update(buildThemesPage(themePage, themeCategory));
          return;
        }

        if (cid === 'shop:back') {
          await i.update(buildMainMenu());
          return;
        }

        if (cid === 'shop:bk:prev' || cid === 'shop:bk:next') {
          bakeryPage += cid === 'shop:bk:next' ? 1 : -1;
          const profile = getProfile(userId);
          const owned = profile?.bakeriesowned || [];
          await i.update(buildBakeriesPage(bakeryPage, owned));
          return;
        }

        if (cid === 'shop:bk:detail') {
          const all = Object.values(loadBakeries()).filter(b => b && b.shop !== false);
          const pageItems = all.slice(bakeryPage * BAKERY_PAGE_SIZE, (bakeryPage + 1) * BAKERY_PAGE_SIZE);
          detailBakeryId = pageItems[0]?.id || null;
          if (detailBakeryId) {
            const profile = getProfile(userId);
            const owned = profile?.bakeriesowned || [];
            await i.update(buildBakeryDetailPage(detailBakeryId, owned));
          } else {
            await i.deferUpdate();
          }
          return;
        }

        if (cid === 'shop:bk:select') {
          detailBakeryId = Number(i.values[0]);
          const profile = getProfile(userId);
          const owned = profile?.bakeriesowned || [];
          await i.update(buildBakeryDetailPage(detailBakeryId, owned));
          return;
        }

        if (cid === 'shop:bk:backtolist') {
          const profile = getProfile(userId);
          const owned = profile?.bakeriesowned || [];
          await i.update(buildBakeriesPage(bakeryPage, owned));
          return;
        }

        if (cid === 'shop:bk:dprev' || cid === 'shop:bk:dnext') {
          const shopItems = Object.values(loadBakeries()).filter(b => b && b.shop !== false);
          const idx = shopItems.findIndex(b => b.id === detailBakeryId);
          const newIdx = cid === 'shop:bk:dnext' ? idx + 1 : idx - 1;
          if (newIdx >= 0 && newIdx < shopItems.length) {
            detailBakeryId = shopItems[newIdx].id;
          }
          const profile = getProfile(userId);
          const owned = profile?.bakeriesowned || [];
          await i.update(buildBakeryDetailPage(detailBakeryId, owned));
          return;
        }

        if (cid === 'shop:th:prev' || cid === 'shop:th:next') {
          themePage += cid === 'shop:th:next' ? 1 : -1;
          await i.update(buildThemesPage(themePage, themeCategory));
          return;
        }

        if (cid === 'shop:th:cat') {
          themeCategory = i.values[0];
          themePage = 0;
          await i.update(buildThemesPage(themePage, themeCategory));
          return;
        }

        if (cid === 'shop:th:buybits' || cid === 'shop:th:buyharmony') {
          const themesShop = loadThemes();
          const items = (themesShop[themeCategory] || []).filter(t => t && typeof t === 'object');
          const theme = items[themePage];
          if (!theme) { await i.deferUpdate(); return; }

          const profile = getProfile(userId);
          if (!profile) {
            await sendNoProfile(i);
            return;
          }

          if (!profile.features) profile.features = {};
          if (!profile.features.purchasedThemes) profile.features.purchasedThemes = [];
          if (profile.features.purchasedThemes.includes(theme.id)) {
            await i.reply({ content: `You already own **${theme.name}**!`, flags: MessageFlags.Ephemeral });
            return;
          }

          if (!profile.balances) profile.balances = { bits: 0, harmony: 0, diamonds: 0, crates: 0, keys: 0, loyalty: 0 };
          const useBits = cid === 'shop:th:buybits';
          const cost = useBits ? (theme.priceBits || 0) : (theme.priceHarmony || 0);
          const currency = useBits ? 'bits' : 'harmony';
          const currencyLabel = useBits ? 'Bits' : 'Harmony';
          const currencyEmoji = useBits ? BITS : HARMONY;
          const balance = Number(profile.balances[currency] || 0);

          if (balance < cost) {
            await i.reply({ content: `You need ${currencyEmoji} ${cost.toLocaleString()} ${currencyLabel} to buy **${theme.name}**, but you only have ${currencyEmoji} ${balance.toLocaleString()}.`, flags: MessageFlags.Ephemeral });
            return;
          }

          profile.balances[currency] = balance - cost;
          profile.features.purchasedThemes.push(theme.id);
          updateProfile(userId, profile);

          await i.reply({ content: `${currencyEmoji} You purchased **${theme.name}** for ${cost.toLocaleString()} ${currencyLabel}!`, flags: MessageFlags.Ephemeral });
          return;
        }
      } catch (err) {
        console.error('shop collector error:', err);
        try { if (!i.replied && !i.deferred) await i.deferUpdate(); } catch (_) {}
      }
    });

    collector.on('end', async () => {
      try { await msg.edit({ components: [] }); } catch (_) {}
    });
  }
};
