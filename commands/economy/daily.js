const {
SlashCommandBuilder,
ContainerBuilder,
TextDisplayBuilder,
SeparatorBuilder,
MessageFlags
 } = require('discord.js');

const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { BITS, HARMONY } = require('./currencyEmojis');
const { sendNoProfile } = require('../../utils/noProfileResponse');

const BASE_REWARD = 500;
const MULTIPLIER_PER_DAY = 0.1;
const BITS_BOOST_MULTIPLIER = 2;
const BASE_HARMONY_REWARD = 30;
const BASE_XP_REWARD = 100;
const COOLDOWN_DURATION = 1000 * 60 * 60 * 24;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward! Build a streak for more bits.'),

  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      await interaction.deferReply();
      await interaction.editReply({ content: '<a:loading:1488385574405406751> Claiming Reward...' }).catch(() => {});

      let profile = getProfile(userId);
      if (!profile) {
        return await sendNoProfile(interaction);
      }

      const now = Date.now();

      if (!profile.stats) {
        profile.stats = {};
      }
      profile.stats.streak = profile.stats.streak || 0;
      profile.stats.beststreak = profile.stats.beststreak || 0;
      profile.stats.lastClaimedAt = profile.stats.lastClaimedAt || 0;

      const timeSinceLastClaim = now - (profile.stats.lastClaimedAt || 0);
      if (timeSinceLastClaim < COOLDOWN_DURATION) {
        const remaining = COOLDOWN_DURATION - timeSinceLastClaim;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

        return await sendOrFallback(interaction, {
          content: `You've already claimed your daily reward! Come back in **${hours}h ${minutes}m ${seconds}s**.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const daysSinceLastClaim = Math.floor(timeSinceLastClaim / COOLDOWN_DURATION);
      let currentStreak = profile.stats.streak || 0;
      let bestStreak = profile.stats.beststreak || 0;

      if (daysSinceLastClaim === 1) {
        // Claimed yesterday, continue streak
        currentStreak = (currentStreak || 0) + 1;
      } else if (daysSinceLastClaim > 1) {
        // Missed days, reset streak
        currentStreak = 1;
      } else {
        // First time claiming
        currentStreak = 1;
      }

      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }

      const multiplier = Math.pow(1 + MULTIPLIER_PER_DAY, currentStreak - 1);
      const reward = Math.floor(BASE_REWARD * multiplier);
      const bitsReward = Math.floor(reward * BITS_BOOST_MULTIPLIER);
      const harmonyReward = Math.floor(BASE_HARMONY_REWARD * multiplier);
      const xpReward = Math.floor(BASE_XP_REWARD * multiplier);

      profile.wallet = profile.wallet || { bits: 0 };
      profile.wallet.bits = (profile.wallet.bits || 0) + bitsReward;

      profile.balances = profile.balances || { bits: 0, harmony: 0 };
      profile.balances.bits = (profile.balances.bits || 0) + bitsReward;
      profile.balances.harmony = (profile.balances.harmony || 0) + harmonyReward;

      profile.stats.streak = currentStreak;
      profile.stats.beststreak = bestStreak;
      profile.stats.lastClaimedAt = now;
      profile.stats.dailymultiplier = multiplier;

      profile.global = profile.global || {};
      profile.global.xp = (profile.global.xp || 0) + xpReward;

      updateProfile(userId, {
        balances: profile.balances,
        stats: profile.stats,
        global: profile.global
      });

      const container = new ContainerBuilder().setAccentColor(0x57F287);
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${BITS} Daily Reward Claimed!`)
      );
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Rewards:**\n${BITS} ${bitsReward} Bits\n${HARMONY} ${harmonyReward} Harmony\n⭐ ${xpReward} XP\n\n` +
          `**Streaks:**\n🔥 Current Streak: ${currentStreak} day${currentStreak > 1 ? 's' : ''}\n⭐ Best Streak: ${bestStreak} day${bestStreak > 1 ? 's' : ''}`
        )
      );
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`-# Come back in 24 hours to claim your next reward!`)
      );

      return await sendOrFallback(interaction, {
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      console.error('Error in daily command:', error);
      return await sendOrFallback(interaction, {
        content: 'An error occurred while claiming your daily reward.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
