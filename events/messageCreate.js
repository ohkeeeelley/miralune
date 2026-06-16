const { Events, PermissionsBitField } = require('discord.js');
const { updateBakeryProduction } = require('../utils/bakeryProduction');
const { getOrCreateId, getUserIdById } = require('../utils/dmRelay');
const { checkBlackwords, isBlacklisted } = require('../utils/moderationManager');
const { addMessageXP } = require('../commands/economy/level');
const { handleMessage: handleAutoSpawn } = require('../model/autoSpawn');
const { cacheMessage, cacheAttachmentBuffers } = require('../utils/messageCache');
const { maybeHandleAIChat } = require('../utils/aiChatManager');
const {
    loadVerificationConfig,
    isVerificationConfigured,
    applyVerification
} = require('../utils/verificationManager');

const OWNER_ID = process.env.OWNER_ID;

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {

        cacheMessage(message);
        if (message.attachments?.size) cacheAttachmentBuffers(message).catch(() => {});

        if (message.author.bot) return;

        if (OWNER_ID && message.author.id === OWNER_ID && message.content.startsWith('!r ')) {
            const args        = message.content.slice(3).trim().split(' ');
            const targetShortId = args[0];
            const replyContent  = args.slice(1).join(' ').trim();

            if (!targetShortId || !replyContent) {
                await message.reply('**Usage:** `!r <ID> <message>`\nExample: `!r 5230 Hey, thanks for reaching out!`').catch(() => {});
                return;
            }

            const targetUserId = getUserIdById(targetShortId);
            if (!targetUserId) {
                await message.reply(`❌ No user found with ID **${targetShortId}**. Double-check the ID.`).catch(() => {});
                return;
            }

            try {
                const targetUser = await message.client.users.fetch(targetUserId);

                await targetUser.send(
                    `${replyContent}\n-# User **${message.author.username}** has responded back to you.`
                );
                await message.reply(`✅ Message delivered to **${targetUser.username}** (ID: ${targetShortId})`).catch(() => {});
            } catch (e) {
                console.error('[dmRelay] Failed to send reply to user:', e);
                await message.reply(`❌ Could not deliver message. The user may have DMs closed.`).catch(() => {});
            }
            return;
        }

        if (!message.guild) {

            if (!OWNER_ID) {
                console.warn('[dmRelay] OWNER_ID not set in .env — cannot forward DM');
                return;
            }

            const userId   = message.author.id;
            const username = message.author.username;
            const tag      = message.author.discriminator && message.author.discriminator !== '0'
                ? `${username}#${message.author.discriminator}`
                : username;

            const shortId = getOrCreateId(userId);

            let forwardContent = '';

            if (message.content && message.content.trim()) {
                forwardContent += message.content;
            }

            if (message.attachments && message.attachments.size > 0) {
                const urls = message.attachments.map(a => a.url).join('\n');
                forwardContent += (forwardContent ? '\n' : '') + urls;
            }

            if (!forwardContent) {
                if (message.stickers && message.stickers.size > 0) {
                    forwardContent = `[Sticker: ${message.stickers.first().name}]`;
                } else {
                    forwardContent = '[No text content]';
                }
            }

            const finalMessage = `${forwardContent}\n-# the user **${tag}** sent the message. ID: ${shortId}`;

            try {
                const owner = await message.client.users.fetch(OWNER_ID);
                await owner.send(finalMessage);
                console.log(`[dmRelay] Forwarded DM from ${tag} (${userId}) ID:${shortId} to owner`);
            } catch (e) {
                console.error('[dmRelay] Failed to forward DM to owner:', e);
            }

            return;
        }

        try {
            const content = String(message.content || '').trim().toLowerCase();
            if (content === '$verify') {
                const cfg = loadVerificationConfig(message.guild.id);
                if (cfg.type === 'basic' && isVerificationConfigured(cfg) && cfg.channelId === message.channel.id) {
                    const cleanupVerifyMessage = async () => {
                        await message.delete().catch(() => {});
                    };

                    if (!message.member) {
                        await cleanupVerifyMessage();
                        return;
                    }

                    if (message.member.roles.cache.has(cfg.verifiedRoleId)) {
                        const alreadyMsg = await message.reply('You are already verified!').catch(() => null);
                        if (alreadyMsg) setTimeout(() => alreadyMsg.delete().catch(() => {}), 8000);
                        await cleanupVerifyMessage();
                        return;
                    }

                    const verified = await applyVerification(message.member, cfg);
                    if (!verified.ok) {
                        const failMsg = await message.reply(`❌ ${verified.error}`).catch(() => null);
                        if (failMsg) setTimeout(() => failMsg.delete().catch(() => {}), 10000);
                        await cleanupVerifyMessage();
                        return;
                    }

                    const okMsg = await message.reply(`✅ You are now verified and received <@&${cfg.verifiedRoleId}>!`).catch(() => null);
                    if (okMsg) setTimeout(() => okMsg.delete().catch(() => {}), 10000);
                    await cleanupVerifyMessage();
                    return;
                }
            }
        } catch (e) {
            console.error('[verification] message verify error:', e);
        }

        try {
            await handleAutoSpawn(message, message.client);
        } catch (e) {
            console.error('[autoSpawn] Error in messageCreate:', e);
        }

        try {
            const matched = checkBlackwords(message.guild.id, message.content);
            if (matched) {
                const canDelete = message.channel.permissionsFor(message.guild.members.me)
                    ?.has(PermissionsBitField.Flags.ManageMessages);
                if (canDelete) {
                    await message.delete().catch(() => {});
                    await message.channel.send({
                        content: `${message.author}, your message was removed for containing a blacklisted word.`,
                    }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
                }
                return;
            }
        } catch (e) {
            console.error('[Blackword] Error checking blackwords:', e);
        }

        try {
            updateBakeryProduction(message.author.id, message.client, false);

            const profile = require('../utils/profileManager').getProfile(message.author.id);
            if (profile) {
                profile.stats = profile.stats || {};
                profile.stats.totalMessages = (profile.stats.totalMessages || 0) + 1;

                try {
                    require('../utils/profileManager').updateProfile(message.author.id, { stats: profile.stats });
                } catch (e) {
                    console.error('Error updating message stats:', e);

                    require('../utils/profileManager').updateProfile(message.author.id, { stats: profile.stats });
                }
            }

            try {
                const { isLevelingEnabled, getLevelUpChannel } = require('../utils/serverSettings');
                
                // Check if leveling is enabled for this server
                if (isLevelingEnabled(message.guild.id)) {
                    const result = addMessageXP(message.guild.id, message.author.id);
                    if (result) {
                        // Get the configured level-up channel
                        const levelUpChannelId = getLevelUpChannel(message.guild.id);
                        const targetChannel = levelUpChannelId 
                            ? message.guild.channels.cache.get(levelUpChannelId) 
                            : message.channel;
                        
                        // Send level-up message to the configured channel
                        if (targetChannel) {
                            targetChannel.send(
                                `🎉 Congratulations **${message.author.username}**, you just reached **Level ${result.level}**!`
                            ).catch(() => {});
                        } else {
                            // Fallback to same channel if configured channel not found
                            message.channel.send(
                                `🎉 Congratulations **${message.author.username}**, you just reached **Level ${result.level}**!`
                            ).catch(() => {});
                        }
                    }
                }
            } catch (e) {
                console.error('Error adding level XP:', e);
            }
        } catch (e) {
            console.error('Error in messageCreate event:', e);
        }

        try {
            await maybeHandleAIChat(message);
        } catch (e) {
            console.error('[AI] Error in messageCreate event:', e);
        }
    }
};
