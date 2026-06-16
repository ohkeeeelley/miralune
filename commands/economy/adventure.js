const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ComponentType, SeparatorBuilder } = require('discord.js');
const EG = require('../../model/MyLittlePonies');
const path = require('path');
const { maskFullName, getRarityEmoji } = require('../../model/autoSpawn');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { sendNoProfile } = require('../../utils/noProfileResponse');
const { BITS, HARMONY, DIAMONDS, CRATES, KEYS, LOYALTY } = require('./currencyEmojis');
const {
  ensurePonyProgress,
  getPonyProgress,
  awardDuplicateBefriendXP,
  describePonyBakeryBonus,
} = require('../../utils/ponyProgressionManager');
const {
  buildAdventureContainer,
  buildBefriendResultContainer,
  buildIgnoreResultContainer,
  buildAdventureCooldownContainer
} = require('./_adventureUtils');

const BASE_REWARD = 25;
const RARITY_REWARDS = {
  'Common': { bits: 150, xp: 30 },
  'Rare': { bits: 250, xp: 70 },
  'Epic': { bits: 400, xp: 100 },
  'Majestic': { bits: 600, xp: 150 },
  'Legend': { bits: 850, xp: 250 },
  'Goddess': { bits: 1200, xp: 350 },
  'Secret': { bits: 1400, xp: 450 },
  'Radiance': { bits: 1700, xp: 600 }
};

const INCORRECT_REWARD = 80;
const EXTRA_HARMONY_CHANCE = 8;
const EXTRA_KEYS_CHANCE = 6;
const EXTRA_CRATE_CHANCE = 5;
const EXTRA_DIAMOND_CHANCE = 4;
const EXTRA_LOYALTY_CHANCE = 3;
const COOLDOWN_DURATION = 1000 * 60 * 8 + 1000 * 30;
const ADVENTURE_CONTINUE_MESSAGES = [
  'You waved at them and they nod and continues on their way',
  'They give you a small wave before trotting off',
  'They seem more interested in snacks than new friends',
  'You called out to them, but they were in a hurry and just nodded',
  'They smile and wave, but are in a rush and continue on their way',
  'You wished them well, and they happily continue on their journey',
  'They nod politely but are focused on their destination',
];

