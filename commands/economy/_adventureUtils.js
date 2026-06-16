const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const { getProfile } = require('../../utils/profileManager');
const { BITS, HARMONY } = require('./currencyEmojis');

function buildAdventureNotificationSection(notifyEnabled = false) {
  const remindBtn = new ButtonBuilder()
    .setCustomId('remindme')
    .setEmoji('🔔')
    .setLabel(notifyEnabled ? 'On' : 'Remind me')
    .setStyle(notifyEnabled ? ButtonStyle.Success : ButtonStyle.Secondary);

  return new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🔔 **Notifications**'),
      new TextDisplayBuilder().setContent('Get reminded when your venture cooldown ends')
    )
    .setButtonAccessory(remindBtn);
}

async function buildAdventureContainer(pony, masked, rarity, interaction, opts = {}) {
  try {
    if (!ContainerBuilder || !TextDisplayBuilder || !SeparatorBuilder) return null;

    const imgPath = opts.imgPath || '';

    const CHECKMARK = '<:checkmark1:1490897821044576266>';
    let ownedTag = '';
    try {
      const profile = getProfile(interaction.user.id);
      if (profile) {
        const collection = profile.global?.collection ?? profile.collection ?? [];
        const alreadyOwned = collection.some(c => String(c.id ?? c).toLowerCase() === String(pony.id).toLowerCase());
        if (alreadyOwned) ownedTag = `  ${CHECKMARK} *Owned*`;
      }
    } catch (e) {}

    const container = new ContainerBuilder()
      .setAccentColor(0x23212b);

    const emojiRarity = require('../../model/EmojiRarity');
    const rarityKey = (pony.rarity || '').charAt(0).toUpperCase() + (pony.rarity || '').slice(1).toLowerCase();
    const rarityEmojis = Array.isArray(emojiRarity[rarityKey]) ? emojiRarity[rarityKey].join(' ') : rarityKey;

    const locationTag = pony.adventureTag || 'Ponyville';
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**[${locationTag}] Look who's here!**  ${rarityEmojis}${ownedTag}`)
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('A mysterious encounter awaits your decision')
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    if (imgPath && fs.existsSync(imgPath)) {
      try {
        const mediaGallery = new MediaGalleryBuilder();
        const galleryItem = new MediaGalleryItemBuilder()
          .setURL(`attachment://${pony.png}`);
        mediaGallery.addItems(galleryItem);
        container.addMediaGalleryComponents(mediaGallery);
      } catch (e) {
        console.warn('Failed to add media gallery:', e.message);
      }
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('While exploring Equestria, you encountered a pony.')
    );

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Name:** ' + masked)
    );

    if (opts.hintStatus) {
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(opts.hintStatus)
      );
    }

    const befriendBtn = new ButtonBuilder()
      .setCustomId('befriend')
      .setLabel('Befriend')
      .setStyle(ButtonStyle.Danger);
    const ignoreBtn = new ButtonBuilder()
      .setCustomId('ignore')
      .setLabel('Ignore')
      .setStyle(ButtonStyle.Secondary);
    const hintBtn = new ButtonBuilder()
      .setCustomId('hint')
      .setLabel('Hint')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(opts.hintUsesCount >= 2);
    const superHintBtn = new ButtonBuilder()
      .setCustomId('superhint')
      .setLabel('Super Hint')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(opts.superHintUsed);
    container.addActionRowComponents(ar => ar.setComponents(
      befriendBtn, ignoreBtn, hintBtn, superHintBtn
    ));

    const files = [];
    if (imgPath && fs.existsSync(imgPath)) {
      try {
        files.push(new AttachmentBuilder(imgPath, { name: pony.png }));
      } catch (e) {
        console.warn('Failed to add image attachment:', e.message);
      }
    }

    return { v2Containers: [container.toJSON()], files };
  } catch (e) {
    console.error('buildAdventureContainer error:', e);
    return null;
  }
}

