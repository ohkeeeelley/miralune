const fs = require('fs');
const path = require('path');
const {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const { sendOrFallback, MessageFlags } = require('../../utils/safeReply');
const { generateLevelCard, CARD_THEMES, PROGRESS_STYLES } = require('../../model/LevelRenderer');
const { isPremium } = require('../../utils/PremiumWhitelist');
const { getProfile } = require('../../utils/profileManager');

const SERVERS_DIR = path.join(__dirname, '../../data/level/servers');
const CONFIG_PATH = path.join(__dirname, '../../data/level/levelConfiguration.json');

const STARTING_LEVEL = 1;
const XP_PER_LEVEL_STEP = 500;

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return { minXP: 12, maxXP: 22, cooldown: 15 };
  }
}

function xpForNextLevel(level) {
  const safeLevel = Math.max(STARTING_LEVEL, Number(level) || STARTING_LEVEL);
  return safeLevel * XP_PER_LEVEL_STEP;
}

function makeDefaultLevelData() {
  return { xp: 0, level: STARTING_LEVEL, totalXP: 0, card: 'default_bg', lastMessage: 0 };
}

function normalizeLevelData(user) {
  const normalized = user && typeof user === 'object' ? { ...user } : makeDefaultLevelData();

  normalized.level = Math.max(STARTING_LEVEL, Number(normalized.level) || STARTING_LEVEL);
  normalized.xp = Math.max(0, Number(normalized.xp) || 0);
  normalized.totalXP = Math.max(0, Number(normalized.totalXP) || 0);
  normalized.lastMessage = Math.max(0, Number(normalized.lastMessage) || 0);

  if (!normalized.card) normalized.card = 'default_bg';

  return normalized;
}

async function safeDeferUpdate(interaction) {
  if (!interaction || interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferUpdate();
    return true;
  } catch (err) {

    if (err && (err.code === 10062 || err.code === 40060)) return false;
    throw err;
  }
}

async function showLoadingState(interaction, text = '## ⏳ Loading...') {
  if (!interaction || (!interaction.deferred && !interaction.replied)) return false;

  const container = new ContainerBuilder().setAccentColor(0x5865F2);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(text)
  );

  try {
    await interaction.editReply({
      files: [],
      components: [container.toJSON()],
      flags: MessageFlags.IsComponentsV2
    });
    return true;
  } catch (err) {
    if (err && (err.code === 10062 || err.code === 40060)) return false;
    return true;
  }
}

function getGuildDataPath(guildId) {
  return path.join(SERVERS_DIR, `${guildId}.json`);
}

