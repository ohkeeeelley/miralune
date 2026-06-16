const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const EquestriaGirls = require('./MyLittlePonies');
const EmojiRarity = require('./EmojiRarity');
const { getProfile, updateProfile } = require('../utils/profileManager');
const { buildNoProfilePayload } = require('../utils/noProfileResponse');

const RARITY_WEIGHTS = { Common: 500, Rare: 300, Epic: 60, Majestic: 25, Legend: 4, Goddess: 2, Secret: 2, Radiance: 0.3 };
const SPAWN_EXCLUDED_RARITIES = new Set(['Seasonal', 'Event', 'OC', 'Unique']);

const SPAWN_MESSAGES = {
  Radiance: [
    "✨ A blinding light illuminates the entire sky!",
    "✨ The stars themselves seem to bow in reverence!",
    "✨ An otherworldly presence fills the air!",
    "✨ A legendary figure appears in a flash of divine light!",
    "✨ The boundaries between realms blur with radiant energy!",
    "✨ Time itself seems to pause in this magnificent moment!",
    "✨ A cascade of celestial light reveals something extraordinary!",
    "✨ The very fabric of reality shimmers with power!"
  ],
  Secret: [
    "🌟 A mysterious shadow dances at the edge of vision...",
    "🌟 Whispers of ancient secrets echo through the air...",
    "🌟 The veil between worlds grows mysteriously thin...",
    "🌟 An enigmatic presence makes itself known...",
    "🌟 The shadows seem to hide something special...",
    "🌟 Time and space bend in impossible ways...",
    "🌟 Reality shifts, revealing hidden wonders...",
    "🌟 The air crackles with mysterious energy..."
  ],
  Goddess: [
    "👑 The heavens part to reveal something divine!",
    "👑 A presence of immense power graces the realm!",
    "👑 Divine energy cascades from the skies!",
    "👑 The very ground trembles with celestial might!",
    "👑 A godly aura fills the atmosphere!",
    "👑 Reality bends before divine majesty!",
    "👑 The air itself hums with sacred power!",
    "👑 Time stands still before this divine moment!"
  ],
  Legend: [
    "🌈 A tale of legend unfolds before your eyes!",
    "🌈 History itself seems to come alive!",
    "🌈 The stuff of legends appears!",
    "🌈 A mythical presence graces the land!",
    "🌈 Stories come to life in magnificent fashion!",
    "🌈 A legendary figure emerges from myth!",
    "🌈 The air fills with legendary power!",
    "🌈 A being of great renown appears!"
  ],
  Majestic: [
    "👸 A majestic figure appears with royal grace!",
    "👸 The air sparkles with regal energy!",
    "👸 A noble presence commands attention!",
    "👸 Royal splendor fills the atmosphere!",
    "👸 A distinguished figure approaches!",
    "👸 The essence of nobility manifests!",
    "👸 A presence of remarkable dignity appears!",
    "👸 Majestic power flows through the air!"
  ],
  Epic: [
    "⭐ An extraordinary sight catches your eye!",
    "⭐ Something remarkable appears!",
    "⭐ A powerful presence makes itself known!",
    "⭐ The air tingles with epic energy!",
    "⭐ An impressive figure emerges!",
    "⭐ Something special draws near!",
    "⭐ A remarkable encounter awaits!",
    "⭐ Epic power radiates through the area!"
  ],
  Rare: [
    "💫 An uncommon sight greets your eyes!",
    "💫 Something unusual catches your attention!",
    "💫 A rare opportunity presents itself!",
    "💫 An unexpected visitor appears!",
    "💫 A special encounter unfolds!",
    "💫 Something unique draws near!",
    "💫 A rare moment manifests!",
    "💫 An unusual presence approaches!"
  ],
  Common: [
    "🌟 A friendly face appears nearby!",
    "🌟 Someone waves at you with a smile!",
    "🌟 A cheerful presence brightens the day!",
    "🌟 You notice someone approaching!",
    "🌟 A warm greeting catches your attention!",
    "🌟  Someone new comes into view!",
    "🌟 A pleasant encounter awaits!",
    "🌟 You spot a friendly visitor!"
  ]
};

