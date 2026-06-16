const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { BITS } = require('./_bakeryUtils');

const COIN_IMAGES = {
    flipping: 'coinflip/flipping.gif',
    heads: 'coinflip/heads.png',
    tails: 'coinflip/tails.png'
};

const SESSION_FILE = path.join(__dirname, '../../data/gamble/coinflip.json');

function loadSessions() {
    if (!fs.existsSync(SESSION_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
}

function saveSessions(sessions) {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
}

function removeSession(guildId, userId) {
    const sessions = loadSessions();
    if (sessions[guildId] && sessions[guildId][userId]) {
        delete sessions[guildId][userId];
        if (Object.keys(sessions[guildId]).length === 0) {
            delete sessions[guildId];
        }
    }
    saveSessions(sessions);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gambleflip')
        .setDescription('Gamble bits with another user in a coin flip!')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The user you want to gamble with')
                .setRequired(true)),

    async execute(interaction) {
        try {
            await interaction.deferReply().catch(() => {});
            await interaction.editReply({ content: '<a:loading:1488385574405406751> Loading Gamble...' }).catch(() => {});
        } catch (e) { }
        const opponent = interaction.options.getUser('opponent');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        if (opponent.id === userId) {
            return await sendOrFallback(interaction, { content: "You can't gamble with yourself!", flags: MessageFlags.Ephemeral });
        }

        const sessions = loadSessions();
        if (!sessions[guildId]) sessions[guildId] = {};

        if (sessions[guildId][userId] || sessions[guildId][opponent.id]) {
            return await sendOrFallback(interaction, { content: "One of the players is already in a gambling session!", flags: MessageFlags.Ephemeral });
        }

        sessions[guildId][userId] = {
            challenger: userId,
            opponent: opponent.id,
            status: 'pending',
            created: Date.now()
        };
        saveSessions(sessions);

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('accept_gamble')
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('decline_gamble')
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
            );

        await sendOrFallback(interaction, {
            content: `${opponent}, ${interaction.user} wants to gamble with you! You have 20 seconds to accept.`,
            components: [row]
        });

        const response = await interaction.fetchReply();
        const filter = i => ['accept_gamble', 'decline_gamble'].includes(i.customId) && i.user.id === opponent.id;
        try {
            const confirmation = await response.awaitMessageComponent({ filter, time: 20000 });

            if (confirmation.customId === 'accept_gamble') {
                sessions[guildId][userId].status = 'betting';
                saveSessions(sessions);

                const bettingRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('place_bet')
                            .setLabel('Place your Bet')
                            .setStyle(ButtonStyle.Primary)
                    );

                await interaction.editReply({
                    content: 'Both players, place your bets!',
                    components: [bettingRow]
                });

                const modalCollector = response.createMessageComponentCollector({
                    filter: i => i.customId === 'place_bet' &&
                        [userId, opponent.id].includes(i.user.id),
                    time: 60000
                });

                const bets = {};

                modalCollector.on('collect', async i => {
                    const modal = new ModalBuilder()
                        .setCustomId('betting_modal')
                        .setTitle('Place your Bet');

                    const bitsInput = new TextInputBuilder()
                        .setCustomId('bits_amount')
                        .setLabel('How many bits do you want to bet?')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    const sideInput = new TextInputBuilder()
                        .setCustomId('coin_side')
                        .setLabel('Choose heads or tails')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(bitsInput),
                        new ActionRowBuilder().addComponents(sideInput)
                    );

                    await i.showModal(modal);

                    try {
                        const modalResponse = await i.awaitModalSubmit({ time: 30000 });
                        const bits = parseInt(modalResponse.fields.getTextInputValue('bits_amount'));
                        const side = modalResponse.fields.getTextInputValue('coin_side').toLowerCase();

                        if (isNaN(bits) || bits < 1) {
                            await modalResponse.reply({ content: 'Invalid bet amount!', ephemeral: true });
                            return;
                        }

                        if (!['heads', 'tails'].includes(side)) {
                            await modalResponse.reply({ content: 'Invalid side choice! Use heads or tails.', ephemeral: true });
                            return;
                        }

                        const profile = getProfile(i.user.id, guildId);
                        if (profile.server.balances.bits < bits) {
                            await modalResponse.reply({ content: 'You don\'t have enough bits!', ephemeral: true });
                            return;
                        }

                        bets[i.user.id] = { bits, side };
                        await modalResponse.reply({ content: 'Bet placed! Waiting for opponent...', ephemeral: true });

                        if (Object.keys(bets).length === 2) {
                            modalCollector.stop('complete');

                            const result = Math.random() < 0.5 ? 'heads' : 'tails';
                            const winners = Object.entries(bets).filter(([_, bet]) => bet.side === result);
                            const totalPot = Object.values(bets).reduce((sum, bet) => sum + bet.bits, 0);

                            Object.entries(bets).forEach(([playerId, bet]) => {
                                const playerProfile = getProfile(playerId, guildId);
                                playerProfile.server.balances.bits -= bet.bits;
                                updateProfile(playerId, guildId, playerProfile.server);
                            });

                            if (winners.length > 0) {
                                winners.forEach(([winnerId]) => {
                                    const winnerProfile = getProfile(winnerId, guildId);
                                    winnerProfile.server.balances.bits += totalPot;
                                    updateProfile(winnerId, guildId, winnerProfile.server);
                                });
                            }

                            const resultEmbed = new EmbedBuilder()
                                .setTitle('Gambling Results')
                                .setDescription(`The coin landed on ${result}!`)
                                .addFields(
                                    { name: 'Total Pot', value: `${BITS} ${totalPot}`, inline: true },
                                    { name: 'Winner(s)', value: winners.map(([id]) => `<@${id}>`).join(', ') || 'No winners!' }
                                )
                                .setColor(winners.length > 0 ? 0x57F287 : 0xED4245)
                                .setImage(`attachment://${result}.png`);

                            await interaction.editReply({
                                content: 'The gambling session has ended!',
                                embeds: [resultEmbed],
                                components: [],
                                files: [{
                                    attachment: path.join(__dirname, '../../assets', COIN_IMAGES[result]),
                                    name: `${result}.png`
                                }]
                            });

                            removeSession(guildId, userId);
                        }
                    } catch (err) {
                        console.error(err);
                    }
                });

                modalCollector.on('end', (_, reason) => {
                    if (reason !== 'complete') {
                        interaction.editReply({
                            content: 'The gambling session has expired!',
                            components: []
                        });
                        removeSession(guildId, userId);
                    }
                });

            } else {
                await interaction.editReply({
                    content: 'Gambling request declined.',
                    components: []
                });
                removeSession(guildId, userId);
            }

        } catch (e) {
            await interaction.editReply({
                content: 'No response received, gambling request expired.',
                components: []
            });
            removeSession(guildId, userId);
        }
    }
};
