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
const { loadStarboard, saveStarboard } = require('../../utils/starboardManager');

function buildMain(guildId) {
    const cfg = loadStarboard(guildId);

    const status = cfg.enabled ? '🟢 Enabled' : '🔴 Disabled';
    const ch     = cfg.channelId ? `<#${cfg.channelId}>` : '*Not set*';

    const c = new ContainerBuilder().setAccentColor(cfg.enabled ? 0xFFD700 : 0x5865F2);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ⭐ Starboard Settings\n\n` +
        `**Status:** ${status}\n` +
        `**Channel:** ${ch}\n` +
        `**Emoji:** ${cfg.emoji}\n` +
        `**Threshold:** ${cfg.threshold} reaction(s)`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sb:toggle')
            .setLabel(cfg.enabled ? 'Disable' : 'Enable')
            .setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('sb:setch')
            .setLabel('Set Channel')
            .setEmoji('📌')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('sb:threshold')
            .setLabel('Threshold')
            .setEmoji('🔢')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('sb:emoji')
            .setLabel('Emoji')
            .setEmoji('✨')
            .setStyle(ButtonStyle.Secondary),
    );
    c.addActionRowComponents(row1);

    return [c.toJSON()];
}

function buildChannelSelect() {
    const c = new ContainerBuilder().setAccentColor(0xFFD700);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 📌 Set Starboard Channel\n\nSelect a text channel from the dropdown below.`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder()
            .setCustomId('sb:selectch')
            .setChannelTypes(ChannelType.GuildText)
            .setPlaceholder('Select a channel')
    ));
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sb:main').setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
    ));
    return [c.toJSON()];
}

function buildThresholdPicker(guildId) {
    const cfg = loadStarboard(guildId);
    const c = new ContainerBuilder().setAccentColor(0xFFD700);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 🔢 Set Threshold\n\nHow many reactions are needed for a message to appear on the starboard?\n\n**Current:** ${cfg.threshold}`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    const row = new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 5, 10].map(n => new ButtonBuilder()
            .setCustomId(`sb:setth:${n}`)
            .setLabel(`${n}`)
            .setStyle(n === cfg.threshold ? ButtonStyle.Primary : ButtonStyle.Secondary))
    );
    c.addActionRowComponents(row);
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sb:main').setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
    ));
    return [c.toJSON()];
}

function buildEmojiPicker(guildId) {
    const cfg = loadStarboard(guildId);
    const emojis = ['⭐', '🌟', '💫', '✨', '🔥'];
    const c = new ContainerBuilder().setAccentColor(0xFFD700);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ✨ Set Emoji\n\nWhich emoji should trigger the starboard?\n\n**Current:** ${cfg.emoji}`
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    const row = new ActionRowBuilder().addComponents(
        ...emojis.map(e => new ButtonBuilder()
            .setCustomId(`sb:setemoji:${e}`)
            .setLabel(e)
            .setStyle(e === cfg.emoji ? ButtonStyle.Primary : ButtonStyle.Secondary))
    );
    c.addActionRowComponents(row);
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sb:main').setLabel('Back').setEmoji('◀️').setStyle(ButtonStyle.Secondary)
    ));
    return [c.toJSON()];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('starboard')
        .setDescription('Configure the starboard')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        const guildId = interaction.guild.id;

        await interaction.reply({
            components: buildMain(guildId),
            flags: MessageFlags.IsComponentsV2,
        });

        const collector = (await interaction.fetchReply()).createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 300_000,
        });

        collector.on('collect', async i => {
            const parts  = i.customId.split(':');
            const action = parts[1];

            try {
                if (action === 'main') {
                    await i.update({ components: buildMain(guildId), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'toggle') {
                    const cfg = loadStarboard(guildId);
                    if (!cfg.channelId && !cfg.enabled) {
                        await i.reply({ content: 'Set a starboard channel first.', flags: MessageFlags.Ephemeral });
                        return;
                    }
                    cfg.enabled = !cfg.enabled;
                    saveStarboard(guildId, cfg);
                    await i.update({ components: buildMain(guildId), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'setch') {
                    await i.update({ components: buildChannelSelect(), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'selectch') {
                    const channelId = i.values[0];
                    const cfg = loadStarboard(guildId);
                    cfg.channelId = channelId;
                    saveStarboard(guildId, cfg);
                    await i.update({ components: buildMain(guildId), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'threshold') {
                    await i.update({ components: buildThresholdPicker(guildId), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'setth') {
                    const val = parseInt(parts[2]);
                    const cfg = loadStarboard(guildId);
                    cfg.threshold = val;
                    saveStarboard(guildId, cfg);
                    await i.update({ components: buildThresholdPicker(guildId), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'emoji') {
                    await i.update({ components: buildEmojiPicker(guildId), flags: MessageFlags.IsComponentsV2 });
                }
                else if (action === 'setemoji') {
                    const emoji = parts[2];
                    const cfg = loadStarboard(guildId);
                    cfg.emoji = emoji;
                    saveStarboard(guildId, cfg);
                    await i.update({ components: buildEmojiPicker(guildId), flags: MessageFlags.IsComponentsV2 });
                }
            } catch (e) {
                console.error('[Starboard] Interaction error:', e);
            }
        });
    },
};
