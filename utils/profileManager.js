const path = require('path');
const fs = require('fs');
const profilesPath = path.join(__dirname, '..', 'data', 'profile', 'profiles.json');
const crypto = require('crypto');
const { sendNoProfile } = require('./noProfileResponse');

function generateVirtualCardNumber(userId) {
    const hash = crypto.createHash('sha256').update(String(userId)).digest();

    const parts = [];

    for (let g = 0; g < 4; g++) {
        let part = '';
        for (let i = 0; i < 4; i++) {

            const idx = (g * 4 + i) % hash.length;
            part += String(hash[idx] % 10);
        }
        parts.push(part);
    }

    return parts.join('');
}

function ensureDataDir() {
    const dir = path.dirname(profilesPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureBakeryProgressDefaults(profile) {
    if (!profile || typeof profile !== 'object') return;

    if (!profile.bakery || typeof profile.bakery !== 'object') {
        profile.bakery = {};
    }

    if (!Array.isArray(profile.bakery.hired)) profile.bakery.hired = [];
    if (!Array.isArray(profile.bakery.boosters)) profile.bakery.boosters = [];
    if (!profile.bakery.ponyProgress || typeof profile.bakery.ponyProgress !== 'object' || Array.isArray(profile.bakery.ponyProgress)) {
        profile.bakery.ponyProgress = {};
    }

    if (!Number.isFinite(Number(profile.bakery.lastPonyBakeryLevelAwarded))) {
        profile.bakery.lastPonyBakeryLevelAwarded = Math.max(1, Number(profile.bakery.level || profile.BakeryLevel || 1) || 1);
    }

    if (!Array.isArray(profile.boosters)) profile.boosters = [];
}

let _cache = null;
let _saveTimer = null;
const SAVE_DEBOUNCE_MS = 2000;

function loadProfiles() {
    if (_cache) return _cache;
    ensureDataDir();
    if (!fs.existsSync(profilesPath)) {
        _cache = {};
        return _cache;
    }
    try {
        _cache = JSON.parse(fs.readFileSync(profilesPath, 'utf8') || '{}');
        return _cache;
    } catch (e) {
        console.error('profiles parse err', e);
        _cache = {};
        return _cache;
    }
}

function _cleanProfiles(profiles) {
    for (const uid of Object.keys(profiles)) {
        const p = profiles[uid];
        if (!p || typeof p !== 'object') continue;
        if (p.collection && p.global) {
            p.global.collection = p.collection;
            delete p.collection;
        }
        if (p.befriendedPonies && p.global) {
            p.global.befriendedPonies = p.befriendedPonies;
            delete p.befriendedPonies;
        }
        if (p.globalStats && p.global) {
            Object.assign(p.global, p.globalStats);
            delete p.globalStats;
        }
        delete p.bank;
    }
}

function saveProfiles(profiles) {
    _cache = profiles;
    _cleanProfiles(_cache);

    if (!_saveTimer) {
        _saveTimer = setTimeout(() => {
            _saveTimer = null;
            try {
                ensureDataDir();
                fs.writeFileSync(profilesPath, JSON.stringify(_cache, null, 2), 'utf8');
            } catch (e) {
                console.error('[ProfileManager] Debounced save error:', e);
            }
        }, SAVE_DEBOUNCE_MS);
    }
}

function flushProfiles() {
    if (_saveTimer) {
        clearTimeout(_saveTimer);
        _saveTimer = null;
    }
    if (_cache) {
        try {
            ensureDataDir();
            fs.writeFileSync(profilesPath, JSON.stringify(_cache, null, 2), 'utf8');
        } catch (e) {
            console.error('[ProfileManager] Flush save error:', e);
        }
    }
}
function getProfile(userId) {
    const profiles = loadProfiles();
    let profile = profiles[userId];

    if (!profile) return null;

    ensureUserCard(profiles, userId);
    profile = profiles[userId];
        ensureBakeryProgressDefaults(profile);

    try {
      saveProfiles(profiles);
    } catch (e) {
      console.warn('Failed to save profiles after ensuring card:', e);
    }

    if (profile.character && profile.bakery) {

        let bakeryLevel = profile.bakery?.level || 1;
        let bakeryXP = profile.bakery?.xp || 0;
        if (bakeryLevel > 100) {
            bakeryLevel = 100;
            bakeryXP = 0;
        }
        const nextLevelXpValue = Math.max(1000, bakeryLevel * 1000);

        const hasBakeryEntries = (obj) => !!obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0;
        const nestedItems = profile.bakery?.items;
        const legacyItems = profile.bakeries;
        const serverLegacyItems = profile.server?.bakeries;
        const activeBakeryItems = hasBakeryEntries(nestedItems)
            ? nestedItems
            : hasBakeryEntries(legacyItems)
                ? legacyItems
                : hasBakeryEntries(serverLegacyItems)
                    ? serverLegacyItems
                    : (nestedItems || legacyItems || serverLegacyItems || {});

        if (profile.bakery && profile.bakery.items !== activeBakeryItems) {
            profile.bakery.items = activeBakeryItems;
            saveProfiles(profiles);
        }

        const legacy = {
            eg_name: profile.character?.name || '',
            eg_age: profile.character?.age || '',
            eg_description: profile.character?.description || '',
            createdAt: profile.character?.createdAt || new Date().toISOString(),
            xp: profile.global?.xp || 0,
            collection: profile.global?.collection || [],
            befriendedPonies: profile.global?.befriendedPonies || [],
            favs: profile.global?.favorites || [],
            joinedAt: profile.global?.joinedAt || new Date().toISOString(),
            AllTimeBaked: profile.stats?.totalAllTimeBaked || 0,
            ClanMemberBaked: profile.stats?.totalClanMemberBaked || 0,
            ClanId: profile.clan?.id || null,
            ClanRole: profile.clan?.role || null,
            coinflipStats: profile.coinflip || {},
            coinflipStreak: profile.coinflip?.streak || 0,
            coinflipWinStreak: profile.coinflip?.winStreak || 0,
            paymentCard: profile.paymentCard,
            profileId: profile.profileId || profile.paymentCard?.number || '',
            bakeryName: profile.bakery?.name || '',
            bakeries: activeBakeryItems,
            bakeriesowned: profile.bakery?.itemsOwned || [],
            menu: profile.bakery?.menu || [],
            BakeryLevel: bakeryLevel,
            BakeryXP: bakeryXP,
            NextLevelXP: profile.bakery?.nextLevelXP || nextLevelXpValue,
            LastBaked: profile.bakery?.lastBaked || 0,
            BakeCooldown: 0,
            BakeryBonus: profile.bakery?.bonus || 0,
            StorageFullNotify: profile.bakery?.storageFullNotify || false,
            StorageFullNotifyAt: profile.bakery?.storageFullNotifyAt || 0,
            SpecialBonus: profile.bakery?.specialBonus || 0,
            BalanceTheme: profile.appearance?.balanceTheme || 'default',
            Motto: profile.appearance?.motto || '',
            Hired: profile.bakery?.hired || [],
            Hire: profile.bakery?.hired || [],
            Boosters: profile.bakery?.boosters || profile.boosters || [],
            Inventory: { Resources: profile.inventory?.resources || {} },
            Rebirth: profile.bakery?.rebirth || 0,
            AchievementsDisplay: profile.server?.achievements?.display || [],
            Achivements: profile.server?.achievements?.accomplished || [],
            AchivementCompleted: profile.server?.achievements?.completed || 0,
            InServer: profile.server?.inServer || false,
            ServerBooster: profile.server?.isServerBooster || false,
            Extra1MenuSlot: profile.features?.unlocked?.extraMenuSlot1 || false,
            Extra2MenuSlot: profile.features?.unlocked?.extraMenuSlot2 || false,
            TotalMessageSent: profile.server?.totalMessagesSent || [],
            ProfileBackground: profile.appearance?.profileBackground || [],
            BakeryBackground: profile.appearance?.bakeryBackground || [],
            LevelCardBG: profile.appearance?.levelCardBG || [],
            Cosmethics: profile.appearance?.cosmetics || [],
            ActiveCosmethics: profile.appearance?.activeCosmetics || [],
            PurchasedThemes: profile.features?.purchasedThemes || [],
            JournyHealth: profile.journey?.health || 2000,
            JournyInventory: profile.journey?.inventory || [],
            JournyPowerup: profile.journey?.powerups || [],
            balances: profile.wallet || {},
            stats: profile.stats || {
                allTimeSold: 0,
                totalBitsEarned: 0,
                adventureSuccesses: 0,
                adventureFailures: 0
            },
            adventureCooldown: profile.adventure?.cooldown || 0,
            lastAdventure: profile.adventure?.lastCompleted || 0,
            adventure_notify: profile.adventure?.notify || false,
            bakery: profile.bakery,
            server: profile.server || {},
            ProfileTags: {
                tag1: (profile.profile?.tag1 || 'No Tag').toString().slice(0, 24),
                tag2: (profile.profile?.tag2 || 'No Tag').toString().slice(0, 24),
                tag3: (profile.profile?.tag3 || 'No Tag').toString().slice(0, 24),
                tag4: (profile.profile?.tag4 || 'No Tag').toString().slice(0, 24),
            },
            CurrentLocation: profile.locations?.currentLocation || null,
            ProfileProgressColor: profile.appearance?.profileProgressColor || null,
            ActiveProfileBackground: profile.appearance?.activeProfileBackground || null,
        };

        return legacy;
    }

    if (!profile.NextLevelXP && profile.bakery) {
        const bakeryLevel = profile.bakery?.level || 1;
        profile.NextLevelXP = profile.bakery?.nextLevelXP || (bakeryLevel * 1000);
        console.log(`[ProfileManager] Initialized missing NextLevelXP for ${userId}: ${profile.NextLevelXP}`);
    }

    if (profile.bank) {
        profiles[userId].balances = profiles[userId].balances || {};
        const legacyBank = profile.bank;
        if (typeof legacyBank === 'number') {
            profiles[userId].balances.bank = { bits: legacyBank, harmony: (profiles[userId].balances.bank && profiles[userId].balances.bank.harmony) || 0 };
        } else if (legacyBank && typeof legacyBank === 'object') {
            profiles[userId].balances.bank = {
                bits: (legacyBank.bits ?? legacyBank) || 0,
                harmony: legacyBank.harmony ?? 0
            };
        }
        delete profiles[userId].bank;
        saveProfiles(profiles);
        profile = profiles[userId];
    }
    ensureUserCard(profiles, userId);
    ensureBakeryProgressDefaults(profile);
    saveProfiles(profiles);

    if (profile.server && profile.server.character && profile.server.bakery) {
        profile.server = profile.server.server || {};
        saveProfiles(profiles);
    }

    if (profile.server) {
        const serverOnlyKeys = [
            'inServer', 'isServerBooster', 'totalMessagesSent', 'achievements', 'clanData'
        ];
        const validKeys = new Set(serverOnlyKeys);
        let cleaned = false;
        for (const key of Object.keys(profile.server)) {
            if (!validKeys.has(key)) {
                delete profile.server[key];
                cleaned = true;
            }
        }
        if (cleaned) saveProfiles(profiles);
    }

    profile.balances = profile.balances || {};
    if (typeof profile.balances.bank === 'number') {
        profile.balances.bank = { bits: profile.balances.bank, harmony: 0 };
    } else if (!profile.balances.bank) {
        profile.balances.bank = { bits: 0, harmony: 0 };
    } else {
        profile.balances.bank.bits = profile.balances.bank.bits ?? 0;
        profile.balances.bank.harmony = profile.balances.bank.harmony ?? 0;
    }

    if (!profile.locations) {
        profile.locations = { owned: [1], currentLocation: "Ponyville" };
        saveProfiles(profiles);
    }

    return {
        profile,
        bakery: profile.bakery,
        bakeries: profile.bakeries || profile.bakery?.items || {},
        bakeryName: profile.bakeryName || profile.bakery?.name || '',
        bakeriesowned: profile.bakeriesowned || profile.bakery?.itemsOwned || [],
        menu: profile.menu || profile.bakery?.menu || [],
        BakeryLevel: profile.BakeryLevel || profile.bakery?.level || 1,
        BakeryXP: profile.BakeryXP ?? profile.bakery?.xp ?? 0,
        NextLevelXP: profile.NextLevelXP || profile.bakery?.nextLevelXP || ((profile.BakeryLevel || 1) * 1000),
        LastBaked: profile.LastBaked || profile.bakery?.lastBaked || 0,
        BakeCooldown: 0,
        StorageFullNotify: profile.StorageFullNotify ?? profile.bakery?.storageFullNotify ?? false,
        StorageFullNotifyAt: profile.StorageFullNotifyAt ?? profile.bakery?.storageFullNotifyAt ?? 0,
        Hired: profile.bakery?.hired || [],
        Boosters: profile.bakery?.boosters || profile.boosters || [],
        InServer: profile.server?.inServer ?? profile.InServer ?? false,
        ServerBooster: profile.server?.isServerBooster ?? profile.ServerBooster ?? false,
        server: profile.server || {},
        locations: profile.locations
    };
}

function ensureUserCard(profiles, userId) {
    if (!profiles[userId]) return;
    const p = profiles[userId];
    if (!p.paymentCard || !p.paymentCard.number) {
        p.paymentCard = p.paymentCard || {};
        p.paymentCard.number = generateVirtualCardNumber(userId);
        p.paymentCard.issuedAt = new Date().toISOString();
    }

    if (!p.profileId) {
        p.profileId = generateProfileId(userId);
    }
}

function generateProfileId(userId, len = 10) {
    const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const hash = crypto.createHash('sha256').update(String(userId)).digest();
    let out = '';
    for (let i = 0; i < len; i++) {
        const idx = hash[i % hash.length] % ALPHABET.length;
        out += ALPHABET[idx];
    }
    return out;
}

function createProfile(userId, profileData) {
    const profiles = loadProfiles();

    if (profiles[userId]) {
        return getProfile(userId);
    }

    const newProfile = {
        character: {
            name: profileData.eg_name || '',
            age: profileData.eg_age || '',
            description: profileData.eg_description || '',
            createdAt: profileData.createdAt || new Date().toISOString()
        },
        global: {
            xp: profileData.xp || 0,
            joinedAt: profileData.joinedAt || new Date().toISOString(),
            collection: profileData.collection || [],
            befriendedPonies: profileData.befriendedPonies || [],
            favorites: profileData.favs || []
        },
        stats: {
            totalAllTimeBaked: profileData.AllTimeBaked || 0,
            totalClanMemberBaked: profileData.ClanMemberBaked || 0,
            allTimeSold: profileData.stats?.allTimeSold || 0,
            totalBitsEarned: profileData.stats?.totalBitsEarned || 0,
            adventureSuccesses: 0,
            adventureFailures: 0,
            beststreak: profileData.stats?.beststreak || 0,
            streak: profileData.stats?.streak || 0,
            lastClaimedAt: profileData.stats?.lastClaimedAt || 0,
            dailymultiplier: profileData.stats?.dailymultiplier || 1,
            questcompleted: profileData.stats?.questcompleted || 0,
            totalponiesbefriended: profileData.stats?.totalponiesbefriended || 0,
            totalachivements: profileData.stats?.totalachivements || 0,
            totalMessages: profileData.stats?.totalMessages || 0
        },
        coinflip: {
            wins: 0,
            losses: 0,
            bitsWon: 0,
            bitsLost: 0,
            streak: 0,
            winStreak: 0
        },
        wallet: {
            bits: profileData.balances?.bits || 0,
            harmony: profileData.balances?.harmony || 0,
            diamonds: profileData.balances?.diamonds || 0,
            tickets: profileData.balances?.tickets || 0,
            tokens: profileData.balances?.tokens || 0,
            crates: profileData.balances?.crates || 0,
            keys: profileData.balances?.keys || 0,
            loyalty: profileData.balances?.loyalty || 0,
            bank: profileData.balances?.bank || { bits: 0, harmony: 0 }
        },
        bakery: {
            name: profileData.bakeryName || '',
            level: profileData.BakeryLevel || 1,
            xp: profileData.BakeryXP || 0,
            bakestorage: profileData.bakestorage || 0,
            maxbakestorage: profileData.maxbakestorage || 150,
            lastProductionUpdate: profileData.LastBaked || Date.now(),
            nextLevelXP: (profileData.BakeryLevel || 1) * 1000,
            lastBaked: profileData.LastBaked || Date.now(),
            bakeCooldown: 0,
            bonus: profileData.BakeryBonus || 0,
            specialBonus: profileData.SpecialBonus || 0,
            storageFullNotify: profileData.StorageFullNotify === true ? true : false,
            storageFullNotified: false,
            storageFullNotifyAt: profileData.StorageFullNotifyAt || 0,
            items: (() => {
              const items = profileData.bakeries || {};
              const now = Date.now();
              for (const key of Object.keys(items)) {
                if (!items[key].lastCycleTime) {
                  items[key].lastCycleTime = now;
                }
              }
              return items;
            })(),
            itemsOwned: profileData.bakeriesowned || [],
            menu: profileData.menu || [],
            hired: profileData.Hired || [],
            boosters: profileData.Boosters || [],
            ponyProgress: profileData.PonyProgress || {},
            lastPonyBakeryLevelAwarded: profileData.LastPonyBakeryLevelAwarded || (profileData.BakeryLevel || 1),
            rebirth: profileData.Rebirth || 0
        },
        boosters: profileData.Boosters || [],
        inventory: {
            resources: profileData.Inventory?.Resources || {}
        },
        appearance: {
            balanceTheme: profileData.BalanceTheme || 'default',
            motto: profileData.appearance?.motto || 'This user is too lazy to set a motto.',
            profileBackground: profileData.ProfileBackground || [],
            bakeryBackground: profileData.BakeryBackground || [],
            levelCardBG: profileData.LevelCardBG || [],
            cosmetics: profileData.Cosmethics || [],
            activeCosmetics: profileData.ActiveCosmethics || []
        },
        features: {
            unlocked: {
                extraMenuSlot1: profileData.Extra1MenuSlot || false,
                extraMenuSlot2: profileData.Extra2MenuSlot || false
            },
            purchasedThemes: profileData.PurchasedThemes || []
        },
        clan: {
            id: profileData.ClanId || null,
            role: profileData.ClanRole || null
        },
        adventure: {
            cooldown: profileData.adventureCooldown || 0,
            lastCompleted: profileData.lastAdventure || 0,
            notify: false
        },
        journey: {
            health: profileData.JournyHealth || 2000,
            inventory: profileData.JournyInventory || [],
            powerups: profileData.JournyPowerup || []
        },
        server: {
            inServer: profileData.InServer || false,
            isServerBooster: profileData.ServerBooster || false,
            totalMessagesSent: profileData.TotalMessageSent || [],
            achievements: {
                display: profileData.AchievementsDisplay || [],
                accomplished: profileData.Achivements || [],
                completed: profileData.AchivementCompleted || 0
            },
            clanData: {
                level: profileData.ClanLevel || [],
                totalBaked: profileData.ClanTotalBaked || 0,
                rank: profileData.ClanRank || [],
                currentDimension: profileData.CurrentDimension || []
            }
        },
        profile: {
            tag1: profileData.profile?.tag1 || 'No Tag',
            tag2: profileData.profile?.tag2 || 'No Tag',
            tag3: profileData.profile?.tag3 || 'No Tag',
            tag4: profileData.profile?.tag4 || 'No Tag',
            Birthday: profileData.profile?.Birthday || '',
            Pronouns: profileData.profile?.Pronouns || '',
            achivementdisplay: profileData.profile?.achivementdisplay || []
        },
        locations: {
            owned: [1],
            currentLocation: "Ponyville"
        },
        paymentCard: null,
        profileId: null
    };

    ensureBakeryProgressDefaults(newProfile);

    profiles[userId] = newProfile;

    ensureUserCard(profiles, userId);

    saveProfiles(profiles);
    flushProfiles();
    return profiles[userId];
}

function updateProfile(userId, updates) {
    const profiles = loadProfiles();
    if (!profiles[userId]) return null;
    const profile = profiles[userId];
    if (updates && updates.server && updates.server.server) {
        updates.server = updates.server.server;
    }

    if (updates.character) profile.character = { ...profile.character, ...updates.character };
    if (updates.global) profile.global = { ...profile.global, ...updates.global };
    if (updates.stats) profile.stats = { ...profile.stats, ...updates.stats };
    if (updates.coinflip) profile.coinflip = { ...profile.coinflip, ...updates.coinflip };
    if (updates.wallet) profile.wallet = { ...profile.wallet, ...updates.wallet };
    if (updates.bakery) {
        profile.bakery = { ...profile.bakery, ...updates.bakery };
        console.log(`[UpdateProfile] Bakery updated for ${userId}. New nextLevelXP: ${profile.bakery.nextLevelXP}`);
    }
    if (updates.inventory) profile.inventory = { ...profile.inventory, ...updates.inventory };
    if (updates.appearance) profile.appearance = { ...profile.appearance, ...updates.appearance };
    if (updates.features) profile.features = { ...profile.features, ...updates.features };
    if (updates.clan) profile.clan = { ...profile.clan, ...updates.clan };
    if (updates.adventure) profile.adventure = { ...profile.adventure, ...updates.adventure };
    if (updates.journey) profile.journey = { ...profile.journey, ...updates.journey };
    if (updates.server) profile.server = { ...profile.server, ...updates.server };
    if (updates.profile) profile.profile = { ...(profile.profile || {}), ...updates.profile };

    if (updates.ProfileTags && typeof updates.ProfileTags === 'object') {
        const nextTags = {};
        if (updates.ProfileTags.tag1 !== undefined) nextTags.tag1 = updates.ProfileTags.tag1;
        if (updates.ProfileTags.tag2 !== undefined) nextTags.tag2 = updates.ProfileTags.tag2;
        if (updates.ProfileTags.tag3 !== undefined) nextTags.tag3 = updates.ProfileTags.tag3;
        if (updates.ProfileTags.tag4 !== undefined) nextTags.tag4 = updates.ProfileTags.tag4;
        if (Object.keys(nextTags).length > 0) {
            profile.profile = { ...(profile.profile || {}), ...nextTags };
        }
    }

    if (updates.paymentCard) profile.paymentCard = updates.paymentCard;
    if (updates.collection) {
        if (profile.global) {
            profile.global.collection = updates.collection;
        } else {
            profile.collection = updates.collection;
        }
    }
    if (updates.befriendedPonies) {
        if (profile.global) {
            profile.global.befriendedPonies = updates.befriendedPonies;
        } else {
            profile.befriendedPonies = updates.befriendedPonies;
        }
    }
    if (updates.globalStats) {
        if (profile.global) profile.global = { ...profile.global, ...updates.globalStats };
    }
    if (updates.BakeryLevel) profile.bakery.level = updates.BakeryLevel;
    if (updates.BakeryXP) profile.bakery.xp = updates.BakeryXP;
    if (updates.NextLevelXP) {
        profile.bakery.nextLevelXP = updates.NextLevelXP;
        console.log(`[UpdateProfile] NextLevelXP updated for ${userId} to ${updates.NextLevelXP}`);
    }
    if (updates.LastBaked) profile.bakery.lastBaked = updates.LastBaked;
    if (updates.balances) profile.wallet = { ...profile.wallet, ...updates.balances };
    if (updates.bakeries) {
        profile.bakery.items = updates.bakeries;

        const now = Date.now();
        for (const key of Object.keys(profile.bakery.items)) {
            if (!profile.bakery.items[key].lastCycleTime) {
                profile.bakery.items[key].lastCycleTime = now;
            }
        }
    }
    if (updates.bakeriesowned) profile.bakery.itemsOwned = updates.bakeriesowned;
    if (updates.menu) profile.bakery.menu = updates.menu;
    if (updates.bakestorage !== undefined) profile.bakery.bakestorage = updates.bakestorage;
    if (updates.BakeCooldown !== undefined) profile.bakery.bakeCooldown = 0;
    if (updates.BakeryBonus !== undefined) profile.bakery.bonus = updates.BakeryBonus;
    if (updates.StorageFullNotify !== undefined) profile.bakery.storageFullNotify = updates.StorageFullNotify;
    if (updates.StorageFullNotifyAt !== undefined) profile.bakery.storageFullNotifyAt = updates.StorageFullNotifyAt;

    if (profile.features?.purchasedThemes) {
        profile.features.purchasedThemes = Array.from(new Set(profile.features.purchasedThemes));
    }

    if (profile.bakery) {
        if (profile.bakery.level > 100) {
            console.log(`[UpdateProfile] Caping bakery level for ${userId}: was ${profile.bakery.level}, setting to 100`);
            profile.bakery.level = 100;
            profile.bakery.xp = 0;
        }
        if (!profile.bakery.nextLevelXP || profile.bakery.nextLevelXP < 1000) {
            profile.bakery.nextLevelXP = Math.max(1000, (profile.bakery.level || 1) * 1000);
        }
    }

    ensureBakeryProgressDefaults(profile);

    saveProfiles(profiles);
    return getProfile(userId);
}

function requireProfile(interaction) {
    const profile = getProfile(interaction.user.id);
    return profile !== null;
}

async function handleProfileRequirement(interaction) {
    if (!requireProfile(interaction)) {
        await sendNoProfile(interaction);
        return false;
    }
    return true;
}

function getAllProfiles() {
    return loadProfiles();
}

module.exports = {
    getProfile,
    createProfile,
    updateProfile,
    requireProfile,
    handleProfileRequirement,
    flushProfiles,
    getAllProfiles
};
