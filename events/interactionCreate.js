const tttGames = require('../commands/minigames/tictactoe.js').games;
const TicTacToeGrid = require('../model/TicTacToeGrid.js');
const TicTacToeImageGrid = require('../model/TicTacToeImageGrid');
const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, StringSelectMenuBuilder, AttachmentBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { Colors } = require('../commands/clan/utils');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getProfile, updateProfile, createProfile, flushProfiles } = require('../utils/profileManager');
const ProfileRenderer = require('../model/ProfileRenderer');

async function buildProfilePreview(user, profile) {
    const bakeryLevel = profile.BakeryLevel || profile.bakery?.level || 1;
    const bakeryXP    = profile.BakeryXP    ?? profile.bakery?.xp ?? 0;
    const nextLevelXP = profile.NextLevelXP || profile.bakery?.nextLevelXP || (bakeryLevel * 1000);
    const rendererProfile = {
        createdAt:        profile.createdAt || new Date().toISOString(),
        profileId:        profile.profileId || user.id,
        motto:            profile.Motto || '',
        bakeryRank:       profile.bakeryRank || null,
        stats:            { allTimeSold: profile.stats?.allTimeSold || 0 },
        server:           { BakeryLevel: bakeryLevel, BakeryXP: bakeryXP, NextLevelXP: nextLevelXP },
        streak:           profile.stats?.streak ?? 0,
        bestStreak:       profile.stats?.beststreak ?? 0,
        questCompleted:   profile.stats?.questcompleted ?? 0,
        poniesBefriended: profile.stats?.totalponiesbefriended ?? profile.befriendedPonies?.length ?? 0,
        totalMessages:    profile.stats?.totalMessages ?? 0,
        favoritePony:     profile.favs?.[0]?.name || null,
        tags: [
            (profile.ProfileTags?.tag1 || 'No Tag').slice(0, 24),
            (profile.ProfileTags?.tag2 || 'No Tag').slice(0, 24),
            (profile.ProfileTags?.tag3 || 'No Tag').slice(0, 24),
            (profile.ProfileTags?.tag4 || 'No Tag').slice(0, 24),
        ],
        location:         profile.CurrentLocation || null,
        progressColor:    profile.ProfileProgressColor || null,
        profileBackground: profile.ActiveProfileBackground || null,
    };
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
    const buf = await ProfileRenderer.generateProfileImage(rendererProfile, user.username, avatarURL);
    return new AttachmentBuilder(buf, { name: 'profile_preview.png' });
}
const { updateBakeryProduction } = require('../utils/bakeryProduction');
const { performBake, buildBakeryEmbed, loadBakeries, NO_PROFILE_ERROR } = require('../commands/economy/_bakeryUtils');
const myMenu = require('../commands/economy/myMenu');
const { sendOrFallback } = require('../utils/safeReply');
const { checkServerMembership } = require('../utils/checkServer');
const { sendNoProfile, isNoProfileMessage } = require('../utils/noProfileResponse');

const BOOSTER_IDS = [
    '853496137130835970'
];

function getActionRowsOnly(containerJSON) {
  if (!containerJSON) return [];
  if (Array.isArray(containerJSON)) {
    return containerJSON.filter(comp => comp && comp.type === 1);
  }
  return [];
}

