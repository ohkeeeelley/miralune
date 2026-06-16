const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        const changes = [];
        if (oldChannel.name !== newChannel.name)
            changes.push(`**Name:** ${oldChannel.name} → ${newChannel.name}`);
        if (oldChannel.topic !== newChannel.topic)
            changes.push(`**Topic:** ${oldChannel.topic || '*None*'} → ${newChannel.topic || '*None*'}`);

        if (changes.length === 0) return;

        const logCh = await getLogChannel(newChannel.guild, 'channels');
        if (!logCh) return;

        const c = new ContainerBuilder().setAccentColor(0xFFA500);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ✏️ Channel Updated\n\n` +
            `**Channel:** <#${newChannel.id}>\n` +
            changes.join('\n') + `\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    },
};