async function buildBefriendResultContainer(isSuccess, pony, rewards, extras = [], opts = {}) {
  try {
    if (!ContainerBuilder || !TextDisplayBuilder || !SeparatorBuilder) return null;

    const emojiRarity = require('../../model/EmojiRarity');
    const locationTag = pony.adventureTag || 'Ponyville';
    const rarityKey = (pony.rarity || '').charAt(0).toUpperCase() + (pony.rarity || '').slice(1).toLowerCase();
    const rarityEmojis = Array.isArray(emojiRarity[rarityKey]) ? emojiRarity[rarityKey].join(' ') : rarityKey;

    const accentColor = isSuccess ? 0x2ecc71 : 0xe74c3c;
    const container = new ContainerBuilder().setAccentColor(accentColor);

    let mainContent = '';
    if (isSuccess) {
      const titleLine = `**[${locationTag}] You know this pony!**`;
      const resultLine = `> Excellent! You correctly identified **${pony.name}**!`;
      const descLine = pony.description ? `*${pony.description}*` : '';

      const rewardLines = [];
      rewardLines.push(`> **Rarity:** ${rarityEmojis}`);
      rewardLines.push(`> **${BITS} +${rewards.bits} bits**`);
      if (rewards.harmony && rewards.harmony > 0) {
        rewardLines.push(`> **${HARMONY} +${rewards.harmony} harmony**`);
      }
      if (extras && extras.length > 0) {
        for (const extra of extras) {
          rewardLines.push(`> ${extra}`);
        }
      }

      const alreadyOwned = opts.alreadyOwned === true;
      rewardLines.push(alreadyOwned
        ? `> You already have **${pony.name}** in your collection!`
        : `> **${pony.name}** has been added to your friends list!`);

      mainContent = titleLine + '\n' + resultLine;
      if (descLine) mainContent += '\n' + descLine;
      mainContent += '\n\n' + rewardLines.join('\n');
    } else {

      mainContent = [
        `[${locationTag}] Try again!.`,
        'Sorry, that\'s not correct.',
        '',
        `The pony was **${pony.name}**.`,
        '',
        'Better luck next time!'
      ].join('\n');
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(mainContent)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addSectionComponents(buildAdventureNotificationSection(opts.notify === true));

    return { v2Containers: [container.toJSON()], files: [] };
  } catch (e) {
    console.error('buildBefriendResultContainer error:', e);
    return null;
  }
}

async function buildIgnoreResultContainer(message, rewards, extras = [], opts = {}) {
  try {
    if (!ContainerBuilder || !TextDisplayBuilder || !SeparatorBuilder) return null;

    const container = new ContainerBuilder().setAccentColor(0x3498db);

    const rewardLines = [];
    rewardLines.push(`> **${BITS} +${rewards} bits**`);
    if (extras && extras.length > 0) {
      for (const extra of extras) {
        rewardLines.push(`> ${extra}`);
      }
    }
    rewardLines.push(`> Remember, there will be other adventures ahead!`);

    const mainContent = `**[Ponyville] Adventure Continues**\n> *${message}*\n\n` + rewardLines.join('\n');

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(mainContent)
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    container.addSectionComponents(buildAdventureNotificationSection(opts.notify === true));

    return { v2Containers: [container.toJSON()], files: [] };
  } catch (e) {
    console.error('buildIgnoreResultContainer error:', e);
    return null;
  }
}

function buildAdventureCooldownContainer(remainingMs) {
  try {
    if (!ContainerBuilder || !TextDisplayBuilder) return null;

    const safeRemaining = Math.max(0, Number(remainingMs) || 0);
    const minutes = Math.floor(safeRemaining / 60000);
    const seconds = Math.floor((safeRemaining % 60000) / 1000);

    const container = new ContainerBuilder().setAccentColor(0x2f3136);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**Cooldown**')
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('> 🍪 Time to eat a cookie while you\'re waiting for your next adventure!')
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> Please wait \`${minutes}m ${seconds}s\` before venturing out again.`)
    );

    return { v2Containers: [container.toJSON()], files: [] };
  } catch (e) {
    console.error('buildAdventureCooldownContainer error:', e);
    return null;
  }
}

function buildNoProfileContainer(createCommand = '/create') {
  try {
    if (!ContainerBuilder || !TextDisplayBuilder || !SeparatorBuilder) return null;

    const container = new ContainerBuilder().setAccentColor(0x2f3136);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('## No Pony Found')
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('You need to create a pony before using this command!')
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Use \`${createCommand}\` to create your own pony and start your adventure in Equestria.`)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('🎯 **How to get started:**')
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Use \`${createCommand}\` to create your own pony and begin your magical journey in Equestria.`)
    );

    return { v2Containers: [container.toJSON()], files: [] };
  } catch (e) {
    console.error('buildNoProfileContainer error:', e);
    return null;
  }
}

module.exports = {
  buildAdventureContainer,
  buildBefriendResultContainer,
  buildIgnoreResultContainer,
  buildAdventureCooldownContainer,
  buildNoProfileContainer
};
