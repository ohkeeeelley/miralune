const fs   = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'logs');

const LOG_TYPES = {
    messages:   { label: 'Messages',    emoji: '💬', description: 'Deleted & edited messages' },
    joinLeave:  { label: 'Join / Leave', emoji: '👋', description: 'Member joins & leaves' },
    moderation: { label: 'Moderation',  emoji: '🔨', description: 'Kick, ban, mute, warn actions' },
    channels:   { label: 'Channels',    emoji: '📁', description: 'Channel create, delete & rename' },
    roles:      { label: 'Roles',       emoji: '🎭', description: 'Role create, delete, rename, permissions & role assignments' },
    server:     { label: 'Server',      emoji: '🏰', description: 'Server name, icon & setting changes' },
};

function ensureDir() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function defaults() {
    const cfg = {};
    for (const key of Object.keys(LOG_TYPES)) {
        cfg[key] = { enabled: false, channelId: null };
    }
    return cfg;
}

function loadLogConfig(guildId) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    if (!fs.existsSync(p)) return defaults();
    try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));

        if (typeof raw.messages === 'boolean' || (raw.channelId && typeof raw.channelId === 'string')) {
            const migrated = defaults();
            const oldCh = raw.channelId || null;
            for (const key of Object.keys(LOG_TYPES)) {
                if (typeof raw[key] === 'boolean') {
                    migrated[key] = { enabled: raw[key], channelId: oldCh };
                }
            }
            fs.writeFileSync(p, JSON.stringify(migrated, null, 2), 'utf8');
            return migrated;
        }

        const def = defaults();
        for (const key of Object.keys(LOG_TYPES)) {
            if (raw[key] && typeof raw[key] === 'object') {
                def[key] = { enabled: !!raw[key].enabled, channelId: raw[key].channelId || null };
            }
        }
        return def;
    } catch {
        return defaults();
    }
}

function saveLogConfig(guildId, cfg) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
}

async function getLogChannel(guild, type) {
    const cfg = loadLogConfig(guild.id);
    const cat = cfg[type];
    if (!cat || !cat.enabled || !cat.channelId) return null;
    try {
        return guild.channels.cache.get(cat.channelId)
            || await guild.channels.fetch(cat.channelId).catch(() => null);
    } catch {
        return null;
    }
}

module.exports = { LOG_TYPES, loadLogConfig, saveLogConfig, getLogChannel };
