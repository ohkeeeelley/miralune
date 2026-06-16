const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const {
  loadVerificationConfig,
  saveVerificationConfig,
  parseQuestionAnswer,
  normalizeAnswer,
  verificationTypeLabel,
  isVerificationConfigured,
  applyVerification
} = require('../../utils/verificationManager');

const SETUP_PREFIX = 'vsetup';
const SETUP_MODAL_PREFIX = 'vsetupmodal';
const VERIFY_BUTTON_ID = 'verification:start';
const VERIFY_MODAL_PREFIX = 'verification';

function getOwnerIdFromSetupId(customId) {
  const parts = String(customId || '').split(':');
  const maybeOwnerId = parts[parts.length - 1];
  return /^\d{17,20}$/.test(maybeOwnerId) ? maybeOwnerId : null;
}

function roleText(roleId) {
  return roleId ? `<@&${roleId}>` : '`Not set`';
}

function channelText(channelId) {
  return channelId ? `<#${channelId}>` : '`Not set`';
}

function maskedPasscode(passcode) {
  if (!passcode) return '`Not set`';
  return '`' + '•'.repeat(String(passcode).length) + '`';
}

function quizSummary(cfg) {
  const coreCount = (cfg.quiz?.core || []).filter(Boolean).length;
  const extraCount = (cfg.quiz?.extra || []).filter(Boolean).length;
  return `Core: **${coreCount}/4**, Optional: **${extraCount}/2**`;
}

function getTypePrompt(cfg, type) {
  if (type === 'passcode') {
    return {
      title: cfg.ui?.passcode?.title || 'Server Verification',
      description: cfg.ui?.passcode?.description || 'Click Verify and enter the passcode digits.'
    };
  }

  if (type === 'quiz') {
    return {
      title: cfg.ui?.quiz?.title || 'Server Verification',
      description: cfg.ui?.quiz?.description || 'Click Verify and answer the quiz modal correctly.'
    };
  }

  return {
    title: 'Server Verification',
    description: 'Type **$verify** in this channel or click the button below.'
  };
}

function parseQuizInputStrict(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return { ok: false, error: 'empty' };

  if (/\s\||\|\s/.test(txt)) {
    return { ok: false, error: 'bar-spaces' };
  }

  const segments = txt.split('|');
  if (segments.length !== 2) {
    return { ok: false, error: 'format' };
  }

  const parsed = parseQuestionAnswer(txt);
  if (!parsed) return { ok: false, error: 'format' };

  return { ok: true, value: parsed };
}

