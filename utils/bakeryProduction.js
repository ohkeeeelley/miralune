const { getProfile, updateProfile } = require('./profileManager');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { getAggregateHiredBonuses } = require('./ponyProgressionManager');

function loadBakeries() {
  try {
    return require(path.join(__dirname, '..', 'model', 'BakeryShop.js'));
  } catch (e) {
    return {};
  }
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

function parseTimestampMs(value, fallbackMs) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return fallbackMs;
}

function hasEntries(obj) {
  return !!obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;
}

function resolveBakeryItems(profile) {
  if (!profile || typeof profile !== 'object') return {};

  if (!profile.bakery || typeof profile.bakery !== 'object') profile.bakery = {};

  const nested = profile.bakery.items;
  const legacy = profile.bakeries;
  const serverLegacy = profile.server?.bakeries;

  const picked = hasEntries(nested)
    ? nested
    : hasEntries(legacy)
      ? legacy
      : hasEntries(serverLegacy)
        ? serverLegacy
        : (nested && typeof nested === 'object' && !Array.isArray(nested)
          ? nested
          : (legacy && typeof legacy === 'object' && !Array.isArray(legacy)
            ? legacy
            : (serverLegacy && typeof serverLegacy === 'object' && !Array.isArray(serverLegacy)
              ? serverLegacy
              : {})));

  profile.bakery.items = picked;
  return picked;
}

