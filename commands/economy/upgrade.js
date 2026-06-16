const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback, MessageFlags } = require('../../utils/safeReply');
const { BITS, HARMONY, DIAMONDS } = require('./currencyEmojis');
const { sendNoProfile } = require('../../utils/noProfileResponse');

const UPGRADES = {
  storage: {
    emoji: '📦',
    label: 'Storage',
    maxLevel: 15,
    baseCost: 4500,
    costIncrement: 1500,
    currency: 'bits',
    perLevel: 500,
    unit: ' items',
    description: 'Increase your bakery storage capacity',
    getLevel: (p) => p.bakery?.upgradeLevel || 0,
    getCurrent: (p) => p.bakery?.maxbakestorage || 150,
    apply: (p, lvl) => {
      if (!p.bakery) p.bakery = {};
      p.bakery.upgradeLevel = lvl;
      p.bakery.maxbakestorage = 150 + lvl * 500;
      if (p.bakery.items) {
        const now = Date.now();
        for (const key of Object.keys(p.bakery.items)) {
          p.bakery.items[key].lastCycleTime = now;
        }
      }
    }
  },
  luck: {
    emoji: '🍀',
    label: 'Luck Boost',
    maxLevel: 10,
    baseCost: 8000,
    costIncrement: 3000,
    currency: 'bits',
    perLevel: 2,
    unit: '%',
    description: 'Increase bonus drop chance on adventures',
    getLevel: (p) => p.upgrades?.luck || 0,
    getCurrent: (p) => (p.upgrades?.luck || 0) * 2,
    apply: (p, lvl) => {
      if (!p.upgrades) p.upgrades = {};
      p.upgrades.luck = lvl;
    }
  },
  bakeSpeed: {
    emoji: '⏱️',
    label: 'Bake Speed',
    maxLevel: 10,
    baseCost: 6000,
    costIncrement: 2500,
    currency: 'bits',
    perLevel: 5,
    unit: '%',
    description: 'Reduce bake cooldown time',
    getLevel: (p) => p.upgrades?.bakeSpeed || 0,
    getCurrent: (p) => (p.upgrades?.bakeSpeed || 0) * 5,
    apply: (p, lvl) => {
      if (!p.upgrades) p.upgrades = {};
      p.upgrades.bakeSpeed = lvl;
    }
  },
  earnings: {
    emoji: '💎',
    label: 'Earnings Boost',
    maxLevel: 10,
    baseCost: 10000,
    costIncrement: 4000,
    currency: 'bits',
    perLevel: 5,
    unit: '%',
    description: 'Earn more bits from baking and adventures',
    getLevel: (p) => p.upgrades?.earnings || 0,
    getCurrent: (p) => (p.upgrades?.earnings || 0) * 5,
    apply: (p, lvl) => {
      if (!p.upgrades) p.upgrades = {};
      p.upgrades.earnings = lvl;
    }
  },
  menuSlots: {
    emoji: '🍰',
    label: 'Menu Slots',
    maxLevel: 2,
    baseCost: 15000,
    costIncrement: 20000,
    currency: 'bits',
    perLevel: 1,
    unit: ' slot',
    description: 'Unlock extra menu slots for your bakery',
    getLevel: (p) => {
      let lvl = 0;
      if (p.Extra1MenuSlot) lvl++;
      if (p.Extra2MenuSlot) lvl++;
      return lvl;
    },
    getCurrent: (p) => {
      let base = 3;
      if (p.Extra1MenuSlot) base++;
      if (p.Extra2MenuSlot) base++;
      return base;
    },
    apply: (p, lvl) => {
      if (lvl >= 1) p.Extra1MenuSlot = true;
      if (lvl >= 2) p.Extra2MenuSlot = true;
    }
  }
};

function getUpgradeCost(key, level) {
  const u = UPGRADES[key];
  return u.baseCost + (level - 1) * u.costIncrement;
}

function fmtNum(n) {
  return Number(n).toLocaleString();
}

function progressBar(current, max, length = 12) {
  const filled = Math.round((current / max) * length);
  const empty  = length - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}

function getCurrencyEmoji(currency) {
  if (currency === 'bits') return BITS;
  if (currency === 'harmony') return HARMONY;
  if (currency === 'diamonds') return DIAMONDS;
  return BITS;
}

