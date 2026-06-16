const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { SUPPORT_SERVER_ID, checkServerMembership } = require('../utils/checkServer');
const { getLogChannel } = require('../utils/logsManager');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            if (member.guild.id === SUPPORT_SERVER_ID) {
                await checkServerMembership(member.user.id, member.client);
            }
        } catch (error) {
            console.error('Error in guildMemberRemove event:', error);
        }

        try {
            const logCh = await getLogChannel(member.guild, 'joinLeave');
            if (logCh) {
                const roles = member.roles.cache
                    .filter(r => r.id !== member.guild.id)
                    .map(r => r.toString()).join(' ') || '*None*';
                const c = new ContainerBuilder().setAccentColor(0xEB4145);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 📤 Member Left\n\n` +
                    `**User:** ${member.user.username} (ID: ${member.user.id})\n` +
                    `**Roles:** ${roles}\n` +
                    `**Member count:** ${member.guild.memberCount}\n\n` +
                    `-# <t:${Math.floor(Date.now() / 1000)}:R>`
                ));
                await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
            }
        } catch (e) {
            console.error('[Logs] Error logging member leave:', e);
        }
    }
};
