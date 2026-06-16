const fs = require('fs');
const path = require('path');

const CLANS_PATH = path.join(__dirname, '..', 'data', 'clans.json');
const CLAN_LEADERBOARD_PATH = path.join(__dirname, '..', 'data', 'ClanLeaderboard.json');
const ALLTIME_LEADERBOARD_PATH = path.join(__dirname, '..', 'data', 'allTimeLeaderboard.json');

function ensureData(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
}

function loadJson(filePath, defaultValue) {
  ensureData(filePath, defaultValue);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
  } catch (e) {
    console.error('Failed to parse', filePath, e);
    return defaultValue;
  }
}

function saveJson(filePath, data) {
  try {
    ensureData(filePath, data);

    if (fs.existsSync(filePath)) {
      const backupDir = path.join(path.dirname(filePath), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `${path.basename(filePath)}.${timestamp}.bak`);
      fs.copyFileSync(filePath, backupPath);
      console.log(`[CLAN-DEBUG] Backup created at ${backupPath}`);
    }

    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf8');

    const verifyData = fs.readFileSync(filePath, 'utf8');
    if (verifyData !== jsonData) {
      throw new Error('Data verification failed after save');
    }

    const fd = fs.openSync(filePath, 'r+');
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    console.log(`[CLAN-DEBUG] Successfully saved and verified ${filePath}`);
  } catch (err) {
    console.error(`[CLAN-DEBUG] Error saving ${filePath}:`, err);
    throw err;
  }
}