function updateBakeryProduction(userId, client = null, sendNotification = true) {
  try {
    const profile = getProfile(userId);
    if (!profile) return;

    const bakeries = resolveBakeryItems(profile);
    const bakeriesMeta = loadBakeries();
    const now = Date.now();
    const lastBaked = parseTimestampMs(profile.bakery?.lastBaked ?? profile.LastBaked, now);
    const maxBakeStorage = Math.max(1, toSafeInt(profile.bakery?.maxbakestorage, 150));
    const previousStorage = Math.max(0, toSafeInt(profile.bakery?.bakestorage ?? profile.bakestorage, 0));
    const hiredBonuses = getAggregateHiredBonuses(profile, userId);
    const speedMultiplier = Math.max(0, hiredBonuses?.bakeSpeedMultiplier || 0);
    let hasChanges = false;
    let totalAccumulated = 0;

    for (const key of Object.keys(bakeries)) {
      const b = bakeries[key];
      if (!b || typeof b !== 'object') {
        bakeries[key] = {
          id: toSafeInt(key, 0),
          name: `Bakery ${key}`,
          accumulated: 0,
          bakeTime: 5,
          lastCycleTime: now,
        };
        hasChanges = true;
      }

      const item = bakeries[key];
      const normalizedAccumulated = Math.max(0, toSafeInt(item.accumulated, 0));
      if (item.accumulated !== normalizedAccumulated) {
        item.accumulated = normalizedAccumulated;
        hasChanges = true;
      }

      const normalizedLastCycleTime = parseTimestampMs(item.lastCycleTime, lastBaked || now);
      if (item.lastCycleTime !== normalizedLastCycleTime) {
        item.lastCycleTime = normalizedLastCycleTime;
        hasChanges = true;
      }

      const currentAccumulated = normalizedAccumulated;
      totalAccumulated += currentAccumulated;
    }

    if (totalAccumulated >= maxBakeStorage) {
      let clamped = false;

      if (totalAccumulated > maxBakeStorage) {
        let runningTotal = 0;
        for (const key of Object.keys(bakeries)) {
          const b = bakeries[key];
          const space = Math.max(0, maxBakeStorage - runningTotal);
          const corrected = Math.min(Math.max(0, toSafeInt(b.accumulated, 0)), space);
          if ((b.accumulated || 0) !== corrected) {
            b.accumulated = corrected;
            clamped = true;
          }
          runningTotal += corrected;
        }
        totalAccumulated = maxBakeStorage;
        if (clamped) hasChanges = true;
      }

      const wasNotNotified = !profile.bakery?.storageFullNotified;

      if (profile.bakery) {
        profile.bakery.bakestorage = totalAccumulated;
        profile.bakery.storageFullNotified = true;
      }
      if (profile.bakestorage !== undefined) {
        profile.bakestorage = totalAccumulated;
      }

      if (wasNotNotified || clamped || hasChanges || previousStorage !== totalAccumulated) {
        updateProfile(userId, {
          bakeries,
          bakery: profile.bakery,
          bakestorage: totalAccumulated
        });
      }

      const wantsNotify = profile.bakery?.storageFullNotify === true;
      if (wantsNotify && wasNotNotified && client) {
        (async () => {
          try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
              const notifyEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('⚠️ Bakery Storage Full!')
                .setDescription('Your bakery storage is full, use `/bake` to sell your items!');

              await user.send({ embeds: [notifyEmbed] }).catch(err => {
                if (err.code !== 50007) {
                  console.error('Failed to send storage full notification:', err);
                }
              });
            }
          } catch (err) {
            console.error('Error sending storage full DM:', err);
          }
        })();
      }

      return;
    }

    if (profile.bakery?.storageFullNotified) {
      profile.bakery.storageFullNotified = false;
      hasChanges = true;
    }

    totalAccumulated = 0;
    for (const key of Object.keys(bakeries)) {
      const b = bakeries[key];
      const meta = bakeriesMeta[String(b.id)] || {};
      const bakeTimeSeconds = Math.max(1, toSafeInt(meta.bakeTime ?? b.bakeTime, 5));
      const bakeTimeMs = bakeTimeSeconds * 1000;
      const effectiveBakeTimeMs = Math.max(250, bakeTimeMs / (1 + speedMultiplier));

      if (meta.bakeTime && b.bakeTime !== meta.bakeTime) {
        b.bakeTime = meta.bakeTime;
        hasChanges = true;
      }

      if (!b.lastCycleTime) {
        b.lastCycleTime = lastBaked || now;
        hasChanges = true;
      }

      const timeSinceLastCycleMs = now - b.lastCycleTime;
      const completedCycles = Math.floor(timeSinceLastCycleMs / effectiveBakeTimeMs);
      const currentAccumulated = Math.max(0, toSafeInt(b.accumulated, 0));
      if (b.accumulated !== currentAccumulated) {
        b.accumulated = currentAccumulated;
        hasChanges = true;
      }

      totalAccumulated += currentAccumulated;

      if (completedCycles > 0) {
        const canAdd = maxBakeStorage - totalAccumulated;

        if (canAdd > 0) {
          const itemsToAdd = Math.min(completedCycles, canAdd);
          b.accumulated = currentAccumulated + itemsToAdd;
          totalAccumulated += itemsToAdd;
          hasChanges = true;
          b.lastCycleTime += itemsToAdd * effectiveBakeTimeMs;

          if (totalAccumulated >= maxBakeStorage) {
            break;
          }
        }
      }
    }

    if (profile.bakery) {
      profile.bakery.bakestorage = totalAccumulated;
    }
    if (profile.bakestorage !== undefined) {
      profile.bakestorage = totalAccumulated;
    }

    if (totalAccumulated > maxBakeStorage) {
      let runningTotal = 0;
      for (const key of Object.keys(bakeries)) {
        const b = bakeries[key];
        const space = Math.max(0, maxBakeStorage - runningTotal);
        b.accumulated = Math.min(Math.max(0, toSafeInt(b.accumulated, 0)), space);
        runningTotal += b.accumulated;
      }
      totalAccumulated = maxBakeStorage;
      if (profile.bakery) profile.bakery.bakestorage = maxBakeStorage;
      if (profile.bakestorage !== undefined) profile.bakestorage = maxBakeStorage;
      hasChanges = true;
    }

    if (hasChanges || previousStorage !== totalAccumulated) {
      const updates = {
        bakeries: bakeries,
        bakestorage: totalAccumulated
      };
      if (profile.bakery) {
        updates.bakery = profile.bakery;
      }
      updateProfile(userId, updates);
    }
  } catch (err) {
    console.error('Error updating bakery production:', err);
  }
}

module.exports = { updateBakeryProduction };
