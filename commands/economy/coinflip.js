const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { BITS } = require('./currencyEmojis');
const { sendOrFallback } = require('../../utils/safeReply');
const { sendNoProfile } = require('../../utils/noProfileResponse');

const lastFlip = new Map();
const COIN_IMAGES = {
    flipping: 'coinflip_assets/flipping.gif',
    heads: 'coinflip_assets/heads.png',
    tails: 'coinflip_assets/tails.png'
};
const MAX_BET = 500000;
const FLIP_MIN = 3000;
const FLIP_MAX = 7000;
const COOLDOWN = 2000;

const WIN_MESSAGES = [
    'Congrats, you won {amount} bits!',
    'Lucky flip! You gained {amount} bits!',
    'Heads up! You just scored {amount} bits!',
    'Winner winner, bits for dinner! +{amount} bits!',
    'You called it! {amount} bits added to your stash.',
    'You must be cheating! {amount} bits richer.',
    'Unbelievable luck! {amount} bits for you.',
    'The coin bows to your will. {amount} bits won!',
    'You flipped the system! {amount} bits gained.',
    'How do you keep winning? {amount} bits more.'
];

const LOSE_MESSAGES = [
    'You lost {amount} bits. Ouch!',
    'You just had to gamble huh? -{amount} bits.',
    'Bad luck! {amount} bits gone.',
    'The coin was not in your favor. Lost {amount} bits.',
    'Better luck next time! {amount} bits lost.',
    'The universe says no. {amount} bits lost.',
    'You flipped... and flopped. {amount} bits gone.',
    'That was embarrassing. -{amount} bits.',
    'You really thought you\'d win? {amount} bits lost.',
    'The coin hates you. {amount} bits vanished.'
];

