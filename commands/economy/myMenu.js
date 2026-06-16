const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { loadBakeries } = require('./_bakeryUtils');
const { sendOrFallback } = require('../../utils/safeReply');
const AssetManager = require('../../model/AssetManager');

const NO_PROFILE_MESSAGE = [
  '**No Pony Found**',
  '',
  'You need to create a pony before using this command!',
  '',
  'Use `/create` to create your own pony and start your adventure in Equestria.',
  '',
  '🎯 **How to get started:**',
  'Use `/create` to create your own pony and begin your magical journey in Equestria.'
].join('\n');

const CATEGORY_META = {
  starter: { label: 'Starter', emoji: '🟢' },
  standard: { label: 'Standard', emoji: '🟡' },
  premium: { label: 'Premium', emoji: '🟠' },
  special: { label: 'Special', emoji: '💎' },
  unknown: { label: 'Unknown', emoji: '⚪' }
};

function getMaxSlots(profile) {
  return (profile.InServer && profile.Extra2MenuSlot) ? 8 :
    (profile.InServer && profile.Extra1MenuSlot) ? 7 : 6;
}

function getBakeryCategory(meta) {
  if (!meta) return 'unknown';
  if (meta.shop === false || Number(meta.id) >= 200) return 'special';
  if ((meta.price || 0) <= 15000 || (meta.bakeTime || 0) <= 10) return 'starter';
  if ((meta.price || 0) <= 100000 || (meta.bakeTime || 0) <= 30) return 'standard';
  return 'premium';
}

function formatBakeryLine(meta, id, index) {
  const categoryKey = getBakeryCategory(meta);
  const category = CATEGORY_META[categoryKey] || CATEGORY_META.unknown;
  if (!meta) return `${index + 1}. [Unknown Bakery] (ID: ${id})`;

  const emoji = AssetManager.getBakeryEmoji(meta.emoji || meta.name) || '🍰';
  return `${index + 1}. ${emoji} **${meta.name}** (ID: ${id})\n   ${meta.min}-${meta.max} bits/cycle · ${meta.bakeTime}m · ${category.emoji} ${category.label}`;
}

function buildCategoryBuckets(ids, bakeriesMeta, menuSet = new Set()) {
  const buckets = {
    starter: [],
    standard: [],
    premium: [],
    special: [],
    unknown: []
  };

  for (const rawId of ids || []) {
    const id = Number(rawId);
    const meta = bakeriesMeta[String(id)];
    const key = getBakeryCategory(meta);
    const category = CATEGORY_META[key] || CATEGORY_META.unknown;
    const marker = menuSet.has(id) ? '⭐ ' : '';

    if (!meta) {
      buckets.unknown.push(`${marker}[Unknown Bakery] (ID: ${id})`);
      continue;
    }

    const emoji = AssetManager.getBakeryEmoji(meta.emoji || meta.name) || '🍰';
    buckets[key].push(`${marker}${emoji} **${meta.name}** (ID: ${id})`);
    if (!CATEGORY_META[key]) {
      buckets.unknown.push(`${marker}${emoji} **${meta.name}** (ID: ${id})`);
    }
  }

  return buckets;
}

function buildMenuSnapshot(profile, bakeriesMeta) {
  const menuIds = Array.isArray(profile.menu) ? profile.menu.map(n => Number(n)).filter(Number.isFinite) : [];
  const menuSet = new Set(menuIds);
  const menuItems = menuIds.map((id, i) => {
    const meta = bakeriesMeta[String(id)];
    return { id, meta, line: formatBakeryLine(meta, id, i) };
  });

  const totalMin = menuItems.reduce((sum, item) => sum + Number(item.meta?.min || 0), 0);
  const totalMax = menuItems.reduce((sum, item) => sum + Number(item.meta?.max || 0), 0);
  const avgBakeTime = menuItems.length
    ? (menuItems.reduce((sum, item) => sum + Number(item.meta?.bakeTime || 0), 0) / menuItems.length).toFixed(1)
    : '0.0';

  const categoryCounts = { starter: 0, standard: 0, premium: 0, special: 0, unknown: 0 };
  for (const item of menuItems) {
    const key = getBakeryCategory(item.meta);
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  }

  return { menuIds, menuSet, menuItems, totalMin, totalMax, avgBakeTime, categoryCounts };
}