function loadGuildData(guildId) {
  const filePath = getGuildDataPath(guildId);
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveGuildData(guildId, data) {
  const filePath = getGuildDataPath(guildId);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getUserLevelData(guildId, userId) {
  const data = loadGuildData(guildId);
  const hadUser = !!data[userId];
  const normalized = normalizeLevelData(data[userId]);

  if (!hadUser || JSON.stringify(data[userId]) !== JSON.stringify(normalized)) {
    data[userId] = normalized;
    saveGuildData(guildId, data);
  }

  return data[userId];
}

function setUserLevelData(guildId, userId, userData) {
  const data = loadGuildData(guildId);
  data[userId] = normalizeLevelData(userData);
  saveGuildData(guildId, data);
}

function getRank(guildId, userId) {
  const data = loadGuildData(guildId);
  const entries = Object.entries(data)
    .map(([uid, d]) => {
      const normalized = normalizeLevelData(d);
      return { uid, level: normalized.level, totalXP: normalized.totalXP };
    })
    .sort((a, b) => b.level - a.level || b.totalXP - a.totalXP);
  const idx = entries.findIndex(e => e.uid === userId);
  return idx === -1 ? entries.length + 1 : idx + 1;
}

function addMessageXP(guildId, userId) {
  const config = loadConfig();
  const data = loadGuildData(guildId);

  if (!data[userId]) data[userId] = makeDefaultLevelData();

  const user = normalizeLevelData(data[userId]);
  const now = Date.now();
  const cooldownMs = (config.cooldown || 15) * 1000;

  if (now - (user.lastMessage || 0) < cooldownMs) return null;

  const min = config.minXP || 12;
  const max = config.maxXP || 22;
  const gained = Math.floor(Math.random() * (max - min + 1)) + min;

  user.xp += gained;
  user.totalXP += gained;
  user.lastMessage = now;

  let leveledUp = false;
  let newLevel = user.level;

  while (user.xp >= xpForNextLevel(user.level)) {
    user.xp -= xpForNextLevel(user.level);
    user.level++;
    leveledUp = true;
    newLevel = user.level;
  }

  data[userId] = user;
  saveGuildData(guildId, data);

  return leveledUp ? { level: newLevel, userId } : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('View your level card and XP progress')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('View another user\'s level card')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return await sendOrFallback(interaction, {
        content: 'This command must be used in a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    const target = interaction.options.getUser('user') || interaction.user;
    if (target.bot) {
      return await sendOrFallback(interaction, {
        content: 'Bots don\'t have levels!',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply().catch(() => {});
    if (!(await showLoadingState(interaction, '## ⏳ Loading Level...'))) return;

    const guildId = interaction.guild.id;
    const userData = getUserLevelData(guildId, target.id);
    const rank = getRank(guildId, target.id);
    const needed = xpForNextLevel(userData.level);

    const avatarURL = target.displayAvatarURL({ extension: 'png', size: 256 });
    const { buffer: buf, isAnimated } = await generateLevelCard({
      username: target.username,
      avatarURL,
      level: userData.level,
      xp: userData.xp,
      neededXP: needed,
      rank,
      cardTheme: userData.card || 'default_bg',
      progressColor: userData.progressColor || null,
      progressStyle: userData.progressStyle || 'static'
    });

    const ext = isAnimated ? 'gif' : 'png';
    const attachment = new AttachmentBuilder(buf, { name: `level.${ext}` });

    const container = new ContainerBuilder();

    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(`attachment://level.${ext}`)
      )
    );

    if (target.id === interaction.user.id) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      const buttons = [
        new ButtonBuilder()
          .setCustomId('level_change_card')
          .setLabel('Change Card')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎨')
      ];

      buttons.push(
        new ButtonBuilder()
          .setCustomId('level_customize')
          .setLabel('Customize')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✨')
      );

      container.addActionRowComponents(row => row.addComponents(...buttons));
    }

    await sendOrFallback(interaction, {
      files: [attachment],
      components: [container.toJSON()],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

async function handleChangeCard(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  if (!(await safeDeferUpdate(interaction))) return;

  const profile = getProfile(interaction.user.id);
  if (!profile?.server?.inServer) {
    return await sendOrFallback(interaction, {
      content: '🔒 You must be a member of the support server to change your level card. Join the server first!',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!(await showLoadingState(interaction))) return;

  const userId = interaction.user.id;
  const userData = getUserLevelData(guildId, userId);
  const userLevel = userData.level;

  const options = CARD_THEMES.map(theme => {
    const unlocked = userLevel >= theme.requiredLevel;
    return {
      label: theme.label,
      description: unlocked
        ? `Unlocked — Level ${theme.requiredLevel} required`
        : `🔒 Locked — Reach Level ${theme.requiredLevel} to unlock`,
      value: theme.key,
      emoji: unlocked ? '✅' : '🔒',
      default: (userData.card || 'default_bg') === theme.key
    };
  });

  const rank = getRank(guildId, userId);
  const needed = xpForNextLevel(userData.level);
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
  const { buffer: previewBuf, isAnimated: previewIsAnimated } = await generateLevelCard({
    username: interaction.user.username,
    avatarURL,
    level: userData.level,
    xp: userData.xp,
    neededXP: needed,
    rank,
    cardTheme: userData.card || 'default_bg',
    progressColor: userData.progressColor || null,
    progressStyle: userData.progressStyle || 'static'
  });
  const previewExt = previewIsAnimated ? 'gif' : 'png';
  const previewAttachment = new AttachmentBuilder(previewBuf, { name: `level.${previewExt}` });

  const container = new ContainerBuilder().setAccentColor(0x3B82F6);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## 🎨 Change Level Card')
  );

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://level.${previewExt}`)
    )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Your level: **${userLevel}**\nSelect a card theme below. Locked cards require a higher level.`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const lines = CARD_THEMES.map(t => {
    const unlocked = userLevel >= t.requiredLevel;
    const current = (userData.card || 'default_bg') === t.key;
    const prefix = current ? '▸ ' : '  ';
    return `${prefix}${unlocked ? '✅' : '🔒'} **${t.label}** — Level ${t.requiredLevel}${current ? ' *(current)*' : ''}`;
  });
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n'))
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const select = new StringSelectMenuBuilder()
    .setCustomId('level_card_select')
    .setPlaceholder('Choose a card theme…')
    .addOptions(options);

  container.addActionRowComponents(row => row.setComponents(select));
  container.addActionRowComponents(row => row.addComponents(
    new ButtonBuilder()
      .setCustomId('level_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  ));

  await interaction.editReply({
    files: [previewAttachment],
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

async function handleCardSelect(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  const userId = interaction.user.id;
  const selected = interaction.values?.[0];
  if (!selected) return;

  if (!(await safeDeferUpdate(interaction))) return;

  const profile = getProfile(userId);
  if (!profile?.server?.inServer) {
    return await sendOrFallback(interaction, {
      content: '🔒 You must be a member of the support server to change your level card. Join the server first!',
      flags: MessageFlags.Ephemeral
    });
  }

  const theme = CARD_THEMES.find(t => t.key === selected);
  if (!theme) {
    return await sendOrFallback(interaction, {
      content: 'Unknown card theme.',
      flags: MessageFlags.Ephemeral
    });
  }

  const userData = getUserLevelData(guildId, userId);

  if (userData.level < theme.requiredLevel) {
    return await sendOrFallback(interaction, {
      content: `🔒 You need to be **Level ${theme.requiredLevel}** to use the **${theme.label}** card. You're currently Level ${userData.level}.`,
      flags: MessageFlags.Ephemeral
    });
  }

  if (!(await showLoadingState(interaction))) return;

  userData.card = selected;
  setUserLevelData(guildId, userId, userData);

  const rank = getRank(guildId, userId);
  const needed = xpForNextLevel(userData.level);
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

  const { buffer: buf, isAnimated: cardIsAnimated } = await generateLevelCard({
    username: interaction.user.username,
    avatarURL,
    level: userData.level,
    xp: userData.xp,
    neededXP: needed,
    rank,
    cardTheme: selected,
    progressColor: userData.progressColor || null,
    progressStyle: userData.progressStyle || 'static'
  });

  const cardExt = cardIsAnimated ? 'gif' : 'png';
  const attachment = new AttachmentBuilder(buf, { name: `level.${cardExt}` });

  const container = new ContainerBuilder().setAccentColor(0x2ECC71);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ✅ Card Changed to **${theme.label}**!`)
  );
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://level.${cardExt}`)
    )
  );

  const buttons = [
    new ButtonBuilder()
      .setCustomId('level_change_card')
      .setLabel('Change Card')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎨')
  ];

  buttons.push(
    new ButtonBuilder()
      .setCustomId('level_customize')
      .setLabel('Customize')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✨'),
    new ButtonBuilder()
      .setCustomId('level_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  );

  container.addActionRowComponents(row => row.addComponents(...buttons));

  await interaction.editReply({
    files: [attachment],
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

async function handleCustomize(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  if (!(await safeDeferUpdate(interaction))) return;

  if (!isPremium(interaction.user.id)) {
    return await sendOrFallback(interaction, {
      content: '🔒 You need to purchase Premium to use these features.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!(await showLoadingState(interaction))) return;

  const userId = interaction.user.id;
  const userData = getUserLevelData(guildId, userId);
  const colors = Array.isArray(userData.progressColor) ? userData.progressColor : [];
  const currentStyle = userData.progressStyle || 'static';
  const styleInfo = PROGRESS_STYLES.find(s => s.key === currentStyle) || PROGRESS_STYLES[0];

  const rank = getRank(guildId, userId);
  const needed = xpForNextLevel(userData.level);
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
  const { buffer: previewBuf, isAnimated } = await generateLevelCard({
    username: interaction.user.username,
    avatarURL,
    level: userData.level,
    xp: userData.xp,
    neededXP: needed,
    rank,
    cardTheme: userData.card || 'default_bg',
    progressColor: userData.progressColor || null,
    progressStyle: currentStyle
  });
  const ext = isAnimated ? 'gif' : 'png';
  const previewAttachment = new AttachmentBuilder(previewBuf, { name: `level.${ext}` });

  const container = new ContainerBuilder().setAccentColor(0x9B59B6);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## ✨ Customize Level Card')
  );

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://level.${ext}`)
    )
  );

  const colorDisplay = colors.length >= 2 ? `**${colors[0]}** → **${colors[1]}**` : 'Default Blue';
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**Current Colors:** ${colorDisplay}\n**Current Style:** ${styleInfo.label} — *${styleInfo.description}*`
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  container.addActionRowComponents(row => row.addComponents(
    new ButtonBuilder()
      .setCustomId('level_change_progress_color')
      .setLabel('Change Progression Color')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🌈'),
    new ButtonBuilder()
      .setCustomId('level_change_progress_style')
      .setLabel('Progression Styles')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎭'),
    new ButtonBuilder()
      .setCustomId('level_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  ));

  await interaction.editReply({
    files: [previewAttachment],
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

async function handleProgressColor(interaction) {
  if (!isPremium(interaction.user.id)) {
    return await interaction.reply({
      content: '🔒 This is a premium-only feature.',
      flags: MessageFlags.Ephemeral
    });
  }

  const guildId = interaction.guild?.id;
  if (!guildId) return;

  const userData = getUserLevelData(guildId, interaction.user.id);
  const colors = Array.isArray(userData.progressColor) ? userData.progressColor : [];

  const modal = new ModalBuilder()
    .setCustomId('level_progress_color_modal')
    .setTitle('Change Progress Bar Color');

  const colorInput1 = new TextInputBuilder()
    .setCustomId('progress_color_1')
    .setLabel('Gradient Start Color (e.g. #FF5733)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('#3B82F6')
    .setRequired(true)
    .setMinLength(4)
    .setMaxLength(7);

  const colorInput2 = new TextInputBuilder()
    .setCustomId('progress_color_2')
    .setLabel('Gradient End Color (e.g. #8B5CF6)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('#8B5CF6')
    .setRequired(true)
    .setMinLength(4)
    .setMaxLength(7);

  if (colors[0]) colorInput1.setValue(colors[0]);
  if (colors[1]) colorInput2.setValue(colors[1]);

  modal.addComponents(
    new ActionRowBuilder().addComponents(colorInput1),
    new ActionRowBuilder().addComponents(colorInput2)
  );
  await interaction.showModal(modal);
}

async function handleProgressColorSubmit(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  if (!isPremium(interaction.user.id)) {
    return await interaction.reply({
      content: '🔒 This is a premium-only feature.',
      flags: MessageFlags.Ephemeral
    });
  }

  const hexRegex = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;

  let color1 = interaction.fields.getTextInputValue('progress_color_1').trim();
  let color2 = interaction.fields.getTextInputValue('progress_color_2').trim();

  if (!color1.startsWith('#')) color1 = '#' + color1;
  if (!color2.startsWith('#')) color2 = '#' + color2;

  if (!hexRegex.test(color1) || !hexRegex.test(color2)) {
    return await interaction.reply({
      content: '❌ Invalid hex color(s). Use a format like `#FF5733` or `#F00`.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply();
  if (!(await showLoadingState(interaction))) return;

  const gradientColors = [color1, color2];

  const userId = interaction.user.id;
  const userData = getUserLevelData(guildId, userId);
  userData.progressColor = gradientColors;
  setUserLevelData(guildId, userId, userData);

  const rank = getRank(guildId, userId);
  const needed = xpForNextLevel(userData.level);
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

  const { buffer: buf, isAnimated: colorIsAnimated } = await generateLevelCard({
    username: interaction.user.username,
    avatarURL,
    level: userData.level,
    xp: userData.xp,
    neededXP: needed,
    rank,
    cardTheme: userData.card || 'default_bg',
    progressColor: gradientColors,
    progressStyle: userData.progressStyle || 'static'
  });

  const colorExt = colorIsAnimated ? 'gif' : 'png';
  const attachment = new AttachmentBuilder(buf, { name: `level.${colorExt}` });

  const container = new ContainerBuilder().setAccentColor(parseInt(color1.replace('#', ''), 16));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 🌈 Gradient Changed to **${color1}** → **${color2}**!`)
  );
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://level.${colorExt}`)
    )
  );

  container.addActionRowComponents(row => row.addComponents(
    new ButtonBuilder()
      .setCustomId('level_customize')
      .setLabel('Back to Customize')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️'),
    new ButtonBuilder()
      .setCustomId('level_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  ));

  await interaction.editReply({
    files: [attachment],
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

async function handleProgressStyle(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  if (!(await safeDeferUpdate(interaction))) return;

  if (!isPremium(interaction.user.id)) {
    return await sendOrFallback(interaction, {
      content: '🔒 This is a premium-only feature.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!(await showLoadingState(interaction))) return;

  const userId = interaction.user.id;
  const userData = getUserLevelData(guildId, userId);
  const currentStyle = userData.progressStyle || 'static';

  const options = PROGRESS_STYLES.map(s => ({
    label: s.label,
    description: s.description,
    value: s.key,
    default: s.key === currentStyle,
    emoji: ({
      static: '⏹️',
      shimmer: '✨',
      pulse: '💫',
      wave: '🌊',
      tidal: '🌀',
      midnight_galaxy: '🌙',
      rainbow: '🌈',
      prism: '🔷',
      stardust: '🌌',
      ember: '🔥',
      glitch: '📟',
      nebula: '🌠'
    })[s.key] || '🌈'
  }));

  const container = new ContainerBuilder().setAccentColor(0x9B59B6);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## 🎭 Progression Styles')
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`Current style: **${(PROGRESS_STYLES.find(s => s.key === currentStyle) || PROGRESS_STYLES[0]).label}**\nSelect a style below to preview and apply it.`)
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const select = new StringSelectMenuBuilder()
    .setCustomId('level_style_select')
    .setPlaceholder('Choose a progression style…')
    .addOptions(options);

  container.addActionRowComponents(row => row.setComponents(select));

  container.addActionRowComponents(row => row.addComponents(
    new ButtonBuilder()
      .setCustomId('level_customize')
      .setLabel('Back to Customize')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️'),
    new ButtonBuilder()
      .setCustomId('level_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  ));

  try {
    await interaction.editReply({
      files: [],
      components: [container.toJSON()],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (err) {
    if (err && (err.code === 10062 || err.code === 40060)) return;
    await sendOrFallback(interaction, {
      components: [container.toJSON()],
      flags: MessageFlags.IsComponentsV2
    }).catch(() => {});
  }
}

async function handleStyleSelect(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  if (!isPremium(interaction.user.id)) {
    return await interaction.reply({
      content: '🔒 This is a premium-only feature.',
      flags: MessageFlags.Ephemeral
    });
  }

  const selected = interaction.values?.[0];
  if (!selected) return;

  const styleInfo = PROGRESS_STYLES.find(s => s.key === selected);
  if (!styleInfo) {
    return await interaction.reply({
      content: 'Unknown style.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!(await safeDeferUpdate(interaction))) return;
  if (!(await showLoadingState(interaction))) return;

  const userId = interaction.user.id;
  const userData = getUserLevelData(guildId, userId);
  userData.progressStyle = selected;
  setUserLevelData(guildId, userId, userData);

  const rank = getRank(guildId, userId);
  const needed = xpForNextLevel(userData.level);
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

  const { buffer: buf, isAnimated } = await generateLevelCard({
    username: interaction.user.username,
    avatarURL,
    level: userData.level,
    xp: userData.xp,
    neededXP: needed,
    rank,
    cardTheme: userData.card || 'default_bg',
    progressColor: userData.progressColor || null,
    progressStyle: selected
  });

  const ext = isAnimated ? 'gif' : 'png';
  const attachment = new AttachmentBuilder(buf, { name: `level.${ext}` });

  const container = new ContainerBuilder().setAccentColor(0x2ECC71);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ✅ Progression Style set to **${styleInfo.label}**!`)
  );
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://level.${ext}`)
    )
  );

  container.addActionRowComponents(row => row.addComponents(
    new ButtonBuilder()
      .setCustomId('level_customize')
      .setLabel('Back to Customize')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️'),
    new ButtonBuilder()
      .setCustomId('level_change_progress_style')
      .setLabel('Change Style')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎭'),
    new ButtonBuilder()
      .setCustomId('level_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅')
  ));

  await interaction.editReply({
    files: [attachment],
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

async function handleDone(interaction) {
  const guildId = interaction.guild?.id;
  if (!guildId) return;

  if (!(await safeDeferUpdate(interaction))) return;
  if (!(await showLoadingState(interaction))) return;

  const userId = interaction.user.id;
  const userData = getUserLevelData(guildId, userId);
  const rank = getRank(guildId, userId);
  const needed = xpForNextLevel(userData.level);
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

  const { buffer: buf, isAnimated } = await generateLevelCard({
    username: interaction.user.username,
    avatarURL,
    level: userData.level,
    xp: userData.xp,
    neededXP: needed,
    rank,
    cardTheme: userData.card || 'default_bg',
    progressColor: userData.progressColor || null,
    progressStyle: userData.progressStyle || 'static'
  });

  const ext = isAnimated ? 'gif' : 'png';
  const attachment = new AttachmentBuilder(buf, { name: `level.${ext}` });

  const container = new ContainerBuilder();
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(`attachment://level.${ext}`)
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addActionRowComponents(row => row.addComponents(
    new ButtonBuilder()
      .setCustomId('level_change_card')
      .setLabel('Change Card')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎨'),
    new ButtonBuilder()
      .setCustomId('level_customize')
      .setLabel('Customize')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✨')
  ));

  await interaction.editReply({
    files: [attachment],
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  });
}

module.exports.handleChangeCard            = handleChangeCard;
module.exports.handleCardSelect            = handleCardSelect;
module.exports.handleCustomize             = handleCustomize;
module.exports.handleProgressColor         = handleProgressColor;
module.exports.handleProgressColorSubmit   = handleProgressColorSubmit;
module.exports.handleProgressStyle         = handleProgressStyle;
module.exports.handleStyleSelect           = handleStyleSelect;
module.exports.handleDone                  = handleDone;
module.exports.addMessageXP                = addMessageXP;
module.exports.xpForNextLevel              = xpForNextLevel;
module.exports.loadGuildData               = loadGuildData;
module.exports.getUserLevelData            = getUserLevelData;
module.exports.CARD_THEMES                 = CARD_THEMES;