function buildSetupContainer(guild, cfg, view, ownerId, statusLine = '') {
  const container = new ContainerBuilder().setAccentColor(0x5865f2);

  if (view === 'main') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## Verification Setup Wizard',
          '',
          `**Server:** ${guild.name}`,
          `**Channel:** ${channelText(cfg.channelId)}`,
          `**Type:** ${verificationTypeLabel(cfg.type)}`,
          `**Verified Role:** ${roleText(cfg.verifiedRoleId)}`,
          `**Unverified Role:** ${roleText(cfg.unverifiedRoleId)} (optional)`,
          `**Passcode:** ${maskedPasscode(cfg.passcode)}`,
          `**Quiz:** ${quizSummary(cfg)}`,
          '',
          isVerificationConfigured(cfg)
            ? '✅ Setup is complete. You can post or refresh the verification panel.'
            : '⚠️ Setup is incomplete. Configure required fields before posting the panel.'
        ].join('\n')
      )
    );

    if (statusLine) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(statusLine));
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:channel:${ownerId}`)
        .setLabel('Set Channel')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:type:${ownerId}`)
        .setLabel('Verification Type')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:roles:${ownerId}`)
        .setLabel('Roles')
        .setStyle(ButtonStyle.Secondary)
    ));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:details:${ownerId}`)
        .setLabel('Type Details')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:help:${ownerId}`)
        .setLabel('Help')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:action:postpanel:${ownerId}`)
        .setLabel('Post/Refresh Panel')
        .setStyle(ButtonStyle.Success)
    ));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:action:close:${ownerId}`)
        .setLabel('Close')
        .setStyle(ButtonStyle.Danger)
    ));

    return container;
  }

  if (view === 'help') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## Verification Setup Help',
          '',
          '**1) Set Channel**',
          '> Where the verification panel message is posted.',
          '',
          '**2) Verification Type**',
          '> Basic: users type **$verify** or click Verify.',
          '> Passcode: users must enter your digit code.',
          '> Quiz: users answer your modal questions.',
          '',
          '**3) Roles**',
          '> Verified role is required and given on success.',
          '> Unverified role is optional and removed on success.',
          '',
          '**4) Type Details**',
          '> Passcode: set passcode + prompt text (title/description).',
          '> Quiz: set core 4 questions, optional +2, and prompt text.',
          '',
          '**Quiz Format Rules**',
          '> Use exactly: `question|answer`',
          '> Do **not** put spaces around `|`.',
          '> ✅ Example: `What is 2+2?|4`',
          '> ❌ Wrong: `What is 2+2? | 4`',
          '',
          '**5) Post/Refresh Panel**',
          '> Sends or updates the verification panel in your selected channel.'
        ].join('\n')
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:main:${ownerId}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ));

    return container;
  }

  if (view === 'channel') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## Setup Channel',
          '',
          `Current channel: ${channelText(cfg.channelId)}`,
          '',
          'Pick the channel where the verification panel should be posted.'
        ].join('\n')
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addActionRowComponents(row => row.setComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`${SETUP_PREFIX}:set:channel:${ownerId}`)
        .setPlaceholder('Select verification channel')
        .setMinValues(1)
        .setMaxValues(1)
        .addChannelTypes(ChannelType.GuildText)
    ));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:main:${ownerId}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ));

    return container;
  }

  if (view === 'type') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## Verification Type',
          '',
          `Current type: **${verificationTypeLabel(cfg.type)}**`,
          '',
          'Choose one verification mode for your server.'
        ].join('\n')
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:set:type:basic:${ownerId}`)
        .setLabel('Basic ($verify)')
        .setStyle(cfg.type === 'basic' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:set:type:passcode:${ownerId}`)
        .setLabel('Passcode (Digits)')
        .setStyle(cfg.type === 'passcode' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:set:type:quiz:${ownerId}`)
        .setLabel('Quiz (Modal)')
        .setStyle(cfg.type === 'quiz' ? ButtonStyle.Success : ButtonStyle.Secondary)
    ));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:main:${ownerId}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ));

    return container;
  }

  if (view === 'roles') {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '## Setup Roles',
          '',
          `Verified role: ${roleText(cfg.verifiedRoleId)}`,
          `Unverified role: ${roleText(cfg.unverifiedRoleId)} (optional)`,
          '',
          'Users who pass verification receive the verified role. If unverified role is set, it will be removed on success.'
        ].join('\n')
      )
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addActionRowComponents(row => row.setComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`${SETUP_PREFIX}:set:verifiedRole:${ownerId}`)
        .setPlaceholder('Select verified role')
        .setMinValues(1)
        .setMaxValues(1)
    ));
    container.addActionRowComponents(row => row.setComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`${SETUP_PREFIX}:set:unverifiedRole:${ownerId}`)
        .setPlaceholder('Select unverified role (optional)')
        .setMinValues(1)
        .setMaxValues(1)
    ));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:clear:unverifiedRole:${ownerId}`)
        .setLabel('Clear Unverified Role')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:view:main:${ownerId}`)
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ));

    return container;
  }

  const detailsLines = [
    '## Type Details',
    '',
    `Current type: **${verificationTypeLabel(cfg.type)}**`,
    ''
  ];

  if (cfg.type === 'basic') {
    detailsLines.push('No extra setup needed. Members can type **$verify** in the verification channel.');
  } else if (cfg.type === 'passcode') {
    const prompt = getTypePrompt(cfg, 'passcode');
    detailsLines.push(`Current passcode: ${maskedPasscode(cfg.passcode)}`);
    detailsLines.push('Passcode must be digits only (4 to 12 digits).');
    detailsLines.push(`Prompt title: **${prompt.title}**`);
    detailsLines.push(`Prompt description: ${prompt.description}`);
  } else {
    const prompt = getTypePrompt(cfg, 'quiz');
    detailsLines.push(`Quiz setup: ${quizSummary(cfg)}`);
    detailsLines.push('Format each question as: `question|answer` (no spaces around `|`).');
    detailsLines.push('Example: `What is 2+2?|4`');
    detailsLines.push(`Prompt title: **${prompt.title}**`);
    detailsLines.push(`Prompt description: ${prompt.description}`);
    const core = cfg.quiz?.core || [];
    for (let i = 0; i < 4; i++) {
      detailsLines.push(core[i]
        ? `Q${i + 1}: ${core[i].question}`
        : `Q${i + 1}: (not set)`);
    }
    const extra = cfg.quiz?.extra || [];
    if (extra.length > 0) {
      for (let i = 0; i < extra.length; i++) {
        detailsLines.push(`Optional Q${i + 5}: ${extra[i].question}`);
      }
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(detailsLines.join('\n'))
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (cfg.type === 'passcode') {
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:modal:passcode:${ownerId}`)
        .setLabel('Set Passcode')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:modal:prompt:passcode:${ownerId}`)
        .setLabel('Set Prompt Text')
        .setStyle(ButtonStyle.Primary)
    ));
  }

  if (cfg.type === 'quiz') {
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:modal:quizcore:${ownerId}`)
        .setLabel('Set Core Quiz (4)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:modal:quizextra:${ownerId}`)
        .setLabel('Set Optional Quiz (+2)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:clear:quizextra:${ownerId}`)
        .setLabel('Clear Optional')
        .setStyle(ButtonStyle.Secondary)
    ));
    container.addActionRowComponents(row => row.setComponents(
      new ButtonBuilder()
        .setCustomId(`${SETUP_PREFIX}:modal:prompt:quiz:${ownerId}`)
        .setLabel('Set Prompt Text')
        .setStyle(ButtonStyle.Primary)
    ));
  }

  container.addActionRowComponents(row => row.setComponents(
    new ButtonBuilder()
      .setCustomId(`${SETUP_PREFIX}:view:main:${ownerId}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
  ));

  return container;
}

function buildSetupPayload(guild, cfg, view, ownerId, statusLine = '', ephemeral = false) {
  const container = buildSetupContainer(guild, cfg, view, ownerId, statusLine);
  const flags = MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0);
  return {
    components: [container.toJSON()],
    flags
  };
}

function buildClosedSetupPayload() {
  const container = new ContainerBuilder().setAccentColor(0x2f3136);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Verification setup closed\nYou can run `/verification_setup` again anytime.')
  );
  return {
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  };
}

function buildPasscodeSetupModal(guildId, ownerId, cfg) {
  const modal = new ModalBuilder()
    .setCustomId(`${SETUP_MODAL_PREFIX}:passcode:${guildId}:${ownerId}`)
    .setTitle('Set Verification Passcode');

  const input = new TextInputBuilder()
    .setCustomId('passcode')
    .setLabel('Passcode (digits only, 4-12)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(12)
    .setRequired(true)
    .setPlaceholder('Example: 123456');

  if (cfg.passcode) input.setValue(cfg.passcode);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildTypePromptSetupModal(guildId, ownerId, cfg, type) {
  const prompt = getTypePrompt(cfg, type);
  const typeName = type === 'passcode' ? 'Passcode' : 'Quiz';

  const modal = new ModalBuilder()
    .setCustomId(`${SETUP_MODAL_PREFIX}:prompt:${type}:${guildId}:${ownerId}`)
    .setTitle(`Set ${typeName} Prompt`);

  const titleInput = new TextInputBuilder()
    .setCustomId('prompt_title')
    .setLabel('Panel Title')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(80)
    .setPlaceholder('Server Verification')
    .setValue(prompt.title);

  const descInput = new TextInputBuilder()
    .setCustomId('prompt_description')
    .setLabel('Panel Description')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(220)
    .setPlaceholder(type === 'passcode'
      ? 'Click Verify and enter the passcode digits.'
      : 'Click Verify and answer the quiz modal correctly.')
    .setValue(prompt.description);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descInput)
  );

  return modal;
}

function buildQuizCoreSetupModal(guildId, ownerId, cfg) {
  const modal = new ModalBuilder()
    .setCustomId(`${SETUP_MODAL_PREFIX}:quizcore:${guildId}:${ownerId}`)
    .setTitle('Set Core Quiz (4 Required)');

  const core = cfg.quiz?.core || [];
  for (let i = 0; i < 4; i++) {
    const field = new TextInputBuilder()
      .setCustomId(`qa${i + 1}`)
      .setLabel(`Q${i + 1}|A${i + 1} (NO spaces around |)`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(180)
      .setPlaceholder('Example: What is 2+2?|4 (no spaces around |)');

    if (core[i]) field.setValue(`${core[i].question}|${core[i].answer}`);

    modal.addComponents(new ActionRowBuilder().addComponents(field));
  }

  return modal;
}

function buildQuizExtraSetupModal(guildId, ownerId, cfg) {
  const modal = new ModalBuilder()
    .setCustomId(`${SETUP_MODAL_PREFIX}:quizextra:${guildId}:${ownerId}`)
    .setTitle('Set Optional Quiz (+2)');

  const extra = cfg.quiz?.extra || [];
  for (let i = 0; i < 2; i++) {
    const idx = i + 5;
    const field = new TextInputBuilder()
      .setCustomId(`qa${idx}`)
      .setLabel(`Optional Q${idx}|A${idx} (NO spaces around |)`)
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(180)
      .setPlaceholder('Example: Favorite color?|blue (no spaces)');

    if (extra[i]) field.setValue(`${extra[i].question}|${extra[i].answer}`);

    modal.addComponents(new ActionRowBuilder().addComponents(field));
  }

  return modal;
}

function buildVerificationPanelPayload(cfg) {
  const container = new ContainerBuilder().setAccentColor(0x57f287);
  const prompt = getTypePrompt(cfg, cfg.type);

  const instructions = [];
  instructions.push(`## ${prompt.title}`);
  instructions.push('');
  instructions.push(`**Type:** ${verificationTypeLabel(cfg.type)}`);
  instructions.push(prompt.description);

  if (cfg.unverifiedRoleId) {
    instructions.push(`Passing verification removes <@&${cfg.unverifiedRoleId}>.`);
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(instructions.join('\n')));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addActionRowComponents(row => row.setComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_BUTTON_ID)
      .setLabel('Verify')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
  ));

  return {
    components: [container.toJSON()],
    flags: MessageFlags.IsComponentsV2
  };
}