const channelMessageCounts = new Map();
const channelTargets = new Map();
const channelLocks = new Map();
const channelCooldowns = new Map();
const activeSpawns = new Map();
const guildMessageCounts = new Map();
const guildTargets = new Map();

const MIN_MESSAGES = 20;
const MAX_MESSAGES = 40;
const COOLDOWN_MS = 1500;
const SPAWN_LIFETIME_MS = 10 * 60 * 1000;
const MAX_GUESSES_PER_USER = 3;

function randomBetween(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function getChannelTarget(guildId, channelId) {
  let t = channelTargets.get(channelId);
  if (t) return t;
  try {
    const cfg = loadServerConfig(guildId);
    if (cfg && cfg.channelTargets && cfg.channelTargets[channelId]) {
      t = Number(cfg.channelTargets[channelId]) || randomBetween(MIN_MESSAGES, MAX_MESSAGES);
      channelTargets.set(channelId, t);
      return t;
    }
  } catch (e) {}
  t = randomBetween(MIN_MESSAGES, MAX_MESSAGES);
  channelTargets.set(channelId, t);
  try { const cfg = loadServerConfig(guildId); cfg.channelTargets = cfg.channelTargets || {}; cfg.channelTargets[channelId] = t; saveServerConfig(guildId, cfg); } catch (e) {}
  return t;
}

async function getGuildTarget(guildId) {
  let t = guildTargets.get(guildId);
  if (t) return t;
  try {
    const cfg = loadServerConfig(guildId);
    if (cfg && cfg.guildTarget) {
      t = Number(cfg.guildTarget) || randomBetween(MIN_MESSAGES, MAX_MESSAGES);
      guildTargets.set(guildId, t);
      return t;
    }
  } catch (e) {}
  t = randomBetween(MIN_MESSAGES, MAX_MESSAGES);
  guildTargets.set(guildId, t);
  try { const cfg = loadServerConfig(guildId); cfg.guildTarget = t; saveServerConfig(guildId, cfg); } catch (e) {}
  return t;
}

function pickEG() {

  const egEnabled = process.env.EQUESTRIA_GIRL_SPAWN_TRIGGER !== 'false';
  const ponyEnabled = process.env.PONY_SPAWN_TRIGGER !== 'false';
  const available = EquestriaGirls.filter(p => {
    if (p.category === 'Equestria Girls' && !egEnabled) return false;
    if (p.category === 'Pony' && !ponyEnabled) return false;
    if (SPAWN_EXCLUDED_RARITIES.has(p.rarity)) return false;
    return true;
  });
  if (available.length === 0) return null;

  const entries = Object.entries(RARITY_WEIGHTS);
  const total = entries.reduce((acc, [, w]) => acc + Number(w || 0), 0);
  if (total <= 0) return available[Math.floor(Math.random() * available.length)];
  let roll = Math.random() * total;
  let selected = entries[entries.length - 1][0];
  for (const [k, w] of entries) { if (roll < w) { selected = k; break; } roll -= w; }
  const pool = available.filter(e => e.rarity === selected);
  if (!pool.length) return available[Math.floor(Math.random() * available.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

function getEGImage(name) {
  if (!name) return null;

  const tryPaths = [
    path.join(__dirname, '..', 'assets', 'ponies_assets', 'equestria_girls', name),
    path.join(__dirname, '..', 'assets', 'ponies_assets', 'equestria_girls', name.toLowerCase()),
    path.join(__dirname, '..', 'assets', 'ponies_assets', 'pony', name),
    path.join(__dirname, '..', 'assets', 'ponies_assets', 'pony', name.toLowerCase()),
    path.join(__dirname, '..', 'assets', name),
    path.join(__dirname, '..', 'assets', name.toLowerCase())
  ];
  for (const p of tryPaths) {
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return null;
}

function getRarityTier(rarity) {
  const highRarity = ['Radiance', 'Secret', 'Goddess'];
  const midRarity = ['Legend', 'Majestic', 'Epic'];
  const lowRarity = ['Rare', 'Common'];

  if (highRarity.includes(rarity)) return 'high';
  if (midRarity.includes(rarity)) return 'mid';
  if (lowRarity.includes(rarity)) return 'low';
  return 'low';
}

function getCorrectGuessRewards(rarity) {
  const tier = getRarityTier(rarity);
  let xp, bits;

  if (tier === 'high') {
    xp = randomBetween(300, 400);
    bits = randomBetween(500, 800);
  } else if (tier === 'mid') {
    xp = randomBetween(200, 250);
    bits = randomBetween(300, 500);
  } else {
    xp = randomBetween(100, 150);
    bits = randomBetween(150, 300);
  }

  return { xp, bits };
}

function getWrongGuessRewards() {
  return { xp: 50, bits: 200 };
}

function getRarityEmoji(rarity) {
  if (!rarity) return '';
  const entry = EmojiRarity[rarity] || EmojiRarity[String(rarity)];
  if (!entry) return String(rarity);
  return Array.isArray(entry) ? entry.join(' ') : String(entry);
}

function maskFullName(name) {
  if (!name) return '``';
  return '`' + name.split(' ').map(part => part.split('').map((ch, i) => (/[A-Za-z]/.test(ch) ? (i === 0 ? ch : '_') : ch)).join(' ')).join('     ') + '`';
}

async function withChannelLock(channelId, fn) {
  if (channelLocks.get(channelId)) return false;
  channelLocks.set(channelId, true);
  try { return await fn(); } finally { channelLocks.delete(channelId); }
}

function loadServerConfig(guildId) {
  try {
    const p = path.join(__dirname, '..', 'data', 'ponyspawn', `${guildId}.json`);
    const raw = fs.readFileSync(p, 'utf8') || '{}';
    const parsed = JSON.parse(raw || '{}');
    if (parsed && Array.isArray(parsed.spawnChannels)) parsed.spawnChannels = parsed.spawnChannels.map(s => String(s).trim()); else parsed.spawnChannels = [];
    if (!parsed.channelTargets || typeof parsed.channelTargets !== 'object') parsed.channelTargets = {};
    if (!parsed.channelCounters || typeof parsed.channelCounters !== 'object') parsed.channelCounters = {};
    if (!parsed.guildMessageCount) parsed.guildMessageCount = 0;
    if (!parsed.guildTarget) parsed.guildTarget = null;
    return parsed;
  } catch (e) { return { spawnChannels: [], channelTargets: {}, channelCounters: {}, guildMessageCount: 0, guildTarget: null }; }
}

function saveServerConfig(guildId, cfg) {
  try {
    const dir = path.join(__dirname, '..', 'data', 'ponyspawn');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, `${guildId}.json`);
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[autoSpawn] saveServerConfig error', e);
    return false;
  }
}

async function handleMessage(message, client) {
  try {
    if (!message || !message.guild || message.author?.bot) return;

    const guildId = message.guild.id;
    const cfg = loadServerConfig(guildId) || { spawnChannels: [] };
    const configured = (cfg.spawnChannels || []).map(String);

    if (configured.length === 0) return;

    const channelId = message.channel.id;

    let activeSpawnChannelId = null;
    for (const cfgChannelId of configured) {
      const active = activeSpawns.get(cfgChannelId);
      if (active) {
        activeSpawnChannelId = cfgChannelId;
        break;
      }
    }

    if (activeSpawnChannelId) {
      const active = activeSpawns.get(activeSpawnChannelId);

      if (Date.now() > active.expiresAt) {
        activeSpawns.delete(activeSpawnChannelId);
        return;
      } else {
        // Normalize function to handle whitespace and special characters consistently
        const normalize = (str) => {
          return String(str || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .replace(/['']/g, "'") // Normalize apostrophes
            .replace(/[""]/g, '"') // Normalize quotes
            .normalize('NFD')      // Unicode normalization
            .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
        };
        
        const guess = normalize(message.content);
        const answer = normalize(active.answer);
        const match = guess === answer;
        console.log(`[autoSpawn] Guess by ${message.author.username} (${message.author.id}): "${guess}" | Answer: "${answer}" | Match: ${match}`);
        
        if (guess && answer && match) {

          await withChannelLock(activeSpawnChannelId, async () => {
            const curr = activeSpawns.get(activeSpawnChannelId);
            if (!curr) return;
            const eg = curr.eg;
            const uid = message.author.id;

            try {
              const baseProfile = getProfile(uid);
              if (!baseProfile) {
                try { await message.reply(buildNoProfilePayload({ ephemeral: false })); } catch (e) {}
                return;
              }

              const rawProfile = baseProfile.profile || baseProfile;
              const collection = rawProfile.global?.collection ?? rawProfile.collection ?? [];
              const befriendedPonies = rawProfile.global?.befriendedPonies ?? rawProfile.befriendedPonies ?? [];
              const already = collection.some(c => String(c.id ?? c).toLowerCase() === String(eg.id).toLowerCase());
              const rewards = getCorrectGuessRewards(eg.rarity);
              const existingWallet = rawProfile.wallet || rawProfile.balances || {};
              const currentBits = existingWallet.bits ?? 0;
              const currentBakery = baseProfile.bakery || rawProfile.bakery || {};

              if (!already) {
                const newCollection = [...collection, { id: eg.id, name: eg.name, png: eg.png, rarity: eg.rarity }];
                const newBefriended = [...befriendedPonies, { id: eg.id, name: eg.name, png: eg.png, rarity: eg.rarity, befriendedAt: new Date().toISOString() }];
                updateProfile(uid, {
                  collection: newCollection,
                  befriendedPonies: newBefriended,
                  wallet: { ...existingWallet, bits: currentBits + rewards.bits },
                  bakery: { ...currentBakery, xp: (currentBakery.xp || 0) + rewards.xp, nextLevelXP: currentBakery.nextLevelXP || (currentBakery.level || 1) * 1000 }
                });
              } else {
                updateProfile(uid, {
                  wallet: { ...existingWallet, bits: currentBits + rewards.bits },
                  bakery: { ...currentBakery, xp: (currentBakery.xp || 0) + rewards.xp, nextLevelXP: currentBakery.nextLevelXP || (currentBakery.level || 1) * 1000 }
                });
              }

              if (curr.expiryTimer) clearTimeout(curr.expiryTimer);

              const winEmbed = new EmbedBuilder()
                .setTitle('🎉 Pony Befriended!')
                .setDescription(`<@${uid}> befriended **${eg.name}**!${already ? '\n*(Already owned — bits and XP added!)*' : ''}\n\n**Rewards:** ✨ +${rewards.xp} XP  💰 +${rewards.bits} Bits`)
                .setColor(0x000000)
                .setFooter({ text: `ID: ${eg.id}` });
              const spawnCh = client.channels.cache.get(activeSpawnChannelId)
                || await client.channels.fetch(activeSpawnChannelId).catch(() => null);
              await (spawnCh || message.channel).send({ embeds: [winEmbed] }).catch(() => null);
            } catch (befriendErr) {
              console.error('[autoSpawn] Error during befriend for', uid, ':', befriendErr);
              await message.channel.send(`<@${uid}> Something went wrong while befriending the pony. Please try again.`).catch(() => {});
            } finally {
              activeSpawns.delete(activeSpawnChannelId);
              channelCooldowns.set(activeSpawnChannelId, Date.now());
            }
          });

          return;
        }

      }
    }

    const guildPrev = guildMessageCounts.get(guildId) || Number(cfg.guildMessageCount || 0) || 0;
    const guildNext = guildPrev + 1;
    guildMessageCounts.set(guildId, guildNext);
    cfg.guildMessageCount = guildNext;
    saveServerConfig(guildId, cfg);

    const guildTarget = await getGuildTarget(guildId);
    console.log(`[autoSpawn] Guild ${guildId}: ${guildNext}/${guildTarget} messages`);

    if ((guildMessageCounts.get(guildId) || 0) < guildTarget) return;

    const spawnChannelId = configured[Math.floor(Math.random() * configured.length)];

    if (activeSpawns.has(spawnChannelId)) return;

    let reserved = null;
    const reservedOk = await withChannelLock(spawnChannelId, async () => {

      if ((guildMessageCounts.get(guildId) || 0) < guildTarget) return false;
      const last = channelCooldowns.get(spawnChannelId) || 0;
      if (Date.now() - last < COOLDOWN_MS) return false;
      if (activeSpawns.has(spawnChannelId)) return false;
      const eg = pickEG();
      if (!eg) return false;
      
      // Normalize the answer to ensure consistent comparison
      const normalizedAnswer = String(eg.name || '')
        .trim()
        .replace(/\s+/g, ' ');  // Replace multiple spaces with single space
      
      reserved = { eg, answer: normalizedAnswer, spawnMessageId: null, expiresAt: Date.now() + SPAWN_LIFETIME_MS, status: 'pending', expiryTimer: null };
      activeSpawns.set(spawnChannelId, reserved);
      channelCooldowns.set(spawnChannelId, Date.now());
      guildMessageCounts.set(guildId, 0);
      cfg.guildMessageCount = 0;
      let newTarget;
      do { newTarget = randomBetween(MIN_MESSAGES, MAX_MESSAGES); } while (Number(newTarget) === Number(guildTarget));
      guildTargets.set(guildId, newTarget);
      return true;
    });
    if (!reservedOk || !reserved) return;

    try {
      const scfg = loadServerConfig(guildId);
      scfg.guildMessageCount = 0;
      scfg.guildTarget = guildTargets.get(guildId);
      saveServerConfig(guildId, scfg);
    } catch (e) {}

    try {
      const eg = reserved.eg;

      const _imgFolder = eg.category === 'Equestria Girls' ? 'equestria_girls' : 'pony';
      const _imgPath = path.join(__dirname, '..', 'assets', 'ponies_assets', _imgFolder, eg.png);
      const img = fs.existsSync(_imgPath) ? _imgPath : null;
      const rarity = getRarityEmoji(eg.rarity);
      const masked = maskFullName(eg.name);
      const locationTag = eg.adventureTag || 'Ponyville';
      const rarityMessages = SPAWN_MESSAGES[eg.rarity] || SPAWN_MESSAGES.Common;
      const spawnMsg = rarityMessages[Math.floor(Math.random() * rarityMessages.length)];

      const container = new ContainerBuilder();
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`${spawnMsg}\n**[${locationTag}]** A wild pony has appeared!  ${rarity}`)
      );
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      if (img) {
        const mediaGallery = new MediaGalleryBuilder();
        mediaGallery.addItems(new MediaGalleryItemBuilder().setURL(`attachment://${eg.png}`));
        container.addMediaGalleryComponents(mediaGallery);
      }
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Name:** ${masked}\n*Type the pony's full name in chat to befriend it!*`)
      );

      const files = img ? [{ attachment: img, name: eg.png }] : [];
      const ch = client.channels.cache.get(spawnChannelId) || await client.channels.fetch(spawnChannelId).catch(() => null);
      if (!ch) { activeSpawns.delete(spawnChannelId); channelCooldowns.set(spawnChannelId, Date.now()); return; }
      try {
        const perm = client?.user ? ch.permissionsFor(client.user) : null;
        if (perm && !perm.has('SendMessages')) { activeSpawns.delete(spawnChannelId); channelCooldowns.set(spawnChannelId, Date.now()); return; }
      } catch (e) {}

      const sent = await (typeof ch.send === 'function'
        ? ch.send({ components: [container], files, flags: MessageFlags.IsComponentsV2 }).catch(() => null)
        : Promise.resolve(null));

      if (sent) {
        const curr = activeSpawns.get(spawnChannelId);
        if (curr) {
          curr.spawnMessageId = sent.id;
          curr.status = 'active';

          curr.expiryTimer = setTimeout(() => {
            const existing = activeSpawns.get(spawnChannelId);
            if (existing && existing.spawnMessageId === sent.id) {
              activeSpawns.delete(spawnChannelId);
            }
          }, SPAWN_LIFETIME_MS);
          activeSpawns.set(spawnChannelId, curr);
        }
      } else {

        const curr = activeSpawns.get(spawnChannelId);
        if (curr && curr === reserved) {
          activeSpawns.delete(spawnChannelId);
        }
        channelCooldowns.set(spawnChannelId, Date.now());
      }
    } catch (err) {

      const curr = activeSpawns.get(spawnChannelId);
      if (curr && curr === reserved) {
        activeSpawns.delete(spawnChannelId);
      }
      channelCooldowns.set(spawnChannelId, Date.now());
    }
  } catch (err) {
    console.error('[autoSpawn] Error in handleMessage', err);
  }
}

module.exports = { handleMessage, maskFullName, getRarityEmoji };
