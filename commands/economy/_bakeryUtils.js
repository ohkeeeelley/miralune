const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { updateBakeryProduction } = require('../../utils/bakeryProduction');
const AssetManager = require('../../model/AssetManager');
const { BITS, HARMONY, LOYALTY, CRATES, DIAMONDS, KEYS } = require('./currencyEmojis');
const {
  ensurePonyProgress,
  getAggregateHiredBonuses,
  awardHiredBakeXP,
  awardHiredBakeryLevelXP,
} = require('../../utils/ponyProgressionManager');

const NO_PROFILE_ERROR = 'NO_PROFILE';

function loadBakeries() {
  try { return require(path.join(__dirname, '..', '..', 'model', 'BakeryShop.js')); } catch (e) { return {}; }
}

function fmtNumber(n) { return new Intl.NumberFormat('en-US').format(n); }

function isWeekend() {
  const now = new Date();
  const day = now.getDay();
  return day === 0 || day === 5 || day === 6;
}

function relativeTimeFrom(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 1000) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s} second${s !== 1 ? 's' : ''} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

function generateProgressBar(progress, barLength = 10) {
  const filledCount = Math.round(progress * barLength);
  const emptyCount = barLength - filledCount;

  const emptyStart = '<:emptystart:1488615316643778743>';
  const emptyMiddle = '<:emptymiddle:1488615211639246868>';
  const emptyEnd = '<:emptyend:1488615114495234098>';

  const filledStart = '<:bluestartfill:1488614681760370779>';
  const filledMiddle = '<:bluefill:1488614802170446048>';
  const filledEnd = '<:bluefillend:1488614937235427509>';

  let bar = '';

  if (filledCount > 0) {
    bar += filledStart;
    for (let i = 1; i < filledCount; i++) bar += filledMiddle;
    bar += filledEnd;
  }

  if (emptyCount > 0) {
    bar += emptyStart;
    for (let i = 1; i < emptyCount; i++) bar += emptyMiddle;
    bar += emptyEnd;
  }

  return bar;
}

function hasBakeryEntries(obj) {
  return !!obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;
}

function resolveActiveBakeries(profile) {
  const nested = profile?.bakery?.items;
  const legacy = profile?.bakeries;
  const serverLegacy = profile?.server?.bakeries;

  const picked = hasBakeryEntries(nested)
    ? nested
    : hasBakeryEntries(legacy)
      ? legacy
      : hasBakeryEntries(serverLegacy)
        ? serverLegacy
        : (nested || legacy || serverLegacy || {});

  if (profile?.bakery && profile.bakery.items !== picked) {
    profile.bakery.items = picked;
  }

  return picked;
}

