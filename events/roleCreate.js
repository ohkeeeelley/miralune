const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.GuildRoleCreate,
    async execute(role) {
        const logCh = await getLogChannel(role.guild, 'roles');
        if (!logCh) return;

        const color = role.hexColor !== '#000000' ? role.hexColor : 'Default';

        const c = new ContainerBuilder().setAccentColor(0x57F287);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 🎭 Role Created\n\n` +
            `**Role:** ${role.name} (${role})\n` +
            `**Color:** ${color}\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    },
};
