const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        const logCh = await getLogChannel(role.guild, 'roles');
        if (!logCh) return;

        const c = new ContainerBuilder().setAccentColor(0xEB4145);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 🗑️ Role Deleted\n\n` +
            `**Role:** ${role.name}\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    },
};
