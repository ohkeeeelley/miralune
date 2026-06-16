const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    AttachmentBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const {
    loadConfig, saveConfig,
    getTicketByChannel, getTicketByUser,
    createTicket, closeTicket, nextTicketNumber
} = require('../../utils/ticketManager');

const { sendOrFallback } = require('../../utils/safeReply');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket system')
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close the current ticket channel')
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a user to the current ticket')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to add')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a user from the current ticket')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Configure the ticket system for this server')
                .addChannelOption(opt =>
                    opt.setName('category')
                        .setDescription('Category where ticket channels will be created')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Support role that can see all tickets')
                        .setRequired(true)
                )
                .addChannelOption(opt =>
                    opt.setName('log_channel')
                        .setDescription('Channel to log ticket events (optional)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('role')
                .setDescription('Change the support role for tickets')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('New support role')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Post a customizable ticket panel in a channel (Manage Channels required)')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to post the panel to')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'setup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return sendOrFallback(interaction, { content: 'You need **Manage Server** permission to configure tickets.', flags: MessageFlags.Ephemeral });
            }
            const category = interaction.options.getChannel('category');
            const role = interaction.options.getRole('role');
            const logChannel = interaction.options.getChannel('log_channel');

            const cfg = loadConfig(guildId);
            cfg.categoryId = category.id;
            cfg.roleId = role.id;
            if (logChannel) cfg.logChannelId = logChannel.id;
            saveConfig(guildId, cfg);

            const container = new ContainerBuilder().setAccentColor(0x57F287);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent('## ✅ Ticket System Configured'));
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `📁 **Category:** ${category.name}\n` +
                `🛡️ **Support Role:** <@&${role.id}>\n` +
                (logChannel ? `📋 **Log Channel:** <#${logChannel.id}>\n` : '') +
                `\nTickets will now be created under **${category.name}**. Use \`/ticket setup\` to reconfigure anytime.`
            ));
            return sendOrFallback(interaction, { components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'role') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return sendOrFallback(interaction, { content: 'You need **Manage Server** permission to change the support role.', flags: MessageFlags.Ephemeral });
            }
            const role = interaction.options.getRole('role');
            const cfg = loadConfig(guildId);
            cfg.roleId = role.id;
            saveConfig(guildId, cfg);

            const container = new ContainerBuilder().setAccentColor(0x57F287);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ Support Role Updated\n> Tickets will now be visible to <@&${role.id}>.`));
            return sendOrFallback(interaction, { components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'create') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return sendOrFallback(interaction, { content: 'You need **Manage Channels** permission to post a ticket panel.', flags: MessageFlags.Ephemeral });
            }
            const cfg = loadConfig(guildId);
            if (!cfg.categoryId || !cfg.roleId) {
                return sendOrFallback(interaction, { content: 'Please run `/ticket setup` first before posting a panel.', flags: MessageFlags.Ephemeral });
            }
            const targetChannel = interaction.options.getChannel('channel');

            const modal = new ModalBuilder()
                .setCustomId(`ticket_panel_modal:${targetChannel.id}`)
                .setTitle('Customize Ticket Panel');
            modal.addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('panel_title')
                        .setLabel('Title')
                        .setStyle(TextInputStyle.Short)
                        .setValue('🎫 Support Tickets')
                        .setMaxLength(100)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('panel_description')
                        .setLabel('Description')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue('Need help or have a question?\nClick the button below to open a private support ticket and a staff member will assist you.')
                        .setMaxLength(1000)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('panel_button_text')
                        .setLabel('Button Text')
                        .setStyle(TextInputStyle.Short)
                        .setValue('Create Ticket')
                        .setMaxLength(80)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('panel_button_color')
                        .setLabel('Button Color (blue, green, red, grey)')
                        .setStyle(TextInputStyle.Short)
                        .setValue('blue')
                        .setMaxLength(10)
                        .setRequired(true)
                )
            );
            await interaction.showModal(modal);
            return;
        }

        if (sub === 'close') {
            return closeTicketChannel(interaction);
        }

        if (sub === 'add') {
            const cfg = loadConfig(guildId);
            const ticket = getTicketByChannel(guildId, interaction.channel.id);
            if (!ticket) {
                return sendOrFallback(interaction, { content: 'This command must be used inside a ticket channel.', flags: MessageFlags.Ephemeral });
            }
            const isOwner = ticket.ownerId === interaction.user.id;
            const hasRole = cfg.roleId && interaction.member.roles.cache.has(cfg.roleId);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
            if (!isOwner && !hasRole && !isAdmin) {
                return sendOrFallback(interaction, { content: 'Only the ticket owner or support staff can add users.', flags: MessageFlags.Ephemeral });
            }
            const target = interaction.options.getUser('user');
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await interaction.channel.permissionOverwrites.edit(target.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            const container = new ContainerBuilder().setAccentColor(0x57F287);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`✅ <@${target.id}> has been added to this ticket.`));
            return sendOrFallback(interaction, { components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }

        if (sub === 'remove') {
            const cfg = loadConfig(guildId);
            const ticket = getTicketByChannel(guildId, interaction.channel.id);
            if (!ticket) {
                return sendOrFallback(interaction, { content: 'This command must be used inside a ticket channel.', flags: MessageFlags.Ephemeral });
            }
            const isOwner = ticket.ownerId === interaction.user.id;
            const hasRole = cfg.roleId && interaction.member.roles.cache.has(cfg.roleId);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);
            if (!isOwner && !hasRole && !isAdmin) {
                return sendOrFallback(interaction, { content: 'Only the ticket owner or support staff can remove users.', flags: MessageFlags.Ephemeral });
            }
            const target = interaction.options.getUser('user');
            if (target.id === ticket.ownerId) {
                return sendOrFallback(interaction, { content: "You can't remove the ticket owner.", flags: MessageFlags.Ephemeral });
            }
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            await interaction.channel.permissionOverwrites.edit(target.id, {
                ViewChannel: false
            });
            const container = new ContainerBuilder().setAccentColor(0xED4245);
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ <@${target.id}> has been removed from this ticket.`));
            return sendOrFallback(interaction, { components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
        }
    }
};

