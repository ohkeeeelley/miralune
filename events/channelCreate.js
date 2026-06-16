const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        if (!channel.guild) return;

        const logCh = await getLogChannel(channel.guild, 'channels');
        if (!logCh) return;

        const category = channel.parent ? channel.parent.name : 'None';

        const c = new ContainerBuilder().setAccentColor(0x57F287);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 📁 Channel Created\n\n` +
            `**Channel:** ${channel.name} (<#${channel.id}>)\n` +
            `**Type:** ${formatChannelType(channel.type)}\n` +
            `**Category:** ${category}\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    },
};

function formatChannelType(type) {
    const map = { 0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement', 13: 'Stage', 15: 'Forum' };
    return map[type] || 'Unknown';
}