module.exports = {
  data: new SlashCommandBuilder().setName('adventure').setDescription('Go on an adventure and try to befriend an EG'),
  async execute(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    try {
      const profile = getProfile(userId);
      if (!profile) return await sendNoProfile(interaction);
      ensurePonyProgress(profile, userId);

      const now = Date.now();
      if (profile.adventureCooldown && profile.adventureCooldown > now) {
        const remaining = Math.max(0, profile.adventureCooldown - now);
        const cooldownContainer = buildAdventureCooldownContainer(remaining);
        if (cooldownContainer && Array.isArray(cooldownContainer.v2Containers)) {
          return await sendOrFallback(interaction, {
            components: cooldownContainer.v2Containers,
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
          });
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        return await sendOrFallback(interaction, { content: `You must wait ${minutes}m ${seconds}s before going on another adventure.`, flags: MessageFlags.Ephemeral });
      }

      const egEnabled = process.env.EQUESTRIA_GIRL_SPAWN_TRIGGER !== 'false';
      const ponyEnabled = process.env.PONY_SPAWN_TRIGGER !== 'false';
      const ADVENTURE_EXCLUDED_RARITIES = new Set(['Seasonal', 'Event', 'OC', 'Unique']);
      const ADVENTURE_RARITY_WEIGHTS = { Common: 500, Rare: 300, Epic: 60, Majestic: 25, Legend: 4, Goddess: 2, Secret: 2, Radiance: 0.3 };
      const spawnPool = EG.filter(p => {
        if (p.category === 'Equestria Girls' && !egEnabled) return false;
        if (p.category === 'Pony' && !ponyEnabled) return false;
        if (ADVENTURE_EXCLUDED_RARITIES.has(p.rarity)) return false;
        return true;
      });
      if (spawnPool.length === 0) {
        return await sendOrFallback(interaction, { content: 'No ponies are currently available for adventure. Try again later!', flags: MessageFlags.Ephemeral });
      }

      const rarityEntries = Object.entries(ADVENTURE_RARITY_WEIGHTS);
      const totalWeight = rarityEntries.reduce((acc, [, w]) => acc + w, 0);
      let roll = Math.random() * totalWeight;
      let selectedRarity = rarityEntries[rarityEntries.length - 1][0];
      for (const [k, w] of rarityEntries) { if (roll < w) { selectedRarity = k; break; } roll -= w; }
      const rarityPool = spawnPool.filter(p => p.rarity === selectedRarity);
      const pickPool = rarityPool.length > 0 ? rarityPool : spawnPool;
      const pony = pickPool[Math.floor(Math.random() * pickPool.length)];
      const imgFolder = pony.category === 'Equestria Girls' ? 'equestria_girls' : 'pony';
      const imgPath = path.join(__dirname, '..', '..', 'assets', 'ponies_assets', imgFolder, pony.png);

      const rarity = getRarityEmoji(pony.rarity);

      const actualName = pony.name || '';
      const nameLength = actualName.length;
      const revealed = new Array(nameLength).fill(false);
      for (let i = 0; i < nameLength; i++) {
        const ch = actualName[i];
        if (!/[A-Za-z]/.test(ch)) revealed[i] = true;
        if (i === 0 || actualName[i - 1] === ' ') {

          if (/[A-Za-z]/.test(ch)) revealed[i] = true;
        }
      }

      function renderFormattedMasked() {
        const parts = [];
        for (let i = 0; i < nameLength; ) {
          let j = i;
          const wordChars = [];
          while (j < nameLength && actualName[j] !== ' ') {
            const ch = actualName[j];
            if (!/[A-Za-z]/.test(ch)) wordChars.push(ch);
            else wordChars.push(revealed[j] ? ch : '_');
            j++;
          }
          parts.push(wordChars.join(' '));
          if (j < nameLength && actualName[j] === ' ') j++;
          i = j;
        }
        return '`' + parts.join('     ') + '`';
      }

      const masked = renderFormattedMasked();

      const rarityColors = {
        'Common': 0x808080,
        'Rare': 0x3498db,
        'Epic': 0x9b59b6,
        'Majestic': 0xe74c3c,
        'Legend': 0xf39c12,
        'Goddess': 0xe91e63,
        'Secret': 0x1abc9c,
        'Radiance': 0xf1c40f
      };
      const embedColor = rarityColors[pony.rarity] || 0x000000;

      let files = [];
      try { files.push({ attachment: imgPath, name: pony.png }); } catch (e) {}

      const embed = new EmbedBuilder()
        .setTitle(`✨ A wild pony appeared! ${rarity}`)
        .setDescription('A mysterious encounter awaits your decision!')
        .addFields([
          { name: 'About this encounter:', value: 'While exploring Equestria, you\'ve encountered a pony. Guess the pony\'s name to befriend it!', inline: false },
          { name: 'Name:', value: masked, inline: false }
        ])
        .setImage(`attachment://${pony.png}`)
        .setFooter({ text: 'You have a minute and 30 seconds to befriend this pony!' });

      const container = await buildAdventureContainer(pony, masked, rarity, interaction, {
        imgPath,
        hintUsesCount: 0,
        superHintUsed: false
      });
      const sendOptions = {
        components: Array.isArray(container.v2Containers) ? container.v2Containers : [container.v2Containers],
        files: container.files,
        flags: MessageFlags.IsComponentsV2
      };

      let message;
      if (interaction.deferred || interaction.replied) {

        await interaction.deleteReply().catch(() => {});
        message = await interaction.channel.send(sendOptions).catch(() => null);
      } else {
        try {
          message = await interaction.reply({ ...sendOptions, fetchReply: true });
        } catch (e) {

          message = await interaction.channel.send(sendOptions).catch(() => null);
        }
      }

      if (!message) return;

      function createAdventureButtons(hintUsesCount = 0, superHintUsedFlag = false) {
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
          .setDisabled(hintUsesCount >= 2);
        const superHintBtn = new ButtonBuilder()
          .setCustomId('superhint')
          .setLabel('Super Hint')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(superHintUsedFlag);
        return new ActionRowBuilder().addComponents(befriendBtn, ignoreBtn, hintBtn, superHintBtn);
      }

  const collector = message.createMessageComponentCollector({ time: 90000 });
  let encounterResolved = false;
  let befriendAttempts = 0;
  let hintUses = 0;
  let superHintUsed = false;
  let collectorBuildResultFn = null;

      collector.on('collect', async i => {
        if (i.user.id !== userId) {
          await sendOrFallback(i, { content: 'These buttons are for the command user only.', flags: MessageFlags.Ephemeral });
          return;
        }

        if (encounterResolved) {
          await sendOrFallback(i, { content: 'This adventure has already ended.', flags: MessageFlags.Ephemeral });
          return;
        }

        try {

          if (i.customId === 'befriend') {
            if (i.deferred || i.replied) {
              console.warn('Cannot show modal: interaction already replied/deferred', { userId: i.user.id, deferred: i.deferred, replied: i.replied });
              return await sendOrFallback(i, { content: 'I can\'t open the modal anymore — try the command again.', flags: MessageFlags.Ephemeral });
            }

            const modalCustomId = `adventure_guess_${userId}_${Date.now()}`;
            console.log(`Showing modal with customId: ${modalCustomId}`);

            await i.showModal(new ModalBuilder()
              .setCustomId(modalCustomId)
              .setTitle('Who is this pony?')
              .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('name')
                  .setLabel("Enter the pony's name")
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setMaxLength(100)
              ))
            );

            console.log(`Waiting for modal submit for customId: ${modalCustomId}`);
            const submitted = await i.awaitModalSubmit({
              time: 90000,
              filter: modal => modal.customId === modalCustomId && modal.user.id === userId
            }).catch((err) => {
              console.error(`Modal submit timeout/error for ${modalCustomId}:`, err?.message || err);
              return null;
            });

            if (!submitted) {
              console.log(`No modal submission received for ${modalCustomId}`);
              try { await i.deferUpdate(); } catch (e) {}
              return await sendOrFallback(i, { content: 'Modal submission timed out. Please try again.', flags: MessageFlags.Ephemeral });
            }

            console.log(`Modal submitted for ${modalCustomId}`);

            try { await submitted.deferUpdate(); } catch (e) {}

            const guess = submitted.fields.getTextInputValue('name').trim().toLowerCase();
            console.log(`User guessed: ${guess}, Actual: ${actualName.toLowerCase()}`);

            let resultEmbed;
            let resultContainer = null;
            let buildResultFn = null;

            if (guess === actualName.toLowerCase()) {
              const rewards = RARITY_REWARDS[pony.rarity] || { bits: BASE_REWARD, xp: 50 };
              profile.balances.bits = (profile.balances.bits || 0) + rewards.bits;
              profile.BakeryXP = (profile.BakeryXP || profile.bakery?.xp || 0) + rewards.xp;

              const rnd = () => Math.floor(Math.random() * 100) + 1;
              const bonusText = [];
              bonusText.push(`⭐ ${rewards.xp} xp`);

              let harmonyEarned = 0;
              if (rnd() <= EXTRA_HARMONY_CHANCE) { const hv = 15 + Math.floor(Math.random() * 6); profile.balances.harmony = (profile.balances.harmony || 0) + hv; harmonyEarned = hv; }
              if (rnd() <= EXTRA_KEYS_CHANCE) { const kv = 1 + Math.floor(Math.random() * 2); profile.balances.keys = (profile.balances.keys || 0) + kv; bonusText.push(`${KEYS} ${kv} key${kv !== 1 ? 's' : ''}`); }
              if (rnd() <= EXTRA_CRATE_CHANCE) { profile.balances.crates = (profile.balances.crates || 0) + 1; bonusText.push(`${CRATES} 1 crate`); }
              if (rnd() <= EXTRA_DIAMOND_CHANCE) { const dv = 5 + Math.floor(Math.random() * 11); profile.balances.diamonds = (profile.balances.diamonds || 0) + dv; bonusText.push(`${DIAMONDS} ${dv} diamonds`); }
              if (rnd() <= EXTRA_LOYALTY_CHANCE) { profile.balances.loyalty = (profile.balances.loyalty || 0) + 1; bonusText.push(`${LOYALTY} 1 loyalty`); }

              profile.stats.totalBitsEarned = (profile.stats.totalBitsEarned || 0) + rewards.bits;
              profile.stats.adventureSuccesses = (profile.stats.adventureSuccesses || 0) + 1;

              if (!profile.collection) profile.collection = [];
              if (!profile.befriendedPonies) profile.befriendedPonies = [];
              const alreadyOwned = profile.collection.some(c => String(c.id) === String(pony.id));
              if (!alreadyOwned) {
                profile.collection.push({ id: pony.id, name: pony.name, png: pony.png, rarity: pony.rarity });
                profile.befriendedPonies.push({ id: pony.id, name: pony.name, png: pony.png, rarity: pony.rarity, befriendedAt: new Date().toISOString() });
                profile.globalStats = profile.globalStats || {};
                profile.globalStats.totalEgCaught = (profile.globalStats.totalEgCaught || 0) + 1;
                profile.globalStats.totalBitsEarned = (profile.globalStats.totalBitsEarned || 0) + rewards.bits;

                getPonyProgress(profile, pony.id, userId);

                const bakeryBonusSummary = describePonyBakeryBonus(pony);
                if (bakeryBonusSummary) {
                  bonusText.push(`🏢 Bakery bonus unlocked: ${bakeryBonusSummary}`);
                }
              } else {
                const duplicateProgress = awardDuplicateBefriendXP(profile, pony, userId);
                if (duplicateProgress && duplicateProgress.xpAward > 0) {
                  const xpNextText = duplicateProgress.nextLevelXP ? `${duplicateProgress.currentXP}/${duplicateProgress.nextLevelXP}` : 'MAX';
                  bonusText.push(`🦄 ${pony.name} gained +${duplicateProgress.xpAward} pony XP (${xpNextText})`);
                  if (duplicateProgress.leveledUp) {
                    bonusText.push(`⬆️ ${pony.name} reached Pony Level ${duplicateProgress.levelAfter}!`);
                  }
                }
              }

              profile.stats.totalponiesbefriended = (profile.stats.totalponiesbefriended || 0) + 1;

              const resultRewards = { bits: rewards.bits, xp: rewards.xp, harmony: harmonyEarned };
              buildResultFn = async (notify) => buildBefriendResultContainer(true, pony, resultRewards, bonusText, { notify, alreadyOwned });
              resultContainer = await buildResultFn(profile.adventure_notify || false);

              resultEmbed = new EmbedBuilder()
                .setTitle('[Ponyville] Pony Befriend')
                .setDescription(`🎉 Congratulations! You successfully befriended **${pony.name}**!\n\n${BITS} ${rewards.bits} bits\n⭐ ${rewards.xp} xp${bonusText.length ? `\n${bonusText.join('\n')}` : ''}\n\nBetter luck next time!`)
                .setFooter({ text: `${pony.rarity} Pony Befriended!` });
            } else {
              befriendAttempts += 1;
              await sendOrFallback(submitted, {
                content: `❌ That's not correct. Try again before the adventure expires! (Wrong attempts: ${befriendAttempts})`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }

            const currentTime = Date.now();
            profile.adventureCooldown = currentTime + COOLDOWN_DURATION;
            profile.lastAdventure = currentTime;

            collectorBuildResultFn = buildResultFn;

            const updateData = {
              adventure: { cooldown: currentTime + COOLDOWN_DURATION, lastCompleted: currentTime },
              wallet: profile.balances || profile.wallet || {},
              stats: profile.stats || {},
              BakeryXP: profile.BakeryXP || profile.bakery?.xp || 0,
              bakery: {
                hired: Array.isArray(profile.bakery?.hired) ? profile.bakery.hired : [],
                ponyProgress: profile.bakery?.ponyProgress || {},
                lastPonyBakeryLevelAwarded: profile.bakery?.lastPonyBakeryLevelAwarded || profile.BakeryLevel || profile.bakery?.level || 1,
              },
            };

            if (profile.collection || profile.befriendedPonies) {
              updateData.global = {
                collection: profile.collection || [],
                befriendedPonies: profile.befriendedPonies || []
              };
            }

            updateProfile(userId, updateData);

            try {
              const editOptions = {
                components: Array.isArray(resultContainer.v2Containers) ? resultContainer.v2Containers : [resultContainer.v2Containers],
                files: resultContainer.files || []
              };
              await message.edit(editOptions);
            } catch (err) {
              console.error('Failed to edit message with result:', err?.message || err);
            }

            encounterResolved = true;
            collector.stop('befriended');

            return;
          }

          await i.deferUpdate().catch(() => {});

          if (i.customId === 'remindme') {
            const newNotify = !(profile.adventure_notify || false);
            profile.adventure_notify = newNotify;
            updateProfile(userId, { adventure: { notify: newNotify } });
            if (collectorBuildResultFn) {
              const updatedContainer = await collectorBuildResultFn(newNotify);
              if (updatedContainer) {
                await message.edit({
                  components: Array.isArray(updatedContainer.v2Containers) ? updatedContainer.v2Containers : [updatedContainer.v2Containers],
                  files: updatedContainer.files || []
                }).catch(() => {});
              }
            }
            return;
          }

          if (i.customId === 'hint' || i.customId === 'superhint') {
            const cost = i.customId === 'hint' ? 500 : 3500;

            if (i.customId === 'hint' && hintUses >= 2) {
              await sendOrFallback(i, { content: 'You can only use the regular hint twice per adventure.', flags: MessageFlags.Ephemeral });
              return;
            }
            if (i.customId === 'superhint' && superHintUsed) {
              await sendOrFallback(i, { content: 'You can only purchase a super hint once per adventure.', flags: MessageFlags.Ephemeral });
              return;
            }

            if ((profile.balances?.bits || 0) < cost) {
              await sendOrFallback(i, { content: `You need ${cost.toLocaleString()} bits to use that hint.`, flags: MessageFlags.Ephemeral });
              return;
            }

            profile.balances.bits -= cost;
            updateProfile(userId, profile);

            if (i.customId === 'superhint') {

              for (let k = 0; k < nameLength; k++) {
                if (/[A-Za-z]/.test(actualName[k])) revealed[k] = true;
              }
              superHintUsed = true;

              const updatedMasked = renderFormattedMasked();

              const hintContainer = await buildAdventureContainer(pony, updatedMasked, rarity, interaction, {
                imgPath,
                hintUsesCount: hintUses,
                superHintUsed: superHintUsed,
                hintStatus: '🔥 **Super Hint Used!** All letters have been revealed!'
              });

              try {
                const editOptions = {
                  components: Array.isArray(hintContainer.v2Containers) ? hintContainer.v2Containers : [hintContainer.v2Containers],
                  files: hintContainer.files || []
                };
                await message.edit(editOptions);
              } catch (err) {
                console.error('Failed to update message for superhint:', err);
              }
              return;
            }

            const unrevealedIdx = [];
            for (let k = 0; k < nameLength; k++) {
              if (!revealed[k] && /[a-zA-Z]/.test(actualName[k])) {
                unrevealedIdx.push(k);
              }
            }

            if (unrevealedIdx.length === 0) {
              profile.balances.bits += cost;
              updateProfile(userId, profile);
              await sendOrFallback(i, { content: 'All letters are already revealed!', flags: MessageFlags.Ephemeral });
              return;
            }

            for (let r = 0; r < 2 && unrevealedIdx.length > 0; r++) {
              const pick = unrevealedIdx.splice(Math.floor(Math.random() * unrevealedIdx.length), 1)[0];
              revealed[pick] = true;
            }
            hintUses++;

            const updatedMasked = renderFormattedMasked();

            const hintContainer = await buildAdventureContainer(pony, updatedMasked, rarity, interaction, {
              imgPath,
              hintUsesCount: hintUses,
              superHintUsed: superHintUsed,
              hintStatus: `💡 **Hint Used ${hintUses}/2** - 2 letters revealed!`
            });

            try {
              const editOptions = {
                components: Array.isArray(hintContainer.v2Containers) ? hintContainer.v2Containers : [hintContainer.v2Containers],
                files: hintContainer.files || []
              };
              await message.edit(editOptions);
            } catch (err) {
              console.error('Failed to update message for hint:', err);
            }

            return;
          }

          if (i.customId === 'ignore') {
            console.log('Ignore button clicked by user:', userId);
            profile.balances = profile.balances || {};
            profile.balances.bits = (profile.balances.bits || 0) + INCORRECT_REWARD;
            const ignoreExtras = [];
            const rnd3 = () => Math.floor(Math.random() * 100) + 1;
            if (rnd3() <= 10) { const hv = 15 + Math.floor(Math.random() * 6); profile.balances.harmony = (profile.balances.harmony || 0) + hv; ignoreExtras.push(`${HARMONY} ${hv} harmony`); }
            if (rnd3() <= 5) { profile.balances.crates = (profile.balances.crates || 0) + 1; ignoreExtras.push(`${CRATES} 1 crate`); }
            const ignoreTime = Date.now();
            updateProfile(userId, {
              adventure: { cooldown: ignoreTime + COOLDOWN_DURATION, lastCompleted: ignoreTime },
              wallet: profile.balances
            });
            const randomMessage = ADVENTURE_CONTINUE_MESSAGES[Math.floor(Math.random() * ADVENTURE_CONTINUE_MESSAGES.length)];

            const ignoreResultContainer = await buildIgnoreResultContainer(randomMessage, INCORRECT_REWARD, ignoreExtras, { notify: profile.adventure_notify || false });
            collectorBuildResultFn = async (notify) => buildIgnoreResultContainer(randomMessage, INCORRECT_REWARD, ignoreExtras, { notify });
            console.log('Ignore: ignoreResultContainer:', ignoreResultContainer ? 'exists' : 'null', ignoreResultContainer?.v2Containers ? 'has v2Containers' : 'no v2Containers');

            try {
              console.log('Ignore: attempting message.edit with container');
              if (ignoreResultContainer && ignoreResultContainer.v2Containers) {
                const editOptions = {
                  components: Array.isArray(ignoreResultContainer.v2Containers) ? ignoreResultContainer.v2Containers : [ignoreResultContainer.v2Containers],
                  files: ignoreResultContainer.files || []
                };
                console.log('Ignore: editOptions components length:', editOptions.components.length, 'type:', Array.isArray(editOptions.components) ? 'array' : 'not array');
                await message.edit(editOptions);
                console.log('Ignore: message.edit succeeded');
              } else {
                console.error('Ignore: Container failed, ignoreResultContainer is:', ignoreResultContainer);
              }
            } catch (err) {
              console.error('Ignore: Failed to edit message with result:', err?.message || err);
            }

            encounterResolved = true;
            collector.stop('ignored');
            return;
          }

          await sendOrFallback(i, { content: 'This feature is not implemented yet!', flags: MessageFlags.Ephemeral });
        } catch (err) {
          console.error('Error handling interaction:', err);
          await sendOrFallback(i, { content: 'Something went wrong with that action. Please try again.', flags: MessageFlags.Ephemeral });
        }
      });

      collector.on('end', async (_, reason) => {
        if (encounterResolved || reason !== 'time') return;

          const timeoutEmbed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle('⏰ Adventure Expired')
            .setDescription('The pony got bored waiting and wandered off...\n\nBetter luck next time!')
            .setFooter({ text: 'Your cooldown is now active. Come back later!' });
          try { await message.edit({ embeds: [timeoutEmbed], components: [], files: [] }); } catch (err) { console.error('Failed to update message after timeout:', err); }
      });

    } catch (error) {
      console.error('Adventure command error:', error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Something went wrong with the adventure command. Please try again later.', flags: MessageFlags.Ephemeral });
        } else if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: 'Something went wrong with the adventure command. Please try again later.' });
        }
      } catch (_) {}
    }
  }
};