const ClansManager = {
  pendingInvites: new Map(),
  _load() {
    this.clans = loadJson(CLANS_PATH, {});
    this.clanLeaderboard = loadJson(CLAN_LEADERBOARD_PATH, {});
    this.allTimeLeaderboard = loadJson(ALLTIME_LEADERBOARD_PATH, {});
  },

  _saveAll() {
    console.log('[CLAN-DEBUG] Saving all clan data...');
    try {
      saveJson(CLANS_PATH, this.clans);
      console.log('[CLAN-DEBUG] Successfully saved clans.json');
      saveJson(CLAN_LEADERBOARD_PATH, this.clanLeaderboard);
      saveJson(ALLTIME_LEADERBOARD_PATH, this.allTimeLeaderboard);
      console.log('[CLAN-DEBUG] All clan data saved successfully');
    } catch (err) {
      console.error('[CLAN-DEBUG] Error saving clan data:', err);
    }
  },

  generateId(name) {
    const slug = String(name || 'clan').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);
    return `${slug}_${Date.now().toString(36)}`;
  },

  createClan(ownerId, name) {
    if (!name || typeof name !== 'string') throw new Error('Invalid clan name');
    this._load();

    for (const k of Object.keys(this.clans)) {
      if ((this.clans[k].name || '').toLowerCase() === name.toLowerCase()) {
        throw new Error('A clan with that name already exists');
      }
    }
    const id = this.generateId(name);
    this.clans[id] = {
      id,
      name,
      ownerId,
      createdAt: Date.now(),
      members: [ownerId],
      roles: { [ownerId]: 'owner' },
      TotalClanBaked: 0,
      AllTimeBaked: 0,
      lastDistributedTotal: 0,
      memberContributions: {},
      xp: 0,
      level: 1
    };
    this._saveAll();
    return this.clans[id];
  },

  getClanById(clanId) {
    this._load();
    return this.clans[clanId] || null;
  },

  getClanByName(name) {
    this._load();
    if (!name) return null;
    return Object.values(this.clans).find(c => (c.name || '').toLowerCase() === name.toLowerCase()) || null;
  },

  addMember(clanId, userId) {
    this._load();
    const clan = this.clans[clanId];
    if (!clan) throw new Error('Clan not found');
    if (!clan.members.includes(userId)) clan.members.push(userId);
    if (!clan.roles) clan.roles = {};
    clan.roles[userId] = 'member';
    this._saveAll();
    return clan;
  },

  removeMember(clanId, userId) {
    this._load();
    const clan = this.clans[clanId];
    if (!clan) throw new Error('Clan not found');
    clan.members = (clan.members || []).filter(id => id !== userId);
    if (clan.roles) delete clan.roles[userId];
    this._saveAll();
    return clan;
  },

  promoteMember(clanId, userId) {
    this._load();
    const clan = this.clans[clanId];
    if (!clan) throw new Error('Clan not found');
    clan.roles = clan.roles || {};
    const currentCOs = Object.values(clan.roles || {}).filter(r => r === 'co').length;
    if (currentCOs >= 2 && clan.roles[userId] !== 'co') throw new Error('CO limit reached (max 2)');
    clan.roles[userId] = 'co';
    this._saveAll();
    return clan;
  },

  demoteMember(clanId, userId) {
    this._load();
    const clan = this.clans[clanId];
    if (!clan) throw new Error('Clan not found');
    clan.roles = clan.roles || {};
    if (clan.roles[userId] === 'owner') throw new Error('Cannot demote owner');
    clan.roles[userId] = 'member';
    this._saveAll();
    return clan;
  },

  kickMember(clanId, issuerId, targetId) {
    this._load();
    const clan = this.clans[clanId];
    if (!clan) throw new Error('Clan not found');
    const role = clan.roles && clan.roles[issuerId];
    if (issuerId !== clan.ownerId && role !== 'co') throw new Error('Not authorized to kick');
    if (targetId === clan.ownerId) throw new Error('Cannot kick owner');
    clan.members = (clan.members || []).filter(id => id !== targetId);
    if (clan.roles) delete clan.roles[targetId];
    this._saveAll();
    return clan;
  },

  addBaked(userId, bakedCount, userProfileAccessor) {
    console.log('[CLAN-DEBUG] ClansManager.addBaked called');
    console.log('[CLAN-DEBUG] userId:', userId);
    console.log('[CLAN-DEBUG] bakedCount:', bakedCount);

    this._load();
    console.log('[CLAN-DEBUG] Loaded clans data');

    let clanId = null;
    if (typeof userProfileAccessor === 'function') {
      const profile = userProfileAccessor(userId);
      console.log('[CLAN-DEBUG] Got user profile:', profile ? 'yes' : 'no');
      console.log('[CLAN-DEBUG] Profile ClanId:', profile ? profile.ClanId : 'none');
      if (profile && profile.ClanId) clanId = profile.ClanId;
    } else {
      console.log('[CLAN-DEBUG] No profile accessor, searching clans');
      for (const [id, clan] of Object.entries(this.clans)) {
        if ((clan.members || []).includes(userId)) {
          clanId = id;
          console.log('[CLAN-DEBUG] Found clan by member search:', id);
          break;
        }
      }
    }

    const xpGain = Math.floor(bakedCount * 0.9);

    if (clanId) {
      console.log('[CLAN-DEBUG] Found clan ID:', clanId);

      this._load();
      const clan = this.clans[clanId];
      console.log('[CLAN-DEBUG] Current clan data:', clan ? {
        name: clan.name,
        TotalClanBaked: clan.TotalClanBaked,
        AllTimeBaked: clan.AllTimeBaked
      } : 'No clan found');

      if (!clan) {
        console.error('[CLAN-DEBUG] ERROR: Clan not found in data even though we have ID');
        return;
      }

      const oldTotal = parseInt(clan.TotalClanBaked || 0, 10);
      const safeCount = parseInt(bakedCount || 0, 10);

      if (isNaN(oldTotal) || isNaN(safeCount)) {
        console.error('[CLAN-DEBUG] Invalid numbers detected:', { oldTotal, bakedCount });
        return;
      }

      clan.TotalClanBaked = oldTotal + safeCount;
      clan.AllTimeBaked = parseInt(clan.AllTimeBaked || 0, 10) + safeCount;

      console.log('[CLAN-DEBUG] Updated TotalClanBaked:', oldTotal, '+', safeCount, '=', clan.TotalClanBaked);

      clan.memberContributions = clan.memberContributions || {};
      clan.memberContributions[userId] = parseInt(clan.memberContributions[userId] || 0, 10) + safeCount;

      try {
        this._saveAll();

        this._load();
        const savedClan = this.clans[clanId];
        console.log('[CLAN-DEBUG] Verified save - current TotalClanBaked:', savedClan.TotalClanBaked);

        if (savedClan.TotalClanBaked !== clan.TotalClanBaked) {
          console.error('[CLAN-DEBUG] Save verification failed! Numbers don\'t match!');
        }
      } catch (err) {
        console.error('[CLAN-DEBUG] Error saving clan data:', err);
      }

      clan.xp = (clan.xp || 0) + xpGain;

      const computeLevel = (totalXP) => {
        let level = 1;
        let remaining = Math.max(0, Math.floor(totalXP || 0));
        let need = 1500;
        while (remaining >= need) {
          remaining -= need;
          level += 1;
          need += 1500;
        }
        return level;
      };
      try {
        const newLevel = computeLevel(clan.xp);
        clan.level = newLevel;
      } catch (e) { console.error('Error computing clan level', e); }

      this.clanLeaderboard[clanId] = {
        id: clanId,
        name: clan.name,
        total: clan.TotalClanBaked
      };

      try {
        const thresholds = [10000,25000,45000,60000,80000,110000,140000,180000,240000,300000,400000,500000,750000,1000000];
        const last = clan.lastDistributedTotal || 0;
        for (const th of thresholds) {
          if (th > last && clan.TotalClanBaked >= th) {
            this._distributeMilestone(clanId, th);
          }
        }
      } catch (e) {
        console.error('Error checking/distributing clan milestones', e);
      }
    }

    this.allTimeLeaderboard[userId] = (this.allTimeLeaderboard[userId] || 0) + bakedCount;

    this._saveAll();

    return clanId;
  },

  getTopClans(limit = 10) {
    this._load();
    const items = Object.values(this.clanLeaderboard || {}).slice();
    items.sort((a, b) => (b.total || 0) - (a.total || 0));
    return items.slice(0, limit);
  },

  getTopAllTimeUsers(limit = 10) {
    this._load();
    const arr = Object.entries(this.allTimeLeaderboard || {}).map(([uid, total]) => ({ uid, total }));
    arr.sort((a, b) => b.total - a.total);
    return arr.slice(0, limit);
  },

  createInvite(clanId, fromUserId, toUserId) {
    this._load();
    const clan = this.clans[clanId];
    if (!clan) throw new Error('Clan not found');
    const key = `${clanId}_${toUserId}`;
    this.pendingInvites.set(key, { clanId, fromUserId, toUserId, createdAt: Date.now() });
    return key;
  },

  removeInvite(key) {
    return this.pendingInvites.delete(key);
  },

  acceptInvite(key) {
    this._load();
    const inv = this.pendingInvites.get(key);
    if (!inv) throw new Error('Invite not found or expired');
    const { clanId, toUserId } = inv;
    const clan = this.clans[clanId];
    if (!clan) throw new Error('Clan not found');
    if (!clan.members.includes(toUserId)) clan.members.push(toUserId);
    clan.roles = clan.roles || {};
    clan.roles[toUserId] = 'member';
    this.pendingInvites.delete(key);
    this._saveAll();
    return clan;
  },

  _distributeMilestone(clanId, threshold) {
    this._load();
    const clan = this.clans[clanId];
    if (!clan) return;
    clan.memberContributions = clan.memberContributions || {};
    const entries = Object.entries(clan.memberContributions).filter(([uid, v]) => v > 0);
    if (!entries.length) {
      clan.lastDistributedTotal = threshold;
      this._saveAll();
      return;
    }
    const totalContrib = entries.reduce((s, [, v]) => s + v, 0);
    const pool = Math.max(1, Math.floor(threshold * 0.01));
    const profileMgr = require('../utils/profileManager');
    for (const [uid, v] of entries) {
      const share = Math.floor((v / totalContrib) * pool);
      if (share > 0) {
        try {
          const p = profileMgr.getProfile(uid);
          if (p) {
            p.balances = p.balances || {};
            p.balances.bits = (p.balances.bits || 0) + share;
            profileMgr.updateProfile(uid, { balances: p.balances });
          }
        } catch (e) { console.error('Error rewarding user', uid, e); }
      }
    }

    clan.memberContributions = {};
    clan.lastDistributedTotal = threshold;
    this._saveAll();
  }
};

ClansManager._load();

module.exports = ClansManager;