function buildMainView(interaction, profile, bakeriesMeta) {
  const { menuItems, totalMin, totalMax, avgBakeTime, categoryCounts } = buildMenuSnapshot(profile, bakeriesMeta);
  const maxSlots = getMaxSlots(profile);
  const usedSlots = menuItems.length;
  const openSlots = Math.max(0, maxSlots - usedSlots);

  const categorySummary = [
    `🟢 ${categoryCounts.starter || 0}`,
    `🟡 ${categoryCounts.standard || 0}`,
    `🟠 ${categoryCounts.premium || 0}`,
    `💎 ${categoryCounts.special || 0}`
  ].join(' · ');

  if (!ContainerBuilder || !TextDisplayBuilder || !SeparatorBuilder) {
    const embed = new EmbedBuilder()
      .setTitle(`🍰 ${interaction.user.username}'s Bakery Menu`)
      .setColor(0xE91E63)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
      .setDescription(
        menuItems.length
          ? `**Active Menu Items:**\n${menuItems.map(item => item.line).join('\n\n')}`
          : '**Active Menu Items:**\nNo bakeries on your menu yet. Add one to start baking.'
      )
      .addFields(
        { name: 'Slots', value: `${usedSlots}/${maxSlots} used (${openSlots} open)`, inline: true },
        { name: 'Cycle Potential', value: `${totalMin}-${totalMax} bits`, inline: true },
        { name: 'Avg Cycle Time', value: `${avgBakeTime}m`, inline: true },
        { name: 'Category Mix', value: categorySummary, inline: false },
        { name: 'Tip', value: 'Use Add Item to activate owned bakeries, then run /bake to collect bits.', inline: false }
      )
      .setFooter({ text: 'Manage your active lineup with the buttons below.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('add_menu_item').setLabel('➕ Add Item').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('remove_menu_item').setLabel('➖ Remove Item').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('my_bakeries').setLabel('📋 My Bakeries').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mymenu_categories').setLabel('🗂️ Categories').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mymenu_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
  }

  const menuItemsContent = menuItems.length
    ? `**Active Menu Items**\n${menuItems.map(item => item.line).join('\n\n')}`
    : '**Active Menu Items**\nNo bakeries on your menu yet. Add one to start baking.';

  const statsContent =
    `**Slots:** ${usedSlots}/${maxSlots} used (${openSlots} open)\n` +
    `**Cycle Potential:** ${totalMin}-${totalMax} bits\n` +
    `**Average Cycle Time:** ${avgBakeTime}m\n` +
    `**Category Mix:** ${categorySummary}`;

  const tipsContent =
    'Only bakeries on your menu generate production when you bake.\n' +
    'Use Add Item or Remove Item to tune your setup.\n' +
    'Use Categories to quickly review your collection by tier.';

  const container = new ContainerBuilder()
    .setAccentColor(0xE91E63)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`🍰 **${interaction.user.username}'s Bakery Menu**`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(menuItemsContent))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(statsContent))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(tipsContent))
    .addActionRowComponents(ar => ar.setComponents(
      new ButtonBuilder().setCustomId('add_menu_item').setLabel('➕ Add Item').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('remove_menu_item').setLabel('➖ Remove Item').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('my_bakeries').setLabel('📋 My Bakeries').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mymenu_categories').setLabel('🗂️ Categories').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mymenu_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
    ));

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildCategoriesEmbed(interaction, profile, bakeriesMeta) {
  const owned = Array.isArray(profile.bakeriesowned) ? profile.bakeriesowned.map(Number).filter(Number.isFinite) : [];
  const menuSet = new Set((profile.menu || []).map(Number).filter(Number.isFinite));
  const buckets = buildCategoryBuckets(owned, bakeriesMeta, menuSet);
  const totalOwned = owned.length;

  const categoryLines = Object.entries(CATEGORY_META)
    .filter(([key]) => key !== 'unknown')
    .map(([key, meta]) => {
      const entries = buckets[key] || [];
      const onMenu = entries.filter(line => line.startsWith('⭐')).length;
      return `${meta.emoji} **${meta.label}**: ${entries.length} owned (${onMenu} on menu)`;
    });

  const firstLines = [];
  for (const [key, meta] of Object.entries(CATEGORY_META)) {
    const entries = (buckets[key] || []).slice(0, 4);
    if (!entries.length) continue;
    firstLines.push(`${meta.emoji} **${meta.label}**\n${entries.join('\n')}`);
  }

  return new EmbedBuilder()
    .setTitle(`🗂️ ${interaction.user.username}'s Bakery Categories`)
    .setColor(0x6C5CE7)
    .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
    .setDescription(firstLines.length ? firstLines.join('\n\n') : 'No owned bakeries yet. Buy one from /shop to get started!')
    .addFields(
      { name: 'Owned Total', value: String(totalOwned), inline: true },
      { name: 'Legend', value: '⭐ = On menu', inline: true },
      { name: 'Category Totals', value: categoryLines.join('\n') || 'No categories yet', inline: false }
    )
    .setFooter({ text: 'Showing up to 4 bakeries per category in preview.' });
}