const STREAK_MESSAGES = [
    'Just stop trying, you\'re going broke.',
    'Seriously, maybe take a break?',
    'The coin hates you. Time to quit.',
    'You\'re on a losing streak worthy of a documentary.',
    'Your luck is so bad it\'s impressive.',
    'Ever considered NOT gambling?',
    'You\'re making the coin rich, not yourself.',
    'This is getting sad. Walk away.',
    'You\'re rage-baiting yourself at this point.'
];

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Bet bits on a coin flip! 50/50 chance to win or lose.')
        .addStringOption(opt =>
            opt.setName('amount')
                .setDescription('Amount of bits to bet (max 500,000, use "all" or "50%" for shortcuts)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('guess')
                .setDescription('Your guess: heads or tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                )
        ),
    async execute(interaction) {
        try {
            await interaction.deferReply().catch(() => {});
            await interaction.editReply({ content: '<a:loading:1488385574405406751> Flipping Coin...' }).catch(() => {});
        } catch (e) { }
        const userId = interaction.user.id;
        const profile = getProfile(userId);
        if (!profile) {
            return await sendNoProfile(interaction);
        }
        if (!profile.balances || typeof profile.balances.bits !== 'number') {
            profile.balances = profile.balances || {};
            profile.balances.bits = 0;
        }

        const guess = interaction.options.getString('guess');
        if (!['heads', 'tails'].includes(guess)) {
            return await sendOrFallback(interaction, { content: 'Invalid guess. Choose heads or tails.', flags: MessageFlags.Ephemeral });
        }

        const now = Date.now();
        const lastFlipTime = lastFlip.get(userId) || 0;
        if (now - lastFlipTime < COOLDOWN) {
            return await sendOrFallback(interaction, { content: 'Please wait a moment between flips!' });
        }
        lastFlip.set(userId, now);

        if (!profile.coinflipStats) {
            profile.coinflipStats = {
                wins: 0,
                losses: 0,
                bitsWon: 0,
                bitsLost: 0
            };
        }

        let bet = interaction.options.getString('amount');
        if (bet.toLowerCase() === 'all') {
            bet = profile.balances.bits;
        } else if (bet.endsWith('%')) {
            const percentage = parseInt(bet);
            if (percentage > 0 && percentage <= 100) {
                bet = Math.floor(profile.balances.bits * (percentage / 100));
            } else {
                return await sendOrFallback(interaction, { content: 'Invalid percentage. Use 1-100%.', flags: MessageFlags.Ephemeral });
            }
        } else {
            bet = parseInt(bet);
        }

        if (bet < 1 || bet > MAX_BET) {
            return await sendOrFallback(interaction, { content: `Bet must be between 1 and ${MAX_BET} bits.`, flags: MessageFlags.Ephemeral });
        }
        if (profile.balances.bits < bet) {
            return await sendOrFallback(interaction, { content: `You don't have enough bits to bet!`, flags: MessageFlags.Ephemeral });
        }

        if (!profile.coinflipStreak) profile.coinflipStreak = 0;

        const flippingPath = path.join(__dirname, '../../assets', COIN_IMAGES.flipping);

        function buildFlippingContainer() {
            const container = new ContainerBuilder().setAccentColor(0x5865F2);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## 🪙 Flipping the coin...')
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `> Bet: ${BITS} **${bet.toLocaleString()}** bits\n` +
                    `> Potential win: ${BITS} **${(bet * 2).toLocaleString()}** bits\n` +
                    `> Your guess: **${guess.charAt(0).toUpperCase() + guess.slice(1)}**`
                )
            );
            const files = [];
            if (fs.existsSync(flippingPath)) {
                container.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL('attachment://flipping.gif')
                    )
                );
                files.push(new AttachmentBuilder(flippingPath, { name: 'flipping.gif' }));
            }
            return { container, files };
        }

        const { container: flipContainer, files: flipFiles } = buildFlippingContainer();
        try {
            await sendOrFallback(interaction, {
                components: [flipContainer.toJSON()],
                files: flipFiles,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (e) {
            console.error('Failed to send initial flip reply:', e);
        }

        const performFlip = async () => {
            const flipTime = Math.floor(Math.random() * (FLIP_MAX - FLIP_MIN + 1)) + FLIP_MIN;
            await sleep(flipTime);

            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const win = guess === result;

            const latestProfile = getProfile(userId);
            if (!latestProfile.balances) latestProfile.balances = { bits: 0 };

            if (win) {
                const winnings = bet * 2;
                latestProfile.balances.bits += winnings;
                latestProfile.coinflipWinStreak = (latestProfile.coinflipWinStreak || 0) + 1;
                latestProfile.coinflipStreak = 0;
                latestProfile.coinflipStats.wins++;
                latestProfile.coinflipStats.bitsWon += winnings;
            } else {
                latestProfile.balances.bits -= bet;
                latestProfile.coinflipWinStreak = 0;
                latestProfile.coinflipStreak = (latestProfile.coinflipStreak || 0) + 1;
                latestProfile.coinflipStats.losses++;
                latestProfile.coinflipStats.bitsLost += bet;
            }
            updateProfile(userId, latestProfile);

            const imgFile = path.join(__dirname, '../../assets', COIN_IMAGES[result]);
            const imgName = `${result}.png`;

            const resultContainer = new ContainerBuilder().setAccentColor(win ? 0x57F287 : 0xED4245);
            resultContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    win ? `## ✅ You Won!` : `## ❌ You Lost!`
                )
            );
            resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            const winStreak = latestProfile.coinflipWinStreak || 0;
            const loseStreak = latestProfile.coinflipStreak || 0;
            const totalFlips = (latestProfile.coinflipStats.wins || 0) + (latestProfile.coinflipStats.losses || 0);
            const winRate = totalFlips > 0 ? Math.round((latestProfile.coinflipStats.wins / totalFlips) * 100) : 0;

            let resultMsg = win
                ? getRandom(WIN_MESSAGES).replace('{amount}', bet.toLocaleString())
                : getRandom(LOSE_MESSAGES).replace('{amount}', bet.toLocaleString());
            if (!win && loseStreak >= 2) resultMsg += `\n-# ${getRandom(STREAK_MESSAGES)}`;

            resultContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `> ${resultMsg}\n\n` +
                    `> Coin landed: **${result.charAt(0).toUpperCase() + result.slice(1)}**  •  Your guess: **${guess.charAt(0).toUpperCase() + guess.slice(1)}**`
                )
            );

            const resultFiles = [];
            if (fs.existsSync(imgFile)) {
                resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(false));
                resultContainer.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(`attachment://${imgName}`)
                    )
                );
                resultFiles.push(new AttachmentBuilder(imgFile, { name: imgName }));
            }

            resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            resultContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${BITS} **Balance:** ${latestProfile.balances.bits.toLocaleString()} bits\n` +
                    `📊 **Stats:** ${latestProfile.coinflipStats.wins}W / ${latestProfile.coinflipStats.losses}L  (${winRate}% win rate)` +
                    (win && winStreak > 1 ? `\n🔥 **Win streak:** ${winStreak}` : '') +
                    (!win && loseStreak > 1 ? `\n💀 **Lose streak:** ${loseStreak}` : '')
                )
            );
            resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            resultContainer.addActionRowComponents(ar => ar.setComponents(
                new ButtonBuilder().setCustomId('coinflip_again').setLabel('Flip Again').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('coinflip_double').setLabel('Double or Nothing').setStyle(win ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(!win || bet * 2 > MAX_BET || latestProfile.balances.bits < bet * 2)
            ));

            try {
                await interaction.editReply({
                    components: [resultContainer.toJSON()],
                    files: resultFiles,
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (e) {
                console.error('Failed to edit flip result:', e);
            }

            try {
                const msg = await interaction.fetchReply();
                const collector = msg.createMessageComponentCollector({
                    filter: i => ['coinflip_again', 'coinflip_double'].includes(i.customId) && i.user.id === userId,
                    time: 60000,
                    max: 1
                });

                collector.on('collect', async i => {
                    await i.deferUpdate();
                    const checkProfile = getProfile(userId);
                    if (!checkProfile || !checkProfile.balances) checkProfile.balances = { bits: 0 };

                    const nextBet = i.customId === 'coinflip_double' ? bet * 2 : bet;

                    if (checkProfile.balances.bits < nextBet) {
                        const noFundsContainer = new ContainerBuilder().setAccentColor(0xED4245);
                        noFundsContainer.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `## 💸 Not Enough Bits\n> You need ${BITS} **${nextBet.toLocaleString()}** bits but only have **${checkProfile.balances.bits.toLocaleString()}**.`
                            )
                        );
                        try {
                            await interaction.editReply({
                                components: [noFundsContainer.toJSON()],
                                files: [],
                                flags: MessageFlags.IsComponentsV2
                            });
                        } catch (e) {
                            console.error('Failed to show not enough bits:', e);
                        }
                        return;
                    }

                    if (i.customId === 'coinflip_double') bet = nextBet;

                    const { container: againContainer, files: againFiles } = buildFlippingContainer();
                    try {
                        await interaction.editReply({
                            components: [againContainer.toJSON()],
                            files: againFiles,
                            flags: MessageFlags.IsComponentsV2
                        });
                    } catch (e) {
                        console.error('Failed to show flipping state:', e);
                    }
                    await performFlip();
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {

                        const expiredContainer = new ContainerBuilder().setAccentColor(win ? 0x57F287 : 0xED4245);
                        expiredContainer.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                win ? `## ✅ You Won!` : `## ❌ You Lost!`
                            )
                        );
                        expiredContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                        expiredContainer.addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${BITS} **Balance:** ${latestProfile.balances.bits.toLocaleString()} bits\n` +
                                `📊 **Stats:** ${latestProfile.coinflipStats.wins}W / ${latestProfile.coinflipStats.losses}L  (${winRate}% win rate)`
                            )
                        );
                        interaction.editReply({ components: [expiredContainer.toJSON()], files: [], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                    }
                });
            } catch (e) {
                console.error('Failed to set up flip collector:', e);
            }
        };

        await performFlip();
    }
};
