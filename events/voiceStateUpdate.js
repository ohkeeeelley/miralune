const { Events } = require('discord.js');
const { getProfile, updateProfile } = require('../utils/profileManager');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {

      const user = newState.member?.user || oldState.member?.user;
      if (!user || user.bot) return;

      const userId = user.id;
      const joined = !oldState.channelId && newState.channelId;
      const left = oldState.channelId && !newState.channelId;
      const switched = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

      const profile = getProfile(userId);
      if (!profile) return;

      if (joined) {
        const updatedServer = { ...profile.server, VoiceJoinedAt: Date.now() };
        updateProfile(userId, { server: updatedServer });
        return;
      }

      if (left || switched) {
        const joinedAt = profile.server?.VoiceJoinedAt || null;
        if (!joinedAt) {
          updateProfile(userId, { server: { ...profile.server, VoiceJoinedAt: null } });
          return;
        }
        const ms = Date.now() - joinedAt;
        const minutes = Math.floor(ms / 60000);
        updateProfile(userId, { server: { ...profile.server, VoiceJoinedAt: null } });
        if (minutes <= 0) return;

        profile.stats = profile.stats || {};
        const oldMinutes = profile.stats.voiceMinutes || 0;
        profile.stats.voiceMinutes = oldMinutes + minutes;

        try {
          updateProfile(userId, { stats: profile.stats });
        } catch (e) {
          console.error('Error updating voice stats:', e);
          updateProfile(userId, { stats: profile.stats });
        }
      }
    } catch (e) {
      console.error('voiceStateUpdate handler error:', e);
    }
  }
};
