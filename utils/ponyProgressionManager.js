const allPonies = require('../model/MyLittlePonies');

const MAX_PONY_LEVEL = 55;
const PONY_LEVEL_XP_STEP = 800;
const MAX_HIRED_PONIES = 6;

const BONUS_TYPES = {
  NONE: 'none',
  XP: 'xpBoost',
  CRATE: 'crateBoost',
  BITS: 'bitsBoost',
  DIAMOND: 'diamondChance',
  SPEED: 'bakeSpeed',
  KEY: 'keyChance',
  LOYALTY: 'loyaltyChance',
  HARMONY: 'harmonyChance',
};

const BONUS_LABELS = {
  [BONUS_TYPES.NONE]: 'No bonus',
  [BONUS_TYPES.XP]: 'XP boost',
  [BONUS_TYPES.CRATE]: 'Crate drop chance',
  [BONUS_TYPES.BITS]: 'Bits boost',
  [BONUS_TYPES.DIAMOND]: 'Diamond reward chance',
  [BONUS_TYPES.SPEED]: 'Bake speed boost',
  [BONUS_TYPES.KEY]: 'Key reward chance',
  [BONUS_TYPES.LOYALTY]: 'Loyalty reward chance',
  [BONUS_TYPES.HARMONY]: 'Harmony reward chance',
};

const BONUS_SCALING = {
  [BONUS_TYPES.XP]: {
    Rare: { base: 4.0, perLevel: 0.12 },
    Epic: { base: 6.0, perLevel: 0.15 },
    Majestic: { base: 8.0, perLevel: 0.18 },
    Legend: { base: 11.0, perLevel: 0.22 },
    Goddess: { base: 13.0, perLevel: 0.24 },
    Secret: { base: 16.0, perLevel: 0.28 },
    Radiance: { base: 18.0, perLevel: 0.32 },
  },
  [BONUS_TYPES.CRATE]: {
    Rare: { base: 2.0, perLevel: 0.08 },
    Epic: { base: 3.0, perLevel: 0.10 },
    Majestic: { base: 4.5, perLevel: 0.12 },
    Legend: { base: 6.0, perLevel: 0.14 },
    Goddess: { base: 7.0, perLevel: 0.16 },
    Secret: { base: 8.5, perLevel: 0.18 },
    Radiance: { base: 9.5, perLevel: 0.20 },
  },
  [BONUS_TYPES.BITS]: {
    Rare: { base: 3.0, perLevel: 0.15 },
    Epic: { base: 5.0, perLevel: 0.18 },
    Majestic: { base: 8.0, perLevel: 0.24 },
    Legend: { base: 12.0, perLevel: 0.30 },
    Goddess: { base: 14.0, perLevel: 0.34 },
    Secret: { base: 18.0, perLevel: 0.40 },
    Radiance: { base: 21.0, perLevel: 0.45 },
  },
  [BONUS_TYPES.DIAMOND]: {
    Rare: { base: 1.5, perLevel: 0.10 },
    Epic: { base: 2.5, perLevel: 0.12 },
    Majestic: { base: 4.0, perLevel: 0.15 },
    Legend: { base: 6.0, perLevel: 0.18 },
    Goddess: { base: 7.5, perLevel: 0.20 },
    Secret: { base: 9.0, perLevel: 0.24 },
    Radiance: { base: 10.0, perLevel: 0.28 },
  },
  [BONUS_TYPES.SPEED]: {
    Rare: { base: 2.0, perLevel: 0.08 },
    Epic: { base: 3.0, perLevel: 0.10 },
    Majestic: { base: 5.0, perLevel: 0.13 },
    Legend: { base: 7.0, perLevel: 0.16 },
    Goddess: { base: 8.0, perLevel: 0.18 },
    Secret: { base: 10.0, perLevel: 0.22 },
    Radiance: { base: 12.0, perLevel: 0.26 },
  },
  [BONUS_TYPES.KEY]: {
    Rare: { base: 0.8, perLevel: 0.04 },
    Epic: { base: 1.2, perLevel: 0.05 },
    Majestic: { base: 1.8, perLevel: 0.06 },
    Legend: { base: 2.6, perLevel: 0.08 },
    Goddess: { base: 3.2, perLevel: 0.09 },
    Secret: { base: 4.0, perLevel: 0.10 },
    Radiance: { base: 4.8, perLevel: 0.12 },
  },
  [BONUS_TYPES.LOYALTY]: {
    Rare: { base: 1.4, perLevel: 0.06 },
    Epic: { base: 2.0, perLevel: 0.07 },
    Majestic: { base: 2.8, perLevel: 0.08 },
    Legend: { base: 3.8, perLevel: 0.10 },
    Goddess: { base: 4.6, perLevel: 0.12 },
    Secret: { base: 5.6, perLevel: 0.14 },
    Radiance: { base: 6.4, perLevel: 0.16 },
  },
  [BONUS_TYPES.HARMONY]: {
    Rare: { base: 1.8, perLevel: 0.07 },
    Epic: { base: 2.6, perLevel: 0.08 },
    Majestic: { base: 3.6, perLevel: 0.10 },
    Legend: { base: 4.8, perLevel: 0.12 },
    Goddess: { base: 5.8, perLevel: 0.14 },
    Secret: { base: 6.8, perLevel: 0.16 },
    Radiance: { base: 8.0, perLevel: 0.19 },
  },
};