let _alertsCache = null;
let _alertsCacheTime = 0;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {

            const _cid = interaction.customId || '';
            const _isTradeSlashCmd = interaction.isChatInputCommand() && interaction.commandName === 'trade';
            const _tradeInteraction = _cid.startsWith('trade:') || _isTradeSlashCmd;
            const _tradeDeferrable = !_isTradeSlashCmd && _tradeInteraction && (
                (interaction.isButton() && (_cid.includes(':accept:') || _cid.includes(':reject:') || _cid.includes(':confirm:') || _cid.includes(':cancel:') || _cid.includes(':pony:'))) ||
                (interaction.isStringSelectMenu() && _cid.includes(':ponyselect:'))
            );

            const _levelUiDeferrable = interaction.isButton() && (_cid === 'level_customize' || _cid === 'level_change_progress_style');
            if (_tradeDeferrable || _levelUiDeferrable) {
                try {
                    await interaction.deferUpdate();
                } catch (e) {

                    if (e.code === 10062 || e.code === 40060) return;
                    throw e;
                }
            }

            if (!_tradeInteraction) {
                setImmediate(() => {
                    checkServerMembership(interaction.user.id, interaction.client).catch(() => {});
                });
            }

            if (!interaction.isChatInputCommand() && !_tradeInteraction) {
                setImmediate(() => {
                    updateBakeryProduction(interaction.user.id, interaction.client, false);
                });
            }

            if (interaction.customId) {
                console.log('interactionCreate: button/component clicked ->', interaction.customId, 'by', interaction.user.id);
                const cid = interaction.customId;

                if (cid.startsWith('vsetup:') || cid === 'verification:start') {
                    try {
                        const verificationSetup = require('../commands/management/verification_setup.js');
                        if (cid.startsWith('vsetup:')) {
                            const handledSetup = await verificationSetup.handleSetupComponent(interaction);
                            if (handledSetup) return;
                        }
                        if (cid === 'verification:start') {
                            const handledVerify = await verificationSetup.handleVerificationButton(interaction);
                            if (handledVerify) return;
                        }
                    } catch (e) {
                        console.error('verification interaction handler error:', e);
                        try {
                            await interaction.reply({ content: 'An error occurred while handling verification.', flags: MessageFlags.Ephemeral });
                        } catch (_) {}
                        return;
                    }
                }

                if (cid.startsWith('help_')) {
                    console.log('Help menu button pressed, deferring update...');
                    try {
                        await interaction.deferUpdate();
                        console.log('Help menu: interaction deferred, rendering menu...');
                    } catch (e) {
                        console.error('Help menu: Error deferring update:', e);
                        return;
                    }
                    const { renderHelpMenu } = require('../commands/utils/help.js');
                    let category = 'collections';
                    if (cid === 'help_collections') category = 'collections';
                    else if (cid === 'help_statistics') category = 'statistics';
                    else if (cid === 'help_features') category = 'features';
                    else if (cid === 'help_utility') category = 'utility';
                    else if (cid === 'help_admin') category = 'admin';
                    console.log('Help menu: rendering category', category);

                    const container = renderHelpMenu(category);
                    try {
                        console.log('Help menu: sending reply...');

                        await interaction.editReply({
                            components: [container.toJSON()],
                            flags: MessageFlags.IsComponentsV2
                        });
                        console.log('Help menu: reply sent successfully');
                    } catch (e) {
                        console.error('Help menu: Error updating:', e);
                    }
                    return;
                }

                if (cid === 'ttt_accept' || cid === 'ttt_decline' || cid.startsWith('ttt_')) {

                    try {
                        const tictactoe = interaction.client.commands.get('tictactoe');
                        if (tictactoe && tictactoe.handleInteraction) {
                            await tictactoe.handleInteraction(interaction);
                            return;
                        }
                    } catch (e) {
                        console.error('Tictactoe handler error:', e);
                    }

                    if (interaction.deferred || interaction.replied) {
                        await interaction.editReply({ content: 'Game interaction failed.', flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ content: 'Game interaction failed.', flags: MessageFlags.Ephemeral });
                    }
                    return;
                }
            }

            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    console.warn(`No command registered for ${interaction.commandName}`);
                    return;
                }

                try {

                    if (!_alertsCache || Date.now() - _alertsCacheTime > 30000) {
                        const alertsPath = path.join(__dirname, '..', 'data', 'alert', 'alerts.json');
                        try {
                            _alertsCache = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));
                        } catch { _alertsCache = { currentAlert: null, readBy: [] }; }
                        _alertsCacheTime = Date.now();
                    }
                    const alerts = _alertsCache;

                    if (alerts.currentAlert && alerts.currentAlert.timestamp && (Date.now() - alerts.currentAlert.timestamp) > 43200000) {
                        alerts.currentAlert = null;
                        alerts.readBy = [];
                        const alertsPath = path.join(__dirname, '..', 'data', 'alert', 'alerts.json');
                        fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));
                    }

                    if (alerts.currentAlert && !alerts.readBy.includes(interaction.user.id)) {
                        const letterPath = path.join(__dirname, '..', 'assets', 'bakery_assets', 'extra_assets', 'Letter.png');
                        const hasLetter = fs.existsSync(letterPath);

                        const letterContainer = new ContainerBuilder().setAccentColor(0xFFD700);
                        if (hasLetter) {
                            letterContainer.addMediaGalleryComponents(
                                new MediaGalleryBuilder().addItems(
                                    new MediaGalleryItemBuilder().setURL('attachment://Letter.png')
                                )
                            );
                        }
                        letterContainer.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('## ✉️ You got a letter!\nYou have received a letter, click **Open** to read it or **Dismiss** to skip!')
                        );
                        letterContainer.addSeparatorComponents(new SeparatorBuilder());
                        letterContainer.addActionRowComponents(
                            new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId('open_alert')
                                    .setLabel('Open')
                                    .setEmoji('<:Letter:1431055730655625307>')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('dismiss_alert')
                                    .setLabel('Dismiss')
                                    .setStyle(ButtonStyle.Secondary)
                            )
                        );

                        const replyPayload = {
                            components: [letterContainer],
                            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                        };
                        if (hasLetter) replyPayload.files = [{ attachment: letterPath, name: 'Letter.png' }];

                        await interaction.reply(replyPayload);
                        return;
                    }
                } catch (alertErr) {
                    console.error('Error checking alerts:', alertErr);
                }

                try {
                    await command.execute(interaction);
                } catch (cmdErr) {
                    console.error(`Error executing command ${interaction.commandName}:`, cmdErr);
                    try {
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({ content: 'An error occurred while executing that command.', flags: MessageFlags.Ephemeral });
                        } else if (interaction.deferred && !interaction.replied) {
                            await interaction.editReply({ content: 'An error occurred while executing that command.' });
                        }
                    } catch (_) {}
                }
                return;
            }

            if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId === 'upgrade_select') {
                try {
                    await interaction.deferReply({ flags: MessageFlags.IsLoading }).catch(() => {});
                    const upgradeCommand = require('../commands/economy/upgrade.js');
                    if (upgradeCommand && upgradeCommand.handleUpgradeSelect) {
                        await upgradeCommand.handleUpgradeSelect(interaction);
                    }
                } catch (err) {
                    console.error('Upgrade select handler error:', err);
                    await sendOrFallback(interaction, {
                        content: 'An error occurred while processing the upgrade selection.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
                return;
            }

            if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId === 'level_card_select') {
                try {
                    const levelCommand = require('../commands/economy/level.js');
                    if (levelCommand && levelCommand.handleCardSelect) {
                        await levelCommand.handleCardSelect(interaction);
                    }
                } catch (err) {
                    console.error('Level card select handler error:', err);
                    await sendOrFallback(interaction, {
                        content: 'An error occurred while changing your card.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
                return;
            }

            if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId === 'level_style_select') {
                try {
                    const levelCommand = require('../commands/economy/level.js');
                    if (levelCommand && levelCommand.handleStyleSelect) {
                        await levelCommand.handleStyleSelect(interaction);
                    }
                } catch (err) {
                    console.error('Level style select handler error:', err);
                    await sendOrFallback(interaction, {
                        content: 'An error occurred while changing your style.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
                return;
            }

            if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId === 'leaderboard_select') {
                try {
                    await interaction.deferUpdate().catch(() => {});
                    const { CATEGORIES, buildLeaderboard } = require('../commands/economy/leaderboard.js');
                    const selected = interaction.values[0];
                    if (!CATEGORIES[selected]) return;

                    const buf = await buildLeaderboard(selected, interaction.client);
                    const attachment = new AttachmentBuilder(buf, { name: 'leaderboard.png' });

                    const container = new ContainerBuilder();
                    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**🏆 Leaderboard**'));
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                    const gallery = new MediaGalleryBuilder();
                    gallery.addItems(new MediaGalleryItemBuilder().setURL('attachment://leaderboard.png'));
                    container.addMediaGalleryComponents(gallery);
                    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                    const select = new StringSelectMenuBuilder()
                        .setCustomId('leaderboard_select')
                        .setPlaceholder('Select a category')
                        .addOptions(
                            Object.entries(CATEGORIES).map(([value, cat]) => ({
                                label: cat.label,
                                value,
                                default: value === selected
                            }))
                        );
                    container.addActionRowComponents(ar => ar.setComponents(select));

                    await interaction.editReply({
                        content: '',
                        files: [attachment],
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch (err) {
                    console.error('Leaderboard select handler error:', err);
                    await sendOrFallback(interaction, {
                        content: 'An error occurred while loading the leaderboard.',
                        flags: MessageFlags.Ephemeral
                    }).catch(() => {});
                }
                return;
            }

            if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('level_bg_choose:')) {
                try {
                    const parts = interaction.customId.split(':');
                    const [, targetUserId, origMsgId] = parts;
                    if (interaction.user.id !== targetUserId) {
                        return interaction.reply({ content: 'You cannot preview someone else\'s background.', ephemeral: true });
                    }
                    const choice = interaction.values && interaction.values[0];
                    if (!choice) return interaction.reply({ content: 'No background selected.', ephemeral: true });

                    const messageCreateEvent = require('./messageCreate');
                    const { generateLevelCard } = require('../utils/levelCard');

                    const user = await interaction.client.users.fetch(targetUserId).catch(() => null);
                    const avatarURL = user ? user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) : null;
                    const xpData = messageCreateEvent.getXP(targetUserId) || { xp: 0, level: 1, nextlevels: messageCreateEvent.getNextLevelXP(1) };
                    let buffer;
                    try {
                        let gradient = false;
                        const gradientUsersPath = path.join(__dirname, '..', 'data', 'gradient_users.json');
                        try {
                            if (fs.existsSync(gradientUsersPath)) {
                                const gusers = JSON.parse(fs.readFileSync(gradientUsersPath, 'utf8')) || [];
                                if (Array.isArray(gusers) && gusers.includes(targetUserId)) gradient = 'holo';
                            }
                        } catch (e) { console.debug('gradient read failed', e?.message || e); }
                        buffer = await generateLevelCard({ avatarURL, username: user ? user.username : 'Unknown', level: xpData.level, xp: xpData.xp, nextLevelXP: xpData.nextlevels, background: choice, gradient });
                    } catch (err) {
                        console.error('Preview generation failed', err);
                        const msg = interaction.message || await interaction.fetchReply().catch(() => null);
                        if (msg && msg.edit) await msg.edit({ content: 'Failed to generate preview.', components: [] }).catch(() => {});
                        else await interaction.followUp({ content: 'Failed to generate preview.', ephemeral: true }).catch(() => {});
                        return;
                    }

                    const selectRow = new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId(`level_bg_choose:${targetUserId}:${origMsgId}`)
                            .setPlaceholder('Choose a background to preview')
                            .addOptions(
                                { label: 'Default', description: 'Revert to the default background', value: 'default_bg.png' },
                                { label: 'Equestria at Night', description: 'Requires Level 5 to equip', value: 'equestria_night_bg.png' },
                                { label: 'Welcome to Ponyville', description: 'Requires Level 10 to equip', value: 'welcome_to_ponyville_bg.png' },
                                { label: 'Crystal Empire', description: 'Requires Level 15 to equip', value: 'crystalempire_bg.png' },
                                { label: 'Derpy Muffinboom', description: 'Requires Level 20 to equip', value: 'derpyboom_bg.png' },
                                { label: 'Manehattan Skyline', description: 'Requires Level 25 to equip', value: 'manehattan_bg.png' },
                                { label: 'Rarity\'s Shop', description: 'Requires Level 30 to equip', value: 'rarityshop_bg.png' },
                                { label: 'Wonderbolts Classroom', description: 'Requires Level 35 to equip', value: 'wonderbolt_classroom_bg.png' },
                                { label: 'Angel Heart Honse', description: 'Requires Level 40 to equip', value: 'flame_honse_bg.png' },
                                { label: 'Cutie Mark Crusaders Treehouse', description: 'Requires Level 45 to equip', value: 'cmc_treehouse_bg.png' },
                                { label: 'Pinke & Maud Pie', description: 'Requires Level 50 to equip', value: 'pinkiexmaud_bg.png' },
                                { label: 'Fluttershy', description: 'Requires Level 55 to equip', value: 'fluttershy_bg.png' },
                                { label: 'Twilight Cutie Mark', description: 'Requires Level 60 to equip', value: 'twilight_bg.png' },
                                { label: 'Starlight Cutie', description: 'Requires Level 65 to equip', value: 'starlight_bg.png' }
                            )
                            .setMinValues(1)
                            .setMaxValues(1)
                    );

                    const applyRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`level_bg_apply:${targetUserId}:${choice}:${origMsgId}`).setLabel('Apply').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`p:${targetUserId}:${origMsgId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                    );

                    try {
                        await interaction.update({ content: 'Preview:', files: [new AttachmentBuilder(buffer, { name: 'levelcard_preview.png' })], components: [selectRow, applyRow] });
                    } catch (err) {
                        console.error('Failed to update message with preview, falling back to followUp:', err);
                        try { await interaction.followUp({ content: 'Preview:', files: [new AttachmentBuilder(buffer, { name: 'levelcard_preview.png' })], components: [selectRow, applyRow], ephemeral: true }); } catch (_) {}
                    }
                } catch (e) {
                    console.error('level_bg_choose handler error:', e);
                    try { await interaction.reply({ content: 'An error occurred while previewing background.', ephemeral: true }); } catch (_) {}
                }
                return;
            }

            if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && interaction.customId && interaction.customId.startsWith('profile_bg_save:')) {
                const targetUserId = interaction.customId.split(':')[1];
                if (interaction.user.id !== targetUserId) {
                    await interaction.reply({ content: 'You can only change your own profile.', flags: MessageFlags.Ephemeral });
                    return;
                }
                try {
                    await interaction.deferUpdate();
                    const chosen = interaction.values[0];
                    updateProfile(targetUserId, { appearance: { activeProfileBackground: chosen } });
                    const bgSaveC = new ContainerBuilder().setAccentColor(0x2ECC71);
                    bgSaveC.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                        `## \u2705 Background Updated!\nYour profile background has been changed. Run \`/profile\` to see your new look!`
                    ));
                    bgSaveC.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                    bgSaveC.addActionRowComponents(ar => ar.setComponents(
                        new ButtonBuilder().setCustomId(`profile_customize_back:${targetUserId}`).setLabel('\u2B05\uFE0F Back to Customize').setStyle(ButtonStyle.Secondary)
                    ));
                    await interaction.editReply({ components: [bgSaveC.toJSON()], flags: MessageFlags.IsComponentsV2, files: [] });
                } catch (e) {
                    console.error('profile_bg_save handler error:', e);
                }
                return;
            }

            const _tradeCid = interaction.customId || '';
            if (_tradeCid.startsWith('trade:')) {
                const { pendingTrades, buildTradeViewExternal, saveTrades, touchTrade, getTrade } = require('../commands/economy/trade.js');
                const capitalize = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

                if (interaction.isModalSubmit() && _tradeCid.startsWith('trade:bitsmodal:')) {
                    try {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        const tradeId = _tradeCid.replace('trade:bitsmodal:', '');
                        const trade = getTrade(tradeId);

                        if (!trade || trade.state !== 'active') {
                            await interaction.editReply({ content: '❌ This trade has expired.' });
                            return;
                        }
                        touchTrade(tradeId);

                        const amount = parseInt(interaction.fields.getTextInputValue('trade_bits_amount'), 10);
                        if (isNaN(amount) || amount < 0) {
                            await interaction.editReply({ content: '❌ Please enter a valid amount (0 or more).' });
                            return;
                        }

                        const userId = interaction.user.id;
                        const profile = getProfile(userId);
                        const bits = Number(profile?.balances?.bits || 0);
                        if (amount > bits) {
                            await interaction.editReply({ content: `❌ You don't have enough bits! You have ${bits.toLocaleString()}.` });
                            return;
                        }

                        const isSender = userId === trade.senderId;
                        if (isSender) {
                            trade.senderBits = amount;
                            trade.senderReady = false;
                        } else {
                            trade.recipientBits = amount;
                            trade.recipientReady = false;
                        }
                        saveTrades();

                        await interaction.editReply({ content: `✅ You offered **${amount.toLocaleString()}** bits!` });

                        if (trade.messageId) {
                            try {
                                const msg = await interaction.channel.messages.fetch(trade.messageId);
                                await msg.edit(buildTradeViewExternal(trade));
                            } catch (err) {
                                console.error('[TRADE] Failed to update main message:', err.message);
                            }
                        }
                    } catch (err) {
                        console.error('[TRADE] Bits modal error:', err.message);
                        await interaction.editReply({ content: `❌ Error: ${err.message}` }).catch(() => {});
                    }
                    return;
                }

                const parts = _tradeCid.split(':');
                const action = parts[1];
                const tradeId = parts.slice(2).join(':');
                const trade = getTrade(tradeId);

                const _deferred = interaction.deferred;

                if (!trade || trade.state !== 'active') {
                    console.log(`[TRADE] Trade not found or expired: tradeId="${tradeId}", found=${!!trade}, state=${trade?.state}, mapSize=${pendingTrades.size}`);
                    if (_deferred) {
                        await interaction.followUp({ content: '❌ This trade has expired or is no longer valid.\n-# Trades expire after 3 minutes of inactivity. Please create a new trade with `/trade`.', flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ content: '❌ This trade has expired or is no longer valid.\n-# Trades expire after 3 minutes of inactivity. Please create a new trade with `/trade`.', flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                touchTrade(tradeId);

                const userId = interaction.user.id;
                if (userId !== trade.senderId && userId !== trade.recipientId) {
                    if (_deferred) {
                        await interaction.followUp({ content: '❌ This trade is not for you!', flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ content: '❌ This trade is not for you!', flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                const isSender = userId === trade.senderId;

                if (action === 'accept') {
                    try {
                        if (userId !== trade.recipientId) {
                            await interaction.followUp({ content: '❌ Only the recipient can accept the trade!', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        trade.accepted = true;
                        saveTrades();
                        await interaction.editReply(buildTradeViewExternal(trade));
                    } catch (err) {
                        console.error('[TRADE] Accept error:', err.message);
                        try {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
                            }
                        } catch (_) {}
                    }
                    return;
                }

                if (action === 'reject') {
                    try {
                        if (userId !== trade.recipientId) {
                            await interaction.followUp({ content: '❌ Only the recipient can reject the trade!', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        pendingTrades.delete(tradeId);
                        saveTrades();

                        const rejectContainer = new ContainerBuilder().setAccentColor(0xE74C3C);
                        rejectContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `## ❌ Trade Rejected\n<@${trade.recipientId}> rejected the trade.`
                        ));
                        await interaction.editReply({ components: [rejectContainer], flags: MessageFlags.IsComponentsV2 });
                    } catch (err) {
                        console.error('[TRADE] Reject error:', err.message);
                        await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
                    }
                    return;
                }

                if (!trade.accepted) {
                    if (_deferred) {
                        await interaction.followUp({ content: '❌ The trade recipient must accept the trade first!', flags: MessageFlags.Ephemeral });
                    } else {
                        await interaction.reply({ content: '❌ The trade recipient must accept the trade first!', flags: MessageFlags.Ephemeral });
                    }
                    return;
                }

                if (action === 'pony') {
                    try {
                        const profile = getProfile(userId);
                        if (!profile) {
                            await sendNoProfile(interaction);
                            return;
                        }

                        const collection = Array.isArray(profile.collection) ? profile.collection : [];
                        if (collection.length === 0) {
                            await interaction.followUp({ content: "❌ You don't have any ponies to trade!", flags: MessageFlags.Ephemeral });
                            return;
                        }

                        const currentPonies = isSender ? (trade.senderPonies || []) : (trade.recipientPonies || []);
                        const currentIds = new Set(currentPonies.map(p => String(p.id)));

                        const options = collection.slice(0, 25).map(p => ({
                            label: p.name.substring(0, 100),
                            value: String(p.id),
                            description: capitalize(p.rarity || 'Unknown').substring(0, 100),
                            default: currentIds.has(String(p.id))
                        }));

                        const maxSelect = Math.min(6, options.length);
                        const select = new StringSelectMenuBuilder()
                            .setCustomId(`trade:ponyselect:${tradeId}`)
                            .setPlaceholder('Select up to 6 ponies...')
                            .setMinValues(1)
                            .setMaxValues(maxSelect)
                            .addOptions(options);

                        await interaction.followUp({
                            content: '🦄 **Select Ponies to Trade** (up to 6)',
                            components: [new ActionRowBuilder().addComponents(select)],
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (err) {
                        console.error('[TRADE] Pony select error:', err.message);
                        await interaction.followUp({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
                    }
                    return;
                }

                if (action === 'ponyselect') {
                    try {
                        const selectedIds = interaction.values.map(Number);
                        const profile = getProfile(userId);
                        if (!profile) {
                            await sendNoProfile(interaction);
                            return;
                        }

                        const collection = Array.isArray(profile.collection) ? profile.collection : [];
                        const selectedPonies = [];
                        for (const id of selectedIds) {
                            const pony = collection.find(p => p.id === id);
                            if (pony) selectedPonies.push({ id: pony.id, name: pony.name, rarity: pony.rarity });
                        }

                        if (selectedPonies.length === 0) {
                            await interaction.followUp({ content: "❌ You don't own any of those ponies!", flags: MessageFlags.Ephemeral });
                            return;
                        }

                        if (isSender) {
                            trade.senderPonies = selectedPonies;
                            trade.senderReady = false;
                        } else {
                            trade.recipientPonies = selectedPonies;
                            trade.recipientReady = false;
                        }
                        saveTrades();

                        if (trade.messageId) {
                            try {
                                const ch = interaction.channel || await interaction.client.channels.fetch(interaction.channelId);
                                const msg = await ch.messages.fetch(trade.messageId);
                                await msg.edit(buildTradeViewExternal(trade));
                            } catch (e) { console.error('[TRADE] Failed to update main message:', e.message); }
                        }

                        const names = selectedPonies.map(p => `**${p.name}**`).join(', ');
                        await interaction.followUp({ content: `✅ You selected ${names}!`, flags: MessageFlags.Ephemeral });
                    } catch (err) {
                        console.error('[TRADE] Pony select error:', err.message);
                        await interaction.followUp({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
                    }
                    return;
                }

                if (action === 'bits') {
                    try {
                        const modal = new ModalBuilder()
                            .setCustomId(`trade:bitsmodal:${tradeId}`)
                            .setTitle('Set Bits Offer')
                            .addComponents(
                                new ActionRowBuilder().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('trade_bits_amount')
                                        .setLabel('Amount of bits to offer')
                                        .setStyle(TextInputStyle.Short)
                                        .setPlaceholder('Enter amount (e.g. 5000) or 0')
                                        .setRequired(true)
                                )
                            );
                        await interaction.showModal(modal);
                    } catch (err) {
                        console.error('[TRADE] Bits modal error:', err.message);
                        await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
                    }
                    return;
                }

                if (action === 'confirm') {
                    try {
                        const hasSenderPonies = trade.senderPonies && trade.senderPonies.length > 0;
                        const hasRecipientPonies = trade.recipientPonies && trade.recipientPonies.length > 0;
                        const hasOffer = hasSenderPonies || hasRecipientPonies || trade.senderBits > 0 || trade.recipientBits > 0;
                        if (!hasOffer) {
                            await interaction.followUp({ content: '❌ At least one side must offer something (a pony or bits) before confirming!', flags: MessageFlags.Ephemeral });
                            return;
                        }

                        if ((hasSenderPonies || hasRecipientPonies) && !(hasSenderPonies && hasRecipientPonies)) {
                            if (trade.senderBits === 0 && trade.recipientBits === 0) {
                                await interaction.followUp({ content: '❌ For pony trades, both users must offer ponies! Or add bits to one side.', flags: MessageFlags.Ephemeral });
                                return;
                            }
                        }

                        if (isSender) trade.senderReady = true;
                        else trade.recipientReady = true;
                        saveTrades();

                        if (trade.senderReady && trade.recipientReady) {

                            const senderProfile = getProfile(trade.senderId);
                            const recipientProfile = getProfile(trade.recipientId);

                            if (!senderProfile || !recipientProfile) {
                                await interaction.followUp({ content: '❌ One of the users no longer has a profile!', flags: MessageFlags.Ephemeral });
                                pendingTrades.delete(tradeId);
                                return;
                            }

                            const senderBits = Number(senderProfile.balances?.bits || 0);
                            const recipientBits = Number(recipientProfile.balances?.bits || 0);
                            if (trade.senderBits > 0 && senderBits < trade.senderBits) {
                                await interaction.followUp({ content: `❌ <@${trade.senderId}> doesn't have enough bits!`, flags: MessageFlags.Ephemeral });
                                trade.senderReady = false;
                                return;
                            }
                            if (trade.recipientBits > 0 && recipientBits < trade.recipientBits) {
                                await interaction.followUp({ content: `❌ <@${trade.recipientId}> doesn't have enough bits!`, flags: MessageFlags.Ephemeral });
                                trade.recipientReady = false;
                                return;
                            }

                            if (!senderProfile.collection) senderProfile.collection = [];
                            if (!recipientProfile.collection) recipientProfile.collection = [];
                            if (!senderProfile.befriendedPonies) senderProfile.befriendedPonies = [];
                            if (!recipientProfile.befriendedPonies) recipientProfile.befriendedPonies = [];

                            if (trade.senderPonies && trade.senderPonies.length > 0) {
                                for (const pony of trade.senderPonies) {
                                    const idx = senderProfile.collection.findIndex(p => p.id === pony.id);
                                    if (idx === -1) {
                                        await interaction.followUp({ content: `❌ <@${trade.senderId}> no longer owns **${pony.name}**!`, flags: MessageFlags.Ephemeral });
                                        trade.senderReady = false;
                                        return;
                                    }
                                }
                            }

                            if (trade.recipientPonies && trade.recipientPonies.length > 0) {
                                for (const pony of trade.recipientPonies) {
                                    const idx = recipientProfile.collection.findIndex(p => p.id === pony.id);
                                    if (idx === -1) {
                                        await interaction.followUp({ content: `❌ <@${trade.recipientId}> no longer owns **${pony.name}**!`, flags: MessageFlags.Ephemeral });
                                        trade.recipientReady = false;
                                        return;
                                    }
                                }
                            }

                            if (!senderProfile.balances) senderProfile.balances = {};
                            if (!recipientProfile.balances) recipientProfile.balances = {};
                            if (trade.senderBits > 0) {
                                senderProfile.balances.bits = (senderProfile.balances.bits || 0) - trade.senderBits;
                                recipientProfile.balances.bits = (recipientProfile.balances.bits || 0) + trade.senderBits;
                            }
                            if (trade.recipientBits > 0) {
                                recipientProfile.balances.bits = (recipientProfile.balances.bits || 0) - trade.recipientBits;
                                senderProfile.balances.bits = (senderProfile.balances.bits || 0) + trade.recipientBits;
                            }

                            if (trade.senderPonies && trade.senderPonies.length > 0) {
                                for (const pony of trade.senderPonies) {
                                    const sIdx = senderProfile.collection.findIndex(p => p.id === pony.id);
                                    if (sIdx !== -1) senderProfile.collection.splice(sIdx, 1);
                                    const sbIdx = senderProfile.befriendedPonies.findIndex(p => p.id === pony.id);
                                    if (sbIdx !== -1) senderProfile.befriendedPonies.splice(sbIdx, 1);
                                    recipientProfile.collection.push(pony);
                                    recipientProfile.befriendedPonies.push({ ...pony, befriendedAt: new Date().toISOString() });
                                }
                            }
                            if (trade.recipientPonies && trade.recipientPonies.length > 0) {
                                for (const pony of trade.recipientPonies) {
                                    const rIdx = recipientProfile.collection.findIndex(p => p.id === pony.id);
                                    if (rIdx !== -1) recipientProfile.collection.splice(rIdx, 1);
                                    const rbIdx = recipientProfile.befriendedPonies.findIndex(p => p.id === pony.id);
                                    if (rbIdx !== -1) recipientProfile.befriendedPonies.splice(rbIdx, 1);
                                    senderProfile.collection.push(pony);
                                    senderProfile.befriendedPonies.push({ ...pony, befriendedAt: new Date().toISOString() });
                                }
                            }

                            updateProfile(trade.senderId, senderProfile);
                            updateProfile(trade.recipientId, recipientProfile);
                            pendingTrades.delete(tradeId);
                            saveTrades();

                            const summaryLines = [];
                            if (trade.senderPonies && trade.senderPonies.length > 0) {
                                const names = trade.senderPonies.map(p => `**${p.name}**`).join(', ');
                                summaryLines.push(`🦄 <@${trade.senderId}> → ${names} → <@${trade.recipientId}>`);
                            }
                            if (trade.recipientPonies && trade.recipientPonies.length > 0) {
                                const names = trade.recipientPonies.map(p => `**${p.name}**`).join(', ');
                                summaryLines.push(`🦄 <@${trade.recipientId}> → ${names} → <@${trade.senderId}>`);
                            }
                            if (trade.senderBits > 0) summaryLines.push(`💰 <@${trade.senderId}> → **${trade.senderBits.toLocaleString()}** bits → <@${trade.recipientId}>`);
                            if (trade.recipientBits > 0) summaryLines.push(`💰 <@${trade.recipientId}> → **${trade.recipientBits.toLocaleString()}** bits → <@${trade.senderId}>`);

                            const successContainer = new ContainerBuilder().setAccentColor(0x2ECC71);
                            successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                                `## ✅ Trade Complete!`
                            ));
                            successContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                            successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(summaryLines.join('\n')));

                            await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
                        } else {

                            await interaction.editReply(buildTradeViewExternal(trade));
                        }
                    } catch (err) {
                        console.error('[TRADE] Confirm error:', err.message);
                        try {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
                            }
                        } catch (_) {}
                    }
                    return;
                }

                if (action === 'cancel') {
                    try {
                        pendingTrades.delete(tradeId);
                        saveTrades();

                        const cancelContainer = new ContainerBuilder().setAccentColor(0xE74C3C);
                        cancelContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `## ❌ Trade Cancelled\n<@${userId}> cancelled the trade.`
                        ));
                        await interaction.editReply({ components: [cancelContainer], flags: MessageFlags.IsComponentsV2 });
                    } catch (err) {
                        console.error('[TRADE] Cancel error:', err.message);
                        try {
                            if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
                            }
                        } catch (_) {}
                    }
                    return;
                }

                return;
            }

            if (interaction.isButton && interaction.isButton()) {
                const cid = interaction.customId || '';

                // Settings button handlers
                if (cid.startsWith('settings_')) {
                    try {
                        await interaction.deferUpdate();
                        const settingsCommand = require('../commands/management/settings.js');
                        
                        if (cid === 'settings_leveling') {
                            await settingsCommand.showLevelingMenu(interaction);
                        } else if (cid === 'settings_moderation') {
                            await settingsCommand.showModerationMenu(interaction);
                        } else if (cid === 'settings_back') {
                            await settingsCommand.showMainMenu(interaction);
                        } else if (cid === 'settings_leveling_toggle') {
                            const { loadServerSettings } = require('../utils/serverSettings');
                            const settings = loadServerSettings(interaction.guild.id);
                            const isEnabled = settings.leveling?.enabled !== false;
                            settingsCommand.toggleLeveling(interaction.guild.id, !isEnabled);
                            await settingsCommand.showLevelingMenu(interaction);
                        } else if (cid === 'settings_moderation_toggle') {
                            const { loadServerSettings } = require('../utils/serverSettings');
                            const settings = loadServerSettings(interaction.guild.id);
                            const isEnabled = settings.moderation?.enabled !== false;
                            settingsCommand.toggleModeration(interaction.guild.id, !isEnabled);
                            await settingsCommand.showModerationMenu(interaction);
                        } else if (cid === 'settings_leveling_channel') {
                            await settingsCommand.showChannelSelector(interaction);
                        }
                        return;
                    } catch (err) {
                        console.error('Settings button error:', err);
                        try {
                            await interaction.followUp({ 
                                content: 'An error occurred while processing your request.', 
                                flags: MessageFlags.Ephemeral 
                            });
                        } catch (_) {}
                        return;
                    }
                }

                // Settings channel select handler
                if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && cid === 'settings_leveling_channel_select') {
                    try {
                        await interaction.deferUpdate();
                        const settingsCommand = require('../commands/management/settings.js');
                        const selectedChannel = interaction.values[0];
                        
                        if (selectedChannel === 'same_channel') {
                            settingsCommand.setLevelUpChannel(interaction.guild.id, null);
                        } else {
                            settingsCommand.setLevelUpChannel(interaction.guild.id, selectedChannel);
                        }
                        
                        await settingsCommand.showLevelingMenu(interaction);
                        return;
                    } catch (err) {
                        console.error('Settings channel select error:', err);
                        try {
                            await interaction.followUp({ 
                                content: 'An error occurred while setting the channel.', 
                                flags: MessageFlags.Ephemeral 
                            });
                        } catch (_) {}
                        return;
                    }
                }

                if ((cid === 'befriend' || cid === 'ignore' || cid === 'hint' || cid === 'superhint' || cid === 'remindme') && interaction.message) {

                    return;
                }

                try {
                    if (cid === 'open_alert') {
                        const alertsPath = path.join(__dirname, '..', 'data', 'alert', 'alerts.json');
                        const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));

                        if (alerts.currentAlert && !alerts.readBy.includes(interaction.user.id)) {
                            alerts.readBy.push(interaction.user.id);
                            fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));

                            const historyPath = path.join(__dirname, '..', 'data', 'alert', 'alerthistory.json');
                            let userHistory = {};
                            try { userHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch { userHistory = {}; }
                            const uid = interaction.user.id;
                            if (!userHistory[uid]) userHistory[uid] = [];
                            userHistory[uid].push({
                                title: alerts.currentAlert.title,
                                description: alerts.currentAlert.description,
                                timestamp: alerts.currentAlert.timestamp,
                                readAt: Date.now()
                            });
                            fs.writeFileSync(historyPath, JSON.stringify(userHistory, null, 2));

                            const alert = alerts.currentAlert;
                            const timestamp = `<t:${Math.floor(alert.timestamp / 1000)}:R>`;

                            const alertContainer = new ContainerBuilder().setAccentColor(0xFF6B00);
                            alertContainer.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`## 📜 ${alert.title}`)
                            );
                            alertContainer.addSeparatorComponents(new SeparatorBuilder());
                            alertContainer.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(alert.description)
                            );
                            alertContainer.addSeparatorComponents(new SeparatorBuilder());
                            alertContainer.addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(`-# Posted ${timestamp} • Saved to your alert history`)
                            );

                            await interaction.update({
                                content: '',
                                embeds: [],
                                components: [alertContainer],
                                files: [],
                                flags: MessageFlags.IsComponentsV2
                            });
                            return;
                        }
                    }

                    if (cid === 'dismiss_alert') {
                        const alertsPath = path.join(__dirname, '..', 'data', 'alert', 'alerts.json');
                        const alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));

                        if (alerts.currentAlert && !alerts.readBy.includes(interaction.user.id)) {
                            alerts.readBy.push(interaction.user.id);
                            fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));
                        }

                        const dismissContainer = new ContainerBuilder().setAccentColor(0x95A5A6);
                        dismissContainer.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent('-# ✉️ Letter dismissed. Use `/alert myhistory` to view past alerts you\'ve opened.')
                        );

                        await interaction.update({
                            content: '',
                            embeds: [],
                            components: [dismissContainer],
                            files: [],
                            flags: MessageFlags.IsComponentsV2
                        });
                        return;
                    }

                    if (cid.startsWith('my_alert_prev:') || cid.startsWith('my_alert_next:')) {
                        try {
                            const myHistoryHandler = require('../commands/management/alert/myhistory.js');
                            const pagePart = cid.split(':')[1];
                            let currentPage = parseInt(pagePart, 10);

                            const historyPath = path.join(__dirname, '..', 'data', 'alert', 'alerthistory.json');
                            let userHistory = {};
                            try { userHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch { userHistory = {}; }
                            const alerts = userHistory[interaction.user.id] || [];

                            if (cid.startsWith('my_alert_prev:')) {
                                currentPage = Math.max(1, currentPage - 1);
                            } else {
                                currentPage = Math.min(alerts.length, currentPage + 1);
                            }

                            const result = myHistoryHandler.buildMyHistoryPage(alerts, currentPage);
                            if (!result) {
                                await interaction.reply({ content: 'Error loading your alert history.', ephemeral: true });
                                return;
                            }

                            await interaction.update({
                                components: [result.container, result.buttons],
                                flags: MessageFlags.IsComponentsV2
                            });
                        } catch (err) {
                            console.error('My alert history pagination error:', err);
                            await interaction.reply({ content: 'An error occurred while navigating your history.', ephemeral: true });
                        }
                        return;
                    }

                    if (cid.startsWith('level_bg_select:')) {
                        try {
                            const messageCreateEvent = require('./messageCreate');
                            const { generateLevelCard } = require('../utils/levelCard');
                            const [, targetUserId] = cid.split(':');
                            if (interaction.user.id !== targetUserId) {
                                await interaction.reply({ content: 'You cannot change someone else\'s background.', ephemeral: true });
                                return;
                            }
                            const levelsData = messageCreateEvent.getLevelsData() || {};
                            const userData = levelsData[targetUserId] || { level: 1 };
                            const userLevel = userData.level || 1;

                            const options = [
                                { label: 'Default', description: 'Revert to the default background', value: 'default_bg.png' },
                                { label: 'Equestria at Night', description: 'Requires Level 5 to equip', value: 'equestria_night_bg.png' },
                                { label: 'Welcome to Ponyville', description: 'Requires Level 10 to equip', value: 'welcome_to_ponyville_bg.png' },
                                { label: 'Crystal Empire', description: 'Requires Level 15 to equip', value: 'crystalempire_bg.png' },
                                { label: 'Derpy Muffinboom', description: 'Requires Level 20 to equip', value: 'derpyboom_bg.png' },
                                { label: 'Manehattan Skyline', description: 'Requires Level 25 to equip', value: 'manehattan_bg.png' },
                                { label: 'Rarity\'s Shop', description: 'Requires Level 30 to equip', value: 'rarityshop_bg.png' },
                                { label: 'Wonderbolts Classroom', description: 'Requires Level 35 to equip', value: 'wonderbolt_classroom_bg.png' },
                                { label: 'Angel Heart Honse', description: 'Requires Level 40 to equip', value: 'flame_honse_bg.png' },
                                { label: 'Cutie Mark Crusaders Treehouse', description: 'Requires Level 45 to equip', value: 'cmc_treehouse_bg.png' },
                                { label: 'Pinke & Maud Pie', description: 'Requires Level 50 to equip', value: 'pinkiexmaud_bg.png' },
                                { label: 'Fluttershy', description: 'Requires Level 55 to equip', value: 'fluttershy_bg.png' },
                                { label: 'Twilight Cutie Mark', description: 'Requires Level 60 to equip', value: 'twilight_bg.png' },
                                { label: 'Starlight Cutie', description: 'Requires Level 65 to equip', value: 'starlight_bg.png' }
                            ];

                            const finalOptions = options.map(opt => ({
                                label: opt.label + (((opt.value && (
                                    (opt.value === 'equestria_night_bg.png' && userLevel < 5) ||
                                    (opt.value === 'welcome_to_ponyville_bg.png' && userLevel < 10) ||
                                    (opt.value === 'crystalempire_bg.png' && userLevel < 15) ||
                                    (opt.value === 'derpyboom_bg.png' && userLevel < 20) ||
                                    (opt.value === 'manehattan_bg.png' && userLevel < 25) ||
                                    (opt.value === 'rarityshop_bg.png' && userLevel < 30) ||
                                    (opt.value === 'wonderbolt_classroom_bg.png' && userLevel < 35) ||
                                    (opt.value === 'flame_honse_bg.png' && userLevel < 40) ||
                                    (opt.value === 'cmc_treehouse_bg.png' && userLevel < 45) ||
                                    (opt.value === 'pinkiexmaud_bg.png' && userLevel < 50) ||
                                    (opt.value === 'fluttershy_bg.png' && userLevel < 55) ||
                                    (opt.value === 'twilight_bg.png' && userLevel < 60) ||
                                    (opt.value === 'starlight_bg.png' && userLevel < 65)
                                )) ? ' (Locked)' : '')),
                                description: opt.description,
                                value: opt.value
                            }));

                            const origMsgId = interaction.message?.id || null;
                            const row = new ActionRowBuilder().addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId(`level_bg_choose:${targetUserId}:${origMsgId}`)
                                    .setPlaceholder('Choose a background to preview')
                                    .addOptions(finalOptions)
                                    .setMinValues(1)
                                    .setMaxValues(1)
                            );

                            try {
                                await interaction.deferReply({ ephemeral: true });
                                await interaction.editReply({ content: 'Select a background to preview:', components: [row] });
                            } catch (e) {
                                console.error('Failed to send ephemeral select reply, falling back to update/edit:', e);
                                try { await interaction.update({ content: 'Select a background to preview:', components: [row] }); } catch (e2) {
                                    await interaction.deferUpdate().catch(() => {});
                                    await interaction.message.edit({ content: 'Select a background to preview:', components: [row] }).catch(() => {});
                                }
                            }
                            return;
                        } catch (e) {
                            console.error('level_bg_select handler error:', e);
                            await interaction.reply({ content: 'An error occurred handling backgrounds.', ephemeral: true }).catch(() => {});
                            return;
                        }
                    }

                    if (cid.startsWith('level_bg_apply:')) {
                        try {
                            const parts = cid.split(':');
                            const targetUserId = parts[1];
                            const choice = parts[2];
                            const origMsgId = parts[3] || null;
                            if (interaction.user.id !== targetUserId) {
                                await interaction.reply({ content: 'You cannot apply someone else\'s background.', ephemeral: true });
                                return;
                            }
                            const messageCreateEvent = require('./messageCreate');
                            const { generateLevelCard } = require('../utils/levelCard');
                            const levelsData = messageCreateEvent.getLevelsData() || {};
                            if (!levelsData[targetUserId]) levelsData[targetUserId] = { xp: 0, level: 1, nextlevels: messageCreateEvent.getNextLevelXP(1) };
                            levelsData[targetUserId].bg = choice;
                            messageCreateEvent.saveLevelsData(levelsData);

                            await interaction.deferUpdate().catch(() => {});

                            const user = await interaction.client.users.fetch(targetUserId).catch(() => null);
                            const avatarURL = user ? user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) : null;
                            const xpData = messageCreateEvent.getXP(targetUserId) || { xp: 0, level: 1, nextlevels: messageCreateEvent.getNextLevelXP(1) };
                            let buffer;
                            try {
                                let gradient = false;
                                const gradientUsersPath = path.join(__dirname, '..', 'data', 'gradient_users.json');
                                try {
                                    if (fs.existsSync(gradientUsersPath)) {
                                        const gusers = JSON.parse(fs.readFileSync(gradientUsersPath, 'utf8')) || [];
                                        if (Array.isArray(gusers) && gusers.includes(targetUserId)) gradient = 'holo';
                                    }
                                } catch (e) { console.debug('gradient read failed', e?.message || e); }
                                buffer = await generateLevelCard({ avatarURL, username: user ? user.username : 'Unknown', level: xpData.level, xp: xpData.xp, nextLevelXP: xpData.nextlevels, background: choice, gradient });
                            } catch (err) {
                                console.error('Failed to generate final card after applying bg:', err);
                                const msg = interaction.message || await interaction.fetchReply().catch(() => null);
                                if (msg && msg.edit) await msg.edit({ content: `Background applied: ${choice}`, components: [] }).catch(() => {});
                                else await interaction.followUp({ content: `Background applied: ${choice}`, ephemeral: true }).catch(() => {});
                                return;
                            }

                            const bgButtonRow = new ActionRowBuilder().addComponents(
                                new ButtonBuilder().setCustomId(`level_bg_select:${targetUserId}`).setLabel('Background').setStyle(ButtonStyle.Primary)
                            );
                            try {
                                if (origMsgId && interaction.channel && interaction.channel.messages) {
                                    const origMsg = await interaction.channel.messages.fetch(origMsgId).catch(() => null);
                                    if (origMsg && origMsg.edit) {
                                        await origMsg.edit({ content: '', files: [new AttachmentBuilder(buffer, { name: 'levelcard.png' })], components: [bgButtonRow] }).catch(() => {});
                                    }
                                }
                                await interaction.followUp({ content: 'Background applied!', ephemeral: true }).catch(() => {});
                            } catch (err) {
                                console.error('Failed to edit/send message with final card:', err);
                            }
                            return;
                        } catch (e) {
                            console.error('level_bg_apply handler error:', e);
                            try { await interaction.reply({ content: 'Failed to apply background.', ephemeral: true }); } catch (_) {}
                            return;
                        }
                    }

                    if (cid.startsWith('p:') || cid.startsWith('level_bg_cancel:')) {
                        try {
                            const parts = cid.split(':');
                            const targetUserId = parts[1];
                            const origMsgId = parts[2] || null;
                            if (interaction.user.id !== targetUserId) {
                                return interaction.reply({ content: 'You cannot cancel someone else\'s action.', ephemeral: true });
                            }
                            await interaction.deferUpdate().catch(() => {});
                            const messageCreateEvent = require('./messageCreate');
                            const { generateLevelCard } = require('../utils/levelCard');
                            const levelsData = messageCreateEvent.getLevelsData() || {};
                            const currentBg = (levelsData[targetUserId] && levelsData[targetUserId].bg) || 'default_bg.png';
                            const user = await interaction.client.users.fetch(targetUserId).catch(() => null);
                            const avatarURL = user ? user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }) : null;
                            const xpData = messageCreateEvent.getXP(targetUserId) || { xp: 0, level: 1, nextlevels: messageCreateEvent.getNextLevelXP(1) };
                            let buffer;
                            try {
                                let gradient = false;
                                const gradientUsersPath = path.join(__dirname, '..', 'data', 'gradient_users.json');
                                try {
                                    if (fs.existsSync(gradientUsersPath)) {
                                        const gusers = JSON.parse(fs.readFileSync(gradientUsersPath, 'utf8')) || [];
                                        if (Array.isArray(gusers) && gusers.includes(targetUserId)) gradient = 'holo';
                                    }
                                } catch (e) { console.debug('gradient read failed', e?.message || e); }
                                buffer = await generateLevelCard({ avatarURL, username: user ? user.username : 'Unknown', level: xpData.level, xp: xpData.xp, nextLevelXP: xpData.nextlevels, background: currentBg, gradient });
                            } catch (err) {
                                console.error('Failed to generate final card after cancel:', err);
                                const msg = interaction.message || await interaction.fetchReply().catch(() => null);
                                if (msg && msg.edit) await msg.edit({ content: 'Failed to render card.', components: [] }).catch(() => {});
                                else await interaction.followUp({ content: 'Failed to render card.', ephemeral: true }).catch(() => {});
                                return;
                            }

                            try {
                                if (origMsgId && interaction.channel && interaction.channel.messages) {
                                    const origMsg = await interaction.channel.messages.fetch(origMsgId).catch(() => null);
                                    if (origMsg && origMsg.edit) {
                                        await origMsg.edit({ content: '', files: [new AttachmentBuilder(buffer, { name: 'levelcard.png' })], components: [] }).catch(() => {});
                                    }
                                }
                                await interaction.followUp({ content: 'Cancelled.', ephemeral: true }).catch(() => {});
                            } catch (err) {
                                console.error('Failed to edit/send message with final card:', err);
                            }
                            return;
                        } catch (e) {
                            console.error('level_bg_cancel handler error:', e);
                            try { await interaction.reply({ content: 'An error occurred.', ephemeral: true }); } catch (_) {}
                            return;
                        }
                    }

                    if (cid === 'clans_top10' || cid === 'clans_alltime' || cid.startsWith('clan_refresh_')) {
                        try {
                            const {
                              handleClanTop10Button,
                              handleClanAllTimeButton,
                              handleClanRefreshButton
                            } = require('../utils/clanUiHelpers');

                            if (cid === 'clans_top10') {
                                await handleClanTop10Button(interaction);
                                return;
                            }

                            if (cid === 'clans_alltime') {
                                await handleClanAllTimeButton(interaction);
                                return;
                            }

                            if (cid.startsWith('clan_refresh_')) {
                                const clanId = cid.split('_')[2];
                                await handleClanRefreshButton(interaction, clanId);
                                return;
                            }
                        } catch (e) {
                            console.error('Clan UI handler error:', e);
                            await interaction.reply({
                                content: 'An error occurred while handling clan UI interaction.',
                                flags: MessageFlags.Ephemeral
                            });
                            return;
                        }
                    }

                    if (cid.startsWith('clan_invite_accept_') || cid.startsWith('clan_invite_decline_')) {
                        try {
                            const ClansManager = require('../model/ClansManager');
                            const isAccept = cid.startsWith('clan_invite_accept_');
                            const key = cid.replace('clan_invite_accept_', '').replace('clan_invite_decline_', '');
                            const inv = ClansManager.pendingInvites.get(key);
                            if (!inv) {
                                await interaction.reply({
                                    content: '❌ This invite is no longer valid or has expired.',
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }
                            if (interaction.user.id !== inv.toUserId) {
                                await interaction.reply({
                                    content: '❌ This invite is not for you.',
                                    flags: MessageFlags.Ephemeral
                                });
                                return;
                            }

                            if (isAccept) {
                                let clan;
                                try {
                                    clan = ClansManager.acceptInvite(key);
                                } catch (e) {
                                    await interaction.reply({
                                        content: `❌ Could not accept invite: ${e.message}`,
                                        flags: MessageFlags.Ephemeral
                                    });
                                    return;
                                }

                                try {
                                    updateProfile(inv.toUserId, {
                                        ClanId: clan.id,
                                        ClanRole: 'member'
                                    });
                                } catch (e) {
                                    console.error('Failed to update profile on clan accept:', e);
                                }

                                const joinedEmbed = new EmbedBuilder()
                                    .setTitle('🎉 Welcome to the Clan!')
                                    .setDescription(`You have joined **${clan.name}**!\n\nUse \`/clans\` to see your clan stats and members.`)
                                    .setColor(Colors.SUCCESS)
                                    .setFooter({ text: 'Bake together, rise together!' });

                                await interaction.update({
                                    embeds: [joinedEmbed],
                                    components: []
                                }).catch(async () => {
                                    await interaction.reply({
                                        embeds: [joinedEmbed],
                                        flags: MessageFlags.Ephemeral
                                    });
                                });

                                try {
                                    const inviter = await interaction.client.users.fetch(inv.fromUserId).catch(() => null);
                                    if (inviter) {
                                        const notifyEmbed = new EmbedBuilder()
                                            .setTitle('🎉 Invite Accepted')
                                            .setDescription(`<@${inv.toUserId}> has joined **${clan.name}**!`)
                                            .setColor(Colors.SUCCESS)
                                            .setTimestamp();

                                        await inviter.send({ embeds: [notifyEmbed] }).catch(() => {});
                                    }
                                } catch (e) {}
                            } else {
                                ClansManager.removeInvite(key);

                                const declinedEmbed = new EmbedBuilder()
                                    .setTitle('Invite Declined')
                                    .setDescription('You have declined the clan invite.')
                                    .setColor(Colors.ERROR)
                                    .setTimestamp();

                                await interaction.update({
                                    embeds: [declinedEmbed],
                                    components: []
                                }).catch(async () => {
                                    await interaction.reply({
                                        embeds: [declinedEmbed],
                                        flags: MessageFlags.Ephemeral
                                    });
                                });

                                try {
                                    const inviter = await interaction.client.users.fetch(inv.fromUserId).catch(() => null);
                                    if (inviter) {
                                        const notifyEmbed = new EmbedBuilder()
                                            .setTitle('Invite Declined')
                                            .setDescription(`<@${inv.toUserId}> has declined your clan invite.`)
                                            .setColor(Colors.ERROR)
                                            .setTimestamp();

                                        await inviter.send({ embeds: [notifyEmbed] }).catch(() => {});
                                    }
                                } catch (e) {}
                            }
                        } catch (e) {
                            console.error('Clan invite button handler failed:', e);
                            await interaction.reply({
                                content: '❌ An error occurred processing the invite.',
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        return;
                    }

                    if (cid === 'upgrade_confirm_no') {
                        try {
                            const upgradeCommand = require('../commands/economy/upgrade.js');
                            if (upgradeCommand && upgradeCommand.handleUpgradeConfirm) {
                                await upgradeCommand.handleUpgradeConfirm(interaction, false, []);
                                return;
                            }
                        } catch (e) {
                            console.error('Upgrade confirm no handler error:', e);
                            await interaction.reply({
                                content: '❌ An error occurred processing your response.',
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        return;
                    }

                    if (cid === 'level_change_card') {
                        try {
                            const levelCommand = require('../commands/economy/level.js');
                            if (levelCommand && levelCommand.handleChangeCard) {
                                await levelCommand.handleChangeCard(interaction);
                                return;
                            }
                        } catch (e) {
                            console.error('Level change card handler error:', e);
                            await sendOrFallback(interaction, {
                                content: '❌ An error occurred.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                        return;
                    }

                    if (cid === 'level_customize') {
                        try {
                            const levelCommand = require('../commands/economy/level.js');
                            if (levelCommand && levelCommand.handleCustomize) {
                                await levelCommand.handleCustomize(interaction);
                                return;
                            }
                        } catch (e) {
                            console.error('Level customize handler error:', e);
                            await sendOrFallback(interaction, {
                                content: '❌ An error occurred.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                        return;
                    }

                    if (cid === 'level_change_progress_color') {
                        try {
                            const levelCommand = require('../commands/economy/level.js');
                            if (levelCommand && levelCommand.handleProgressColor) {
                                await levelCommand.handleProgressColor(interaction);
                                return;
                            }
                        } catch (e) {
                            console.error('Level progress color handler error:', e);
                            await sendOrFallback(interaction, {
                                content: '❌ An error occurred.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                        return;
                    }

                    if (cid === 'level_change_progress_style') {
                        try {
                            const levelCommand = require('../commands/economy/level.js');
                            if (levelCommand && levelCommand.handleProgressStyle) {
                                await levelCommand.handleProgressStyle(interaction);
                                return;
                            }
                        } catch (e) {
                            console.error('Level progress style handler error:', e);
                            await sendOrFallback(interaction, {
                                content: '❌ An error occurred.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                        return;
                    }

                    if (cid === 'level_done') {
                        try {
                            const levelCommand = require('../commands/economy/level.js');
                            if (levelCommand && levelCommand.handleDone) {
                                await levelCommand.handleDone(interaction);
                                return;
                            }
                        } catch (e) {
                            console.error('Level done handler error:', e);
                            await sendOrFallback(interaction, {
                                content: '❌ An error occurred.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                        return;
                    }

                    if (cid.startsWith('upgrade_confirm_yes:')) {
                        try {
                            const data = cid.split(':').slice(1);
                            const upgradeCommand = require('../commands/economy/upgrade.js');
                            if (upgradeCommand && upgradeCommand.handleUpgradeConfirm) {
                                await upgradeCommand.handleUpgradeConfirm(interaction, true, data);
                                return;
                            }
                        } catch (e) {
                            console.error('Upgrade confirm yes handler error:', e);
                            await interaction.reply({
                                content: '❌ An error occurred processing your upgrade.',
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        return;
                    }

                    if (cid === 'upgrade_back') {
                        try {
                            const upgradeCommand = require('../commands/economy/upgrade.js');
                            if (upgradeCommand && upgradeCommand.handleUpgradeBack) {
                                await upgradeCommand.handleUpgradeBack(interaction);
                                return;
                            }
                        } catch (e) {
                            console.error('Upgrade back handler error:', e);
                            await interaction.reply({
                                content: '❌ An error occurred.',
                                flags: MessageFlags.Ephemeral
                            });
                        }
                        return;
                    }

                    if (cid.startsWith('transfer_')) {
                        const [action, senderIdFromCid] = cid.split('_').slice(1);

                        const mentionedId = interaction.message.mentions.users.first()?.id || null;
                        let originalSenderId = null;
                        let originalRecipientId = null;

                        if (action === 'accept' || action === 'decline') {
                            originalSenderId = senderIdFromCid;
                            originalRecipientId = mentionedId;
                        } else if (action === 'amount') {
                            originalRecipientId = senderIdFromCid;
                            originalSenderId = mentionedId;
                        } else {
                            originalSenderId = senderIdFromCid;
                            originalRecipientId = mentionedId;
                        }

                        if ((action === 'accept' || action === 'decline')) {
                            if (interaction.user.id !== interaction.message.mentions.users.first()?.id) {
                                await interaction.reply({ content: 'This transfer is not for you!', flags: MessageFlags.Ephemeral });
                                return;
                            }
                        }

                        const transferKey = `${originalSenderId || ''}-${originalRecipientId || ''}`;
                        const pendingTransfer = require('../commands/economy/transfer.js').pendingTransfers.get(transferKey);

                        if (!pendingTransfer || pendingTransfer.state === 'expired') {
                            await interaction.reply({ content: 'This transfer request has expired or is no longer valid.', flags: MessageFlags.Ephemeral });
                            return;
                        }

                        if (action === 'accept') {
                            pendingTransfer.state = 'accepted';

                            if (interaction.user.id === originalSenderId) {
                                await interaction.reply({ content: 'You cannot accept your own transfer request!', flags: MessageFlags.Ephemeral });
                                return;
                            }

                            const amountButton = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`transfer_amount_${interaction.user.id}`)
                                    .setLabel('Enter Amount')
                                    .setStyle(ButtonStyle.Primary)
                            );

                            const waitingEmbed = new EmbedBuilder()
                                .setTitle('💰 Transfer Amount Pending')
                                .setColor(0xFFAA00)
                                .setDescription(`<@${originalSenderId}>, please click the button below to enter the amount to transfer.`)
                                .setTimestamp();

                            await interaction.update({
                                embeds: [waitingEmbed],
                                components: [amountButton],
                                content: `<@${originalSenderId}>`
                            });

                        } else if (action === 'decline') {
                            require('../commands/economy/transfer.js').pendingTransfers.delete(transferKey);

                            const declinedEmbed = new EmbedBuilder()
                                .setTitle('❌ Transfer Declined')
                                .setDescription(`${interaction.user} declined the transfer request.`)
                                .setColor(0xFF0000)
                                .setTimestamp();

                            await interaction.update({
                                embeds: [declinedEmbed],
                                components: [],
                                content: `<@${originalSenderId}>`
                            });
                        } else if (action === 'amount') {
                            const recipientId = originalRecipientId || senderIdFromCid;
                            if (interaction.user.id !== interaction.message.mentions.users.first()?.id) {
                                await interaction.reply({ content: 'Only the sender can enter the transfer amount!', flags: MessageFlags.Ephemeral });
                                return;
                            }

                            const modal = new ModalBuilder()
                                .setCustomId(`transfer_modal_${recipientId}`)
                                .setTitle('Transfer Bits')
                                .addComponents(
                                    new ActionRowBuilder().addComponents(
                                        new TextInputBuilder()
                                            .setCustomId('amount')
                                            .setLabel('Amount of bits to transfer')
                                            .setStyle(TextInputStyle.Short)
                                            .setPlaceholder('Enter amount (e.g. 1000)')
                                            .setRequired(true)
                                    )
                                );

                            await interaction.showModal(modal);
                        }
                        return;
                    }

                    if (interaction.isModalSubmit() && interaction.customId.startsWith('transfer_modal_')) {
                        const recipientId = interaction.customId.split('_')[2];
                        const amount = parseInt(interaction.fields.getTextInputValue('amount'), 10);

                        if (isNaN(amount) || amount <= 0) {
                            await interaction.reply({ content: 'Please enter a valid amount greater than 0!', flags: MessageFlags.Ephemeral });
                            return;
                        }

                        const pendingTransfers = require('../commands/economy/transfer.js').pendingTransfers;
                        const transferId = `${interaction.user.id}-${recipientId}`;
                        const pendingTransfer = pendingTransfers.get(transferId);

                        const senderProfile = getProfile(interaction.user.id);
                        const recipientProfile = getProfile(recipientId);

                        if (!senderProfile || !recipientProfile) {
                            await interaction.reply({ content: 'One of the users involved no longer has a profile.', flags: MessageFlags.Ephemeral });
                            return;
                        }

                        if ((senderProfile.balances?.bits || 0) < amount) {
                            await interaction.reply({ content: `You don't have enough bits! You have ${senderProfile.balances?.bits || 0} bits`, flags: MessageFlags.Ephemeral });
                            return;
                        }

                        senderProfile.balances = senderProfile.balances || {};
                        recipientProfile.balances = recipientProfile.balances || {};
                        senderProfile.balances.bits = (senderProfile.balances.bits || 0) - amount;
                        recipientProfile.balances.bits = (recipientProfile.balances.bits || 0) + amount;

                        updateProfile(interaction.user.id, { balances: senderProfile.balances });
                        updateProfile(recipientId, { balances: recipientProfile.balances });

                        const transferKey = `${interaction.user.id}-${recipientId}`;
                        require('../commands/economy/transfer.js').pendingTransfers.delete(transferKey);

                        const successEmbed = new EmbedBuilder()
                            .setTitle('💰 Transfer Complete')
                            .setDescription(`Transfer of ${amount} bits completed!\n\nFrom: <@${interaction.user.id}>\nTo: <@${recipientId}>`)
                            .setColor(0x00FF00)
                            .setTimestamp();

                        await interaction.message.edit({
                            content: `<@${interaction.user.id}> → <@${recipientId}>`,
                            embeds: [successEmbed],
                            components: []
                        }).catch(console.error);

                        await interaction.reply({
                            content: `Successfully transferred ${amount} bits to <@${recipientId}>!`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (cid.startsWith('profile_customize:')) {
                        const targetUserId = cid.split(':')[1];
                        if (interaction.user.id !== targetUserId) {
                            await interaction.reply({ content: 'You can only customize your own profile.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        try {
                            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                            const profileData = getProfile(targetUserId);
                            const previewUser = await interaction.client.users.fetch(targetUserId).catch(() => interaction.user);
                            const previewAttachment = profileData ? await buildProfilePreview(previewUser, profileData).catch(() => null) : null;
                            const cc = new ContainerBuilder().setAccentColor(0x9B59B6);
                            cc.addTextDisplayComponents(new TextDisplayBuilder().setContent('## \u270f\ufe0f Customize Profile\nChoose what you\'d like to customize:'));
                            if (previewAttachment) {
                                cc.addMediaGalleryComponents(
                                    new MediaGalleryBuilder().addItems(
                                        new MediaGalleryItemBuilder().setURL('attachment://profile_preview.png')
                                    )
                                );
                            }
                            cc.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                            cc.addActionRowComponents(ar => ar.setComponents(
                                new ButtonBuilder().setCustomId(`profile_motto:${targetUserId}`).setLabel('Motto').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDCDD'),
                                new ButtonBuilder().setCustomId(`profile_set_tag:${targetUserId}`).setLabel('Tags').setStyle(ButtonStyle.Secondary).setEmoji('\uD83C\uDFF7\uFE0F'),
                                new ButtonBuilder().setCustomId(`profile_set_bg:${targetUserId}`).setLabel('Change BG').setStyle(ButtonStyle.Primary).setEmoji('\uD83D\uDDBC\uFE0F'),
                                new ButtonBuilder().setCustomId(`profile_set_progress:${targetUserId}`).setLabel('Progress Color').setStyle(ButtonStyle.Secondary).setEmoji('\uD83C\uDF08')
                            ));
                            const replyPayload = { components: [cc.toJSON()], flags: MessageFlags.IsComponentsV2 };
                            if (previewAttachment) replyPayload.files = [previewAttachment];
                            await interaction.editReply(replyPayload);
                        } catch (e) {
                            console.error('Profile customize handler error:', e);
                            await interaction.editReply({ content: 'An error occurred.' }).catch(() => {});
                        }
                        return;
                    }

                    if (cid.startsWith('profile_customize_back:')) {
                        const targetUserId = cid.split(':')[1];
                        if (interaction.user.id !== targetUserId) {
                            await interaction.reply({ content: 'You can only customize your own profile.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        try {
                            await interaction.deferUpdate();
                            const profileData = getProfile(targetUserId);
                            const previewUser = await interaction.client.users.fetch(targetUserId).catch(() => interaction.user);
                            const previewAttachment = profileData ? await buildProfilePreview(previewUser, profileData).catch(() => null) : null;
                            const cc = new ContainerBuilder().setAccentColor(0x9B59B6);
                            cc.addTextDisplayComponents(new TextDisplayBuilder().setContent('## \u270f\ufe0f Customize Profile\nChoose what you\'d like to customize:'));
                            if (previewAttachment) {
                                cc.addMediaGalleryComponents(
                                    new MediaGalleryBuilder().addItems(
                                        new MediaGalleryItemBuilder().setURL('attachment://profile_preview.png')
                                    )
                                );
                            }
                            cc.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                            cc.addActionRowComponents(ar => ar.setComponents(
                                new ButtonBuilder().setCustomId(`profile_motto:${targetUserId}`).setLabel('Motto').setStyle(ButtonStyle.Secondary).setEmoji('\uD83D\uDCDD'),
                                new ButtonBuilder().setCustomId(`profile_set_tag:${targetUserId}`).setLabel('Tags').setStyle(ButtonStyle.Secondary).setEmoji('\uD83C\uDFF7\uFE0F'),
                                new ButtonBuilder().setCustomId(`profile_set_bg:${targetUserId}`).setLabel('Change BG').setStyle(ButtonStyle.Primary).setEmoji('\uD83D\uDDBC\uFE0F'),
                                new ButtonBuilder().setCustomId(`profile_set_progress:${targetUserId}`).setLabel('Progress Color').setStyle(ButtonStyle.Secondary).setEmoji('\uD83C\uDF08')
                            ));
                            const replyPayload = { components: [cc.toJSON()], flags: MessageFlags.IsComponentsV2 };
                            if (previewAttachment) replyPayload.files = [previewAttachment];
                            await interaction.editReply(replyPayload);
                        } catch (e) {
                            console.error('Profile customize back handler error:', e);
                        }
                        return;
                    }

                    if (cid.startsWith('profile_set_tag:')) {
                        const targetUserId = cid.split(':')[1];
                        if (interaction.user.id !== targetUserId) {
                            await interaction.reply({ content: 'You can only change your own tags.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        try {
                            const tagProfile = getProfile(targetUserId);
                            const t = tagProfile?.ProfileTags || {};
                            const tagModal = new ModalBuilder().setCustomId('profile_tag_modal').setTitle('Set Profile Tags');
                            tagModal.addComponents(
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tag1').setLabel('Tag 1 (max 24 chars)').setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(false).setValue(t.tag1 && t.tag1 !== 'No Tag' ? t.tag1 : '')),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tag2').setLabel('Tag 2 (max 24 chars)').setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(false).setValue(t.tag2 && t.tag2 !== 'No Tag' ? t.tag2 : '')),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tag3').setLabel('Tag 3 (max 24 chars)').setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(false).setValue(t.tag3 && t.tag3 !== 'No Tag' ? t.tag3 : '')),
                                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tag4').setLabel('Tag 4 (max 24 chars)').setStyle(TextInputStyle.Short).setMaxLength(24).setRequired(false).setValue(t.tag4 && t.tag4 !== 'No Tag' ? t.tag4 : ''))
                            );
                            await interaction.showModal(tagModal);
                        } catch (e) {
                            console.error('Profile set tag handler error:', e);
                            await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral }).catch(() => {});
                        }
                        return;
                    }

                    if (cid.startsWith('profile_set_bg:')) {
                        const targetUserId = cid.split(':')[1];
                        if (interaction.user.id !== targetUserId) {
                            await interaction.reply({ content: 'You can only change your own profile.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        try {
                            await interaction.deferUpdate();
                            const bgC = new ContainerBuilder().setAccentColor(0x3498DB);
                            bgC.addTextDisplayComponents(new TextDisplayBuilder().setContent('## \uD83D\uDDBC\uFE0F Change Profile Background\nSelect a background from the dropdown below:'));
                            const bgSelect = new StringSelectMenuBuilder()
                                .setCustomId(`profile_bg_save:${targetUserId}`)
                                .setPlaceholder('Choose a background...')
                                .addOptions([
                                    { label: 'Default', description: 'The original dark background', value: 'Profile_Background.png' },
                                    { label: 'Aqua', description: 'Aqua coloured background', value: 'Aqua_Background.jpg' },
                                    { label: 'Cherry', description: 'Cherry coloured background', value: 'Cherry_Background.jpeg' }
                                ]);
                            bgC.addActionRowComponents(ar => ar.setComponents(bgSelect));
                            bgC.addActionRowComponents(ar => ar.setComponents(
                                new ButtonBuilder().setCustomId(`profile_customize_back:${targetUserId}`).setLabel('\u2B05\uFE0F Back').setStyle(ButtonStyle.Secondary)
                            ));
                            await interaction.editReply({ components: [bgC.toJSON()], flags: MessageFlags.IsComponentsV2, files: [] });
                        } catch (e) {
                            console.error('Profile set bg handler error:', e);
                        }
                        return;
                    }

                    if (cid.startsWith('profile_set_progress:')) {
                        const targetUserId = cid.split(':')[1];
                        if (interaction.user.id !== targetUserId) {
                            await interaction.reply({ content: 'You can only change your own profile.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        try {
                            const progProfilesPath = path.join(__dirname, '../data/profile/profiles.json');
                            const progProfiles = JSON.parse(fs.readFileSync(progProfilesPath, 'utf8'));
                            const existingColors = progProfiles[targetUserId]?.appearance?.profileProgressColor || [];
                            const progModal = new ModalBuilder().setCustomId('profile_progress_color_modal').setTitle('Progress Bar Color');
                            const pc1 = new TextInputBuilder().setCustomId('progress_color_1').setLabel('Gradient Start Color (e.g. #1E90FF)').setStyle(TextInputStyle.Short).setPlaceholder('#1E90FF').setRequired(true).setMinLength(4).setMaxLength(7);
                            const pc2 = new TextInputBuilder().setCustomId('progress_color_2').setLabel('Gradient End Color (e.g. #87CEFA)').setStyle(TextInputStyle.Short).setPlaceholder('#87CEFA').setRequired(true).setMinLength(4).setMaxLength(7);
                            if (existingColors[0]) pc1.setValue(existingColors[0]);
                            if (existingColors[1]) pc2.setValue(existingColors[1]);
                            progModal.addComponents(new ActionRowBuilder().addComponents(pc1), new ActionRowBuilder().addComponents(pc2));
                            await interaction.showModal(progModal);
                        } catch (e) {
                            console.error('Profile set progress handler error:', e);
                            await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral }).catch(() => {});
                        }
                        return;
                    }

                    if (cid.startsWith('profile_motto:')) {
                        try {
                            const targetUserId = cid.split(':')[1];
                            if (interaction.user.id !== targetUserId) {
                                await interaction.reply({ content: 'You can only change your own motto.', ephemeral: true });
                                return;
                            }

                            const isBooster = BOOSTER_IDS.includes(interaction.user.id);
                            const maxCharacters = isBooster ? 160 : 80;
                            const labelText = isBooster ? `Your Motto (max 160 characters - Booster)` : `Your Motto (max 80 characters)`;

                            const modal = new ModalBuilder()
                                .setCustomId('motto_modal')
                                .setTitle('Set Your Motto');

                            const mottoInput = new TextInputBuilder()
                                .setCustomId('motto_text')
                                .setLabel(labelText)
                                .setStyle(TextInputStyle.Short)
                                .setMaxLength(maxCharacters)
                                .setRequired(false);

                            const row = new ActionRowBuilder().addComponents(mottoInput);
                            modal.addComponents(row);

                            await interaction.showModal(modal);
                        } catch (e) {
                            console.error('Profile motto button handler error:', e);
                            await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
                        }
                        return;
                    }

                    if (cid.startsWith('profile_stats:') || cid.startsWith('profile_achievements:')) {
                        try {
                            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                            await interaction.editReply({
                                content: 'These are still being made and will come out in the Next Update'
                            });
                        } catch (e) {
                            console.error('Profile feature handler error:', e);
                        }
                        return;
                    }

                    if (cid === 'bake' || cid.startsWith('bake_now:')) {
                        try {
                            const profile = getProfile(interaction.user.id);
                            if (!profile) {
                                await sendNoProfile(interaction);
                                return;
                            }
                            const now = Date.now();
                            const cooldownRemaining = 0;
                            if (cooldownRemaining > 0) {
                                const minutes = Math.floor(cooldownRemaining / 60000);
                                const seconds = Math.floor((cooldownRemaining % 60000) / 1000);
                                await interaction.reply({
                                    content: `You have to wait ${minutes} minutes and ${seconds} seconds to bake again.`,
                                    ephemeral: true
                                });
                                return;
                            }

                            if (cid.startsWith('bake_now:')) {
                                const parts = cid.split(':');
                                const targetGuildId = parts[1];
                                const targetUserId = parts[2];

                                if (interaction.user.id !== targetUserId) {
                                    await interaction.reply({
                                        content: "This button is for someone else's bakery!",
                                        ephemeral: true
                                    });
                                    return;
                                }
                            }

                            await interaction.deferUpdate();

                            const result = await performBake(interaction, interaction.guildId, interaction.user.id);
                            if (!result || result.error) {
                                if (result && result.error) {
                                    if (result.error === NO_PROFILE_ERROR || isNoProfileMessage(result.error)) {
                                        await sendNoProfile(interaction);
                                        return;
                                    }

                                    await sendOrFallback(interaction, {
                                        content: result.error,
                                        ephemeral: true
                                    });
                                }
                                return;
                            }

                            const baseFiles = result.files || [];
                            if (result.v2Containers) {
                                const v2Payload = { files: baseFiles, components: result.v2Containers, flags: MessageFlags.IsComponentsV2 };
                                await sendOrFallback(interaction, v2Payload);
                            } else {
                                const fallbackPayload = { files: baseFiles };
                                if (result.components) fallbackPayload.components = result.components;
                                await sendOrFallback(interaction, fallbackPayload);
                            }

                        } catch (err) {
                            console.error('Error in bake button:', err);
                        }
                        return;
                    }

                    if (cid.startsWith('remind_bake:')) {
                        const parts = cid.split(':');
                        const guildId = parts[1];
                        const userId = parts[2];

                        if (userId !== interaction.user.id) {
                            await interaction.reply({ content: 'This reminder button is not for you!', ephemeral: true });
                            return;
                        }

                        const profile = getProfile(userId);
                        if (!profile) {
                            await interaction.reply({ content: 'Could not find your profile!', ephemeral: true });
                            return;
                        }

                        if (!profile.bakery) {
                            await interaction.reply({ content: 'You don\'t have a bakery yet!', ephemeral: true });
                            return;
                        }

                        const newState = !profile.bakery.storageFullNotify;
                        profile.bakery.storageFullNotify = newState;

                        if (newState) {
                            profile.bakery.storageFullNotified = false;
                        }
                        updateProfile(userId, { bakery: profile.bakery });

                        await interaction.reply({
                            content: newState ? '✅ Storage full notifications enabled! You\'ll get a DM when your bakery storage is full.' : '❌ Storage full notifications disabled.',
                            ephemeral: true
                        });
                        return;
                    }

                    if (cid === 'bakery') {
                        console.debug('[interactionCreate] bakery button clicked by', interaction.user.id);
                        const profile = getProfile(interaction.user.id);
                        if (!profile) {
                            await sendNoProfile(interaction);
                            return;
                        }
                        const bakeriesMeta = loadBakeries();

                        let isDeferred = false;
                        try {
                            await interaction.deferReply({ ephemeral: false });
                            isDeferred = true;
                        } catch (e) {
                            console.debug('Failed to defer bakery button:', e?.message);
                        }

                        const result = await buildBakeryEmbed(profile, bakeriesMeta, interaction, { omitViewButton: true });
                        if (!result) {
                            if (isDeferred && !interaction.replied) {
                                await interaction.editReply({ content: 'This bot requires a Components V2 compatible discord.js to show the bakery UI.' }).catch(() => {});
                            } else if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ content: 'This bot requires a Components V2 compatible discord.js to show the bakery UI.', flags: MessageFlags.Ephemeral }).catch(() => {});
                            } else {
                                await sendOrFallback(interaction, { content: 'This bot requires a Components V2 compatible discord.js to show the bakery UI.', flags: MessageFlags.Ephemeral });
                            }
                            return;
                        }
                        if (!result.v2Containers) {
                            if (isDeferred && !interaction.replied) {
                                await interaction.editReply({ content: 'This feature requires a Components V2 capable discord.js/runtime. Please update the bot.' }).catch(() => {});
                            } else if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply({ content: 'This feature requires a Components V2 capable discord.js/runtime. Please update the bot.', flags: MessageFlags.Ephemeral }).catch(() => {});
                            } else {
                                await sendOrFallback(interaction, { content: 'This feature requires a Components V2 capable discord.js/runtime. Please update the bot.', flags: MessageFlags.Ephemeral });
                            }
                            return;
                        }

                        const v2Payload = { files: result.files || [], components: result.v2Containers, flags: MessageFlags.IsComponentsV2 };
                        try {
                            if (isDeferred && !interaction.replied) {
                                await interaction.editReply(v2Payload);
                            } else if (!interaction.replied && !interaction.deferred) {
                                await interaction.reply(v2Payload);
                            } else {
                                await sendOrFallback(interaction, v2Payload);
                            }
                        } catch (e) {
                            console.error('Failed to send bakery button response:', e);
                            try {
                                await sendOrFallback(interaction, { content: 'Failed to display bakery. Please try again.', flags: MessageFlags.Ephemeral });
                            } catch (e2) {
                                console.error('Fallback also failed for bakery button:', e2);
                            }
                        }
                        return;
                    }

                    if (cid === 'view_balance') {
                        try {
                            const balanceCmd = interaction.client.commands.get('balance');
                            if (balanceCmd && typeof balanceCmd.execute === 'function') {
                                await balanceCmd.execute(interaction);
                            } else {
                                await sendOrFallback(interaction, { content: 'Balance command is not available.', flags: MessageFlags.Ephemeral });
                            }
                        } catch (e) {
                            console.error('view_balance button handler error:', e);
                            try { await sendOrFallback(interaction, { content: 'An error occurred opening your balances.', flags: MessageFlags.Ephemeral }); } catch (_) {}
                        }
                        return;
                    }

                    if (cid === 'add_menu_item' || cid === 'remove_menu_item' || cid === 'my_bakeries' || cid === 'mymenu_categories' || cid === 'mymenu_refresh') {
                        await myMenu.handleButton(interaction);
                        return;
                    }

                    if (cid.startsWith('bake_now:') || cid.startsWith('open_bakery:')) {
                        const parts = cid.split(':');
                        const action = parts[0];
                        const guildId = parts[1];
                        const userId = parts[2];

                        if (!guildId || !userId) {
                            await interaction.reply({ content: 'Invalid button data.', flags: MessageFlags.Ephemeral }).catch(() => {});
                            return;
                        }

                        if (interaction.guildId && interaction.guildId !== guildId) {
                            await interaction.reply({ content: 'This button is for a different server.', flags: MessageFlags.Ephemeral }).catch(() => {});
                            return;
                        }

                        if (interaction.user.id !== userId) {
                            await interaction.reply({ content: 'These buttons are for the command user only.', flags: MessageFlags.Ephemeral }).catch(() => {});
                            return;
                        }

                        if (action === 'bake_now') {
                            const result = await performBake(interaction, guildId, userId);
                            if (!result || result.error) {
                                if (result && result.error) {
                                    if (result.error === NO_PROFILE_ERROR || isNoProfileMessage(result.error)) {
                                        await sendNoProfile(interaction);
                                        return;
                                    }

                                    await sendOrFallback(interaction, {
                                        content: result.error,
                                        ephemeral: true
                                    });
                                }
                                return;
                            }

                            const baseFiles = result.files || [];
                            const profile = getProfile(userId, guildId);
                            if (profile && profile.server && profile.server.StorageFullNotify) {
                                const now = Date.now();
                                const notifyAt = now;
                                profile.server.StorageFullNotifyAt = notifyAt;
                                updateProfile(userId, guildId, profile.server);
                            }

                            try {
                                const ch = interaction.channel || interaction.message?.channel;
                                if (result.v2Containers) {
                                    const v2Payload = { files: baseFiles, components: result.v2Containers, flags: MessageFlags.IsComponentsV2 };
                                    if (ch && ch.send) {
                                        const channelPayload = { ...v2Payload };
                                        delete channelPayload.flags;
                                        await ch.send(channelPayload).catch(() => {});
                                    } else {
                                        try { await interaction.reply({ ...v2Payload, ephemeral: false }); } catch (e) {}
                                    }
                                } else {
                                    const fallbackPayload = { files: baseFiles };
                                    if (result.components) fallbackPayload.components = result.components;

                                    if (ch && ch.send) {
                                        await ch.send(fallbackPayload).catch(err => { throw err; });
                                    } else {
                                        await sendOrFallback(interaction, fallbackPayload);
                                    }
                                }
                            } catch (e) {
                                console.error('Failed to send message after bake:', e);
                            }
                            return;
                        }

                        if (action === 'open_bakery') {
                            const profile = getProfile(userId, guildId);
                            if (!profile) {
                                await sendNoProfile(interaction);
                                return;
                            }
                            const bakeriesMeta = loadBakeries();
                            const result = await buildBakeryEmbed(profile, bakeriesMeta, interaction, { omitViewButton: true });
                            if (!result) {
                                await sendOrFallback(interaction, { content: 'This bot requires a Components V2 compatible discord.js to show the bakery UI.', flags: MessageFlags.Ephemeral });
                                return;
                            }
                            try { await interaction.deferUpdate(); } catch (e) {}
                            try {
                                const ch = interaction.channel || interaction.message?.channel;

                                if (!result.v2Containers) {
                                    await sendOrFallback(interaction, { content: 'This feature requires a Components V2 capable discord.js/runtime. Please update the bot.', flags: MessageFlags.Ephemeral });
                                    return;
                                }

                                const v2Payload = { files: result.files || [], components: result.v2Containers, flags: MessageFlags.IsComponentsV2 };
                                if (ch && ch.send) {
                                    const channelPayload = { ...v2Payload };
                                    delete channelPayload.flags;
                                    await ch.send(channelPayload).catch(err => { throw err; });
                                } else {
                                    await sendOrFallback(interaction, v2Payload);
                                }
                            } catch (e) {
                                console.error('Failed to send message for open_bakery (primary ch.send failed):', e);
                                try {
                                    await sendOrFallback(interaction, { content: 'Failed to open bakery. Please try again.', flags: MessageFlags.Ephemeral });
                                } catch (e2) {
                                    console.error('sendOrFallback also failed for open_bakery:', e2);
                                }
                            }
                            return;
                        }
                    }

                    if (cid === 'ticket_open') {
                        try {
                            const { loadConfig: loadTicketCfg, getTicketByUser: getOpenTicket } = require('../utils/ticketManager');
                            const { handleOpenModal } = require('../commands/management/ticket.js');
                            const tcfg = loadTicketCfg(interaction.guild.id);
                            if (!tcfg.categoryId || !tcfg.roleId) {
                                await interaction.reply({ content: 'The ticket system has not been set up yet. Ask an admin to run `/ticket setup`.', flags: MessageFlags.Ephemeral });
                                return;
                            }
                            const texisting = getOpenTicket(interaction.guild.id, interaction.user.id);
                            if (texisting) {
                                await interaction.reply({ content: `You already have an open ticket: <#${texisting.channelId}>`, flags: MessageFlags.Ephemeral });
                                return;
                            }
                            await interaction.deferReply({ ephemeral: true });
                            await handleOpenModal(interaction);
                        } catch (e) {
                            console.error('ticket_open button error:', e);
                            try { await interaction.reply({ content: 'Failed to open a ticket. Please try again.', flags: MessageFlags.Ephemeral }); } catch (_) {}
                        }
                        return;
                    }

                    if (cid === 'ticket_close') {
                        try {
                            const { closeTicketChannel } = require('../commands/management/ticket.js');
                            await closeTicketChannel(interaction);
                        } catch (e) {
                            console.error('ticket_close button error:', e);
                            try { await interaction.reply({ content: 'Failed to close the ticket. Please try again.', flags: MessageFlags.Ephemeral }); } catch (_) {}
                        }
                        return;
                    }

                } catch (err) {
                    console.error('button interaction error:', err);
                    try { await interaction.reply({ content: 'An error occurred handling that button.', flags: MessageFlags.Ephemeral }); } catch (e) {}
                    return;
                }
            }

            if (interaction.isModalSubmit()) {
                if (interaction.customId.startsWith('vsetupmodal:') || interaction.customId.startsWith('verification:')) {
                    try {
                        const verificationSetup = require('../commands/management/verification_setup.js');
                        if (interaction.customId.startsWith('vsetupmodal:')) {
                            const handledSetupModal = await verificationSetup.handleSetupModal(interaction);
                            if (handledSetupModal) return;
                        }
                        if (interaction.customId.startsWith('verification:')) {
                            const handledVerifyModal = await verificationSetup.handleVerificationModal(interaction);
                            if (handledVerifyModal) return;
                        }
                    } catch (e) {
                        console.error('verification modal handler error:', e);
                        try { await interaction.reply({ content: 'An error occurred while handling verification modal.', flags: MessageFlags.Ephemeral }); } catch (_) {}
                        return;
                    }
                }

                if (interaction.customId === 'level_progress_color_modal') {
                    try {
                        const levelCommand = require('../commands/economy/level.js');
                        if (levelCommand && levelCommand.handleProgressColorSubmit) {
                            await levelCommand.handleProgressColorSubmit(interaction);
                            return;
                        }
                    } catch (e) {
                        console.error('Level progress color modal error:', e);
                        try { await interaction.reply({ content: '❌ An error occurred.', flags: MessageFlags.Ephemeral }); } catch (_) {}
                    }
                    return;
                }

                if (interaction.customId.startsWith('ticket_panel_modal:')) {
                    try {
                        const channelId = interaction.customId.split(':')[1];
                        const { handlePanelModal } = require('../commands/management/ticket.js');
                        await handlePanelModal(interaction, channelId);
                    } catch (e) {
                        console.error('ticket_panel_modal error:', e);
                        try { await interaction.reply({ content: 'Failed to send the panel. Please try again.', flags: MessageFlags.Ephemeral }); } catch (_) {}
                    }
                    return;
                }

                if (interaction.customId.startsWith('adventure_guess_')) {
                    await interaction.deferReply({ ephemeral: true }).catch(() => {});
                    return;
                }

                if (interaction.customId === 'profile_tag_modal') {
                    try {
                        const userId = interaction.user.id;
                        const tag1 = (interaction.fields.getTextInputValue('tag1') || '').trim().slice(0, 24) || 'No Tag';
                        const tag2 = (interaction.fields.getTextInputValue('tag2') || '').trim().slice(0, 24) || 'No Tag';
                        const tag3 = (interaction.fields.getTextInputValue('tag3') || '').trim().slice(0, 24) || 'No Tag';
                        const tag4 = (interaction.fields.getTextInputValue('tag4') || '').trim().slice(0, 24) || 'No Tag';

                        const updated = updateProfile(userId, {
                            profile: { tag1, tag2, tag3, tag4 }
                        });

                        if (!updated) {
                            throw new Error(`Failed to update profile tags for user ${userId}`);
                        }

                        flushProfiles();

                        const tagC = new ContainerBuilder().setAccentColor(0x2ECC71);
                        tagC.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `## \u2705 Tags Updated!\n**Tag 1:** ${tag1}\n**Tag 2:** ${tag2}\n**Tag 3:** ${tag3}\n**Tag 4:** ${tag4}\n\nRun \`/profile\` to see your tags!`
                        ));
                        await interaction.reply({ components: [tagC.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
                    } catch (e) {
                        console.error('Profile tag modal error:', e);
                        await interaction.reply({ content: 'An error occurred while saving your tags.', flags: MessageFlags.Ephemeral }).catch(() => {});
                    }
                    return;
                }

                if (interaction.customId === 'profile_progress_color_modal') {
                    try {
                        const userId = interaction.user.id;
                        const hexRegex = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;
                        let pColor1 = interaction.fields.getTextInputValue('progress_color_1').trim();
                        let pColor2 = interaction.fields.getTextInputValue('progress_color_2').trim();
                        if (!pColor1.startsWith('#')) pColor1 = '#' + pColor1;
                        if (!pColor2.startsWith('#')) pColor2 = '#' + pColor2;
                        if (!hexRegex.test(pColor1) || !hexRegex.test(pColor2)) {
                            await interaction.reply({ content: '\u274C Invalid hex color(s). Use a format like `#FF5733`.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        updateProfile(userId, { appearance: { profileProgressColor: [pColor1, pColor2] } });
                        const progC = new ContainerBuilder().setAccentColor(parseInt(pColor1.replace('#', ''), 16) || 0x9B59B6);
                        progC.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                            `## \uD83C\uDF08 Progress Bar Updated!\n**${pColor1}** \u2192 **${pColor2}**\nRun \`/profile\` to see your updated profile!`
                        ));
                        await interaction.reply({ components: [progC.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
                    } catch (e) {
                        console.error('Profile progress color modal error:', e);
                        await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral }).catch(() => {});
                    }
                    return;
                }

                if (interaction.customId === 'motto_modal') {
                    try {
                        const mottoText = interaction.fields.getTextInputValue('motto_text') || '';
                        const userId = interaction.user.id;

                        const isBooster = BOOSTER_IDS.includes(userId);
                        const maxCharacters = isBooster ? 160 : 80;
                        const trimmedMotto = mottoText.substring(0, maxCharacters);

                        const profilesPath = path.join(__dirname, '../data/profile/profiles.json');
                        const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));

                        if (!profiles[userId]) {
                            await sendNoProfile(interaction);
                            return;
                        }

                        profiles[userId].appearance = profiles[userId].appearance || {};
                        profiles[userId].appearance.motto = trimmedMotto;

                        updateProfile(userId, { appearance: { motto: trimmedMotto } });
                        fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2));

                        const boosterNote = isBooster ? ' (Booster - 160 chars)' : '';
                        console.log(`[Motto Modal] User ${userId} set motto to: "${trimmedMotto}"${boosterNote}`);

                        const embed = new EmbedBuilder()
                            .setTitle('✅ Motto Updated')
                            .setDescription(`Your motto has been set to:\n\`${trimmedMotto || '(empty)'}\`${boosterNote ? `\n\n*${boosterNote}*` : ''}`)
                            .setColor(0x4CAF50)
                            .setTimestamp();

                        await interaction.reply({ embeds: [embed], ephemeral: true });
                    } catch (e) {
                        console.error('Motto modal handler error:', e);
                        await interaction.reply({ content: 'An error occurred while saving your motto.', ephemeral: true }).catch(() => {});
                    }
                    return;
                }

                if (interaction.customId === 'alertModal') {
                    const title = interaction.fields.getTextInputValue('title');
                    const description = interaction.fields.getTextInputValue('description');

                    const alertsPath = path.join(__dirname, '..', 'data', 'alert', 'alerts.json');
                    let alerts = {};
                    if (fs.existsSync(alertsPath)) {
                        alerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));
                    }

                    if (!alerts.history) alerts.history = [];

                    const newAlert = {
                        title,
                        description,
                        timestamp: Date.now()
                    };

                    alerts.currentAlert = newAlert;
                    alerts.history.push(newAlert);
                    alerts.readBy = [];

                    fs.writeFileSync(alertsPath, JSON.stringify(alerts, null, 2));

                    _alertsCache = alerts;
                    _alertsCacheTime = Date.now();

                    const confirmContainer = new ContainerBuilder().setAccentColor(0x2ECC71);
                    confirmContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`## ✅ Alert Created\n**${title}** has been created and will be shown to all users!`)
                    );

                    await interaction.reply({
                        components: [confirmContainer],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                    });
                    return;
                }

                if (interaction.customId === 'add_menu_modal' || interaction.customId === 'remove_menu_modal') {
                    await myMenu.handleModal(interaction);
                    return;
                }

                if (interaction.customId === 'lottery_setup_modal') {
                    try {
                        const gambleSetup = require('../commands/economy/gamble_setup.js');
                        await gambleSetup.handleSetupModal(interaction);
                    } catch (e) {
                        console.error('lottery_setup_modal handler error:', e);
                        try { await interaction.editReply({ content: '❌ An error occurred while setting up the lottery.' }); } catch (_) {}
                    }
                    return;
                }

                if (interaction.customId.startsWith('adventure_guess_')) {
                    await interaction.reply({ content: 'Guess received! Check the adventure message for results.', flags: MessageFlags.Ephemeral });
                    return;
                }

                if (!interaction.customId.startsWith('create_profile')) return;

                const userId = interaction.user.id;
                const guildId = interaction.guildId;

                if (!guildId) {
                    await interaction.reply({
                        content: 'You must create your profile in a server.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const eg_name = interaction.fields.getTextInputValue('eg_name')?.trim() || '';
                const bakery_name = interaction.fields.getTextInputValue('bakery_name')?.trim() || '';
                const eg_age = interaction.fields.getTextInputValue('eg_age')?.trim() || '';
                const eg_description = interaction.fields.getTextInputValue('eg_description')?.trim() || '';

                if (!eg_name || !bakery_name) {
                    await interaction.reply({
                        content: 'Name and Bakery Name are required.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                const existingProfile = getProfile(userId);
                if (existingProfile) {
                    await interaction.reply({
                        content: "You already have a profile! You can only create one profile that works across all servers.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const profiles = Object.values(require('../data/profile/profiles.json') || {});
                const egNameTaken = profiles.some(p =>
                    p && p.eg_name && String(p.eg_name).toLowerCase() === eg_name.toLowerCase()
                );
                const bakeryNameTaken = profiles.some(p =>
                    p && p.bakeryName && String(p.bakeryName).toLowerCase() === bakery_name.toLowerCase()
                );

                if (egNameTaken) {
                    await interaction.reply({
                        content: 'That EG Name is already taken. Please choose a different name.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (bakeryNameTaken) {
                    await interaction.reply({
                        content: 'That Bakery Name is already taken. Please choose a different name.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                const starterBakeries = {
                    "1": { id: 1, name: "Muffin", accumulated: 0, bakeTime: 6, lastCycleTime: Date.now() },
                    "2": { id: 2, name: "Chocolate Pie", accumulated: 0, bakeTime: 8, lastCycleTime: Date.now() },
                    "3": { id: 3, name: "Strawberry Cupcake", accumulated: 0, bakeTime: 9, lastCycleTime: Date.now() }
                };

                const profile = {
                    character: {
                        name: eg_name,
                        age: eg_age,
                        description: eg_description,
                        createdAt: new Date().toISOString()
                    },
                    global: {
                        xp: 0,
                        collection: [],
                        befriendedPonies: [],
                        favorites: [],
                        joinedAt: new Date().toISOString()
                    },
                    stats: {
                        totalAllTimeBaked: 0,
                        totalClanMemberBaked: 0,
                        allTimeSold: 0,
                        totalBitsEarned: 0,
                        adventureSuccesses: 0,
                        adventureFailures: 0
                    },
                    coinflip: {
                        wins: 0,
                        losses: 0,
                        bitsWon: 0,
                        bitsLost: 0,
                        streak: 0,
                        winStreak: 0
                    },
                    wallet: {
                        bits: 0,
                        harmony: 0,
                        diamonds: 0,
                        tickets: 0,
                        tokens: 0,
                        crates: 0,
                        keys: 0,
                        loyalty: 0,
                        bank: { bits: 0, harmony: 0 }
                    },
                    bakery: {
                        name: bakery_name,
                        level: 1,
                        xp: 0,
                        bakestorage: 0,
                        maxbakestorage: 150,
                        nextLevelXP: 1000,
                        lastBaked: Date.now(),
                        lastProductionUpdate: Date.now(),
                        bonus: 0,
                        specialBonus: 0,
                        storageFullNotify: false,
                        storageFullNotified: false,
                        storageFullNotifyAt: 0,
                        items: starterBakeries,
                        itemsOwned: [1, 2, 3],
                        menu: [1, 2, 3],
                        hired: [],
                        boosters: [],
                        ponyProgress: {},
                        lastPonyBakeryLevelAwarded: 1,
                        rebirth: 0
                    },
                    boosters: [],
                    inventory: {
                        resources: { eggs: 0, milk: 0, apples: 0, sugar: 0, flower: 0, whipcream: 0, rainbow_apple: 0, grapes: 0, lettuce: 0, pineapple: 0, lime: 0, cherry: 0, watermelon: 0, banana: 0, kiwi: 0, wrench: 0, wood: 0, stone: 0, bolts: 0, hammer: 0, nails: 0, saw: 0 }
                    },
                    appearance: {
                        balanceTheme: 'default',
                        profileBackground: [],
                        bakeryBackground: [],
                        levelCardBG: [],
                        cosmetics: [],
                        activeCosmetics: []
                    },
                    features: {
                        unlocked: {
                            extraMenuSlot1: false,
                            extraMenuSlot2: false
                        },
                        purchasedThemes: []
                    },
                    clan: {
                        id: null,
                        role: null
                    },
                    adventure: {
                        cooldown: 0,
                        lastCompleted: 0,
                        notify: false
                    },
                    journey: {
                        health: 2000,
                        inventory: [],
                        powerups: []
                    },
                    server: {
                        inServer: false,
                        isServerBooster: false,
                        totalMessagesSent: [],
                        achievements: {
                            display: [],
                            accomplished: [],
                            completed: 0
                        },
                        clanData: {
                            level: [],
                            totalBaked: 0,
                            rank: [],
                            currentDimension: []
                        }
                    },
                    locations: {
                        owned: [1],
                        currentLocation: "Ponyville"
                    },
                    paymentCard: {
                        number: crypto.createHash('sha256').update(userId).digest().toString('hex').substring(0, 16),
                        issuedAt: new Date().toISOString()
                    }
                };

                try {
                    await createProfile(userId, {
                        eg_name,
                        eg_age,
                        eg_description,
                        bakeryName: bakery_name,
                        bakeries: starterBakeries,
                        bakeriesowned: [1, 2, 3],
                        menu: [1, 2, 3]
                    });
                } catch (e) {
                    try {
                        const profilesPath = path.join(__dirname, '..', 'data', 'profile', 'profiles.json');
                        let allProfiles = {};
                        try {
                            const raw = fs.readFileSync(profilesPath, 'utf8') || '';
                            allProfiles = raw ? JSON.parse(raw) : {};
                        } catch (parseErr) {
                            allProfiles = {};
                        }
                        allProfiles[userId] = profile;
                        fs.writeFileSync(profilesPath, JSON.stringify(allProfiles, null, 2));
                    } catch (writeErr) {
                        console.error('Failed to persist new profile:', writeErr);
                        try { await interaction.reply({ content: 'Failed to create your profile due to a server error.', flags: MessageFlags.Ephemeral }); } catch (_) {}
                        return;
                    }
                }

                try { await checkServerMembership(userId, interaction.client); } catch (e) { console.error('checkServerMembership failed after create:', e); }

                const imagePath = path.join(__dirname, '..', 'assets', 'canterlot_welcome.png');
                const hasImage = fs.existsSync(imagePath);

                const welcomeContainer = new ContainerBuilder().setAccentColor(0xE8A9FF);

                if (hasImage) {
                    welcomeContainer.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL('attachment://canterlot_welcome.png')
                        )
                    );
                }

                welcomeContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Welcome to Miralune, ${eg_name}!`)
                );

                welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                welcomeContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `Your profile has been created and your bakery is ready!\n\n` +
                        `**${eg_name}** · Age ${eg_age}${eg_description ? `\n> *${eg_description}*` : ''}\n\n` +
                        `🥐 **${bakery_name}**\n` +
                        `Your bakery comes with three starter items:\n` +
                        `> 🧁 Muffin · 🥧 Chocolate Pie · 🧁 Strawberry Cupcake`
                    )
                );

                welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                welcomeContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Getting Started:**\n` +
                        `> **/bake** — sell your baked goods and earn bits\n` +
                        `> **/bakery** — check your bakery stats & storage\n` +
                        `> **/shop** — buy new bakeries to earn more\n` +
                        `> **/adventure** — befriend ponies & Equestria Girls\n` +
                        `> **/balance** — view your wallet & bank\n` +
                        `> **/profile** — see your full profile card`
                    )
                );

                welcomeContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                welcomeContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `-# This bot is a fan-made project inspired by Minuette. Not affiliated with Hasbro.`
                    )
                );

                const bakeNowBtn = new ButtonBuilder().setCustomId('bake').setLabel('Bake Now!').setStyle(ButtonStyle.Success);
                const bakeryBtn = new ButtonBuilder().setCustomId('bakery').setLabel('View Bakery').setStyle(ButtonStyle.Secondary);
                welcomeContainer.addActionRowComponents(new ActionRowBuilder().addComponents(bakeNowBtn, bakeryBtn));

                try {
                    await interaction.reply({ content: 'Your profile has been created!', flags: MessageFlags.Ephemeral });
                    const channel = interaction.channel;
                    const msgPayload = {
                        components: [welcomeContainer.toJSON()],
                        flags: MessageFlags.IsComponentsV2
                    };
                    if (hasImage) msgPayload.files = [{ attachment: imagePath, name: 'canterlot_welcome.png' }];
                    await channel.send(msgPayload).catch(() => {});

                    try {
                        const { updateBakeryCounter } = require('../main');
                        if (updateBakeryCounter) updateBakeryCounter(interaction.client);
                    } catch {}
                } catch (err) {
                    console.error('Interaction handler error', err);
                    try {
                        await interaction.reply({
                            content: 'An error occurred while creating your profile.',
                            ephemeral: true
                        });
                    } catch {}
                }
            }
        } catch (err) {
            console.error('interactionCreate event error:', err);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({
                        content: 'An internal error occurred.',
                        ephemeral: true
                    });
                } catch {}
            }
        }
    }
};
