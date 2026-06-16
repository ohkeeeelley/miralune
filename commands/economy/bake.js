const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const { performBake, loadBakeries, buildBakeryEmbed, NO_PROFILE_ERROR } = require('./_bakeryUtils');
const { getProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { checkServerMembership } = require('../../utils/checkServer');
const AssetManager = require('../../model/AssetManager');
const { sendNoProfile, isNoProfileMessage } = require('../../utils/noProfileResponse');

const bakeCooldowns = new Map();
const BAKE_COOLDOWN_MS = 8000;

module.exports = {
  data: new SlashCommandBuilder().setName('bake').setDescription('Bake your bakeries and collect Bits'),
  async execute(interaction) {
    if (!interaction.guild) return await sendOrFallback(interaction, { content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const now = Date.now();
    const lastBakeTime = bakeCooldowns.get(userId) || 0;
    const timeSinceLastBake = now - lastBakeTime;

    if (timeSinceLastBake < BAKE_COOLDOWN_MS) {
      const remainingMs = BAKE_COOLDOWN_MS - timeSinceLastBake;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      await sendOrFallback(interaction, {
        content: `Slow down, jeez you're barely getting anything from spamming! Wait ${remainingSeconds}s.`,
        ephemeral: true
      });
      return;
    }

    bakeCooldowns.set(userId, now);

      try {
        await interaction.deferReply().catch(() => {});
        await interaction.editReply({ content: '<a:loading:1488385574405406751> Baking...' }).catch(() => {});

        checkServerMembership(userId, interaction.client).catch(() => {});

        const profile = getProfile(userId);

        if (!profile) {
          await sendNoProfile(interaction);
          return;
        }

        const result = await performBake(interaction, guildId, userId);

        if (result && result.cooldown) {
          try {
            const BakerySetting = require('../../model/BakerySetting');
            const buffer = await BakerySetting.generateCooldownImage({
              username: interaction.user.username,
              avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
              remainingTime: result.remainingSeconds,
              totalTime: result.totalSeconds
            });
            const { AttachmentBuilder } = require('discord.js');
            const attachment = new AttachmentBuilder(buffer, { name: 'bake_cooldown.png' });
            const embed = { embeds: [ { image: { url: 'attachment://bake_cooldown.png' }, color: 0x2F3136 } ] };
            await sendOrFallback(interaction, { files: [attachment], embeds: [embed.embeds[0]] });
          } catch (imgErr) {
            console.error('Failed to generate cooldown image:', imgErr);
            await sendOrFallback(interaction, { content: 'You can bake now!', ephemeral: true });
          }
          return;
        }

        if (!result || result.error) {
          if (result && result.error) {
            if (isNoProfileMessage(result.error) || result.error === NO_PROFILE_ERROR) {
              await sendNoProfile(interaction);
              return;
            }

            await sendOrFallback(interaction, {
              content: result.error,
              ephemeral: true
            });
          }
          return;
        }

        const embeds = result.embed ? [result.embed] : [];
        const files = result.files || [];

        try {
          let payload;
          if (result.v2Containers && result.v2Containers.length > 0) {

            payload = {
              files,
              components: result.v2Containers.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c),
              flags: MessageFlags.IsComponentsV2
            };
          } else {

            payload = { embeds, files };
          }

          try {
            if (interaction.deferred && !interaction.replied) {
              await interaction.editReply(payload);
            } else {
              await sendOrFallback(interaction, payload);
            }
          } catch (e) {
            console.error('Failed to send bake reply with v2, falling back to embed:', e);

            await sendOrFallback(interaction, { embeds, files });
          }

          if (result.levelledUp && result.profile && result.profile.BakeryLevel) {
            const levelUpContainer = new ContainerBuilder().setAccentColor(0xFF00FF);
            levelUpContainer.addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `## ✨ Level Up!\n> 🎉 Congratulations, **${interaction.user.username}**! You've levelled up to **Level ${result.profile.BakeryLevel}**!`
              )
            );
            await interaction.followUp({
              components: [levelUpContainer.toJSON()],
              flags: MessageFlags.IsComponentsV2
            });
          }

        } catch (e) {
          console.error('Failed to send bake reply, falling back:', e);
          await sendOrFallback(interaction, { embeds, files });
        }

    } catch (err) {
      console.error('bake command error', err);
      if (!interaction.replied && !interaction.deferred) await sendOrFallback(interaction, { content: 'An error occurred while baking.', ephemeral: true }).catch(() => {});
    }
  }
};