const DUPLICATE_XP_BY_RARITY = {
  Common: 120,
  Rare: 220,
  Epic: 320,
  Majestic: 480,
  Legend: 650,
  Goddess: 800,
  Secret: 950,
  Radiance: 1100,
};

const PONY_MAP = new Map(allPonies.map((pony) => [Number(pony.id), pony]));

const RESTRICTED_BONUS_ALLOWLIST_BY_TYPE = {
  [BONUS_TYPES.KEY]: new Set(['Captain Celaeno', 'Element Of Magic']),
  [BONUS_TYPES.LOYALTY]: new Set(['Apple Bloom', 'Element Of Loyalty']),
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toTitleCase(text) {
  if (!text) return '';
  const value = String(text).trim();
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizePonyId(value) {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

function normalizeBonusType(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = Object.values(BONUS_TYPES).find((type) => type.toLowerCase() === raw.toLowerCase());
  return match || null;
}

function getConfiguredBonusType(pony) {
  if (!pony || typeof pony !== 'object') return null;
  const rawType = pony.bakeryBonus?.type ?? pony.bonusType;
  if (rawType === undefined || rawType === null) return null;
  return normalizeBonusType(rawType) || BONUS_TYPES.NONE;
}

function isRestrictedBonusAllowedForPony(bonusType, pony) {
  if (bonusType !== BONUS_TYPES.KEY && bonusType !== BONUS_TYPES.LOYALTY) return true;
  const allowedNames = RESTRICTED_BONUS_ALLOWLIST_BY_TYPE[bonusType];
  if (!allowedNames) return false;
  const ponyName = String(pony?.name || '').trim();
  return allowedNames.has(ponyName);
}

function describePonyBakeryBonus(pony) {
  const type = getConfiguredBonusType(pony);
  if (!type || type === BONUS_TYPES.NONE) return null;

  const label = BONUS_LABELS[type] || 'Bakery bonus';
  const note = String(pony?.bakeryBonus?.note || '').trim();
  return note ? `${label} - ${note}` : label;
}

function seedUnitInterval(seedInput) {
  const text = String(seedInput || '0');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function xpRequiredForLevel(level) {
  const safe = clamp(Number(level) || 1, 1, MAX_PONY_LEVEL);
  return safe * PONY_LEVEL_XP_STEP;
}

function defaultProgressEntry(userId, pony) {
  const ponyId = normalizePonyId(pony?.id);
  const rarity = toTitleCase(pony?.rarity) || 'Common';
  const bonusType = determineBonusType(userId, ponyId, rarity, pony);

  return {
    ponyId,
    name: pony?.name || `Pony #${ponyId}`,
    rarity,
    level: 1,
    xp: 0,
    bonusType,
  };
}

function determineBonusType(userId, ponyId, rarity, pony) {
  const configuredType = getConfiguredBonusType(pony);
  if (configuredType && isRestrictedBonusAllowedForPony(configuredType, pony)) return configuredType;

  if (!ponyId) return BONUS_TYPES.NONE;

  const rarityKey = toTitleCase(rarity);
  if (rarityKey === 'Common') return BONUS_TYPES.NONE;

  const unlockRoll = seedUnitInterval(`${userId}:${ponyId}:unlock`);

  if (rarityKey === 'Rare' && unlockRoll > 0.45) return BONUS_TYPES.NONE;
  if (rarityKey === 'Epic' && unlockRoll > 0.60) return BONUS_TYPES.NONE;

  const poolByRarity = {
    Rare: [BONUS_TYPES.XP, BONUS_TYPES.CRATE, BONUS_TYPES.BITS, BONUS_TYPES.HARMONY],
    Epic: [BONUS_TYPES.XP, BONUS_TYPES.CRATE, BONUS_TYPES.BITS, BONUS_TYPES.SPEED, BONUS_TYPES.HARMONY],
    Majestic: [BONUS_TYPES.XP, BONUS_TYPES.CRATE, BONUS_TYPES.BITS, BONUS_TYPES.DIAMOND, BONUS_TYPES.SPEED, BONUS_TYPES.HARMONY],
    Legend: [BONUS_TYPES.XP, BONUS_TYPES.CRATE, BONUS_TYPES.BITS, BONUS_TYPES.DIAMOND, BONUS_TYPES.SPEED, BONUS_TYPES.HARMONY],
    Goddess: [BONUS_TYPES.XP, BONUS_TYPES.CRATE, BONUS_TYPES.BITS, BONUS_TYPES.DIAMOND, BONUS_TYPES.SPEED, BONUS_TYPES.HARMONY],
    Secret: [BONUS_TYPES.XP, BONUS_TYPES.CRATE, BONUS_TYPES.BITS, BONUS_TYPES.DIAMOND, BONUS_TYPES.SPEED, BONUS_TYPES.HARMONY],
    Radiance: [BONUS_TYPES.XP, BONUS_TYPES.CRATE, BONUS_TYPES.BITS, BONUS_TYPES.DIAMOND, BONUS_TYPES.SPEED, BONUS_TYPES.HARMONY],
  };

  const pool = poolByRarity[rarityKey] || [BONUS_TYPES.XP, BONUS_TYPES.BITS, BONUS_TYPES.CRATE];
  const pick = Math.floor(seedUnitInterval(`${userId}:${ponyId}:type`) * pool.length);
  return pool[pick] || BONUS_TYPES.NONE;
}

function normalizeEntry(entry, userId, pony) {
  const ponyId = normalizePonyId(entry?.ponyId ?? pony?.id);
  const rarity = toTitleCase(entry?.rarity || pony?.rarity) || 'Common';
  const name = entry?.name || pony?.name || `Pony #${ponyId}`;
  const level = clamp(Number(entry?.level) || 1, 1, MAX_PONY_LEVEL);

  let xp = Number(entry?.xp) || 0;
  if (xp < 0) xp = 0;
  if (level >= MAX_PONY_LEVEL) {
    xp = clamp(xp, 0, xpRequiredForLevel(MAX_PONY_LEVEL));
  }

  let bonusType = entry?.bonusType;
  if (!bonusType || !Object.prototype.hasOwnProperty.call(BONUS_LABELS, bonusType) || !isRestrictedBonusAllowedForPony(bonusType, pony)) {
    bonusType = determineBonusType(userId, ponyId, rarity, pony);
  }

  return { ponyId, name, rarity, level, xp, bonusType };
}

function getPonyById(ponyId) {
  return PONY_MAP.get(Number(ponyId)) || null;
}

function getOwnedCollection(profile) {
  const fromGlobal = Array.isArray(profile?.global?.collection) ? profile.global.collection : [];
  const fromLegacy = Array.isArray(profile?.collection) ? profile.collection : [];
  return fromLegacy.length > 0 ? fromLegacy : fromGlobal;
}

function ensurePonyProgress(profile, userId) {
  if (!profile || typeof profile !== 'object') return profile;

  if (!profile.bakery || typeof profile.bakery !== 'object') profile.bakery = {};
  if (!Array.isArray(profile.bakery.hired)) profile.bakery.hired = [];
  if (!profile.bakery.ponyProgress || typeof profile.bakery.ponyProgress !== 'object' || Array.isArray(profile.bakery.ponyProgress)) {
    profile.bakery.ponyProgress = {};
  }

  profile.bakery.hired = profile.bakery.hired
    .map((id) => normalizePonyId(id))
    .filter((id, index, arr) => id !== null && arr.indexOf(id) === index)
    .slice(0, MAX_HIRED_PONIES);

  const currentBakeryLevel = Number(profile.BakeryLevel || profile.bakery.level || 1) || 1;
  if (!Number.isFinite(profile.bakery.lastPonyBakeryLevelAwarded)) {
    profile.bakery.lastPonyBakeryLevelAwarded = clamp(currentBakeryLevel, 1, 1000);
  }

  const owned = getOwnedCollection(profile);
  for (const ownedPony of owned) {
    const ponyId = normalizePonyId(ownedPony?.id ?? ownedPony);
    if (ponyId === null) continue;

    const pony = getPonyById(ponyId) || ownedPony;
    const existing = profile.bakery.ponyProgress[String(ponyId)];

    if (!existing) {
      profile.bakery.ponyProgress[String(ponyId)] = defaultProgressEntry(userId, pony);
      continue;
    }

    profile.bakery.ponyProgress[String(ponyId)] = normalizeEntry(existing, userId, pony);
  }

  return profile;
}

function getPonyProgress(profile, ponyId, userId) {
  const id = normalizePonyId(ponyId);
  if (id === null) return null;

  ensurePonyProgress(profile, userId);

  const key = String(id);
  if (!profile.bakery.ponyProgress[key]) {
    const pony = getPonyById(id) || { id };
    profile.bakery.ponyProgress[key] = defaultProgressEntry(userId, pony);
  }

  profile.bakery.ponyProgress[key] = normalizeEntry(profile.bakery.ponyProgress[key], userId, getPonyById(id));
  return profile.bakery.ponyProgress[key];
}

function addPonyXP(profile, ponyId, amount, userId) {
  const xpGain = Math.max(0, Math.floor(Number(amount) || 0));
  const entry = getPonyProgress(profile, ponyId, userId);
  if (!entry || xpGain <= 0) {
    return {
      xpGained: 0,
      levelsGained: 0,
      leveledUp: false,
      levelBefore: entry?.level || 1,
      levelAfter: entry?.level || 1,
      nextLevelXP: entry ? (entry.level >= MAX_PONY_LEVEL ? null : xpRequiredForLevel(entry.level)) : null,
    };
  }

  const levelBefore = entry.level;
  entry.xp += xpGain;

  while (entry.level < MAX_PONY_LEVEL) {
    const required = xpRequiredForLevel(entry.level);
    if (entry.xp < required) break;
    entry.xp -= required;
    entry.level += 1;
  }

  if (entry.level >= MAX_PONY_LEVEL) {
    entry.level = MAX_PONY_LEVEL;
    entry.xp = clamp(entry.xp, 0, xpRequiredForLevel(MAX_PONY_LEVEL));
  }

  const levelsGained = Math.max(0, entry.level - levelBefore);

  return {
    xpGained: xpGain,
    levelsGained,
    leveledUp: levelsGained > 0,
    levelBefore,
    levelAfter: entry.level,
    currentXP: entry.xp,
    nextLevelXP: entry.level >= MAX_PONY_LEVEL ? null : xpRequiredForLevel(entry.level),
  };
}

function awardDuplicateBefriendXP(profile, pony, userId) {
  const ponyId = normalizePonyId(pony?.id);
  if (ponyId === null) return null;

  const rarity = toTitleCase(pony?.rarity);
  const xpAward = DUPLICATE_XP_BY_RARITY[rarity] || 180;
  const xpResult = addPonyXP(profile, ponyId, xpAward, userId);

  return {
    ponyId,
    ponyName: pony?.name || `Pony #${ponyId}`,
    xpAward,
    ...xpResult,
  };
}

function awardHiredBakeXP(profile, totalSold, userId) {
  ensurePonyProgress(profile, userId);

  const sold = Math.max(0, Math.floor(Number(totalSold) || 0));
  if (sold <= 0 || !Array.isArray(profile.bakery.hired) || profile.bakery.hired.length === 0) {
    return { xpEach: 0, levelUps: [] };
  }

  const xpEach = clamp(Math.floor(sold * 0.45), 35, 220);
  const levelUps = [];

  for (const ponyId of profile.bakery.hired) {
    const result = addPonyXP(profile, ponyId, xpEach, userId);
    if (result.leveledUp) {
      const pony = getPonyById(ponyId);
      levelUps.push({ ponyId, ponyName: pony?.name || `Pony #${ponyId}`, ...result });
    }
  }

  return { xpEach, levelUps };
}

function awardHiredBakeryLevelXP(profile, levelsGained, userId) {
  ensurePonyProgress(profile, userId);

  const levels = Math.max(0, Math.floor(Number(levelsGained) || 0));
  if (levels <= 0 || !Array.isArray(profile.bakery.hired) || profile.bakery.hired.length === 0) {
    return { xpEach: 0, levelUps: [] };
  }

  const xpEach = levels * 180;
  const levelUps = [];

  for (const ponyId of profile.bakery.hired) {
    const result = addPonyXP(profile, ponyId, xpEach, userId);
    if (result.leveledUp) {
      const pony = getPonyById(ponyId);
      levelUps.push({ ponyId, ponyName: pony?.name || `Pony #${ponyId}`, ...result });
    }
  }

  return { xpEach, levelUps };
}

function calculateSinglePonyBonusPercent(entry) {
  if (!entry || entry.bonusType === BONUS_TYPES.NONE) return 0;
  const rarity = toTitleCase(entry.rarity);
  const cfg = BONUS_SCALING[entry.bonusType]?.[rarity];
  if (!cfg) return 0;

  const level = clamp(Number(entry.level) || 1, 1, MAX_PONY_LEVEL);
  const percent = cfg.base + (level - 1) * cfg.perLevel;
  return Math.max(0, percent);
}

function getAggregateHiredBonuses(profile, userId) {
  ensurePonyProgress(profile, userId);

  const hiredIds = Array.isArray(profile?.bakery?.hired) ? profile.bakery.hired : [];

  const totals = {
    bitsMultiplier: 0,
    xpMultiplier: 0,
    extraCrateChance: 0,
    diamondBonusChance: 0,
    bakeSpeedMultiplier: 0,
    keyBonusChance: 0,
    loyaltyBonusChance: 0,
    harmonyBonusChance: 0,
    contributors: [],
  };

  for (const ponyId of hiredIds) {
    const entry = getPonyProgress(profile, ponyId, userId);
    if (!entry || entry.bonusType === BONUS_TYPES.NONE) continue;

    const percent = calculateSinglePonyBonusPercent(entry);
    if (percent <= 0) continue;

    if (entry.bonusType === BONUS_TYPES.BITS) totals.bitsMultiplier += percent / 100;
    if (entry.bonusType === BONUS_TYPES.XP) totals.xpMultiplier += percent / 100;
    if (entry.bonusType === BONUS_TYPES.CRATE) totals.extraCrateChance += percent / 100;
    if (entry.bonusType === BONUS_TYPES.DIAMOND) totals.diamondBonusChance += percent / 100;
    if (entry.bonusType === BONUS_TYPES.SPEED) totals.bakeSpeedMultiplier += percent / 100;
    if (entry.bonusType === BONUS_TYPES.KEY) totals.keyBonusChance += percent / 100;
    if (entry.bonusType === BONUS_TYPES.LOYALTY) totals.loyaltyBonusChance += percent / 100;
    if (entry.bonusType === BONUS_TYPES.HARMONY) totals.harmonyBonusChance += percent / 100;

    totals.contributors.push({
      ponyId,
      name: entry.name,
      rarity: entry.rarity,
      level: entry.level,
      bonusType: entry.bonusType,
      bonusPercent: percent,
    });
  }

  totals.bitsMultiplier = clamp(totals.bitsMultiplier, 0, 2.5);
  totals.xpMultiplier = clamp(totals.xpMultiplier, 0, 2.0);
  totals.extraCrateChance = clamp(totals.extraCrateChance, 0, 0.75);
  totals.diamondBonusChance = clamp(totals.diamondBonusChance, 0, 0.65);
  totals.bakeSpeedMultiplier = clamp(totals.bakeSpeedMultiplier, 0, 1.2);
  totals.keyBonusChance = clamp(totals.keyBonusChance, 0, 0.45);
  totals.loyaltyBonusChance = clamp(totals.loyaltyBonusChance, 0, 0.55);
  totals.harmonyBonusChance = clamp(totals.harmonyBonusChance, 0, 0.6);

  return totals;
}

function getHiredPonyEntries(profile, userId) {
  ensurePonyProgress(profile, userId);

  const hiredIds = Array.isArray(profile?.bakery?.hired) ? profile.bakery.hired : [];
  const entries = [];

  for (const ponyId of hiredIds) {
    const entry = getPonyProgress(profile, ponyId, userId);
    if (!entry) continue;
    entries.push({
      ponyId,
      name: entry.name,
      rarity: entry.rarity,
      level: entry.level,
      xp: entry.xp,
      nextLevelXP: entry.level >= MAX_PONY_LEVEL ? null : xpRequiredForLevel(entry.level),
      bonusType: entry.bonusType,
      bonusPercent: calculateSinglePonyBonusPercent(entry),
    });
  }

  return entries;
}

function findOwnedPonyByQuery(profile, query) {
  const text = String(query || '').trim();
  const ownedCollection = getOwnedCollection(profile);

  if (!text) {
    return { match: null, matches: [] };
  }

  const ownedById = new Map();
  for (const item of ownedCollection) {
    const id = normalizePonyId(item?.id ?? item);
    if (id === null) continue;
    const pony = getPonyById(id) || item;
    if (!ownedById.has(id)) ownedById.set(id, pony);
  }

  const numericId = normalizePonyId(text);
  if (numericId !== null && ownedById.has(numericId)) {
    return { match: ownedById.get(numericId), matches: [ownedById.get(numericId)] };
  }

  const allOwned = [...ownedById.values()];
  const exact = allOwned.find((pony) => String(pony.name || '').toLowerCase() === text.toLowerCase());
  if (exact) {
    return { match: exact, matches: [exact] };
  }

  const partial = allOwned.filter((pony) => String(pony.name || '').toLowerCase().includes(text.toLowerCase()));
  if (partial.length === 1) {
    return { match: partial[0], matches: partial };
  }

  return { match: null, matches: partial.slice(0, 25) };
}

function hirePony(profile, ponyId, userId) {
  ensurePonyProgress(profile, userId);

  const id = normalizePonyId(ponyId);
  if (id === null) return { ok: false, error: 'Invalid pony id.' };

  const ownedIds = new Set(getOwnedCollection(profile).map((p) => normalizePonyId(p?.id ?? p)).filter((v) => v !== null));
  if (!ownedIds.has(id)) {
    return { ok: false, error: 'You can only hire ponies you already befriended.' };
  }

  if (profile.bakery.hired.includes(id)) {
    return { ok: false, error: 'That pony is already hired.' };
  }

  if (profile.bakery.hired.length >= MAX_HIRED_PONIES) {
    return { ok: false, error: `You can only hire up to ${MAX_HIRED_PONIES} ponies right now.` };
  }

  profile.bakery.hired.push(id);
  const entry = getPonyProgress(profile, id, userId);

  return {
    ok: true,
    pony: getPonyById(id) || { id, name: entry?.name || `Pony #${id}`, rarity: entry?.rarity || 'Unknown' },
    entry,
  };
}

function unhirePony(profile, ponyId, userId) {
  ensurePonyProgress(profile, userId);

  const id = normalizePonyId(ponyId);
  if (id === null) return { ok: false, error: 'Invalid pony id.' };

  const index = profile.bakery.hired.indexOf(id);
  if (index === -1) {
    return { ok: false, error: 'That pony is not currently hired.' };
  }

  profile.bakery.hired.splice(index, 1);
  const entry = getPonyProgress(profile, id, userId);

  return {
    ok: true,
    pony: getPonyById(id) || { id, name: entry?.name || `Pony #${id}`, rarity: entry?.rarity || 'Unknown' },
    entry,
  };
}

function formatBonusText(entry) {
  if (!entry || entry.bonusType === BONUS_TYPES.NONE) return 'No bonus';
  const percent = calculateSinglePonyBonusPercent(entry);
  return `+${percent.toFixed(1)}% ${BONUS_LABELS[entry.bonusType]}`;
}

function formatAggregateBonusLines(aggregate) {
  const lines = [];
  if (!aggregate) return lines;

  if (aggregate.bitsMultiplier > 0) lines.push(`Bits boost: +${(aggregate.bitsMultiplier * 100).toFixed(1)}%`);
  if (aggregate.xpMultiplier > 0) lines.push(`Bakery XP boost: +${(aggregate.xpMultiplier * 100).toFixed(1)}%`);
  if (aggregate.extraCrateChance > 0) lines.push(`Extra crate chance: +${(aggregate.extraCrateChance * 100).toFixed(1)}%`);
  if (aggregate.diamondBonusChance > 0) lines.push(`Diamond reward chance: +${(aggregate.diamondBonusChance * 100).toFixed(1)}%`);
  if (aggregate.bakeSpeedMultiplier > 0) lines.push(`Bake speed bonus: +${(aggregate.bakeSpeedMultiplier * 100).toFixed(1)}%`);
  if (aggregate.keyBonusChance > 0) lines.push(`Key reward chance: +${(aggregate.keyBonusChance * 100).toFixed(1)}%`);
  if (aggregate.loyaltyBonusChance > 0) lines.push(`Loyalty reward chance: +${(aggregate.loyaltyBonusChance * 100).toFixed(1)}%`);
  if (aggregate.harmonyBonusChance > 0) lines.push(`Harmony reward chance: +${(aggregate.harmonyBonusChance * 100).toFixed(1)}%`);

  return lines;
}

module.exports = {
  MAX_PONY_LEVEL,
  PONY_LEVEL_XP_STEP,
  MAX_HIRED_PONIES,
  BONUS_TYPES,
  BONUS_LABELS,
  describePonyBakeryBonus,
  getConfiguredBonusType,
  xpRequiredForLevel,
  getPonyById,
  ensurePonyProgress,
  getPonyProgress,
  addPonyXP,
  awardDuplicateBefriendXP,
  awardHiredBakeXP,
  awardHiredBakeryLevelXP,
  calculateSinglePonyBonusPercent,
  getAggregateHiredBonuses,
  getHiredPonyEntries,
  findOwnedPonyByQuery,
  hirePony,
  unhirePony,
  formatBonusText,
  formatAggregateBonusLines,
};