async function postOrRefreshVerificationPanel(guild, cfg) {
  const targetChannel = await guild.channels.fetch(cfg.channelId).catch(() => null);
  if (!targetChannel || !targetChannel.isTextBased()) {
    return { ok: false, error: 'The configured verification channel was not found or is not a text channel.' };
  }

  const panelPayload = buildVerificationPanelPayload(cfg);
  let panelMessage = null;

  if (cfg.panelMessageId && cfg.panelChannelId === cfg.channelId) {
    panelMessage = await targetChannel.messages.fetch(cfg.panelMessageId).catch(() => null);
    if (panelMessage) {
      await panelMessage.edit(panelPayload).catch(() => null);
    }
  }

  if (!panelMessage) {
    panelMessage = await targetChannel.send(panelPayload).catch((e) => {
      console.error('[verification_setup] panel send error:', e.message);
      return null;
    });
  }

  if (!panelMessage) {
    return { ok: false, error: 'Failed to send verification panel. Check bot permissions in that channel.' };
  }

  cfg.panelChannelId = panelMessage.channel.id;
  cfg.panelMessageId = panelMessage.id;
  saveVerificationConfig(guild.id, cfg);

  return { ok: true, channelId: panelMessage.channel.id, messageId: panelMessage.id };
}

function buildPasscodeVerifyModal(guildId, cfg) {
  const prompt = getTypePrompt(cfg, 'passcode');
  const modalTitle = prompt.title.slice(0, 45) || 'Verification Passcode';

  const modal = new ModalBuilder()
    .setCustomId(`${VERIFY_MODAL_PREFIX}:passcode:${guildId}`)
    .setTitle(modalTitle);

  const passcodeLabel = (prompt.description || 'Enter the verification passcode')
    .slice(0, 45)
    .replace(/\n/g, ' ')
    .trim() || 'Passcode (digits only)';

  const field = new TextInputBuilder()
    .setCustomId('passcode')
    .setLabel(passcodeLabel)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(12)
    .setPlaceholder('Enter the passcode');

  modal.addComponents(new ActionRowBuilder().addComponents(field));
  return modal;
}