function getAccumulatedCount(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

async function buildBakeryEmbed(profile, bakeriesMeta, interaction, opts = {}) {
  const bakeries = resolveActiveBakeries(profile);
  const bakeryObjs = Object.values(bakeries);
  const now = Date.now();
  const lastBaked = profile.server?.LastBaked || profile.LastBaked || Date.now();
  const bakeCooldown = 0;
  const cooldownRemaining = Math.max(0, lastBaked + bakeCooldown * 1000 - now);

  const rawStorage = bakeryObjs.reduce((total, b) => total + getAccumulatedCount(b?.accumulated), 0);
  const maxStorage = profile.bakery?.maxbakestorage || profile.server?.maxbakestorage || 150;
  const currentStorage = Math.min(rawStorage, maxStorage);
  const storageProgress = Math.min(1, currentStorage / maxStorage);
  const storagePercentage = Math.round(storageProgress * 100);

  let statusLine = '';
  if (!bakeryObjs.length) statusLine = 'No bakeries owned.';
  else statusLine = generateProgressBar(storageProgress) + ` ${storagePercentage}%`;

  const allSold = (profile.stats && profile.stats.allTimeSold) || 0;
  const overallLevel = profile.BakeryLevel || profile.bakery?.level || 1;
  const location = profile.locations?.currentLocation
    || profile.server?.locations?.currentLocation
    || profile.CurrentLocation
    || profile.server?.locationName
    || profile.locationName
    || profile.location
    || 'Unassigned';

  if (!ContainerBuilder || !TextDisplayBuilder || !SeparatorBuilder) return null;

  const bakeryImagePath = path.join(__dirname, '../../assets/clan_assets/BakeryImage.png');

  let bakerySummary = '';
  const menu = Array.isArray(profile.menu) ? profile.menu : [];
  if (menu.length > 0) {
    const short = menu.map(id => {
      const meta = bakeriesMeta[String(id)] || {};
      const name = meta.name || (bakeryObjs.find(b => Number(b.id) === Number(id)) || {}).name || String(id);
      const bakeryEmoji = AssetManager.getBakeryEmoji(meta.emoji || name) || '';
      return `${bakeryEmoji} ${name}`;
    });
    bakerySummary = short.join(' • ');
  } else if (bakeryObjs.length === 0) {
    bakerySummary = 'No bakeries owned.';
  } else {
    const short = bakeryObjs.map(b => {
      const meta = bakeriesMeta[String(b.id)] || {};
      const bakeryEmoji = AssetManager.getBakeryEmoji(meta.emoji || b.name) || '';
      return `${bakeryEmoji} ${b.name}`;
    });
    bakerySummary = short.join(' • ');
  }

  const xpCurrent = profile.BakeryXP || profile.bakery?.xp || 0;
  const xpNext = profile.NextLevelXP || (overallLevel * 1000);
  const xpBar = generateProgressBar(Math.min(1, xpCurrent / xpNext));

  const bakeButton = new ButtonBuilder()
    .setCustomId('bake')
    .setLabel('Bake')
    .setEmoji('🥐')
    .setStyle(ButtonStyle.Success)
    .setDisabled(cooldownRemaining > 0);

  const storageNotifyEnabled = profile.bakery?.storageFullNotify === true || profile.server?.bakery?.storageFullNotify === true;
  const remindButton = new ButtonBuilder()
    .setCustomId(`remind_bake:${interaction.guildId}:${interaction.user.id}`)
    .setLabel(storageNotifyEnabled ? 'Notifications On' : 'Notify When Full')
    .setEmoji(storageNotifyEnabled ? '🔔' : '🔕')
    .setStyle(storageNotifyEnabled ? ButtonStyle.Success : ButtonStyle.Secondary);

  const container = new ContainerBuilder().setAccentColor(0xC07030);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 🥐 ${profile.bakeryName || 'Bakery'}`)
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `📍 ${location} · 🔷 Level ${overallLevel} · ⏳ ${relativeTimeFrom(profile.createdAt || Date.now())}\n` +
      `📊 **Total Sold:** ${fmtNumber(allSold)} · ✨ **XP:** ${fmtNumber(xpCurrent)} / ${fmtNumber(xpNext)}\n` +
      xpBar
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**My Menu**\n${bakerySummary}`)
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const storageLabel = currentStorage >= maxStorage ? '⚠️ **Storage Full!**' : '**Storage**';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${storageLabel}\n${statusLine}  *(${currentStorage} / ${maxStorage})*`
    )
  );

  const files = [];
  try {
    if (fs.existsSync(bakeryImagePath)) {
      files.push({ attachment: bakeryImagePath, name: 'BakeryImage.png' });
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL('attachment://BakeryImage.png')
        )
      );
    }
  } catch (e) {
    console.error('Error preparing bakery attachments:', e);
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addActionRowComponents(actionRow => actionRow.setComponents(bakeButton, remindButton));

  if (!opts.omitViewButton) {
    const viewButton = new ButtonBuilder().setCustomId('bakery').setLabel('View Bakery').setStyle(ButtonStyle.Secondary);
    container.addActionRowComponents(ar => ar.setComponents(viewButton));
  }

  const embed = new EmbedBuilder()
    .setTitle(`${profile.bakeryName || 'Bakery'} — ${interaction.user.username}`)
    .setColor(0x2b2d31)
    .setDescription([
      `📍 **Location:** ${location} | 🔷 **Level:** ${overallLevel}`,
      `📊 **Total Sold:** ${fmtNumber(allSold)} | ✨ **XP:** ${fmtNumber(xpCurrent)} / ${fmtNumber(xpNext)}`,
      `**My Menu**\n${bakerySummary}\n\n**Storage** — ${storagePercentage}% (${currentStorage}/${maxStorage})`
    ].filter(Boolean).join('\n\n'));

  try {
    if (fs.existsSync(bakeryImagePath)) embed.setImage('attachment://BakeryImage.png');
  } catch (e) { /* ignore */ }

  return {
    v2Containers: [container],
    files,
    embed,
    buttons: { bakeButton, remindButton }
  };
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    try {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`Failed to fetch image, status ${res.statusCode}`));
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    } catch (e) { reject(e); }
  });
}

async function performBake(interaction, guildId, userId) {
  try {
    if (!interaction || !guildId || !userId) return;

    updateBakeryProduction(userId, interaction.client, false);

    const profile = getProfile(userId);
    if (!profile) return { error: NO_PROFILE_ERROR };
    ensurePonyProgress(profile, userId);

    if (!profile.NextLevelXP && profile.bakery?.nextLevelXP) {
      profile.NextLevelXP = profile.bakery.nextLevelXP;
    }
    if (!profile.BakeryLevel && profile.bakery?.level) {
      profile.BakeryLevel = profile.bakery.level;
    }
    if (profile.BakeryXP === undefined && profile.bakery?.xp !== undefined) {
      profile.BakeryXP = profile.bakery.xp;
    }
    if (!profile.NextLevelXP || profile.NextLevelXP < 1000) {
      const bakeryLevel = profile.BakeryLevel || profile.bakery?.level || 1;
      profile.NextLevelXP = bakeryLevel * 1000;
    }

    const now = Date.now();
    const cooldownRemainingMs = 0;
    if (cooldownRemainingMs > 0) {
      return {
        cooldown: true,
        remainingSeconds: Math.ceil(cooldownRemainingMs / 1000),
        totalSeconds: 0
      };
    }

    const bakeriesMeta = loadBakeries();
    let totalSold = 0;
    let totalBits = 0;
    const soldCounts = [];

    const inServer = profile.InServer || profile.server?.inServer || false;
    const serverBooster = profile.ServerBooster || profile.server?.isServerBooster || false;

    const bakeries = resolveActiveBakeries(profile);
    for (const key of Object.keys(bakeries)) {
      const b = bakeries[key];
      const meta = bakeriesMeta[String(b.id)];
      if (!meta) continue;

      let items = getAccumulatedCount(b.accumulated);
      let lowAccumulationMultiplier = 1.0;
      if (items <= 0) {
        items = 1;
        lowAccumulationMultiplier = 0.1;
      }

      let perItem = Math.floor((meta.max + meta.min) / 2);
      let incomeMultiplier = 1.0;
      if (serverBooster) incomeMultiplier *= 1.3;
      if (inServer) incomeMultiplier *= 1.15;
      if (isWeekend()) incomeMultiplier *= 2;
      incomeMultiplier *= lowAccumulationMultiplier;
      perItem = Math.floor(perItem * incomeMultiplier);

      const earned = Math.floor(perItem * items * 0.7);
      const bakeryEmoji = AssetManager.getBakeryEmoji(meta.emoji || b.name);
      totalSold += items;
      totalBits += earned;
      soldCounts.push(`${bakeryEmoji} ${b.name} x${items}`);
    }

    let xpGained = 0;
    let levelledUp = false;
    const bonusMessageLines = [];

    if (totalSold > 0) {
      const maxItems = 150;
      const maxBaseXp = 226;
      const baseXp = Math.floor((totalSold / maxItems) * maxBaseXp);
      let bonusMultiplier = 1.0;

      if (serverBooster && inServer) bonusMultiplier = 1.6;
      else if (serverBooster || inServer) bonusMultiplier = 1.3;
      if (isWeekend()) bonusMultiplier *= 2;

      try {
        if (profile.ClanId) {
          const ClansManager = require('../../model/ClansManager');
          const ClanUIRenderer = require('../../model/ClanUIRenderer');
          const clan = ClansManager.getClanById(profile.ClanId);
          if (clan) {
            const clanBonus = ClanUIRenderer.calculateBakeBonus(
              clan.TotalClanBaked || 0,
              totalBits,
              profile.ClanMemberBaked || 0
            );
            if (clanBonus > totalBits) {
              const extraBits = clanBonus - totalBits;
              totalBits = clanBonus;
              bonusMessageLines.push(`🏰 Earned +${fmtNumber(extraBits)} bits from clan progression bonus!`);
            }
          }
        }
      } catch (e) {
        console.error('Failed to apply clan bonus:', e);
      }

      xpGained = Math.floor(baseXp * bonusMultiplier);

      const ponyBonuses = getAggregateHiredBonuses(profile, userId);
      if (ponyBonuses.bitsMultiplier > 0) {
        const beforeBits = totalBits;
        totalBits = Math.floor(totalBits * (1 + ponyBonuses.bitsMultiplier));
        bonusMessageLines.push(`🦄 Hired pony bonus: +${fmtNumber(totalBits - beforeBits)} bits (${(ponyBonuses.bitsMultiplier * 100).toFixed(1)}%)`);
      }
      if (ponyBonuses.xpMultiplier > 0) {
        const beforeXP = xpGained;
        xpGained = Math.floor(xpGained * (1 + ponyBonuses.xpMultiplier));
        bonusMessageLines.push(`🦄 Hired pony bonus: +${xpGained - beforeXP} bakery XP (${(ponyBonuses.xpMultiplier * 100).toFixed(1)}%)`);
      }

      profile.BakeryXP = (profile.BakeryXP || 0) + xpGained;

      if (!profile.balances) {
        profile.balances = { bits: 0, harmony: 0, diamonds: 0, crates: 0, keys: 0, loyalty: 0 };
      }
      if (ponyBonuses.extraCrateChance > 0 && Math.random() < ponyBonuses.extraCrateChance) {
        const crateBonus = Math.random() < 0.25 ? 2 : 1;
        profile.balances.crates = (profile.balances.crates || 0) + crateBonus;
        bonusMessageLines.push(`📦 Hired pony bonus: +${crateBonus} crate${crateBonus === 1 ? '' : 's'}`);
      }
      if (ponyBonuses.diamondBonusChance > 0 && Math.random() < ponyBonuses.diamondBonusChance) {
        const diamondBonus = 5 + Math.floor(Math.random() * 11);
        profile.balances.diamonds = (profile.balances.diamonds || 0) + diamondBonus;
        bonusMessageLines.push(`💎 Hired pony bonus: +${diamondBonus} diamonds`);
      }
      if (ponyBonuses.keyBonusChance > 0 && Math.random() < ponyBonuses.keyBonusChance) {
        const keyBonus = Math.random() < 0.2 ? 2 : 1;
        profile.balances.keys = (profile.balances.keys || 0) + keyBonus;
        bonusMessageLines.push(`${KEYS} Hired pony bonus: +${keyBonus} key${keyBonus === 1 ? '' : 's'}`);
      }
      if (ponyBonuses.loyaltyBonusChance > 0 && Math.random() < ponyBonuses.loyaltyBonusChance) {
        const loyaltyBonus = Math.random() < 0.15 ? 2 : 1;
        profile.balances.loyalty = (profile.balances.loyalty || 0) + loyaltyBonus;
        bonusMessageLines.push(`${LOYALTY} Hired pony bonus: +${loyaltyBonus} loyalty`);
      }
      if (ponyBonuses.harmonyBonusChance > 0 && Math.random() < ponyBonuses.harmonyBonusChance) {
        const harmonyBonus = 8 + Math.floor(Math.random() * 15);
        profile.balances.harmony = (profile.balances.harmony || 0) + harmonyBonus;
        bonusMessageLines.push(`${HARMONY} Hired pony bonus: +${harmonyBonus} harmony`);
      }
    }

    const prevBakeryLevel = Math.min(profile.BakeryLevel || 1, 100);
    let currentLevelXpReq = profile.NextLevelXP || (prevBakeryLevel * 1000);

    if (currentLevelXpReq < 1000) currentLevelXpReq = prevBakeryLevel * 1000;

    while (profile.BakeryXP >= currentLevelXpReq && profile.BakeryLevel < 100) {
      profile.BakeryXP -= currentLevelXpReq;
      profile.BakeryLevel += 1;
      levelledUp = true;
      const nextReq = profile.BakeryLevel * 1000;
      profile.NextLevelXP = nextReq;
      if (profile.bakery) {
        profile.bakery.level = profile.BakeryLevel;
        profile.bakery.nextLevelXP = nextReq;
      }
      console.log(`[LEVEL-UP] Leveled up to ${profile.BakeryLevel}! Remaining XP: ${profile.BakeryXP}`);
      currentLevelXpReq = nextReq;
    }

    const bakeryLevelsGained = Math.max(0, (profile.BakeryLevel || 1) - prevBakeryLevel);
    const hiredBakeXpResult = awardHiredBakeXP(profile, totalSold, userId);
    if (hiredBakeXpResult.xpEach > 0 && Array.isArray(profile.bakery?.hired) && profile.bakery.hired.length > 0) {
      bonusMessageLines.push(`🦄 Hired ponies gained +${hiredBakeXpResult.xpEach} XP from this bake.`);
    }
    const hiredBakeryLevelResult = awardHiredBakeryLevelXP(profile, bakeryLevelsGained, userId);
    if (hiredBakeryLevelResult.xpEach > 0 && bakeryLevelsGained > 0) {
      bonusMessageLines.push(`🦄 Hired ponies gained +${hiredBakeryLevelResult.xpEach} XP from bakery level up.`);
    }

    const leveledPonyNames = [];
    for (const e of hiredBakeXpResult.levelUps || []) leveledPonyNames.push(e.ponyName);
    for (const e of hiredBakeryLevelResult.levelUps || []) leveledPonyNames.push(e.ponyName);
    const uniqueLevelUps = [...new Set(leveledPonyNames)];
    if (uniqueLevelUps.length > 0) {
      bonusMessageLines.push(`⬆️ Pony level up: ${uniqueLevelUps.slice(0, 3).join(', ')}${uniqueLevelUps.length > 3 ? ' +' + (uniqueLevelUps.length - 3) + ' more' : ''}`);
    }

    if (profile.bakery) {
      profile.bakery.lastPonyBakeryLevelAwarded = profile.BakeryLevel || profile.bakery.level || 1;
    }

    if (profile.BakeryLevel > 100) {
      profile.BakeryLevel = 100;
      profile.BakeryXP = Math.min(profile.BakeryXP, 100000);
    }
    if (!profile.NextLevelXP) profile.NextLevelXP = profile.BakeryLevel * 1000;
    if (profile.bakery) {
      profile.bakery.nextLevelXP = profile.NextLevelXP;
      profile.bakery.level = profile.BakeryLevel;
    }

    if (!profile.balances) profile.balances = { bits: 0, harmony: 0, diamonds: 0, crates: 0, keys: 0, loyalty: 0 };
    profile.balances.bits += totalBits;

    const storedStats = profile.profile?.stats || {};
    if (!profile.stats) profile.stats = {
      allTimeSold: storedStats.allTimeSold || 0,
      totalBitsEarned: storedStats.totalBitsEarned || 0,
      totalMessages: storedStats.totalMessages || 0
    };
    profile.stats.allTimeSold = (profile.stats.allTimeSold || 0) + totalSold;
    profile.stats.totalBitsEarned = (profile.stats.totalBitsEarned || 0) + totalBits;
    profile.LastBaked = now;
    profile.BakeCooldown = 0;
    profile.StorageFullNotifyAt = now;

    const bakeriesToReset = resolveActiveBakeries(profile);
    for (const key of Object.keys(bakeriesToReset)) {
      bakeriesToReset[key].accumulated = 0;
      bakeriesToReset[key].lastCycleTime = now;
    }

    if (profile.bakery) {
      profile.bakery.bakestorage = 0;
      profile.bakery.storageFullNotified = false;
      profile.bakery.items = bakeriesToReset;
    }
    if (profile.server?.bakestorage !== undefined) profile.server.bakestorage = 0;
    if (profile.bakestorage !== undefined) profile.bakestorage = 0;

    updateProfile(userId, profile);

    try {
      const ClansManager = require('../../model/ClansManager');
      if (typeof totalSold === 'number' && totalSold > 0) {
        console.log('[CLAN-DEBUG] Starting clan bake update...');
        console.log('[CLAN-DEBUG] User ID:', userId);
        console.log('[CLAN-DEBUG] Total Sold:', totalSold);
        const p = require('../../utils/profileManager').getProfile(userId);
        console.log('[CLAN-DEBUG] User Profile ClanId:', p ? p.ClanId : 'No profile');

        if (p && p.ClanId) {
          console.log('[CLAN-DEBUG] Found clan ID:', p.ClanId);
          const clan = ClansManager.getClanById(p.ClanId);
          console.log('[CLAN-DEBUG] Current clan TotalClanBaked:', clan ? clan.TotalClanBaked : 'No clan found');
        }

        ClansManager.addBaked(userId, totalSold, require('../../utils/profileManager').getProfile);

        try {
          if (p) {
            const allTimeBaked = (p.AllTimeBaked || 0) + totalSold;
            const clanMemberBaked = p.ClanId ? (p.ClanMemberBaked || 0) + totalSold : (p.ClanMemberBaked || 0);
            console.log('[CLAN-DEBUG] Updated ClanMemberBaked to:', clanMemberBaked);
            if (p.ClanId) {
              const clanAfter = ClansManager.getClanById(p.ClanId);
              console.log('[CLAN-DEBUG] Clan TotalClanBaked after update:', clanAfter ? clanAfter.TotalClanBaked : 'No clan found');
            }
            require('../../utils/profileManager').updateProfile(userId, {
              AllTimeBaked: allTimeBaked,
              ClanMemberBaked: clanMemberBaked
            });
          }
        } catch (e) {
          console.error('[CLAN-DEBUG] Error updating profile:', e);
        }
      }
    } catch (e) {
      console.error('Failed to update clan bake counts:', e);
    }

    const currentBaked = fmtNumber(totalSold);
    const currentEarned = fmtNumber(totalBits);
    const countsLine = soldCounts.length ? soldCounts.join(', ') : 'No bakeries owned.';

    const weekend = isWeekend();
    if (weekend && serverBooster && inServer) bonusMessageLines.push("🌟 You've earned ~3x more (2x weekend + 45% server booster & in server)!");
    else if (weekend && serverBooster) bonusMessageLines.push("🌟 You've earned 2.6x more (2x weekend + 30% server booster)!");
    else if (weekend && inServer) bonusMessageLines.push("🌟 You've earned 2.3x more (2x weekend + 15% for being in server)!");
    else if (weekend) bonusMessageLines.push("🌟 You've earned 2x more for baking on the weekend!");
    else if (serverBooster && inServer) bonusMessageLines.push("⭐ You've earned 45% more for being a server booster and in the server!");
    else if (serverBooster) bonusMessageLines.push("⭐ You've earned 30% more for being a server booster!");
    else if (inServer) bonusMessageLines.push("✨ You've earned 15% more for being in the server!");

    const bonusMessage = bonusMessageLines.join('\n');

    const bakeXpCurrent = profile.BakeryXP || profile.bakery?.xp || 0;
    const bakeXpNext = profile.NextLevelXP || ((profile.BakeryLevel || 1) * 1000);
    const bakeXpBar = generateProgressBar(Math.min(1, bakeXpCurrent / bakeXpNext));
    const currentLevel = profile.BakeryLevel || profile.bakery?.level || 1;

    const resultText =
      `🎉 ${interaction.user.username}'s Baking Results!\n\n` +
      ` __You baked: ${currentBaked} items and earned ${BITS} ${currentEarned} bits.__` +
      (bonusMessage ? `\n${bonusMessage}` : '') +
      `\n\n**My Summary**:\n${countsLine}\n\n` +
      `≿━━━━━━━━━━━━━━━༺ **EXPERIENCE** ༻━━━━━━━━━━━━━━━≾\n` +
      `• **Bakery Level**: ${currentLevel}\n• **XP Earned**: +${xpGained}`;

    const viewBakeryButton = new ButtonBuilder().setCustomId('bakery').setLabel('View Bakery').setStyle(ButtonStyle.Secondary);
    const viewBalanceButton = new ButtonBuilder().setCustomId('view_balance').setLabel('View Balances').setStyle(ButtonStyle.Secondary);

    const resultContainer = new ContainerBuilder().setAccentColor(0x4CAF50);

    resultContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## 🎉 ${interaction.user.username}'s Baking Results!`)
    );
    resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    let earningsText = `> You baked **${currentBaked}** items and earned ${BITS} **${currentEarned} bits**!`;
    if (bonusMessage) earningsText += `\n> ${bonusMessage}`;
    resultContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(earningsText)
    );
    resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    resultContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**My Summary**\n${countsLine}`)
    );
    resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    resultContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Experience**\n` +
        `> 🔷 **Level:** ${currentLevel}\n` +
        `> ✨ **XP Earned:** +${xpGained}\n` +
        `> ${bakeXpBar}  ${fmtNumber(bakeXpCurrent)} / ${fmtNumber(bakeXpNext)}`
      )
    );
    resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    resultContainer.addActionRowComponents(ar => ar.setComponents(viewBakeryButton, viewBalanceButton));

    const files = [];

    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${interaction.user.username}'s Results!`)
      .setColor(0x2b2d31)
      .setDescription(resultText);

    return {
      v2Containers: [resultContainer],
      profile,
      bakeriesMeta,
      files,
      embed,
      levelledUp
    };
  } catch (err) {
    console.error('performBake error:', err);
    throw err;
  }
}

module.exports = { buildBakeryEmbed, performBake, loadBakeries, fmtNumber, NO_PROFILE_ERROR };
