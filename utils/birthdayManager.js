const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'birthdays');

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function guildConfigPath(guildId) {
    return path.join(DATA_DIR, `${guildId}.json`);
}

function globalBirthdaysPath() {
    return path.join(DATA_DIR, 'birthdays.json');
}

function loadConfig(guildId) {
    ensureDir();
    const p = guildConfigPath(guildId);
    if (!fs.existsSync(p)) return { channelId: null, roleId: null };
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return { channelId: null, roleId: null }; }
}

function saveConfig(guildId, data) {
    ensureDir();
    fs.writeFileSync(guildConfigPath(guildId), JSON.stringify(data, null, 2), 'utf8');
}

function loadBirthdays() {
    ensureDir();
    const p = globalBirthdaysPath();
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch { return {}; }
}

function saveBirthdays(data) {
    ensureDir();
    fs.writeFileSync(globalBirthdaysPath(), JSON.stringify(data, null, 2), 'utf8');
}

function setBirthday(userId, month, day) {
    const all = loadBirthdays();
    all[userId] = { month, day };
    saveBirthdays(all);
}

function getBirthday(userId) {
    return loadBirthdays()[userId] || null;
}

function removeBirthday(userId) {
    const all = loadBirthdays();
    delete all[userId];
    saveBirthdays(all);
}

function getUsersWithBirthday(month, day) {
    const all = loadBirthdays();
    return Object.entries(all)
        .filter(([, b]) => b.month === month && b.day === day)
        .map(([uid]) => uid);
}

const MONTH_NAMES = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function formatBirthday(month, day) {
    return `${MONTH_NAMES[month]} ${day}`;
}

function addPendingRoleRemoval(guildId, userId, roleId, removeAt) {
    const cfg = loadConfig(guildId);
    if (!Array.isArray(cfg.pendingRemovals)) cfg.pendingRemovals = [];
    cfg.pendingRemovals = cfg.pendingRemovals.filter(r => r.userId !== userId);
    cfg.pendingRemovals.push({ userId, roleId, removeAt });
    saveConfig(guildId, cfg);
}

function getPendingRoleRemovals(guildId) {
    const cfg = loadConfig(guildId);
    return Array.isArray(cfg.pendingRemovals) ? cfg.pendingRemovals : [];
}

function clearPendingRoleRemoval(guildId, userId) {
    const cfg = loadConfig(guildId);
    if (!Array.isArray(cfg.pendingRemovals)) return;
    cfg.pendingRemovals = cfg.pendingRemovals.filter(r => r.userId !== userId);
    saveConfig(guildId, cfg);
}

module.exports = {
    loadConfig,
    saveConfig,
    setBirthday,
    getBirthday,
    removeBirthday,
    getUsersWithBirthday,
    formatBirthday,
    MONTH_NAMES,
    addPendingRoleRemoval,
    getPendingRoleRemovals,
    clearPendingRoleRemoval,
};