function buildQuizCoreVerifyModal(guildId, cfg) {
  const prompt = getTypePrompt(cfg, 'quiz');
  const hasExtra = (cfg.quiz?.extra || []).length > 0;
  const titleBase = prompt.title || 'Verification Quiz';
  const modalTitle = (hasExtra ? `${titleBase} (1/2)` : titleBase).slice(0, 45);

  const modal = new ModalBuilder()
    .setCustomId(`${VERIFY_MODAL_PREFIX}:quizcore:${guildId}`)
    .setTitle(modalTitle);

  const core = cfg.quiz?.core || [];
  for (let i = 0; i < 4; i++) {
    const qa = core[i];
    const question = qa?.question || `Question ${i + 1}`;

    const field = new TextInputBuilder()
      .setCustomId(`a${i + 1}`)
      .setLabel(question.slice(0, 45))
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(120)
      .setPlaceholder('Type your answer');

    modal.addComponents(new ActionRowBuilder().addComponents(field));
  }

  return modal;
}

function buildQuizExtraVerifyModal(guildId, userId, cfg) {
  const prompt = getTypePrompt(cfg, 'quiz');
  const titleBase = prompt.title || 'Verification Quiz';

  const modal = new ModalBuilder()
    .setCustomId(`${VERIFY_MODAL_PREFIX}:quizextra:${guildId}:${userId}`)
    .setTitle(`${titleBase} (2/2)`.slice(0, 45));

  const extra = cfg.quiz?.extra || [];
  for (let i = 0; i < extra.length; i++) {
    const question = extra[i].question || `Optional Question ${i + 1}`;
    const field = new TextInputBuilder()
      .setCustomId(`ex${i + 1}`)
      .setLabel(question.slice(0, 45))
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(120)
      .setPlaceholder('Type your answer');

    modal.addComponents(new ActionRowBuilder().addComponents(field));
  }

  return modal;
}

