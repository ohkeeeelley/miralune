const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
    ChannelType,
} = require('discord.js');
const { loadWelcome, saveWelcome } = require('../../utils/welcomeManager');

function makeContainer(color, content) {
    const c = new ContainerBuilder().setAccentColor(color);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return { components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 };
}

function makeModal(customId, title, existingHeading, existingTitle, existingDesc, existingMessage) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title.slice(0, 45));

    const headingInput = new TextInputBuilder()
        .setCustomId('heading')
        .setLabel('Heading (text above the image)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('New Incomer')
        .setMaxLength(60)
        .setRequired(true);
    if (existingHeading) headingInput.setValue(existingHeading);

    const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('Image Title (on the card)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('{user} just joined the server')
        .setMaxLength(100)
        .setRequired(true);
    if (existingTitle) titleInput.setValue(existingTitle);

    const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Card Description ({user} {count})')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Member #{count}')
        .setMaxLength(100)
        .setRequired(true);
    if (existingDesc) descInput.setValue(existingDesc);

    const messageInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('Message below the image')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Welcome to {server}! Enjoy your stay~')
        .setMaxLength(300)
        .setRequired(false);
    if (existingMessage) messageInput.setValue(existingMessage);

    modal.addComponents(
        new ActionRowBuilder().addComponents(headingInput),
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(messageInput),
    );
    return modal;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the welcome system for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub => sub
            .setName('setup')
            .setDescription('Set the welcome channel and optional auto-role')
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('Channel to send welcome messages in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
            .addRoleOption(opt => opt
                .setName('role')
                .setDescription('Role to automatically assign on join (optional)')
                .setRequired(false)))

        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Show all welcome messages configured for this server'))

        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a welcome message')
            .addStringOption(opt => opt
                .setName('name')
                .setDescription('Name of the welcome to remove')
                .setRequired(true)))

        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('Create a new welcome message')
            .addStringOption(opt => opt
                .setName('name')
                .setDescription('Name for this welcome message')
                .setRequired(true)
                .setMaxLength(32)))

        .addSubcommand(sub => sub
            .setName('embed')
            .setDescription('Edit the title and description of the currently active welcome'))

        .addSubcommand(sub => sub
            .setName('switch')
            .setDescription('Switch which welcome message is active')
            .addStringOption(opt => opt
                .setName('name')
                .setDescription('Name of the welcome to make active')
                .setRequired(true))),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
        }

        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'setup') {
            await interaction.deferReply();
            const channel = interaction.options.getChannel('channel');
            const role    = interaction.options.getRole('role');

            const cfg     = loadWelcome(guildId);
            cfg.channelId = channel.id;
            if (role) cfg.roleId = role.id;

            let roleWarning = '';
            if (role) {
                const botMember = interaction.guild.members.me;
                if (!botMember.permissions.has('ManageRoles')) {
                    roleWarning = '\n\n> ⚠️ **Warning:** The bot is missing the **Manage Roles** permission. It won\'t be able to assign the role until this is enabled.';
                } else if (botMember.roles.highest.position <= role.position) {
                    roleWarning = `\n\n> ⚠️ **Warning:** The bot's highest role is **below** ${role}. Move the bot's role **above** it in Server Settings → Roles, otherwise it can't assign it.`;
                }
            }

            if (Object.keys(cfg.welcomes).length === 0) {
                cfg.welcomes['Default'] = {
                    heading:     'New Incomer',
                    title:       '{user} just joined the server',
                    description: 'Member #{count}',
                    message:     'Welcome to {server}! Enjoy your stay~ {mention}',
                };
                cfg.activeWelcome = 'Default';
            }
            saveWelcome(guildId, cfg);

            const lines = [
                `## ✅ Welcome System Configured`,
                ``,
                `**Channel:** ${channel}`,
                role ? `**Auto-Role:** ${role}` : `**Auto-Role:** None`,
                `**Active Welcome:** ${cfg.activeWelcome}`,
                roleWarning,
                ``,
                `-# Use \`/welcome create\` to make custom welcome messages, or \`/welcome embed\` to edit the current one.`,
            ].join('\n');

            return interaction.editReply(makeContainer(0x63B3ED, lines));
        }

        if (sub === 'list') {
            await interaction.deferReply();
            const cfg   = loadWelcome(guildId);
            const names = Object.keys(cfg.welcomes);

            if (names.length === 0) {
                return interaction.editReply(makeContainer(0xFFD700,
                    '## 📋 Welcome Messages\n\nNo welcome messages yet. Use `/welcome create <name>` to make one.',
                ));
            }

            const channelTxt = cfg.channelId ? `<#${cfg.channelId}>` : '*(not set)*';
            const roleTxt    = cfg.roleId    ? `<@&${cfg.roleId}>`   : '*(none)*';

            const list = names.map(name => {
                const w        = cfg.welcomes[name];
                const badge    = name === cfg.activeWelcome ? ' ✦ **Active**' : '';
                const msg = w.message ? `\n> **Message:** ${w.message}` : '';
                return `**${name}**${badge}\n> **Heading:** ${w.heading || 'New Incomer'}\n> **Title:** ${w.title}\n> **Desc:** *${w.description}*${msg}`;
            }).join('\n\n');

            const container = new ContainerBuilder().setAccentColor(0x7289DA);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## 📋 Welcome Messages\n\n**Channel:** ${channelTxt}  |  **Auto-Role:** ${roleTxt}`
            ));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(list));

            return interaction.editReply({ components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'remove') {
            await interaction.deferReply();
            const name = interaction.options.getString('name');
            const cfg  = loadWelcome(guildId);

            if (!cfg.welcomes[name]) {
                return interaction.editReply(makeContainer(0xEB4145,
                    `## ❌ Not Found\n\nNo welcome named **"${name}"** exists.\nAvailable: ${Object.keys(cfg.welcomes).join(', ') || 'none'}`,
                ));
            }

            if (cfg.activeWelcome === name && Object.keys(cfg.welcomes).length === 1) {
                return interaction.editReply(makeContainer(0xEB4145,
                    `## ❌ Cannot Remove\n\n**"${name}"** is the only welcome message and is currently active.\nCreate another welcome first before removing this one.`,
                ));
            }

            delete cfg.welcomes[name];
            if (cfg.activeWelcome === name) {
                cfg.activeWelcome = Object.keys(cfg.welcomes)[0];
            }
            saveWelcome(guildId, cfg);

            return interaction.editReply(makeContainer(0x57F287,
                `## 🗑️ Welcome Removed\n\nWelcome **"${name}"** has been deleted.` +
                (cfg.activeWelcome ? `\n**Now active:** ${cfg.activeWelcome}` : ''),
            ));
        }

        if (sub === 'create') {
            const name = interaction.options.getString('name');
            const cfg  = loadWelcome(guildId);

            if (cfg.welcomes[name]) {
                return interaction.reply({
                    content: `A welcome named **"${name}"** already exists. Use \`/welcome embed\` to edit the active one, or pick a different name.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.showModal(makeModal('welcome_create', `Create: ${name}`));

            const submitted = await interaction.awaitModalSubmit({
                time:   60_000,
                filter: i => i.user.id === interaction.user.id,
            }).catch(() => null);

            if (!submitted) return;

            const heading     = submitted.fields.getTextInputValue('heading');
            const title       = submitted.fields.getTextInputValue('title');
            const description = submitted.fields.getTextInputValue('description');
            const message     = submitted.fields.getTextInputValue('message') || '';

            cfg.welcomes[name] = { heading, title, description, message };
            if (!cfg.activeWelcome) cfg.activeWelcome = name;
            saveWelcome(guildId, cfg);

            const isFirst = Object.keys(cfg.welcomes).length === 1;
            const container = new ContainerBuilder().setAccentColor(0x57F287);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                [
                    `## ✅ Welcome Created`,
                    ``,
                    `**Name:** ${name}`,
                    `**Heading:** ${heading}`,
                    `**Title:** ${title}`,
                    `**Description:** ${description}`,
                    message ? `**Message:** ${message}` : '',
                    isFirst
                        ? `\n-# This is now your active welcome.`
                        : `\n-# Use \`/welcome switch ${name}\` to make it active.`,
                ].join('\n')
            ));
            return submitted.reply({ components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'embed') {
            const cfg = loadWelcome(guildId);

            if (!cfg.activeWelcome || !cfg.welcomes[cfg.activeWelcome]) {
                return interaction.reply({
                    content: 'No active welcome found. Use `/welcome create <name>` first.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const active = cfg.welcomes[cfg.activeWelcome];
            await interaction.showModal(
                makeModal('welcome_edit', `Edit: ${cfg.activeWelcome}`, active.heading, active.title, active.description, active.message)
            );

            const submitted = await interaction.awaitModalSubmit({
                time:   60_000,
                filter: i => i.user.id === interaction.user.id,
            }).catch(() => null);

            if (!submitted) return;

            cfg.welcomes[cfg.activeWelcome].heading     = submitted.fields.getTextInputValue('heading');
            cfg.welcomes[cfg.activeWelcome].title       = submitted.fields.getTextInputValue('title');
            cfg.welcomes[cfg.activeWelcome].description = submitted.fields.getTextInputValue('description');
            cfg.welcomes[cfg.activeWelcome].message     = submitted.fields.getTextInputValue('message') || '';
            saveWelcome(guildId, cfg);

            const w = cfg.welcomes[cfg.activeWelcome];
            const container = new ContainerBuilder().setAccentColor(0x63B3ED);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                [
                    `## ✏️ Welcome Updated`,
                    ``,
                    `**Active:** ${cfg.activeWelcome}`,
                    `**New Heading:** ${w.heading}`,
                    `**New Title:** ${w.title}`,
                    `**New Description:** ${w.description}`,
                    w.message ? `**New Message:** ${w.message}` : '',
                ].filter(Boolean).join('\n')
            ));
            return submitted.reply({ components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'switch') {
            await interaction.deferReply();
            const name = interaction.options.getString('name');
            const cfg  = loadWelcome(guildId);

            if (!cfg.welcomes[name]) {
                return interaction.editReply(makeContainer(0xEB4145,
                    `## ❌ Not Found\n\nNo welcome named **"${name}"** exists.\nAvailable: ${Object.keys(cfg.welcomes).join(', ') || 'none'}`,
                ));
            }

            if (cfg.activeWelcome === name) {
                return interaction.editReply(makeContainer(0xFFD700,
                    `## ℹ️ Already Active\n\n**"${name}"** is already the active welcome.`,
                ));
            }

            const previous    = cfg.activeWelcome;
            cfg.activeWelcome = name;
            saveWelcome(guildId, cfg);

            return interaction.editReply(makeContainer(0x57F287,
                `## 🔄 Welcome Switched\n\n**Previous:** ${previous || 'none'}\n**Now Active:** ${name}`,
            ));
        }
    },
};
