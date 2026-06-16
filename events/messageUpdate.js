const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;
        if (!oldMessage.content && !newMessage.content) return;

        const channel = await getLogChannel(newMessage.guild, 'messages');
        if (!channel) return;

        const before = oldMessage.content
            ? (oldMessage.content.length > 500 ? oldMessage.content.slice(0, 500) + '…' : oldMessage.content)
            : '*Empty*';
        const after = newMessage.content
            ? (newMessage.content.length > 500 ? newMessage.content.slice(0, 500) + '…' : newMessage.content)
            : '*Empty*';

        const c = new ContainerBuilder().setAccentColor(0xFFA500);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ✏️ Message Edited\n\n` +
            `**Author:** ${newMessage.author.username} (ID: ${newMessage.author.id})\n` +
            `**Channel:** <#${newMessage.channel.id}>\n` +
            `**[Jump to message](${newMessage.url})**\n\n` +
            `**Before:**\n>>> ${before}\n\n` +
            `**After:**\n>>> ${after}\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await channel.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    },
};
