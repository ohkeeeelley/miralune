const { Events, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const { loadStarboard, saveStarboard } = require('../utils/starboardManager');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        if (reaction.message.partial) {
            try { await reaction.message.fetch(); } catch { return; }
        }

        const message = reaction.message;
        if (!message.guild) return;

        const cfg = loadStarboard(message.guild.id);
        if (!cfg.enabled || !cfg.channelId) return;
        if (reaction.emoji.name !== cfg.emoji) return;

        const existingPostId = cfg.posts[message.id];
        if (!existingPostId) return;

        const starboardChannel = message.guild.channels.cache.get(cfg.channelId)
            || await message.guild.channels.fetch(cfg.channelId).catch(() => null);
        if (!starboardChannel) return;

        const count = reaction.count;

        try {
            if (count < cfg.threshold) {

                const existing = await starboardChannel.messages.fetch(existingPostId).catch(() => null);
                if (existing) await existing.delete().catch(() => {});
                delete cfg.posts[message.id];
                saveStarboard(message.guild.id, cfg);
            } else {

                const existing = await starboardChannel.messages.fetch(existingPostId).catch(() => null);
                if (!existing) return;

                const content = message.content
                    ? (message.content.length > 1000 ? message.content.slice(0, 1000) + '…' : message.content)
                    : '';

                const c = new ContainerBuilder().setAccentColor(0xFFD700);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## ${cfg.emoji} ${count} | <#${message.channel.id}>`
                ));
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                let bodyText = `**${message.author?.username || 'Unknown'}**\n`;
                if (content) bodyText += `${content}\n`;
                bodyText += `\n**[Jump to message](${message.url})**`;
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyText));

                const img = message.attachments?.find(a => a.contentType?.startsWith('image/'));
                if (img) {
                    c.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL(img.url)
                        )
                    );
                }

                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `-# <t:${Math.floor(message.createdTimestamp / 1000)}:R>`
                ));

                await existing.edit({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 });
            }
        } catch (e) {
            console.error('[Starboard] Error updating/removing starboard post:', e);
        }
    },
};
