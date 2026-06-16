const { getProfile, updateProfile } = require('./profileManager');
const SUPPORT_SERVER_ID = '1475754440441991200';
const BOOSTER_ROLE_ID = '1480082291899236434';
let cachedInviteLink = null;

/****
 * @param {Client}
 * @returns {Promise<string>}
 */
async function getSupportServerInviteLink(client) {
  try {
    if (cachedInviteLink) {
      return cachedInviteLink;
    }

    const guild = await client.guilds.fetch(SUPPORT_SERVER_ID).catch(() => null);
    if (!guild) {
      console.warn('Could not fetch support server for invite generation');
      return `https://discord.gg/wHMdDkPyBu`;
    }

    const channels = guild.channels.cache.filter(c =>
      c.isTextBased() && c.permissionsFor(guild.me)?.has('CreateInstantInvite')
    );

    if (channels.size > 0) {
      const channel = channels.first();
      try {
        const invites = await channel.fetchInvites().catch(() => []);
        const permanentInvite = invites.find(inv => !inv.expiresAt && !inv.uses);
        if (permanentInvite) {
          cachedInviteLink = permanentInvite.url;
          return permanentInvite.url;
        }

        const newInvite = await channel.createInvite({
          maxAge: 0,
          maxUses: 0,
          reason: 'Support server invite for bot users'
        }).catch(() => null);

        if (newInvite) {
          cachedInviteLink = newInvite.url;
          return newInvite.url;
        }
      } catch (e) {
        console.error('Error managing invites:', e);
      }
    }
  } catch (error) {
    console.error('Error generating support server invite link:', error);
  }

  return `https://discord.gg/wHMdDkPyBu`;
}

/**
 * @param {string}
 * @param {Client}
 */
async function checkServerMembership(userId, client) {
  try {
    const profile = getProfile(userId);
    if (!profile) return;
    const supportServer = await client.guilds.fetch(SUPPORT_SERVER_ID).catch(() => null);
    if (!supportServer) {
      console.warn(`Support server ${SUPPORT_SERVER_ID} not found or bot not in server`);
      const defaults = {
        InServer: false,
        ServerBooster: false,
        Extra1MenuSlot: false,
        Extra2MenuSlot: false,
        BakeryBonus: 0
      };

      if (profile && profile.server) {
        updateProfile(userId, { server: defaults });
      }
      return;
    }

    const member = await supportServer.members.fetch(userId).catch(() => null);
    const isInServer = !!member;
    let isBooster = false;

    if (isInServer && member) {
      isBooster = member.roles.cache.has(BOOSTER_ROLE_ID);
    }

    const updates = {
      inServer: isInServer,
      isServerBooster: isBooster
    };

    if (profile) {
      updateProfile(userId, { server: updates });
    }
  } catch (error) {
    console.error('Error in checkServerMembership:', error);
  }
}

module.exports = { checkServerMembership, SUPPORT_SERVER_ID, BOOSTER_ROLE_ID, getSupportServerInviteLink };