module.exports = {
  data: new SlashCommandBuilder().setName('mymenu').setDescription('View and manage your bakery menu'),
  async execute(interaction) {
    try { await interaction.deferReply({ flags: MessageFlags.IsLoading }); } catch (e) { }
    const userId = interaction.user.id;
    const profile = getProfile(userId);
    if (!profile) return await sendOrFallback(interaction, { content: NO_PROFILE_MESSAGE, flags: MessageFlags.Ephemeral });
    if (!profile.menu) profile.menu = [];
    const bakeriesMeta = loadBakeries();

    const payload = buildMainView(interaction, profile, bakeriesMeta);
    await sendOrFallback(interaction, payload);
  },
  async handleButton(interaction) {
    const customId = interaction.customId;

    if (customId === 'mymenu_refresh') {
      const userId = interaction.user.id;
      const profile = getProfile(userId);
      if (!profile) return await sendOrFallback(interaction, { content: NO_PROFILE_MESSAGE, flags: MessageFlags.Ephemeral });

      const bakeriesMeta = loadBakeries();
      const payload = buildMainView(interaction, profile, bakeriesMeta);
      try {
        await interaction.update(payload);
      } catch {
        await sendOrFallback(interaction, payload);
      }
      return;
    }

    if (customId === 'mymenu_categories') {
      const userId = interaction.user.id;
      const profile = getProfile(userId);
      if (!profile) return await sendOrFallback(interaction, { content: NO_PROFILE_MESSAGE, flags: MessageFlags.Ephemeral });

      const bakeriesMeta = loadBakeries();
      const embed = buildCategoriesEmbed(interaction, profile, bakeriesMeta);
      await sendOrFallback(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (customId === 'my_bakeries') {
      const userId = interaction.user.id;
      const profile = getProfile(userId);
      if (!profile) return await sendOrFallback(interaction, { content: NO_PROFILE_MESSAGE, flags: MessageFlags.Ephemeral });

      const bakeriesMeta = loadBakeries();
      const owned = Array.isArray(profile.bakeriesowned) ? profile.bakeriesowned.map(Number).filter(Number.isFinite) : [];
      const menuSet = new Set((profile.menu || []).map(Number).filter(Number.isFinite));
      const bakeryList = owned.map((id, i) => {
        const meta = bakeriesMeta[String(id)];
        const line = formatBakeryLine(meta, id, i);
        return `${menuSet.has(id) ? '⭐ ' : ''}${line}`;
      });

      const buckets = buildCategoryBuckets(owned, bakeriesMeta, menuSet);
      const catSummary = Object.entries(CATEGORY_META)
        .filter(([key]) => key !== 'unknown')
        .map(([key, meta]) => `${meta.emoji} ${meta.label}: ${(buckets[key] || []).length}`)
        .join(' · ');

      const listPreview = bakeryList.length > 20 ? `${bakeryList.slice(0, 20).join('\n\n')}\n\n...and ${bakeryList.length - 20} more.` : bakeryList.join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`📋 ${interaction.user.username}'s Bakeries Owned`)
        .setColor(0x2D3436)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
        .setDescription(bakeryList.length ? listPreview : 'You do not own any bakeries.')
        .addFields(
          { name: 'Menu Marker', value: bakeryList.filter(line => line.startsWith('⭐')).length ? '⭐ = On your menu' : 'No active menu items yet', inline: false },
          { name: 'Total Owned', value: String(owned.length), inline: true },
          { name: 'Category Mix', value: catSummary || 'No categories yet', inline: true }
        )
        .setFooter({ text: 'Use /mymenu to manage your lineup. Showing up to 20 bakeries in preview.' });
      await sendOrFallback(interaction, { embeds: [embed] });
      return;
    }

    if (customId !== 'add_menu_item' && customId !== 'remove_menu_item') {
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(customId === 'add_menu_item' ? 'add_menu_modal' : 'remove_menu_modal')
      .setTitle(customId === 'add_menu_item' ? 'Add Bakery to Menu' : 'Remove Bakery from Menu')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('bakery_id')
            .setLabel('Bakery ID')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(customId === 'add_menu_item' ? 'Example: 7 (must be owned)' : 'Example: 7 (must be on menu)')
            .setMinLength(1)
            .setMaxLength(6)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);
  },
  async handleModal(interaction) {
    const userId = interaction.user.id;
    const profile = getProfile(userId);
    if (!profile) return await sendOrFallback(interaction, { content: NO_PROFILE_MESSAGE, flags: MessageFlags.Ephemeral });

    if (!Array.isArray(profile.menu)) profile.menu = [];
    profile.menu = profile.menu.map(Number).filter(Number.isFinite);
    const ownedBakeryIds = new Set((profile.bakeriesowned || []).map(Number).filter(Number.isFinite));

    const rawBakeryId = (interaction.fields.getTextInputValue('bakery_id') || '').trim();
    if (!/^\d+$/.test(rawBakeryId)) {
      return await sendOrFallback(interaction, { content: 'Please enter a valid numeric bakery ID.', flags: MessageFlags.Ephemeral });
    }

    const bakeryId = Number(rawBakeryId);
    const bakeriesMeta = loadBakeries();
    if (!bakeriesMeta[String(bakeryId)]) return await sendOrFallback(interaction, { content: `Bakery ID ${bakeryId} does not exist.`, flags: MessageFlags.Ephemeral });
    if (interaction.customId === 'add_menu_modal') {

      const maxSlots = getMaxSlots(profile);
      if (profile.menu.length >= maxSlots) return await sendOrFallback(interaction, { content: `Your menu is full (max ${maxSlots} bakeries).`, flags: MessageFlags.Ephemeral });
      if (profile.menu.includes(bakeryId)) return await sendOrFallback(interaction, { content: 'Bakery already on your menu.', flags: MessageFlags.Ephemeral });
      if (!ownedBakeryIds.has(bakeryId)) return await sendOrFallback(interaction, { content: 'You must own the bakery before adding it to your menu.', flags: MessageFlags.Ephemeral });

      try {
        const meta = bakeriesMeta[String(bakeryId)];
        const now = Date.now();
        const last = profile.LastBaked || 0;
        const remaining = 0;
        if (remaining > 0) {

          profile.BakeCooldown = 0;

          if (profile.StorageFullNotify) {
            profile.StorageFullNotifyAt = now;
          }
        }
      } catch (e) {
        console.error('Failed to add bakery to menu:', e);
      }

      profile.menu.push(bakeryId);
      profile.menu = [...new Set(profile.menu.map(Number).filter(Number.isFinite))];
      profile.menu.sort((a, b) => a - b);

      const meta = bakeriesMeta[String(bakeryId)];
      profile.storageTime = Math.min(180000 + profile.menu.length * 97500, 765000);
      updateProfile(userId, profile);
      await sendOrFallback(interaction, {
        content: `Added **${meta?.name || `Bakery ${bakeryId}`}** to your menu. Slots used: ${profile.menu.length}/${maxSlots}.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    } else if (interaction.customId === 'remove_menu_modal') {
      if (!profile.menu.includes(bakeryId)) return await sendOrFallback(interaction, { content: 'Bakery not on your menu.', flags: MessageFlags.Ephemeral });

      try {
        const meta = bakeriesMeta[String(bakeryId)];
        const now = Date.now();
        const last = profile.LastBaked || 0;
        const remaining = 0;
        if (remaining > 0) {
          profile.BakeCooldown = 0;

          if (profile.StorageFullNotify) {
            if (0 <= 0) {
              profile.StorageFullNotify = false;
              profile.StorageFullNotifyAt = 0;
            } else {
              profile.StorageFullNotifyAt = now;
            }
          }
        }
      } catch (e) {
        console.error('Failed to adjust BakeCooldown on remove_menu:', e);
      }

      profile.menu = profile.menu.filter(id => Number(id) !== bakeryId);

      const maxSlots = getMaxSlots(profile);
      const meta = bakeriesMeta[String(bakeryId)];
      profile.storageTime = Math.min(180000 + profile.menu.length * 97500, 765000);
      updateProfile(userId, profile);
      await sendOrFallback(interaction, {
        content: `Removed **${meta?.name || `Bakery ${bakeryId}`}** from your menu. Slots used: ${profile.menu.length}/${maxSlots}.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await sendOrFallback(interaction, { content: 'Menu updated!', flags: MessageFlags.Ephemeral });
  }
};
