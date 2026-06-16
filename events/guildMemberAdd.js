const { Events, AttachmentBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const { SUPPORT_SERVER_ID, checkServerMembership } = require('../utils/checkServer');
const { loadWelcome, generateWelcomeCard } = require('../utils/welcomeManager');
const { isBlacklisted } = require('../utils/moderationManager');
const { getLogChannel } = require('../utils/logsManager');
const { loadVerificationConfig, isVerificationConfigured } = require('../utils/verificationManager');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {

        try {
            if (isBlacklisted(member.guild.id, member.user.id)) {
                await member.ban({ reason: 'Blacklisted user attempted to rejoin' }).catch(() => {});
                console.log(`[Blacklist] Auto-banned ${member.user.username} (${member.user.id}) from ${member.guild.name}`);
                return;
            }
        } catch (e) {
            console.error('[Blacklist] Error checking blacklist:', e);
        }

        try {
            if (member.guild.id === SUPPORT_SERVER_ID) {
                await checkServerMembership(member.user.id, member.client);
            }
        } catch (error) {
            console.error('Error in guildMemberAdd event:', error);
        }

        try {
            const vcfg = loadVerificationConfig(member.guild.id);
            if (isVerificationConfigured(vcfg) && vcfg.unverifiedRoleId && !member.roles.cache.has(vcfg.verifiedRoleId)) {
                const unverifiedRole = member.guild.roles.cache.get(vcfg.unverifiedRoleId)
                    || await member.guild.roles.fetch(vcfg.unverifiedRoleId).catch(() => null);

                if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
                    const botMember = member.guild.members.me;
                    if (botMember?.permissions?.has('ManageRoles') && botMember.roles.highest.position > unverifiedRole.position) {
                        await member.roles.add(unverifiedRole).catch(() => {});
                    }
                }
            }
        } catch (error) {
            console.error('[Verification] Failed to apply unverified role:', error);
        }

        try {
            const cfg = loadWelcome(member.guild.id);

            if (cfg.roleId) {
                try {
                    const role = member.guild.roles.cache.get(cfg.roleId)
                        || await member.guild.roles.fetch(cfg.roleId).catch(() => null);
                    if (role) await member.roles.add(role);
                } catch (err) {
                    console.error('[Welcome] Failed to add role:', err);
                }
            }

            if (cfg.channelId && cfg.activeWelcome && cfg.welcomes[cfg.activeWelcome]) {
                const channel = member.guild.channels.cache.get(cfg.channelId)
                    || await member.guild.channels.fetch(cfg.channelId).catch(() => null);

                if (!channel) {
                    console.warn('[Welcome] Welcome channel not found:', cfg.channelId);
                    return;
                }

                const active     = cfg.welcomes[cfg.activeWelcome];
                const heading    = active.heading || 'New Incomer';
                const cardBuffer = await generateWelcomeCard(member, active.title, active.description);
                const attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome.png' });

                const container = new ContainerBuilder().setAccentColor(0xE8A9FF);
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${heading}`)
                );
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                const gallery = new MediaGalleryBuilder();
                gallery.addItems(new MediaGalleryItemBuilder().setURL('attachment://welcome.png'));
                container.addMediaGalleryComponents(gallery);

                const msgTemplate = active.message || '';
                if (msgTemplate) {
                    const vars = {
                        '{user}':        member.user.username,
                        '{displayname}': member.displayName,
                        '{server}':      member.guild.name,
                        '{count}':       member.guild.memberCount.toLocaleString(),
                        '{mention}':     `<@${member.user.id}>`,
                    };
                    const msg = Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(k, v), msgTemplate);
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(msg));
                }

                await channel.send({
                    components: [container.toJSON()],
                    files: [attachment],
                    flags: MessageFlags.IsComponentsV2,
                });
            }
        } catch (error) {
            console.error('[Welcome] Error in welcome system:', error);
        }

        try {
            const logCh = await getLogChannel(member.guild, 'joinLeave');
            if (logCh) {
                const created = Math.floor(member.user.createdTimestamp / 1000);
                const c = new ContainerBuilder().setAccentColor(0x57F287);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 📥 Member Joined\n\n` +
                    `**User:** ${member.user.username} (ID: ${member.user.id})\n` +
                    `**Account created:** <t:${created}:R>\n` +
                    `**Member count:** ${member.guild.memberCount}\n\n` +
                    `-# <t:${Math.floor(Date.now() / 1000)}:R>`
                ));
                await logCh.send({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => {});
            }
        } catch (e) {
            console.error('[Logs] Error logging member join:', e);
        }
    }
};