async function sendVerifyResult(interaction, cfg) {
  const member = interaction.member
    || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    await interaction.reply({ content: 'Could not load your member profile.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  if (member.roles.cache.has(cfg.verifiedRoleId)) {
    await interaction.reply({ content: 'You are already verified!', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  const applied = await applyVerification(member, cfg);
  if (!applied.ok) {
    await interaction.reply({ content: `❌ ${applied.error}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.reply({
    content: `✅ You are now verified and received <@&${cfg.verifiedRoleId}>!`,
    flags: MessageFlags.Ephemeral
  }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification_setup')
    .setDescription('Interactive setup wizard for server verification')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: 'You need Manage Server permission to configure verification.',
        flags: MessageFlags.Ephemeral
      });
    }

    const cfg = loadVerificationConfig(interaction.guild.id);
    const payload = buildSetupPayload(interaction.guild, cfg, 'main', interaction.user.id, '', true);
    return interaction.reply(payload);
  },

  async handleSetupComponent(interaction) {
    const cid = interaction.customId || '';
    if (!cid.startsWith(`${SETUP_PREFIX}:`)) return false;

    const ownerId = getOwnerIdFromSetupId(cid);
    if (!ownerId) {
      await interaction.reply({ content: 'Invalid setup interaction.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: 'Only the command user can use this setup panel.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (!interaction.guild || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to do that.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    const cfg = loadVerificationConfig(interaction.guild.id);
    const parts = cid.split(':');

    if (parts[1] === 'view') {
      const view = parts[2] || 'main';
      await interaction.update(buildSetupPayload(interaction.guild, cfg, view, ownerId));
      return true;
    }

    if (parts[1] === 'set' && parts[2] === 'channel' && interaction.isChannelSelectMenu()) {
      cfg.channelId = interaction.values[0] || null;
      saveVerificationConfig(interaction.guild.id, cfg);
      await interaction.update(buildSetupPayload(interaction.guild, cfg, 'channel', ownerId, '✅ Verification channel updated.'));
      return true;
    }

    if (parts[1] === 'set' && parts[2] === 'type' && interaction.isButton()) {
      const type = parts[3];
      if (!['basic', 'passcode', 'quiz'].includes(type)) {
        await interaction.reply({ content: 'Unknown verification type.', flags: MessageFlags.Ephemeral }).catch(() => {});
        return true;
      }

      cfg.type = type;
      saveVerificationConfig(interaction.guild.id, cfg);
      await interaction.update(buildSetupPayload(interaction.guild, cfg, 'type', ownerId, `✅ Verification type set to **${verificationTypeLabel(type)}**.`));
      return true;
    }

    if (parts[1] === 'set' && parts[2] === 'verifiedRole' && interaction.isRoleSelectMenu()) {
      cfg.verifiedRoleId = interaction.values[0] || null;
      saveVerificationConfig(interaction.guild.id, cfg);
      await interaction.update(buildSetupPayload(interaction.guild, cfg, 'roles', ownerId, '✅ Verified role updated.'));
      return true;
    }

    if (parts[1] === 'set' && parts[2] === 'unverifiedRole' && interaction.isRoleSelectMenu()) {
      cfg.unverifiedRoleId = interaction.values[0] || null;
      saveVerificationConfig(interaction.guild.id, cfg);
      await interaction.update(buildSetupPayload(interaction.guild, cfg, 'roles', ownerId, '✅ Unverified role updated.'));
      return true;
    }

    if (parts[1] === 'clear' && parts[2] === 'unverifiedRole' && interaction.isButton()) {
      cfg.unverifiedRoleId = null;
      saveVerificationConfig(interaction.guild.id, cfg);
      await interaction.update(buildSetupPayload(interaction.guild, cfg, 'roles', ownerId, '✅ Unverified role cleared.'));
      return true;
    }

    if (parts[1] === 'clear' && parts[2] === 'quizextra' && interaction.isButton()) {
      cfg.quiz.extra = [];
      saveVerificationConfig(interaction.guild.id, cfg);
      await interaction.update(buildSetupPayload(interaction.guild, cfg, 'details', ownerId, '✅ Optional quiz questions cleared.'));
      return true;
    }

    if (parts[1] === 'modal' && interaction.isButton()) {
      const modalType = parts[2];
      if (modalType === 'prompt') {
        const promptType = parts[3];
        if (!['passcode', 'quiz'].includes(promptType)) {
          await interaction.reply({ content: 'Unknown prompt type.', flags: MessageFlags.Ephemeral }).catch(() => {});
          return true;
        }
        await interaction.showModal(buildTypePromptSetupModal(interaction.guild.id, ownerId, cfg, promptType));
        return true;
      }

      if (modalType === 'passcode') {
        await interaction.showModal(buildPasscodeSetupModal(interaction.guild.id, ownerId, cfg));
        return true;
      }
      if (modalType === 'quizcore') {
        await interaction.showModal(buildQuizCoreSetupModal(interaction.guild.id, ownerId, cfg));
        return true;
      }
      if (modalType === 'quizextra') {
        await interaction.showModal(buildQuizExtraSetupModal(interaction.guild.id, ownerId, cfg));
        return true;
      }
    }

    if (parts[1] === 'action' && parts[2] === 'postpanel' && interaction.isButton()) {
      await interaction.deferUpdate();

      if (!isVerificationConfigured(cfg)) {
        await interaction.editReply(
          buildSetupPayload(
            interaction.guild,
            cfg,
            'main',
            ownerId,
            '❌ Setup is incomplete. Required: channel, verified role, and type-specific settings.'
          )
        ).catch(() => {});
        return true;
      }

      const posted = await postOrRefreshVerificationPanel(interaction.guild, cfg);
      if (!posted.ok) {
        await interaction.editReply(
          buildSetupPayload(interaction.guild, cfg, 'main', ownerId, `❌ ${posted.error}`)
        ).catch(() => {});
        return true;
      }

      await interaction.editReply(
        buildSetupPayload(interaction.guild, cfg, 'main', ownerId, `✅ Verification panel posted in <#${posted.channelId}>.`)
      ).catch(() => {});
      return true;
    }

    if (parts[1] === 'action' && parts[2] === 'close' && interaction.isButton()) {
      await interaction.update(buildClosedSetupPayload());
      return true;
    }

    await interaction.reply({ content: 'Unknown setup action.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  },

  async handleSetupModal(interaction) {
    const cid = interaction.customId || '';
    if (!cid.startsWith(`${SETUP_MODAL_PREFIX}:`)) return false;

    const parts = cid.split(':');
    const modalType = parts[1];
    const promptType = modalType === 'prompt' ? parts[2] : null;
    const guildId = modalType === 'prompt' ? parts[3] : parts[2];
    const ownerId = modalType === 'prompt' ? parts[4] : parts[3];

    if (!guildId || !ownerId) {
      await interaction.reply({ content: 'Invalid setup modal data.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: 'Only the setup owner can submit this modal.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (!interaction.guild || interaction.guild.id !== guildId || !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to do that.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    const cfg = loadVerificationConfig(guildId);

    if (modalType === 'prompt') {
      if (!['passcode', 'quiz'].includes(promptType)) {
        await interaction.reply({ content: 'Unknown prompt type.', flags: MessageFlags.Ephemeral }).catch(() => {});
        return true;
      }

      const title = String(interaction.fields.getTextInputValue('prompt_title') || '').trim();
      const description = String(interaction.fields.getTextInputValue('prompt_description') || '').trim();

      if (!title || !description) {
        await interaction.reply({
          content: 'Title and description are required.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
        return true;
      }

      cfg.ui = cfg.ui || {};
      cfg.ui[promptType] = cfg.ui[promptType] || {};
      cfg.ui[promptType].title = title.slice(0, 80);
      cfg.ui[promptType].description = description.slice(0, 220);
      saveVerificationConfig(guildId, cfg);

      await interaction.reply({
        content: `✅ ${promptType === 'passcode' ? 'Passcode' : 'Quiz'} prompt text updated.`,
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
      return true;
    }

    if (modalType === 'passcode') {
      const passcode = String(interaction.fields.getTextInputValue('passcode') || '').trim();
      if (!/^\d{4,12}$/.test(passcode)) {
        await interaction.reply({
          content: 'Passcode must be digits only and between 4 and 12 characters.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
        return true;
      }

      cfg.passcode = passcode;
      saveVerificationConfig(guildId, cfg);

      await interaction.reply({
        content: '✅ Passcode updated. Go back to the setup panel and post/refresh the verification panel.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
      return true;
    }

    if (modalType === 'quizcore') {
      const parsed = [];
      for (let i = 1; i <= 4; i++) {
        const raw = interaction.fields.getTextInputValue(`qa${i}`);
        const qaResult = parseQuizInputStrict(raw);
        if (!qaResult.ok) {
          const guidance = qaResult.error === 'bar-spaces'
            ? `Q${i} has spaces around \`|\`. Use this exact format with no spaces around the bar: \`question|answer\`. Example: \`What is 2+2?|4\``
            : `Q${i} is invalid. Use this exact format: \`question|answer\` (no spaces around \`|\`). Example: \`What is 2+2?|4\``;
          await interaction.reply({
            content: guidance,
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
          return true;
        }
        parsed.push(qaResult.value);
      }

      cfg.quiz.core = parsed;
      saveVerificationConfig(guildId, cfg);

      await interaction.reply({
        content: '✅ Core quiz saved (4 required questions).',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
      return true;
    }

    if (modalType === 'quizextra') {
      const optional = [];
      for (let i = 5; i <= 6; i++) {
        const raw = String(interaction.fields.getTextInputValue(`qa${i}`) || '').trim();
        if (!raw) continue;

        const qaResult = parseQuizInputStrict(raw);
        if (!qaResult.ok) {
          const guidance = qaResult.error === 'bar-spaces'
            ? `Optional Q${i} has spaces around \`|\`. Use \`question|answer\` with no spaces. Example: \`Favorite color?|blue\``
            : `Optional Q${i} is invalid. Use \`question|answer\` with no spaces around \`|\`. Example: \`Favorite color?|blue\``;
          await interaction.reply({
            content: guidance,
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
          return true;
        }
        optional.push(qaResult.value);
      }

      cfg.quiz.extra = optional;
      saveVerificationConfig(guildId, cfg);

      await interaction.reply({
        content: `✅ Optional quiz saved (${optional.length}/2).`,
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
      return true;
    }

    await interaction.reply({ content: 'Unknown setup modal.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  },

  async handleVerificationButton(interaction) {
    if ((interaction.customId || '') !== VERIFY_BUTTON_ID) return false;
    if (!interaction.guild) {
      await interaction.reply({ content: 'Verification only works in a server.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    const cfg = loadVerificationConfig(interaction.guild.id);
    if (!isVerificationConfigured(cfg)) {
      await interaction.reply({
        content: 'Verification is not fully configured yet. Please contact a server admin.',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
      return true;
    }

    const member = interaction.member
      || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: 'Could not load your member profile.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (member.roles.cache.has(cfg.verifiedRoleId)) {
      await interaction.reply({ content: 'You are already verified.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (cfg.type === 'basic') {
      const result = await applyVerification(member, cfg);
      if (!result.ok) {
        await interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        return true;
      }

      await interaction.reply({ content: `✅ You are now verified and received <@&${cfg.verifiedRoleId}>!`, flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (cfg.type === 'passcode') {
      await interaction.showModal(buildPasscodeVerifyModal(interaction.guild.id, cfg));
      return true;
    }

    if (cfg.type === 'quiz') {
      if (!(cfg.quiz?.core || []).every(Boolean)) {
        await interaction.reply({
          content: 'The quiz is not fully configured yet. Please contact a server admin.',
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
        return true;
      }

      await interaction.showModal(buildQuizCoreVerifyModal(interaction.guild.id, cfg));
      return true;
    }

    await interaction.reply({ content: 'Unknown verification type.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return true;
  },

  async handleVerificationModal(interaction) {
    const cid = interaction.customId || '';
    if (!cid.startsWith(`${VERIFY_MODAL_PREFIX}:`)) return false;

    const parts = cid.split(':');
    const modalType = parts[1];
    const guildId = parts[2];

    if (!interaction.guild || interaction.guild.id !== guildId) {
      await interaction.reply({ content: 'This verification modal is invalid for this server.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    const cfg = loadVerificationConfig(guildId);
    if (!isVerificationConfigured(cfg)) {
      await interaction.reply({ content: 'Verification is not fully configured.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    const member = interaction.member
      || await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: 'Could not load your member profile.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (member.roles.cache.has(cfg.verifiedRoleId)) {
      await interaction.reply({ content: 'You are already verified.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return true;
    }

    if (modalType === 'passcode') {
      const entered = String(interaction.fields.getTextInputValue('passcode') || '').trim();
      if (normalizeAnswer(entered) !== normalizeAnswer(cfg.passcode || '')) {
        await interaction.reply({ content: '❌ Incorrect passcode. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
        return true;
      }

      await sendVerifyResult(interaction, cfg);
      return true;
    }

    if (modalType === 'quizcore') {
      const core = cfg.quiz?.core || [];
      for (let i = 0; i < 4; i++) {
        const expected = normalizeAnswer(core[i]?.answer || '');
        const entered = normalizeAnswer(interaction.fields.getTextInputValue(`a${i + 1}`));
        if (!expected || entered !== expected) {
          await interaction.reply({
            content: `❌ Quiz answer ${i + 1} is incorrect. Please try again.`,
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
          return true;
        }
      }

      const extra = cfg.quiz?.extra || [];
      if (extra.length > 0) {
        await interaction.showModal(buildQuizExtraVerifyModal(guildId, interaction.user.id, cfg));
        return true;
      }

      await sendVerifyResult(interaction, cfg);
      return true;
    }

    if (modalType === 'quizextra') {
      const requiredUserId = parts[3] || '';
      if (requiredUserId && requiredUserId !== interaction.user.id) {
        await interaction.reply({ content: 'This quiz step is not for you.', flags: MessageFlags.Ephemeral }).catch(() => {});
        return true;
      }

      const extra = cfg.quiz?.extra || [];
      for (let i = 0; i < extra.length; i++) {
        const expected = normalizeAnswer(extra[i]?.answer || '');
        const entered = normalizeAnswer(interaction.fields.getTextInputValue(`ex${i + 1}`));
        if (!expected || entered !== expected) {
          await interaction.reply({
            content: `❌ Optional quiz answer ${i + 5} is incorrect. Please try again.`,
            flags: MessageFlags.Ephemeral
          }).catch(() => {});
          return true;
        }
      }

      await sendVerifyResult(interaction, cfg);
      return true;
    }

    return false;
  }
};
