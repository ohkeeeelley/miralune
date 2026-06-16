const fs = require('fs');
const path = require('path');
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
function backupFile(filePath, backupsDir) {
  try {
    ensureDir(backupsDir);
    if (!fs.existsSync(filePath)) return false;
    const base = path.basename(filePath);
    const dest = path.join(backupsDir, `${base}.${timestamp()}.bak`);
    fs.copyFileSync(filePath, dest);
    return dest;
  } catch (err) {
    console.error('Backup failed for', filePath, err);
    return false;
  }
}

function safeWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function validateJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8') || '';
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function runStartupChecks() {
  console.log('Updating Bakery Data — running startup checks...');
  const backupsDir = path.join(__dirname, '..', 'data', 'backups');
  const checks = [
    { path: path.join(__dirname, '..', 'data', 'profile', 'profiles.json'), default: {} }
  ];

  for (const c of checks) {
    try {
      const dir = path.dirname(c.path);
      ensureDir(dir);
      if (fs.existsSync(c.path)) {
        const b = backupFile(c.path, backupsDir);
        if (c.path.endsWith('.js')) {

          try {

            const abs = path.resolve(c.path);
            delete require.cache[require.resolve(abs)];
            require(abs);
            console.log(`- ${c.path} OK; backup saved to ${b || 'N/A'}`);
          } catch (err) {
            console.warn(`- ${c.path} failed to load as a JS module; backup saved at ${b || 'N/A'}. Leaving file in place for manual inspection.`);
            console.error(err);
          }
        } else {
          const parsed = validateJson(c.path);
          if (!parsed) {
            console.warn(`- ${c.path} is invalid JSON; replacing with default and saved backup at ${b || 'N/A'}`);
            safeWriteJson(c.path, c.default);
          } else {
            console.log(`- ${c.path} OK; backup saved to ${b || 'N/A'}`);

            if (c.path.endsWith('profiles.json')) {
              try {
                const profiles = parsed;
                let migrated = false;
                for (const [uid, profile] of Object.entries(profiles)) {
                  if (!profile || typeof profile !== 'object') continue;

                  profile.xp = profile.xp ?? 0;
                  profile.collection = profile.collection ?? [];
                  profile.befriendedPonies = profile.befriendedPonies ?? [];
                  profile.favs = profile.favs ?? [];

                  if (profile.bakery && typeof profile.bakery === 'object') {
                    const nextStorageNotify = profile.bakery.storageFullNotify === true ? true : false;
                    if (profile.bakery.storageFullNotify !== nextStorageNotify) {
                      profile.bakery.storageFullNotify = nextStorageNotify;
                      migrated = true;
                    }

                    if (profile.bakery.storageFullNotified === undefined) {
                      profile.bakery.storageFullNotified = false;
                      migrated = true;
                    }

                    if (!Array.isArray(profile.bakery.hired)) {
                      profile.bakery.hired = [];
                      migrated = true;
                    }

                    if (!Array.isArray(profile.bakery.boosters)) {
                      profile.bakery.boosters = [];
                      migrated = true;
                    }

                    if (!profile.bakery.ponyProgress || typeof profile.bakery.ponyProgress !== 'object' || Array.isArray(profile.bakery.ponyProgress)) {
                      profile.bakery.ponyProgress = {};
                      migrated = true;
                    }

                    if (!Number.isFinite(Number(profile.bakery.lastPonyBakeryLevelAwarded))) {
                      profile.bakery.lastPonyBakeryLevelAwarded = Math.max(1, Number(profile.bakery.level || 1) || 1);
                      migrated = true;
                    }
                  }

                  if (!Array.isArray(profile.boosters)) {
                    profile.boosters = [];
                    migrated = true;
                  }

                  if (!profile.servers || typeof profile.servers !== 'object') continue;
                  for (const [gid, server] of Object.entries(profile.servers)) {
                    if (!server || typeof server !== 'object') continue;

                      if (server.bakeries && typeof server.bakeries === 'object') {
                        for (const [bid, b] of Object.entries(server.bakeries)) {
                          if (b && typeof b === 'object') {

                            if ('storage' in b || 'lastBaked' in b || 'xp' in b || 'level' in b) {
                              delete b.storage;
                              delete b.lastBaked;
                              delete b.xp;
                              delete b.level;
                              migrated = true;
                            }

                            server.bakeries[bid] = { id: b.id, name: b.name, accumulated: b.accumulated || 0 };
                          }
                        }
                      }

                    server.BakeryLevel = server.BakeryLevel ?? 1;
                    server.BakeryXP = server.BakeryXP ?? 0;
                    server.NextLevelXP = server.NextLevelXP ?? (server.BakeryLevel * 1000);
                    server.LastBaked = server.LastBaked ?? Date.now();
                    server.BakeCooldown = 0;
                    server.BakeryBonus = server.BakeryBonus ?? 0;
                    server.StorageFullNotify = server.StorageFullNotify ?? false;
                    server.SpecialBonus = server.SpecialBonus ?? 0;
                    server.Hired = server.Hired ?? [];
                    server.Inventory = server.Inventory ?? { Resources: { eggs: 0, milk: 0, apples: 0, sugar: 0, flower: 0, whipcream: 0, rainbow_apple: 0, grapes: 0, lettuce: 0, pineapple: 0, lime:0, cherry: 0, watermelon:0, banana:0, kiwi:0,  wrench: 0, wood: 0, stone: 0, bolts: 0, hammer: 0, nails: 0, saw: 0 } };
                    server.Rebirth = server.Rebirth ?? 0;
                    server.AchievementsDisplay = server.AchievementsDisplay ?? [];
                    server.Achivements = server.Achivements ?? [];
                    server.AchivementCompleted = server.AchivementCompleted ?? 0;

                    server.ClanLevel = server.ClanLevel ?? [];
                    server.ClanTotalBaked = server.ClanTotalBaked ?? 0;
                    server.ClanRank = server.ClanRank ?? [];
                    server.CurrentDimension = server.CurrentDimension ?? [];
                    server.InServer = server.InServer ?? false;
                    server.ServerBooster = server.ServerBooster ?? false;
                    server.Extra1MenuSlot = server.Extra1MenuSlot ?? false;
                    server.Extra2MenuSlot = server.Extra2MenuSlot ?? false;
                    server.TotalMessageSent = server.TotalMessageSent ?? [];
                    server.ProfileBackground = server.ProfileBackground ?? [];
                    server.BakeryBackground = server.BakeryBackground ?? [];
                    server.LevelCardBG = server.LevelCardBG ?? [];
                    server.Cosmethics = server.Cosmethics ?? [];
                    server.ActiveCosmethics = server.ActiveCosmethics ?? [];
                    server.JournyHealth = server.JournyHealth ?? 2000;
                    server.JournyInventory = server.JournyInventory ?? [];
                    server.JournyPowerup = server.JournyPowerup ?? [];
                  }
                }

                if (migrated) {

                  safeWriteJson(c.path, profiles);
                  console.log(`- profiles.json migrated and saved; backup at ${b || 'N/A'}`);
                }
              } catch (merr) {
                console.error('Failed to migrate profiles.json:', merr);
              }
            }
          }
        }
      } else {
          if (c.path.endsWith('.js')) {
            ensureDir(path.dirname(c.path));
            fs.writeFileSync(c.path, c.default, 'utf8');
          } else {
            safeWriteJson(c.path, c.default);
          }
          console.log(`- ${c.path} was missing; created default.`);
      }
    } catch (err) {
      console.error('Startup check failed for', c.path, err);
    }
  }

  console.log('Startup checks complete.');

  console.log('\n[CONCURRENCY] Initializing concurrency safeguards...');
  try {
    const dataValidator = require('./dataValidator');
    const basePath = path.join(__dirname, '..');
    dataValidator.ensureFiles(basePath);
    console.log('[CONCURRENCY] ✓ All data files verified and initialized');
  } catch (e) {
    console.error('[CONCURRENCY] Warning: Could not initialize concurrency safeguards:', e.message);
  }
}

module.exports = { runStartupChecks, backupFile, ensureDir };
