const axios = require('axios');
const MAX_ENTRIES    = 2000;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const cache = new Map();

/**
 * @param {import('discord.js').Message}
 */
function cacheMessage(message) {
    if (!message?.id) return;

    if (cache.size >= MAX_ENTRIES) {
        cache.delete(cache.keys().next().value);
    }

    cache.set(message.id, {
        content: message.content || null,
        authorId: message.author?.id ?? null,
        authorUsername: message.author?.username ?? null,
        authorBot: message.author?.bot ?? false,
        channelId: message.channel?.id ?? null,
        attachments: message.attachments
            ? [...message.attachments.values()].map(a => ({ name: a.name, url: a.url, contentType: a.contentType }))
            : [],
        attachmentBuffers: [],
    });
}

/**
 * @param {import('discord.js').Message}
 */
async function cacheAttachmentBuffers(message) {
    if (!message?.id || !message.attachments?.size) return;

    const imageAttachments = [...message.attachments.values()].filter(a =>
        (a.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.name ?? '')) &&
        (a.size ?? 0) <= MAX_IMAGE_SIZE
    );

    if (!imageAttachments.length) return;

    const buffers = [];
    for (const a of imageAttachments) {
        try {
            const resp = await axios.get(a.url, { responseType: 'arraybuffer', timeout: 10_000 });
            buffers.push({ name: a.name ?? 'image.png', buffer: Buffer.from(resp.data) });
        } catch {
        }
    }

    const entry = cache.get(message.id);
    if (entry) entry.attachmentBuffers = buffers;
}

/**
 * @param {string}
 */
function getCachedMessage(messageId) {
    return cache.get(messageId) ?? null;
}

/**
 * @param {string}
 */
function deleteCachedMessage(messageId) {
    cache.delete(messageId);
}

module.exports = { cacheMessage, cacheAttachmentBuffers, getCachedMessage, deleteCachedMessage };