async function openTicket(interaction, user, title, description = '') {
    const guildId = interaction.guild.id;
    const cfg = loadConfig(guildId);

    if (!cfg.categoryId || !cfg.roleId) {
        return sendOrFallback(interaction, {
            content: 'The ticket system has not been set up yet. Ask an admin to run `/ticket setup`.',
            flags: MessageFlags.Ephemeral
        });
    }

    const existing = getTicketByUser(guildId, user.id);
    if (existing) {
        return sendOrFallback(interaction, {
            content: `You already have an open ticket: <#${existing.channelId}>`,
            flags: MessageFlags.Ephemeral
        });
    }

    const isModal = interaction.isModalSubmit?.();
    if (isModal) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
        await sendOrFallback(interaction, { content: 'Creating your ticket...', flags: MessageFlags.Ephemeral });
    }

    const ticketNumber = nextTicketNumber(guildId);
    const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

    const category = await interaction.guild.channels.fetch(cfg.categoryId).catch(() => null);
    if (!category) {
        const errMsg = 'Ticket category not found. Please ask an admin to re-run `/ticket setup`.';
        if (isModal) return interaction.editReply({ content: errMsg }).catch(() => {});
        return sendOrFallback(interaction, { content: errMsg, flags: MessageFlags.Ephemeral });
    }

    const channel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: cfg.categoryId,
        topic: `Ticket #${ticketNumber} | ${user.tag} | ${title}`,
        permissionOverwrites: [
            { id: interaction.guild.id, deny: ['ViewChannel'] },
            { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
            { id: cfg.roleId, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages', 'AttachFiles'] },
            { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels', 'ManageMessages'] }
        ]
    });

    createTicket(guildId, ticketNumber, user.id, channel.id);

    const welcomeContainer = new ContainerBuilder().setAccentColor(0x5865F2);
    welcomeContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎫 ${title}`));
    welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    welcomeContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `<@${user.id}> <@&${cfg.roleId}> Welcome\n\n` +
        (description ? `${description}\n\n` : '') +
        `Support will be with you shortly.\nTo close this ticket press the close button.`
    ));
    welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    welcomeContainer.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Secondary)
    ));

    await channel.send({
        components: [welcomeContainer.toJSON()],
        flags: MessageFlags.IsComponentsV2
    });

    if (cfg.logChannelId) {
        const logChannel = await interaction.guild.channels.fetch(cfg.logChannelId).catch(() => null);
        if (logChannel) {
            const logContainer = new ContainerBuilder().setAccentColor(0x5865F2);
            logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `📋 **Ticket Opened** — <#${channel.id}>\n> **User:** <@${user.id}> (${user.tag})\n> **Title:** ${title}\n> **Ticket #:** ${ticketNumber}`
            ));
            await logChannel.send({ components: [logContainer.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    }

    if (isModal) {
        await interaction.editReply({ content: `✅ Your ticket has been created: <#${channel.id}>` }).catch(() => {});
    } else {
        await interaction.editReply({ content: `✅ Your ticket has been created: <#${channel.id}>` }).catch(() => {});
    }
}

async function closeTicketChannel(interaction) {
    const guildId = interaction.guild.id;
    const cfg = loadConfig(guildId);
    const ticket = getTicketByChannel(guildId, interaction.channel.id);

    if (!ticket) {
        return sendOrFallback(interaction, { content: 'This command must be used inside a ticket channel.', flags: MessageFlags.Ephemeral });
    }

    const isOwner = ticket.ownerId === interaction.user.id;
    const hasRole = cfg.roleId && interaction.member.roles.cache.has(cfg.roleId);
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

    if (!isOwner && !hasRole && !isAdmin) {
        return sendOrFallback(interaction, { content: 'Only the ticket owner or support staff can close this ticket.', flags: MessageFlags.Ephemeral });
    }

    const closingContainer = new ContainerBuilder().setAccentColor(0xED4245);
    closingContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 🔒 Ticket Closed\n> Closed by <@${interaction.user.id}>. This channel will be deleted in 5 seconds.`
    ));
    await sendOrFallback(interaction, { components: [closingContainer.toJSON()], flags: MessageFlags.IsComponentsV2 });

    closeTicket(guildId, interaction.channel.id);

    if (cfg.logChannelId) {
        const logChannel = await interaction.guild.channels.fetch(cfg.logChannelId).catch(() => null);
        if (logChannel) {
            const logContainer = new ContainerBuilder().setAccentColor(0xED4245);
            logContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `🔒 **Ticket Closed** — Ticket #${ticket.number}\n> **Closed by:** <@${interaction.user.id}>\n> **Owner:** <@${ticket.ownerId}>`
            ));
            await logChannel.send({ components: [logContainer.toJSON()], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    }

    setTimeout(() => {
        interaction.channel.delete().catch(() => {});
    }, 5000);
}

