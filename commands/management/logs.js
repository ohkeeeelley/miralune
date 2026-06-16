const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    MessageFlags,
} = require('discord.js');
const { LOG_TYPES, loadLogConfig, saveLogConfig } = require('../../utils/logsManager');

function buildMain(guildId) {
    const cfg = loadLogConfig(guildId);

    const lines = Object.entries(LOG_TYPES).map(([key, { emoji, label }]) => {
        const cat = cfg[key];
        const dot = cat.enabled ? '🟢' : '🔴';
        const ch  = cat.channelId ? `<#${cat.channelId}>` : '*Not set*';
        return `${dot} ${emoji} **${label}** → ${ch}`;
    }).join('\n');

    const c = new ContainerBuilder().setAccentColor(0x5865F2);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 📋 Log Settings\n\nSelect a category to configure.\n\n${lines}`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const keys = Object.keys(LOG_TYPES);
    const row1 = new ActionRowBuilder().addComponents(
        keys.slice(0, 3).map(k => new ButtonBuilder()
            .setCustomId(`logs:cat:${k}`)
            .setLabel(LOG_TYPES[k].label)
            .setEmoji(LOG_TYPES[k].emoji)
            .setStyle(ButtonStyle.Secondary))
    );
    const row2 = new ActionRowBuilder().addComponents(
        keys.slice(3, 6).map(k => new ButtonBuilder()
            .setCustomId(`logs:cat:${k}`)
            .setLabel(LOG_TYPES[k].label)
            .setEmoji(LOG_TYPES[k].emoji)
            .setStyle(ButtonStyle.Secondary))
    );
    c.addActionRowComponents(row1);
    c.addActionRowComponents(row2);

    return [c.toJSON()];
}

function buildCategory(guildId, type) {
    const cfg  = loadLogConfig(guildId);
    const cat  = cfg[type];
    const info = LOG_TYPES[type];

    const dot = cat.enabled ? '🟢 Enabled' : '🔴 Disabled';
    const ch  = cat.channelId ? `<#${cat.channelId}>` : '*Not set*';

    const c = new ContainerBuilder().setAccentColor(cat.enabled ? 0x57F287 : 0xEB4145);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${info.emoji} ${info.label} Logs\n\n${info.description}\n\n**Status:** ${dot}\n**Channel:** ${ch}`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const btns = [
        new ButtonBuilder()
            .setCustomId(`logs:toggle:${type}`)
            .setLabel(cat.enabled ? 'Disable' : 'Enable')
            .setStyle(cat.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`logs:setch:${type}`)
            .setLabel('Set Channel')
            .setEmoji('📌')
            .setStyle(ButtonStyle.Secondary),
    ];
    if (cat.channelId) {
        btns.push(new ButtonBuilder()
            .setCustomId(`logs:clearch:${type}`)
            .setLabel('Clear Channel')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger));
    }
    btns.push(new ButtonBuilder()
        .setCustomId('logs:main')
        .setLabel('Back')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Secondary));

    c.addActionRowComponents(new ActionRowBuilder().addComponents(btns));
    return [c.toJSON()];
}

function buildChannelSelect(type) {
    const info = LOG_TYPES[type];

    const c = new ContainerBuilder().setAccentColor(0x5865F2);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 📌 Set Channel for ${info.emoji} ${info.label}\n\nSelect a text channel from the dropdown below.`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId(`logs:select:${type}`)
            .setChannelTypes(ChannelType.GuildText)
            .setPlaceholder('Select a channel')
    ));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`logs:cat:${type}`)
            .setLabel('Cancel')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
    ));

    return [c.toJSON()];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Configure server logging')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        const guildId = interaction.guild.id;

        const msg = await interaction.reply({
            components: buildMain(guildId),
            flags: MessageFlags.IsComponentsV2,
            withResponse: true,
        });

        const collector = (await interaction.fetchReply()).createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 300_000,
        });

        collector.on('collect', async i => {
            const parts  = i.customId.split(':');
            const action = parts[1];
            const type   = parts[2];

            try {
                if (action === 'main') {
                    await i.update({ components: buildMain(guildId), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'cat') {
                    await i.update({ components: buildCategory(guildId, type), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'toggle') {
                    const cfg = loadLogConfig(guildId);
                    cfg[type].enabled = !cfg[type].enabled;
                    saveLogConfig(guildId, cfg);
                    await i.update({ components: buildCategory(guildId, type), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'setch') {
                    await i.update({ components: buildChannelSelect(type), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'clearch') {
                    const cfg = loadLogConfig(guildId);
                    cfg[type].channelId = null;
                    saveLogConfig(guildId, cfg);
                    await i.update({ components: buildCategory(guildId, type), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'select') {
                    const channelId = i.values[0];
                    const cfg = loadLogConfig(guildId);
                    cfg[type].channelId = channelId;
                    saveLogConfig(guildId, cfg);
                    await i.update({ components: buildCategory(guildId, type), flags: MessageFlags.IsComponentsV2 });
                }
            } catch (e) {
                console.error('[Logs] Interaction error:', e);
            }
        });
    },
};
