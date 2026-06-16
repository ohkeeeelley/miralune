const fs   = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'starboard');

function ensureDir() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function defaults() {
    return {
        channelId: null,
        threshold: 3,
        emoji: '⭐',
        enabled: false,
        posts: {},
        ignoredChannels: [],
    };
}

function loadStarboard(guildId) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    if (!fs.existsSync(p)) return defaults();
    try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        return { ...defaults(), ...raw };
    } catch {
        return defaults();
    }
}

function saveStarboard(guildId, cfg) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
}

module.exports = { loadStarboard, saveStarboard };
