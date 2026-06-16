const fs   = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'moderation');

const DEFAULT_BLACKWORDS = [
    'nigger', 'nigga', 'faggot', 'retard', 'kys',
    'kill yourself', 'neck yourself',
];

function ensureDir() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadModData(guildId) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    if (!fs.existsSync(p)) {
        return {
            maxWarns:   3,
            warns:      {},
            blacklist:  [],
            blackwords: [...DEFAULT_BLACKWORDS],
        };
    }
    try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
            maxWarns:   raw.maxWarns   ?? 3,
            warns:      raw.warns      || {},
            blacklist:  raw.blacklist   || [],
            blackwords: raw.blackwords  ?? [...DEFAULT_BLACKWORDS],
        };
    } catch {
        return { maxWarns: 3, warns: {}, blacklist: [], blackwords: [...DEFAULT_BLACKWORDS] };
    }
}

function saveModData(guildId, data) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function addWarn(guildId, userId, reason, modId) {
    const data = loadModData(guildId);
    if (!data.warns[userId]) data.warns[userId] = [];
    const id = (data.warns[userId].length > 0
        ? Math.max(...data.warns[userId].map(w => w.id)) + 1
        : 1);
    const warn = { id, reason: reason || 'No reason provided', by: modId, timestamp: Date.now() };
    data.warns[userId].push(warn);
    saveModData(guildId, data);
    return { warn, total: data.warns[userId].length, max: data.maxWarns };
}

function getWarns(guildId, userId) {
    const data = loadModData(guildId);
    return data.warns[userId] || [];
}

function removeWarn(guildId, userId, warnId) {
    const data = loadModData(guildId);
    if (!data.warns[userId]) return false;
    const idx = data.warns[userId].findIndex(w => w.id === warnId);
    if (idx === -1) return false;
    data.warns[userId].splice(idx, 1);
    if (data.warns[userId].length === 0) delete data.warns[userId];
    saveModData(guildId, data);
    return true;
}

function clearWarns(guildId, userId) {
    const data = loadModData(guildId);
    const had = (data.warns[userId] || []).length;
    delete data.warns[userId];
    saveModData(guildId, data);
    return had;
}

function setMaxWarns(guildId, max) {
    const data = loadModData(guildId);
    data.maxWarns = max;
    saveModData(guildId, data);
}

function addBlacklist(guildId, userId) {
    const data = loadModData(guildId);
    if (data.blacklist.includes(userId)) return false;
    data.blacklist.push(userId);
    saveModData(guildId, data);
    return true;
}

function removeBlacklist(guildId, userId) {
    const data = loadModData(guildId);
    const idx = data.blacklist.indexOf(userId);
    if (idx === -1) return false;
    data.blacklist.splice(idx, 1);
    saveModData(guildId, data);
    return true;
}

function isBlacklisted(guildId, userId) {
    const data = loadModData(guildId);
    return data.blacklist.includes(userId);
}

function addBlackword(guildId, word) {
    const data = loadModData(guildId);
    const lower = word.toLowerCase();
    if (data.blackwords.includes(lower)) return false;
    data.blackwords.push(lower);
    saveModData(guildId, data);
    return true;
}

function removeBlackword(guildId, word) {
    const data = loadModData(guildId);
    const lower = word.toLowerCase();
    const idx = data.blackwords.indexOf(lower);
    if (idx === -1) return false;
    data.blackwords.splice(idx, 1);
    saveModData(guildId, data);
    return true;
}

function getBlackwords(guildId) {
    const data = loadModData(guildId);
    return data.blackwords;
}

function resetBlackwords(guildId) {
    const data = loadModData(guildId);
    data.blackwords = [...DEFAULT_BLACKWORDS];
    saveModData(guildId, data);
}

function checkBlackwords(guildId, text) {
    const data = loadModData(guildId);
    const lower = text.toLowerCase();
    return data.blackwords.find(w => lower.includes(w)) || null;
}

module.exports = {
    loadModData, saveModData,
    addWarn, getWarns, removeWarn, clearWarns, setMaxWarns,
    addBlacklist, removeBlacklist, isBlacklisted,
    addBlackword, removeBlackword, getBlackwords, resetBlackwords, checkBlackwords,
    DEFAULT_BLACKWORDS,
};
