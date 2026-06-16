const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');
const { getCachedMessage, deleteCachedMessage } = require('../utils/messageCache');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild) return;

        const cached = getCachedMessage(message.id);

        if (message.author?.bot) return;
        if (cached?.authorBot) return;

        const authorId       = message.author?.id       ?? cached?.authorId       ?? null;
        const authorUsername = message.author?.username  ?? cached?.authorUsername ?? 'Unknown';

        if (!authorId) return;

        const rawContent = message.content ?? cached?.content ?? null;
        const content = rawContent
            ? (rawContent.length > 1000 ? rawContent.slice(0, 1000) + '…' : rawContent)
            : '*(No text content)*';

        const cachedAttachments = cached?.attachments ?? [];
        const liveAttachments   = message.attachments?.size
            ? [...message.attachments.values()].map(a => a.name ?? a.url)
            : [];
        const allAttachments = liveAttachments.length
            ? liveAttachments
            : cachedAttachments.map(a => (typeof a === 'string' ? a : (a.name ?? a.url)));
        const attachments = allAttachments.length
            ? `\n**Attachments:** ${allAttachments.join(', ')}`
            : '';

        const imageFiles = (cached?.attachmentBuffers ?? []).map(b => ({
            attachment: b.buffer,
            name: b.name,
        }));

        const channel = await getLogChannel(message.guild, 'messages');
        if (!channel) return;

        deleteCachedMessage(message.id);

        const channelId = message.channelId ?? message.channel?.id ?? cached?.channelId ?? 'unknown';

        const c = new ContainerBuilder().setAccentColor(0xEB4145);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 🗑️ Message Deleted\n\n` +
            `**Author:** ${authorUsername} (ID: ${authorId})\n` +
            `**Channel:** <#${channelId}>\n` +
            `**Content:**\n>>> ${content}${attachments}\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await channel.send({
            components: [c.toJSON()],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
            ...(imageFiles.length ? { files: imageFiles } : {}),
        }).catch(() => {});
    },
};
