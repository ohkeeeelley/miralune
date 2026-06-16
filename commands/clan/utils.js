const { EmbedBuilder, MessageFlags } = require('discord.js');
const ClansManager = require('../../model/ClansManager');
const { getProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { SUPPORT_SERVER_ID } = require('../../utils/checkServer');
let SUPPORT_SERVER_INVITE = 'https://discord.gg/wHMdDkPyBu';

async function getSupportServerInvite(client) {
  try {
    const guild = await client.guilds.fetch(SUPPORT_SERVER_ID).catch(() => null);
    if (!guild) {
      console.warn('Could not fetch support server for invite generation');
      return SUPPORT_SERVER_INVITE;
    }

    const channels = guild.channels.cache.filter(c =>
      c.isTextBased() && c.permissionsFor(guild.me).has('CreateInstantInvite')
    );

    if (channels.size > 0) {
      const channel = channels.first();
      const invites = await channel.fetchInvites().catch(() => []);

      const permanentInvite = invites.find(inv => !inv.expiresAt && !inv.uses);
      if (permanentInvite) {
        SUPPORT_SERVER_INVITE = permanentInvite.url;
        return permanentInvite.url;
      }

      const newInvite = await channel.createInvite({
        maxAge: 0,
        maxUses: 0,
        reason: 'Join our support server to access clan features or get help!'
      }).catch(() => null);

      if (newInvite) {
        SUPPORT_SERVER_INVITE = newInvite.url;
        return newInvite.url;
      }
    }
  } catch (error) {
    console.error('Error generating support server invite:', error);
  }

  return SUPPORT_SERVER_INVITE;
}

const Colors = {
  SUCCESS: 0x00FF00,
  ERROR: 0xFF0000,
  INFO: 0x2b2d31,
  PRIMARY: 0x00AAFF
};

async function checkSupportServerMembership(interaction, profile) {
  try {
    const support = await interaction.client.guilds.fetch(SUPPORT_SERVER_ID).catch(() => null);
    if (!support) {
      console.error('Support server not found or bot is not in the server');
      const inviteLink = await getSupportServerInvite(interaction.client);
      await sendOrFallback(interaction, {
        content: `You must join the support server to use clan features. Join here: ${inviteLink}`,
        flags: MessageFlags.Ephemeral
      });
      return false;
    }

    const member = await support.members.fetch(interaction.user.id).catch(() => null);

    if (!member) {
      const inviteLink = await getSupportServerInvite(interaction.client);
      await sendOrFallback(interaction, {
        content: `You must join the support server to use clan features. Join here: ${inviteLink}`,
        flags: MessageFlags.Ephemeral
      });
      return false;
    }
    if (profile && profile.server && !profile.server.InServer) {
      profile.server.InServer = true;
      getProfile.updateProfile = getProfile.updateProfile || require('../../utils/profileManager').updateProfile;
    }

    return true;
  } catch (e) {
    console.error('Support server membership check failed', e);
    const inviteLink = await getSupportServerInvite(interaction.client).catch(() => SUPPORT_SERVER_INVITE);
    await sendOrFallback(interaction, {
      content: `You must join the support server to use clan features. Join here: ${inviteLink}`,
      flags: MessageFlags.Ephemeral
    });
    return false;
  }
}

function checkClanAccess(interaction, profile, requireOwner = false) {
  if (!profile || !profile.ClanId) {
    sendOrFallback(interaction, { content: "You're not in a clan.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return null;
  }

  const clan = ClansManager.getClanById(profile.ClanId);
  if (!clan) {
    sendOrFallback(interaction, { content: "Could not find your clan.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return null;
  }

  if (requireOwner && clan.ownerId !== interaction.user.id) {
    sendOrFallback(interaction, { content: "Only the clan owner can perform this action.", flags: MessageFlags.Ephemeral }).catch(() => {});
    return null;
  }

  return clan;
}

function createClanEmbed(clan) {
  return new EmbedBuilder()
    .setTitle(`${clan.name} - 🧁 Clan Profile 🧁`)
    .setDescription('*Your clan dashboard with all available options*')
    .setColor(Colors.INFO);
}

module.exports = {
  Colors,
  checkSupportServerMembership,
  checkClanAccess,
  createClanEmbed,
  SUPPORT_SERVER_INVITE,
  getSupportServerInvite
};
