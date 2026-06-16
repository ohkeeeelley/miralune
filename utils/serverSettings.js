const fs = require('fs');
const path = require('path');

const SETTINGS_DIR = path.join(__dirname, '../data/servers');

// Ensure settings directory exists
if (!fs.existsSync(SETTINGS_DIR)) {
    fs.mkdirSync(SETTINGS_DIR, { recursive: true });
}

/**
 * Load server settings from file
 * @param {string} guildId - The guild ID
 * @returns {object} Server settings object
 */
function loadServerSettings(guildId) {
    const filePath = path.join(SETTINGS_DIR, `${guildId}.json`);
    
    try {
        if (!fs.existsSync(filePath)) {
            return getDefaultSettings();
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Merge with defaults to ensure all properties exist
        return { ...getDefaultSettings(), ...data };
    } catch (error) {
        console.error(`Error loading settings for guild ${guildId}:`, error);
        return getDefaultSettings();
    }
}

/**
 * Save server settings to file
 * @param {string} guildId - The guild ID
 * @param {object} settings - Settings object to save
 */
function saveServerSettings(guildId, settings) {
    const filePath = path.join(SETTINGS_DIR, `${guildId}.json`);
    
    try {
        const currentSettings = loadServerSettings(guildId);
        const mergedSettings = { ...currentSettings, ...settings };
        
        fs.writeFileSync(filePath, JSON.stringify(mergedSettings, null, 2));
        return true;
    } catch (error) {
        console.error(`Error saving settings for guild ${guildId}:`, error);
        return false;
    }
}

/**
 * Get default server settings
 * @returns {object} Default settings
 */
function getDefaultSettings() {
    return {
        leveling: {
            enabled: true,
            levelUpChannel: null, // null = send in same channel as message
        },
        moderation: {
            enabled: true,
        },
        // Preserve existing properties
        spawnChannels: [],
        channelTargets: {},
        channelCounters: {},
        guildTarget: null,
    };
}

/**
 * Check if leveling is enabled for a guild
 * @param {string} guildId - The guild ID
 * @returns {boolean} True if leveling is enabled
 */
function isLevelingEnabled(guildId) {
    const settings = loadServerSettings(guildId);
    return settings.leveling?.enabled !== false;
}

/**
 * Check if moderation is enabled for a guild
 * @param {string} guildId - The guild ID
 * @returns {boolean} True if moderation is enabled
 */
function isModerationEnabled(guildId) {
    const settings = loadServerSettings(guildId);
    return settings.moderation?.enabled !== false;
}

/**
 * Get level-up notification channel
 * @param {string} guildId - The guild ID
 * @returns {string|null} Channel ID or null for same channel
 */
function getLevelUpChannel(guildId) {
    const settings = loadServerSettings(guildId);
    return settings.leveling?.levelUpChannel || null;
}

/**
 * Toggle leveling system
 * @param {string} guildId - The guild ID
 * @param {boolean} enabled - Enable or disable
 * @returns {boolean} Success status
 */
function toggleLeveling(guildId, enabled) {
    const settings = loadServerSettings(guildId);
    settings.leveling = settings.leveling || {};
    settings.leveling.enabled = enabled;
    return saveServerSettings(guildId, settings);
}

/**
 * Toggle moderation system
 * @param {string} guildId - The guild ID
 * @param {boolean} enabled - Enable or disable
 * @returns {boolean} Success status
 */
function toggleModeration(guildId, enabled) {
    const settings = loadServerSettings(guildId);
    settings.moderation = settings.moderation || {};
    settings.moderation.enabled = enabled;
    return saveServerSettings(guildId, settings);
}

/**
 * Set level-up channel
 * @param {string} guildId - The guild ID
 * @param {string|null} channelId - Channel ID or null for same channel
 * @returns {boolean} Success status
 */
function setLevelUpChannel(guildId, channelId) {
    const settings = loadServerSettings(guildId);
    settings.leveling = settings.leveling || {};
    settings.leveling.levelUpChannel = channelId;
    return saveServerSettings(guildId, settings);
}

module.exports = {
    loadServerSettings,
    saveServerSettings,
    getDefaultSettings,
    isLevelingEnabled,
    isModerationEnabled,
    getLevelUpChannel,
    toggleLeveling,
    toggleModeration,
    setLevelUpChannel,
};
