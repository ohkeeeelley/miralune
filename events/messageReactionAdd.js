const { Events, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const { loadStarboard, saveStarboard } = require('../utils/starboardManager');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        if (user.bot) return;

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
        if (message.channel.id === cfg.channelId) return;
        if (message.author?.bot) return;

        const count = reaction.count;
        if (count < cfg.threshold) return;

        const starboardChannel = message.guild.channels.cache.get(cfg.channelId)
            || await message.guild.channels.fetch(cfg.channelId).catch(() => null);
        if (!starboardChannel) return;

        const existingPostId = cfg.posts[message.id];

        const content = message.content
            ? (message.content.length > 1000 ? message.content.slice(0, 1000) + '…' : message.content)
            : '';

        const c = new ContainerBuilder().setAccentColor(0xFFD700);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ${cfg.emoji} ${count} | <#${message.channel.id}>`
        ));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        let bodyText = `**${message.author.username}**\n`;
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

        const sendOptions = {
            components: [c.toJSON()],
            flags: MessageFlags.IsComponentsV2,
        };

        try {
            if (existingPostId) {

                const existing = await starboardChannel.messages.fetch(existingPostId).catch(() => null);
                if (existing) {
                    await existing.edit(sendOptions);
                } else {

                    const sent = await starboardChannel.send(sendOptions);
                    cfg.posts[message.id] = sent.id;
                    saveStarboard(message.guild.id, cfg);
                }
            } else {

                const sent = await starboardChannel.send(sendOptions);
                cfg.posts[message.id] = sent.id;
                saveStarboard(message.guild.id, cfg);
            }
        } catch (e) {
            console.error('[Starboard] Error sending/updating starboard post:', e);
        }
    },
};
