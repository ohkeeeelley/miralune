const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { SUPPORT_SERVER_ID } = require('../utils/checkServer');
const { checkServerMembership } = require('../utils/checkServer');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        try {

            if (newMember.guild.id === SUPPORT_SERVER_ID) {

                if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
                    await checkServerMembership(newMember.user.id, newMember.client);
                }
            }
        } catch (error) {
            console.error('Error in guildMemberUpdate event:', error);
        }

        try {
            const added   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

            if (added.size === 0 && removed.size === 0) return;

            const logCh = await getLogChannel(newMember.guild, 'roles');
            if (!logCh) return;

            const lines = [];
            if (added.size)   lines.push(`**Added:** ${added.map(r => r.toString()).join(' ')}`);
            if (removed.size) lines.push(`**Removed:** ${removed.map(r => r.toString()).join(' ')}`);

            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 🎭 Member Roles Updated\n\n` +
                `**User:** ${newMember.user.username} (ID: ${newMember.user.id})\n` +
                lines.join('\n') + `\n\n` +
                `-# <t:${Math.floor(Date.now() / 1000)}:R>`
            ));

            await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
        } catch (e) {
            console.error('[Logs] Error logging role change:', e);
        }
    }
};