function buildHubContainer(profile) {
  const container = new ContainerBuilder().setAccentColor(0x9B59B6);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## ⚙️ Upgrade Hub')
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('Invest in upgrades to power up your bakery and adventures!')
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const overviewLines = [];
  for (const [key, u] of Object.entries(UPGRADES)) {
    const lvl = u.getLevel(profile);
    const isMaxed = lvl >= u.maxLevel;
    const bar = progressBar(lvl, u.maxLevel, 8);
    const nextCost = isMaxed ? '' : ` — Next: ${fmtNum(getUpgradeCost(key, lvl + 1))} bits`;
    overviewLines.push(
      `${u.emoji} **${u.label}** ${bar} \`${lvl}/${u.maxLevel}\`` +
      (isMaxed ? ' ✅' : nextCost)
    );
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(overviewLines.join('\n'))
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const bits = profile.wallet?.bits ?? profile.balances?.bits ?? 0;
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Your Balance:** ${BITS} ${fmtNum(bits)}`)
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('Select an upgrade below:')
  );

  const options = Object.entries(UPGRADES).map(([key, u]) => {
    const lvl = u.getLevel(profile);
    const isMaxed = lvl >= u.maxLevel;
    return {
      label: u.label,
      description: isMaxed
        ? `MAX LEVEL — ${u.description}`
        : `Lvl ${lvl}/${u.maxLevel} · ${u.description}`,
      value: key,
      emoji: u.emoji
    };
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId('upgrade_select')
    .setPlaceholder('Choose an upgrade…')
    .addOptions(options);

  container.addActionRowComponents(row =>
    row.setComponents(select)
  );

  return container;
}

function buildDetailContainer(profile, key) {
  const u = UPGRADES[key];
  const lvl = u.getLevel(profile);
  const isMaxed = lvl >= u.maxLevel;
  const currentVal = u.getCurrent(profile);
  const nextLevel = lvl + 1;
  const nextCost = isMaxed ? 0 : getUpgradeCost(key, nextLevel);
  const newVal = currentVal + u.perLevel;
  const bits = profile.wallet?.bits ?? profile.balances?.bits ?? 0;
  const currEmoji = getCurrencyEmoji(u.currency);

  const container = new ContainerBuilder().setAccentColor(isMaxed ? 0x2ECC71 : 0x9B59B6);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${u.emoji} ${u.label} Upgrade`)
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(u.description)
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const bar = progressBar(lvl, u.maxLevel);
  if (isMaxed) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Level:** ${lvl}/${u.maxLevel}  ✅ **MAX**\n` +
        `${bar}\n\n` +
        `**Current Bonus:** +${fmtNum(currentVal)}${u.unit}\n\n` +
        `This upgrade is fully maxed out!`
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addActionRowComponents(row =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_back')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
      )
    );
  } else {
    const canAfford = bits >= nextCost;
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Level:** ${lvl}/${u.maxLevel} → **${nextLevel}/${u.maxLevel}**\n` +
        `${bar}\n\n` +
        `**Current:** +${fmtNum(currentVal)}${u.unit}\n` +
        `**After Upgrade:** +${fmtNum(newVal)}${u.unit} *(+${fmtNum(u.perLevel)}${u.unit})*`
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Cost:** ${currEmoji} ${fmtNum(nextCost)}\n` +
        `**Your Balance:** ${currEmoji} ${fmtNum(bits)}` +
        (canAfford
          ? `\n**After Purchase:** ${currEmoji} ${fmtNum(bits - nextCost)}`
          : `\n❌ **Need:** ${currEmoji} ${fmtNum(nextCost - bits)} more`)
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addActionRowComponents(row =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`upgrade_confirm_yes:${key}:${nextCost}:${nextLevel}`)
          .setLabel('Upgrade!')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
          .setDisabled(!canAfford),
        new ButtonBuilder()
          .setCustomId('upgrade_back')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
      )
    );
  }

  return container;
}

function buildSuccessContainer(profile, key, oldVal, newVal, cost, newLevel) {
  const u = UPGRADES[key];
  const bits = profile.wallet?.bits ?? profile.balances?.bits ?? 0;
  const currEmoji = getCurrencyEmoji(u.currency);
  const container = new ContainerBuilder().setAccentColor(0x2ECC71);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ✅ ${u.emoji} ${u.label} Upgraded!`)
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Level:** ${newLevel}/${u.maxLevel}\n` +
      `${progressBar(newLevel, u.maxLevel)}\n\n` +
      `**Bonus:** +${fmtNum(oldVal)}${u.unit} → +${fmtNum(newVal)}${u.unit}\n` +
      `**Cost Paid:** ${currEmoji} ${fmtNum(cost)}\n` +
      `**Remaining:** ${currEmoji} ${fmtNum(bits)}`
    )
  );

  return container;
}

function buildCancelledContainer() {
  const container = new ContainerBuilder().setAccentColor(0xE74C3C);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## ❌ Upgrade Cancelled')
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('No bits were deducted.')
  );
  return container;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Upgrade your bakery features and adventure perks'),

  async execute(interaction) {
    try {
      await interaction.deferReply().catch(() => {});
      await interaction.editReply({ content: '<a:loading:1488385574405406751> Loading Upgrades...' }).catch(() => {});
    } catch (e) {}

    if (!interaction.guild) {
      return await sendOrFallback(interaction, {
        content: 'This command must be used in a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    const userId  = interaction.user.id;
    const profile = getProfile(userId);
    if (!profile) {
      return await sendNoProfile(interaction);
    }

    const container = buildHubContainer(profile);

    await sendOrFallback(interaction, {
      components: [container.toJSON()],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

async function handleUpgradeSelect(interaction) {
  const userId = interaction.user.id;
  const selectedValue = interaction.values && interaction.values[0];

  const profile = getProfile(userId);
  if (!profile) {
    return await sendNoProfile(interaction);
  }

  if (!UPGRADES[selectedValue]) {
    return await sendOrFallback(interaction, {
      content: 'Unknown upgrade category.',
      flags: MessageFlags.Ephemeral
    });
  }

  const container = buildDetailContainer(profile, selectedValue);
  return await sendOrFallback(interaction, {
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

async function handleUpgradeConfirm(interaction, isYes, data) {
  try {
    if (!isYes) {
      const container = buildCancelledContainer();
      return await interaction.reply({
        components: [container.toJSON()],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const [key, costStr, levelStr] = data;
    const cost = Number(costStr);
    const newLevel = Number(levelStr);

    const u = UPGRADES[key];
    if (!u) {
      return await interaction.reply({ content: 'Unknown upgrade.', flags: MessageFlags.Ephemeral });
    }

    const userId = interaction.user.id;
    const profile = getProfile(userId);
    if (!profile) {
      return await sendNoProfile(interaction);
    }

    const bits = profile.wallet?.bits ?? profile.balances?.bits ?? 0;

    const currentLevel = u.getLevel(profile);
    if (newLevel !== currentLevel + 1) {
      return await interaction.reply({ content: 'Upgrade level mismatch. Please try again.', flags: MessageFlags.Ephemeral });
    }
    const expectedCost = getUpgradeCost(key, newLevel);
    if (cost !== expectedCost) {
      return await interaction.reply({ content: 'Upgrade cost mismatch. Please try again.', flags: MessageFlags.Ephemeral });
    }
    if (newLevel > u.maxLevel) {
      return await interaction.reply({ content: 'Already at max level!', flags: MessageFlags.Ephemeral });
    }
    if (bits < cost) {
      return await interaction.reply({
        content: `You need ${fmtNum(cost)} bits but only have ${fmtNum(bits)}.`,
        flags: MessageFlags.Ephemeral
      });
    }

    const oldVal = u.getCurrent(profile);
    if (!profile.wallet) profile.wallet = {};
    if (!profile.balances) profile.balances = {};
    profile.wallet.bits = bits - cost;
    profile.balances.bits = bits - cost;
    u.apply(profile, newLevel);
    updateProfile(userId, profile);

    const newVal = u.getCurrent(profile);
    const container = buildSuccessContainer(profile, key, oldVal, newVal, cost, newLevel);

    return await interaction.reply({
      components: [container.toJSON()],
      flags: MessageFlags.IsComponentsV2
    });

  } catch (err) {
    console.error('upgrade confirm error', err);
    await interaction.reply({
      content: 'An error occurred during upgrade.',
      flags: MessageFlags.Ephemeral
    }).catch(() => {});
  }
}

async function handleUpgradeBack(interaction) {
  const userId = interaction.user.id;
  const profile = getProfile(userId);
  if (!profile) {
    return await sendNoProfile(interaction);
  }
  const container = buildHubContainer(profile);
  return await interaction.reply({
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

module.exports.handleUpgradeSelect  = handleUpgradeSelect;
module.exports.handleUpgradeConfirm = handleUpgradeConfirm;
module.exports.handleUpgradeBack    = handleUpgradeBack;
module.exports.UPGRADES             = UPGRADES;