module.exports.openTicket = openTicket;
module.exports.closeTicketChannel = closeTicketChannel;

async function handlePanelModal(interaction, channelId) {
    const title = interaction.fields.getTextInputValue('panel_title');
    const description = interaction.fields.getTextInputValue('panel_description');
    const buttonText = interaction.fields.getTextInputValue('panel_button_text') || 'Create Ticket';
    const buttonColorRaw = (interaction.fields.getTextInputValue('panel_button_color') || 'blue').toLowerCase().trim();

    const colorMap = {
        blue: ButtonStyle.Primary,
        green: ButtonStyle.Success,
        red: ButtonStyle.Danger,
        grey: ButtonStyle.Secondary,
        gray: ButtonStyle.Secondary
    };
    const buttonStyle = colorMap[buttonColorRaw] ?? ButtonStyle.Primary;

    const targetChannel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (!targetChannel) {
        return interaction.reply({ content: '❌ Could not find the target channel. Please try `/ticket create` again.', flags: MessageFlags.Ephemeral });
    }

    const panel = new ContainerBuilder().setAccentColor(0x5865F2);
    panel.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
    panel.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    panel.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));
    panel.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    panel.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel(buttonText).setEmoji('🎫').setStyle(buttonStyle)
    ));

    await targetChannel.send({ components: [panel.toJSON()], flags: MessageFlags.IsComponentsV2 });
    await interaction.reply({ content: `✅ Ticket panel sent to <#${targetChannel.id}>.`, flags: MessageFlags.Ephemeral });
}

async function handleOpenModal(interaction) {
    const title = 'Support Ticket';
    const description = '';
    await openTicket(interaction, interaction.user, title, description);
}

module.exports.handlePanelModal = handlePanelModal;
module.exports.handleOpenModal = handleOpenModal;
