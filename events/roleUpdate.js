const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.GuildRoleUpdate,
    async execute(oldRole, newRole) {
        const changes = [];

        if (oldRole.name !== newRole.name)
            changes.push(`**Name:** ${oldRole.name} → ${newRole.name}`);

        if (oldRole.hexColor !== newRole.hexColor)
            changes.push(`**Color:** ${oldRole.hexColor} → ${newRole.hexColor}`);

        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            const oldPerms = oldRole.permissions.serialize();
            const newPerms = newRole.permissions.serialize();
            const added   = [];
            const removed = [];
            for (const [perm, val] of Object.entries(newPerms)) {
                if (val && !oldPerms[perm]) added.push(formatPerm(perm));
                if (!val && oldPerms[perm]) removed.push(formatPerm(perm));
            }
            if (added.length)   changes.push(`**Permissions Added:** ${added.join(', ')}`);
            if (removed.length) changes.push(`**Permissions Removed:** ${removed.join(', ')}`);
        }

        if (changes.length === 0) return;

        const logCh = await getLogChannel(newRole.guild, 'roles');
        if (!logCh) return;

        const c = new ContainerBuilder().setAccentColor(0xFFA500);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `## ✏️ Role Updated\n\n` +
            `**Role:** ${newRole.name} (${newRole})\n` +
            changes.join('\n') + `\n\n` +
            `-# <t:${Math.floor(Date.now() / 1000)}:R>`
        ));

        await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
    },
};

function formatPerm(perm) {
    return perm.replace(/([A-Z])/g, ' $1').trim();
}
