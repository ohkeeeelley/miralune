const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
    ChannelType,
} = require('discord.js');
const {
    loadServerSettings,
    toggleLeveling,
    toggleModeration,
    setLevelUpChannel,
} = require('../../utils/serverSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure bot features for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ 
                content: 'This command can only be used in a server.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        await interaction.deferReply();

        // Show main menu
        await showMainMenu(interaction);
    },
};

/**
 * Show the main settings menu
 */
async function showMainMenu(interaction) {
    const settings = loadServerSettings(interaction.guild.id);
    
    const container = new ContainerBuilder().setAccentColor(0x5865F2);
    
    const levelStatus = settings.leveling?.enabled !== false ? '✅ Enabled' : '❌ Disabled';
    const moderationStatus = settings.moderation?.enabled !== false ? '✅ Enabled' : '❌ Disabled';
    
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ⚙️ Server Settings\n\n` +
            `Configure bot features for **${interaction.guild.name}**\n\n` +
            `### Current Status:\n` +
            `**Leveling System:** ${levelStatus}\n` +
            `**Moderation Tools:** ${moderationStatus}\n\n` +
            `-# Select a category to configure:`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('settings_leveling')
            .setLabel('Leveling System')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
        new ButtonBuilder()
            .setCustomId('settings_moderation')
            .setLabel('Moderation')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️')
    );

    await interaction.editReply({
        components: [container.toJSON(), buttons],
        flags: MessageFlags.IsComponentsV2,
    });
}

/**
 * Show leveling settings menu
 */
async function showLevelingMenu(interaction) {
    const settings = loadServerSettings(interaction.guild.id);
    const isEnabled = settings.leveling?.enabled !== false;
    const levelUpChannel = settings.leveling?.levelUpChannel;
    
    let channelMention = 'Same channel as message';
    if (levelUpChannel) {
        const channel = interaction.guild.channels.cache.get(levelUpChannel);
        channelMention = channel ? `<#${levelUpChannel}>` : 'Channel not found';
    }
    
    const container = new ContainerBuilder().setAccentColor(isEnabled ? 0x57F287 : 0xED4245);
    
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 📊 Leveling System\n\n` +
            `**Status:** ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
            (isEnabled 
                ? `**Level-up Channel:** ${channelMention}\n\n` +
                  `When enabled, users gain XP from messages and receive level-up notifications.\n\n` +
                  `-# Configure the settings below:`
                : `**Leveling is currently disabled.**\n\n` +
                  `Users will not gain XP or see level-up messages.\n\n` +
                  `-# Enable it to configure additional options:`
            )
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const buttons = new ActionRowBuilder();
    
    // Toggle button
    buttons.addComponents(
        new ButtonBuilder()
            .setCustomId('settings_leveling_toggle')
            .setLabel(isEnabled ? 'Disable' : 'Enable')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(isEnabled ? '❌' : '✅')
    );
    
    // Channel button (only if enabled)
    if (isEnabled) {
        buttons.addComponents(
            new ButtonBuilder()
                .setCustomId('settings_leveling_channel')
                .setLabel('Set Channel')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📢')
        );
    }
    
    // Back button
    buttons.addComponents(
        new ButtonBuilder()
            .setCustomId('settings_back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );

    await interaction.editReply({
        components: [container.toJSON(), buttons],
        flags: MessageFlags.IsComponentsV2,
    });
}

/**
 * Show moderation settings menu
 */
async function showModerationMenu(interaction) {
    const settings = loadServerSettings(interaction.guild.id);
    const isEnabled = settings.moderation?.enabled !== false;
    
    const container = new ContainerBuilder().setAccentColor(isEnabled ? 0x57F287 : 0xED4245);
    
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 🛡️ Moderation Tools\n\n` +
            `**Status:** ${isEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
            (isEnabled 
                ? `Moderation commands (kick, ban, mute, warn, etc.) are available.\n\n` +
                  `-# Moderators can use these tools to manage the server.`
                : `**Moderation tools are currently disabled.**\n\n` +
                  `Commands like /kick, /ban, /mute, and /warn will not work.\n\n` +
                  `-# Enable them to allow moderators to use these tools.`
            )
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('settings_moderation_toggle')
            .setLabel(isEnabled ? 'Disable' : 'Enable')
            .setStyle(isEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(isEnabled ? '❌' : '✅'),
        new ButtonBuilder()
            .setCustomId('settings_back')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );

    await interaction.editReply({
        components: [container.toJSON(), buttons],
        flags: MessageFlags.IsComponentsV2,
    });
}

/**
 * Show channel selector for level-up notifications
 */
async function showChannelSelector(interaction) {
    const settings = loadServerSettings(interaction.guild.id);
    const currentChannel = settings.leveling?.levelUpChannel;
    
    const container = new ContainerBuilder().setAccentColor(0x5865F2);
    
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## 📢 Level-up Notification Channel\n\n` +
            `Select where level-up messages should be sent:\n\n` +
            `-# Choose a channel from the dropdown below:`
        )
    );

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    // Get text channels
    const textChannels = interaction.guild.channels.cache
        .filter(ch => ch.type === ChannelType.GuildText)
        .sort((a, b) => a.position - b.position)
        .first(25); // Discord limits to 25 options

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('settings_leveling_channel_select')
        .setPlaceholder('Select a channel...')
        .addOptions(
            {
                label: 'Same channel as message',
                description: 'Send level-up messages in the channel where user is chatting',
                value: 'same_channel',
                emoji: '💬',
                default: !currentChannel,
            },
            ...textChannels.map(ch => ({
                label: `#${ch.name}`,
                description: ch.topic?.slice(0, 100) || 'No description',
                value: ch.id,
                emoji: '📝',
                default: ch.id === currentChannel,
            }))
        );

    const backButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('settings_leveling')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('◀️')
    );

    await interaction.editReply({
        components: [
            container.toJSON(),
            new ActionRowBuilder().addComponents(selectMenu),
            backButton,
        ],
        flags: MessageFlags.IsComponentsV2,
    });
}

// Export helper functions for button handling
module.exports.showMainMenu = showMainMenu;
module.exports.showLevelingMenu = showLevelingMenu;
module.exports.showModerationMenu = showModerationMenu;
module.exports.showChannelSelector = showChannelSelector;
module.exports.toggleLeveling = toggleLeveling;
module.exports.toggleModeration = toggleModeration;
module.exports.setLevelUpChannel = setLevelUpChannel;
