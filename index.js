const fs = require('fs');
const path = require('path');
const { Client, Collection, Events, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
require('dotenv').config();

const TOKEN     = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID  = process.env.OWNER_ID;

const profileManager       = require('./utils/profileManager');
const { runStartupChecks } = require('./utils/startupChecks');
const logger               = require('./utils/logger');
const { updateBakeryProduction } = require('./utils/bakeryProduction');
const {
    loadConfig: loadBirthdayConfig,
    saveConfig: saveBirthdayConfig,
    getUsersWithBirthday,
    formatBirthday,
    addPendingRoleRemoval,
    getPendingRoleRemovals,
    clearPendingRoleRemoval,
} = require('./utils/birthdayManager');

logger.info('============ STARTING MIRALUNE ============');

function updateBotStatus(client) {
    const profilesPath = path.join(__dirname, 'data', 'profile', 'profiles.json');
    let profileCount = 0;
    try {
        if (fs.existsSync(profilesPath)) {
            const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8') || '{}');
            profileCount = Object.keys(profiles).length;
        }
    } catch (err) {
        console.error('Error reading profiles:', err);
    }

    client.user.setPresence({
        activities: [{
            name: `over the bakery, over ${profileCount} bakers`,
            type: ActivityType.Watching
        }],
        status: 'online'
    });
}

if (!TOKEN) {
    console.error('❌ TOKEN not set in .env');
    process.exit(1);
}

if (!OWNER_ID) {
    console.warn('⚠️  OWNER_ID not set in .env — DM relay will not forward messages');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction
    ]
});

client.commands = new Collection();

function loadCommands(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            loadCommands(full);
            continue;
        }
        if (!entry.name.endsWith('.js')) continue;
        try {
            delete require.cache[require.resolve(full)];
            const cmd = require(full);
            if (cmd && cmd.data && cmd.execute) {
                client.commands.set(cmd.data.name, cmd);
                logger.info(`Loaded command: ${cmd.data.name}`);
            } else {
                logger.warn(`Skipping ${entry.name} - missing data/execute`);
            }
        } catch (err) {
            logger.error(`Failed loading command ${entry.name}: ${err}`);
        }
    }
}

try { runStartupChecks(); } catch (err) { logger.error(`Startup checks failed: ${err}`); }

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const categories = fs.readdirSync(commandsPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    console.log('Loading command categories:');
    for (const cat of categories) {
        if (cat.toLowerCase().includes('economy'))         console.log('Loading Economy Commands.');
        else if (cat.toLowerCase().includes('management')) console.log('Loading Management Commands');
        else if (cat.toLowerCase().includes('utils') || cat.toLowerCase().includes('utility')) console.log('Loading Utility Commands.');
        else console.log(`- ${cat}`);
    }
    loadCommands(commandsPath);
} else {
    console.warn('No commands directory found.');
}

const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
        try {
            delete require.cache[require.resolve(path.join(eventsPath, file))];
            const evt = require(path.join(eventsPath, file));
            if (evt && evt.name && evt.execute) {
                if (evt.once) client.once(evt.name, (...a) => evt.execute(...a));
                else          client.on(evt.name,   (...a) => evt.execute(...a));
                logger.info(`Loaded event: ${evt.name} (${file})`);
            } else {
                logger.warn(`Skipping event file ${file} - invalid export`);
            }
        } catch (err) {
            logger.error(`Failed loading event ${file}: ${err}`);
        }
    }
}

try {
    const serversDir = path.join(__dirname, 'data', 'ponyspawn');
    if (!fs.existsSync(serversDir)) fs.mkdirSync(serversDir, { recursive: true });
} catch (e) {
    console.warn('Could not create data/ponyspawn directory', e);
}

try {
    const dmIdsPath = path.join(__dirname, 'data', 'dmIds.json');
    if (!fs.existsSync(dmIdsPath)) {
        fs.writeFileSync(dmIdsPath, JSON.stringify({ byUserId: {}, byId: {} }, null, 2));
        logger.info('Created data/dmIds.json');
    }
} catch (e) {
    console.warn('Could not create data/dmIds.json', e);
}

