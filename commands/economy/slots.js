const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { BITS } = require('./currencyEmojis');
const { sendNoProfile } = require('../../utils/noProfileResponse');

const SYMBOLS = {
    '🎰': { name: 'JACKPOT', weight: 1, payout: 50 },
    '💎': { name: 'Diamond', weight: 2, payout: 25 },
    '🌟': { name: 'Star', weight: 3, payout: 10 },
    '🍎': { name: 'Apple', weight: 4, payout: 5 },
    '🍪': { name: 'Cookie', weight: 5, payout: 3 },
    '🎂': { name: 'Cake', weight: 6, payout: 2 }
};

const WEIGHTED_SYMBOLS = Object.entries(SYMBOLS).flatMap(([symbol, info]) =>
    Array(info.weight).fill(symbol)
);

function getRandomSymbol() {
    return WEIGHTED_SYMBOLS[Math.floor(Math.random() * WEIGHTED_SYMBOLS.length)];
}

function calculateWinnings(symbols, betAmount) {
    if (symbols.every(s => s === symbols[0])) {
        return betAmount * SYMBOLS[symbols[0]].payout;
    }

    const counts = symbols.reduce((acc, symbol) => {
        acc[symbol] = (acc[symbol] || 0) + 1;
        return acc;
    }, {});

    const maxCount = Math.max(...Object.values(counts));
    if (maxCount === 2) {
        const pairSymbol = Object.keys(counts).find(symbol => counts[symbol] === 2);
        return Math.floor(betAmount * (SYMBOLS[pairSymbol].payout * 0.5));
    }

    return 0;
}

async function spinSlots(interaction, betAmount) {

    const spinningEmbed = new EmbedBuilder()
        .setTitle('🎰 Slots Machine')
        .setDescription('Spinning...\n⚪ ⚪ ⚪')
        .setColor(0xFFD700)
        .setFooter({ text: `Bet: ${betAmount} ${BITS}` });

    const message = await interaction.reply({
        embeds: [spinningEmbed],
        withResponse: true
    });

    const finalSymbols = [
        getRandomSymbol(),
        getRandomSymbol(),
        getRandomSymbol()
    ];
    for (let i = 0; i < 3; i++) {

        await new Promise(resolve => setTimeout(resolve, 1000));

        const currentDisplay = finalSymbols.map((symbol, index) =>
            index <= i ? symbol : '⚪'
        ).join(' ');

        const spinningEmbed = new EmbedBuilder()
            .setTitle('🎰 Slots Machine')
            .setDescription(`Spinning...\n${currentDisplay}`)
            .setColor(0xFFD700)
            .setFooter({ text: `Bet: ${betAmount} ${BITS}` });

        await message.edit({ embeds: [spinningEmbed] });
    }

    const winAmount = calculateWinnings(finalSymbols, betAmount);
    const isWin = winAmount > 0;

    const profile = getProfile(interaction.user.id);
    profile.balances = profile.balances || {};
    profile.balances.bits = (profile.balances.bits || 0) + winAmount - betAmount;
    await updateProfile(interaction.user.id, { balances: profile.balances });

    const finalEmbed = new EmbedBuilder()
        .setTitle(isWin ? '🎰 Winner!' : '🎰 Better luck next time!')
        .setDescription(`Final Result:\n${finalSymbols.join(' ')}\n\n${
            isWin
                ? `You won ${winAmount} ${BITS}!`
                : 'No winning combination'
        }\n\nNew Balance: ${profile.balances.bits} ${BITS}`)
        .setColor(isWin ? 0x00FF00 : 0xFF0000)
        .setFooter({ text: `Bet: ${betAmount} ${BITS}` });

    await message.edit({ embeds: [finalEmbed] });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Try your luck at the slots machine!')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of bits to bet')
                .setRequired(true)
                .setMinValue(10)
                .setMaxValue(100000)),

    async execute(interaction) {
        try { await interaction.deferReply({ flags: MessageFlags.IsLoading }).catch(() => {}); } catch (e) { }
        try {
            const betAmount = interaction.options.getInteger('amount');
            const profile = getProfile(interaction.user.id);

            if (!profile) {
                await sendNoProfile(interaction);
                return;
            }

            if (!profile.balances?.bits || profile.balances.bits < betAmount) {
                await interaction.reply({
                    content: `You don't have enough bits! You have ${profile.balances?.bits || 0} ${BITS}`,
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await spinSlots(interaction, betAmount);

        } catch (error) {
            console.error('Slots command error:', error);
            await interaction.reply({
                content: 'An error occurred while playing slots.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
