const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
        const changes = [];

        if (oldGuild.name !== newGuild.name)
            changes.push(`**Name:** ${oldGuild.name} → ${newGuild.name}`);

        if (oldGuild.icon !== newGuild.icon)
            changes.push(`**Icon:** Changed`);

        if (oldGuild.banner !== newGuild.banner)
            changes.push(`**Banner:** Changed`);

        if (oldGuild.description !== newGuild.description)
            changes.push(`**Description:** ${oldGuild.description || '*None*'} → ${newGuild.description || '*None*'}`);

        if (changes.length === 0) return;

        const logCh = await getLogChannel(newGuild, 'server');
        if (!logCh) return;

        const c = new ContainerBuilder().setAccentColor(0xFFA500);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## 🏰 Server Updated\n\n` +
            changes.join('\n') + `\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    },
};