const PROFILE_VC_ID = process.env.PROFILEVOICE_CHANNEL_ID;

async function updateBakeryCounter(botClient) {
    if (!PROFILE_VC_ID) return;
    try {
        const profilesPath = path.join(__dirname, 'data', 'profile', 'profiles.json');
        let count = 0;
        if (fs.existsSync(profilesPath)) {
            const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8') || '{}');
            count = Object.keys(profiles).length;
        }
        const channel = await botClient.channels.fetch(PROFILE_VC_ID).catch(() => null);
        if (channel) {
            const newName = `🌈┃Total Bakeries: ${count}`;
            if (channel.name !== newName) {
                await channel.setName(newName);
            }
        }
    } catch (err) {
        console.error('Bakery counter update error:', err.message);
    }
}

client.once(Events.ClientReady, (c) => {
    logger.info(`Logged in as ${c.user.tag}`);
    logger.info(`DM relay OWNER_ID: ${OWNER_ID || 'NOT SET'}`);

    updateBotStatus(c);
    updateBakeryCounter(c);

    try {
        const lotteryManager = require('./utils/lotteryManager');
        lotteryManager.scheduleEnd(c);
    } catch (e) {
        console.warn('Could not schedule lottery end on startup:', e);
    }

    setInterval(() => updateBotStatus(c), 5 * 60 * 1000);

    setInterval(() => updateBakeryCounter(c), 3 * 60 * 1000);

    const CHECK_INTERVAL = 30 * 1000;
    setInterval(async () => {
        try {

            try {
                const alertsPath = path.join(__dirname, 'data', 'alert', 'alerts.json');
                if (fs.existsSync(alertsPath)) {
                    const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8') || '{}');
                    if (alerts.currentAlert && alerts.currentAlert.timestamp &&
                        (Date.now() - alerts.currentAlert.timestamp) > 43200000) {
                        alerts.currentAlert = null;
                        alerts.readBy = [];
                        fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));
                        console.log('Cleared old alert (12 hours expired)');
                    }
                }
            } catch (e) {
                console.error('Alert cleanup error:', e);
            }

            const profilesPath = path.join(__dirname, 'data', 'profile', 'profiles.json');
            if (!fs.existsSync(profilesPath)) return;

            const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8') || '{}');
            const now = Date.now();

            for (const [userId, pdata] of Object.entries(profiles)) {
                try {
                    const shouldNotify = pdata.bakery &&
                        pdata.bakery.bakestorage >= pdata.bakery.maxbakestorage &&
                        !pdata.bakery.storageFullNotified;

                    updateBakeryProduction(userId, c, shouldNotify);
                } catch (e) {
                    console.error('Error updating bakery production for', userId, e);
                }

                const servers = pdata.servers || {};
                for (const guildId of Object.keys(servers)) {
                    try {
                        const prof = profileManager.getProfile(userId, guildId);
                        if (!prof || !prof.server) continue;
                        const server = prof.server;

                        if (server.StorageFullNotify && server.StorageFullNotifyAt &&
                            Number(server.StorageFullNotifyAt) <= now) {
                            let dmSent = false;
                            try {
                                const user = await c.users.fetch(userId).catch(() => null);
                                if (user) {
                                    await user.send('🎂 Hey! Your bakery is ready to bake again!');
                                    dmSent = true;
                                }
                            } catch (e) {
                                console.error('Failed to send StorageFullNotify DM:', e);
                            }

                            if (dmSent) {
                                profileManager.updateProfile(userId, guildId, { StorageFullNotify: false, StorageFullNotifyAt: 0 });
                            } else {
                                const retryAt = Date.now() + (60 * 60 * 1000);
                                profileManager.updateProfile(userId, guildId, { StorageFullNotify: true, StorageFullNotifyAt: retryAt });
                            }
                        }
                    } catch (e) {
                        console.error('Error processing StorageFullNotify for', userId, guildId, e);
                    }
                }
            }

            for (const [userId, pdata] of Object.entries(profiles)) {
                try {
                    if (pdata.adventure?.notify === true &&
                        pdata.adventure.cooldown > 0 &&
                        now >= pdata.adventure.cooldown) {
                        const user = await c.users.fetch(userId).catch(() => null);
                        if (user) {
                            await user.send('🌟 Your adventure cooldown has expired! Head back and go on another adventure with `/adventure`!').catch(() => {});
                        }
                        profileManager.updateProfile(userId, { adventure: { notify: false } });
                    }
                } catch (e) {
                    console.error('Error sending adventure reminder for', userId, e);
                }
            }

        } catch (e) {
            console.error('Background checker error:', e);
        }
    }, CHECK_INTERVAL);
    setInterval(async () => {
        try {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
            const todayMonth = now.getMonth() + 1;
            const todayDay   = now.getDate();

            const birthdayUsers = getUsersWithBirthday(todayMonth, todayDay);

            for (const guild of c.guilds.cache.values()) {
                try {
                    const cfg = loadBirthdayConfig(guild.id);

                    if (cfg.channelId) {
                        const lastCheck = cfg.lastBirthdayCheck || null;
                        if (lastCheck !== todayStr) {
                            cfg.lastBirthdayCheck = todayStr;

                            for (const userId of birthdayUsers) {
                                try {
                                    const member = await guild.members.fetch(userId).catch(() => null);
                                    if (!member) continue;

                                    const channel = await c.channels.fetch(cfg.channelId).catch(() => null);
                                    if (channel) {
                                        await channel.send(
                                            `🎂 Happy Birthday, <@${userId}>! 🎉 Wishing you a magical day filled with friendship and cake! 🍰`
                                        ).catch(e => console.error('Birthday message send error:', e));
                                    }

                                    if (cfg.roleId) {
                                        try {
                                            await member.roles.add(cfg.roleId);
                                            addPendingRoleRemoval(guild.id, userId, cfg.roleId, Date.now() + 86400000);
                                        } catch (e) {
                                            console.error('Failed to add birthday role:', e);
                                        }
                                    }
                                } catch (e) {
                                    console.error('Birthday processing error for user', userId, e);
                                }
                            }

                            saveBirthdayConfig(guild.id, cfg);
                        }
                    }

                    const pending = getPendingRoleRemovals(guild.id);
                    for (const entry of pending) {
                        if (Date.now() < entry.removeAt) continue;
                        try {
                            const member = await guild.members.fetch(entry.userId).catch(() => null);
                            if (member) {
                                await member.roles.remove(entry.roleId).catch(e => console.error('Failed to remove birthday role:', e));
                            }
                        } catch (e) {
                            console.error('Birthday role removal error:', e);
                        }
                        clearPendingRoleRemoval(guild.id, entry.userId);
                    }
                } catch (e) {
                    console.error('Birthday check error for guild', guild.id, e);
                }
            }
        } catch (e) {
            console.error('Birthday interval error:', e);
        }
    }, 60 * 1000);
});

const autoSpawn = require('./model/autoSpawn');
client.on('messageCreate', async (message) => {
    await autoSpawn.handleMessage(message, client);
});

process.on('SIGINT', async () => {
    logger.info('\n👋 Received Ctrl+C - Shutting down gracefully...');
    try {
        if (client.isReady()) {
            logger.info('🔌 Disconnecting from Discord...');
            await client.destroy();
            logger.info('✅ Successfully disconnected!');
        }
    } catch (err) {
        logger.error(`❌ Error during shutdown: ${err}`);
    }
    logger.info('Disconnected!');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('\n⚠️ Received termination signal - Shutting down...');
    try {
        if (client.isReady()) {
            logger.info('🔌 Disconnecting from Discord...');
            await client.destroy();
            logger.info('✅ Successfully disconnected!');
        }
    } catch (err) {
        logger.error(`❌ Error during shutdown: ${err}`);
    }
    process.exit(0);
});

client.login(TOKEN).catch(err => {
    logger.error(`❌ Failed to login: ${err}`);
    process.exit(1);
});

module.exports = client;
module.exports.updateBakeryCounter = updateBakeryCounter;

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise} reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err}`);
});
