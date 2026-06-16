const {
  SlashCommandBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');

const allPonies = require('../../model/MyLittlePonies');
const FriendshipRenderer = require('../../model/FriendshipRenderer');
const { getProfile } = require('../../utils/profileManager');
const { sendNoProfile } = require('../../utils/noProfileResponse');
const { sendOrFallback } = require('../../utils/safeReply');
const {
  MAX_PONY_LEVEL,
  ensurePonyProgress,
  getPonyProgress,
  xpRequiredForLevel,
  describePonyBakeryBonus,
} = require('../../utils/ponyProgressionManager');

const PONY_BY_ID = new Map(allPonies.map((pony) => [Number(pony.id), pony]));
const PAGE_SIZE = Number(FriendshipRenderer.PAGE_SIZE) || 4;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getOwnedCollection(profile) {
  const fromLegacy = Array.isArray(profile?.collection) ? profile.collection : [];
  const fromGlobal = Array.isArray(profile?.global?.collection) ? profile.global.collection : [];
  return fromLegacy.length > 0 ? fromLegacy : fromGlobal;
}

function dedupeOwnedPonies(collection) {
  const byId = new Map();

  for (const item of collection) {
    const id = Number(item?.id ?? item);
    if (!Number.isFinite(id) || byId.has(id)) continue;
    byId.set(id, item);
  }

  return [...byId.values()].sort((a, b) => {
    const idA = Number(a?.id ?? a) || 0;
    const idB = Number(b?.id ?? b) || 0;
    return idA - idB;
  });
}

function buildFriendshipEntries(profile, userId) {
  const sourceProfile = profile?.profile && !Array.isArray(profile?.collection)
    ? profile.profile
    : profile;

  ensurePonyProgress(sourceProfile, userId);

  const owned = dedupeOwnedPonies(getOwnedCollection(sourceProfile));
  const hiredSet = new Set((Array.isArray(sourceProfile?.bakery?.hired) ? sourceProfile.bakery.hired : []).map((id) => Number(id)));

  return owned.map((item) => {
    const id = Number(item?.id ?? item);
    const pony = PONY_BY_ID.get(id) || item || { id, name: `Pony #${id}` };
    const progress = getPonyProgress(sourceProfile, id, userId);

    const level = clamp(Number(progress?.level) || 1, 1, MAX_PONY_LEVEL);
    const xp = Math.max(0, Number(progress?.xp) || 0);
    const nextLevelXP = level >= MAX_PONY_LEVEL ? null : xpRequiredForLevel(level);

    return {
      id,
      pony,
      name: pony.name || progress?.name || `Pony #${id}`,
      rarity: pony.rarity || progress?.rarity || 'Common',
      category: pony.category || 'Unknown',
      family: pony.family || 'Unknown',
      bonusText: describePonyBakeryBonus(pony) || 'This pony does not have a natural bakery bonus.',
      level,
      xp,
      nextLevelXP,
      isHired: hiredSet.has(id),
    };
  });
}

function buildNavRow(currentPage, totalPages, prevButtonId, nextButtonId, disabled = false) {
  const prevDisabled = disabled || currentPage <= 0;
  const nextDisabled = disabled || currentPage >= totalPages - 1;

  return [
    new ButtonBuilder()
      .setCustomId(prevButtonId)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(prevDisabled),
    new ButtonBuilder()
      .setCustomId('friendship_page_indicator')
      .setLabel(`Page ${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(nextButtonId)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(nextDisabled)
  ];
}

function buildFriendshipContainer({
  targetUser,
  pageIndex,
  totalPages,
  totalCollected,
  showingStart,
  showingEnd,
  imageName,
  prevButtonId,
  nextButtonId,
  disableButtons,
}) {
  const container = new ContainerBuilder().setAccentColor(0x8e44ad);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## 💞 Friendship Progress\n**${targetUser.username}** • **${totalCollected}** collected ponies`
    )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Showing **${showingStart}-${showingEnd}** • Page **${pageIndex + 1}/${totalPages}**`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const gallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL(`attachment://${imageName}`)
  );
  container.addMediaGalleryComponents(gallery);

  if (totalPages > 1) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );
    container.addActionRowComponents((row) => row.setComponents(
      ...buildNavRow(pageIndex, totalPages, prevButtonId, nextButtonId, disableButtons)
    ));
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('-# Use the buttons to switch pages. Only the command user can control navigation.')
  );

  return container;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('friendship')
    .setDescription('View collected ponies with level progress and details')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('View another user\'s friendship collection')
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('page')
        .setDescription('Page number to open')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const requestedPage = Math.max(1, interaction.options.getInteger('page') || 1);

      const profile = getProfile(targetUser.id);
      if (!profile) {
        if (targetUser.id === interaction.user.id) return sendNoProfile(interaction);
        return sendOrFallback(interaction, {
          content: `${targetUser.username} does not have a profile yet.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const entries = buildFriendshipEntries(profile, targetUser.id);
      if (entries.length === 0) {
        return sendOrFallback(interaction, {
          content: `${targetUser.username} has not collected any ponies yet.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
      let currentPage = clamp(requestedPage - 1, 0, totalPages - 1);

      const sessionId = `${interaction.id}_${Date.now().toString(36)}`;
      const prevButtonId = `friendship_prev_${sessionId}`;
      const nextButtonId = `friendship_next_${sessionId}`;

      const buildPayload = async (pageIndex, disableButtons = false) => {
        const start = pageIndex * PAGE_SIZE;
        const pageEntries = entries.slice(start, start + PAGE_SIZE);
        const showingStart = entries.length > 0 ? start + 1 : 0;
        const showingEnd = Math.min(entries.length, start + pageEntries.length);

        const imageBuffer = await FriendshipRenderer.generatePage({
          username: targetUser.username,
          page: pageIndex + 1,
          totalPages,
          totalCollected: entries.length,
          showingStart,
          showingEnd,
          entries: pageEntries,
        });

        const imageName = `friendship_page_${pageIndex + 1}.png`;
        const files = [new AttachmentBuilder(imageBuffer, { name: imageName })];
        const container = buildFriendshipContainer({
          targetUser,
          pageIndex,
          totalPages,
          totalCollected: entries.length,
          showingStart,
          showingEnd,
          imageName,
          prevButtonId,
          nextButtonId,
          disableButtons,
        });

        const payload = {
          flags: MessageFlags.IsComponentsV2,
          files,
          components: [container.toJSON()],
        };

        return payload;
      };

      await interaction.deferReply();
      const replyMessage = await interaction.editReply(await buildPayload(currentPage));

      if (totalPages <= 1 || !replyMessage) return;

      const collector = replyMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 3 * 60 * 1000,
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.customId !== prevButtonId && buttonInteraction.customId !== nextButtonId) {
          return;
        }

        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: 'Only the user who used this command can change pages.',
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
          return;
        }

        if (buttonInteraction.customId === prevButtonId) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (buttonInteraction.customId === nextButtonId) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        }

        await buttonInteraction.update(await buildPayload(currentPage)).catch(() => {});
      });

      collector.on('end', async () => {
        try {
          if (totalPages > 1) {
            await interaction.editReply(await buildPayload(currentPage, true));
          }
        } catch (_) {}
      });
    } catch (error) {
      console.error('Error in /friendship command:', error);
      return sendOrFallback(interaction, {
        content: 'Failed to render friendship progress right now. Please try again.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
