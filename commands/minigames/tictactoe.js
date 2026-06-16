const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');
const TicTacToeGrid = require('../../model/TicTacToeGrid');
const TicTacToeImageGrid = require('../../model/TicTacToeImageGrid');

const games = {};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Challenge someone to a game of Tic Tac Toe!')
        .addUserOption(option => option.setName('opponent').setDescription('The user to challenge').setRequired(true)),
    async execute(interaction) {
        try {
            await interaction.deferReply();
        } catch (e) { }
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('opponent');
        if (!opponent || opponent.bot || opponent.id === challenger.id) {
            if (interaction.deferred) {
                await interaction.editReply({ content: 'Please choose a valid user to challenge!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'Please choose a valid user to challenge!', flags: MessageFlags.Ephemeral });
            }
            return;
        }

        const challengeContainer = new ContainerBuilder();
        challengeContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**🎮 Tic Tac Toe Challenge**\n\n${challenger.toString()} (X) vs ${opponent.toString()} (O)`)
        );

        challengeContainer.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true)
        );

        challengeContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${opponent.toString()}, you've been challenged! Click a button below to accept or decline.`)
        );

        challengeContainer.addActionRowComponents(ar => ar.setComponents(
            new ButtonBuilder().setCustomId('ttt_accept').setLabel('Accept').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ttt_decline').setLabel('Decline').setEmoji('❌').setStyle(ButtonStyle.Danger)
        ));

        if (interaction.deferred) {
            await interaction.editReply({
                components: [challengeContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } else {
            await interaction.reply({
                components: [challengeContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
        const msg = await interaction.fetchReply();

        games[msg.id] = {
            challengerId: challenger.id,
            opponentId: opponent.id,
            challenger: challenger,
            opponent: opponent,
            state: 'pending',
            currentTurn: challenger.id,
            grid: new TicTacToeGrid(),
            timeout: setTimeout(async () => {
                if (games[msg.id] && games[msg.id].state === 'pending') {
                    games[msg.id].state = 'expired';
                    const expiredContainer = new ContainerBuilder();
                    expiredContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('Game has expired.')
                    );
                    try {
                        await msg.edit({
                            components: [expiredContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                    } catch (e) {}
                    delete games[msg.id];
                }
            }, 15000)
        };
    },

    async handleInteraction(interaction) {
        const game = games[interaction.message.id];
        if (!game) return;

        if (interaction.customId === 'ttt_accept') {
            if (interaction.user.id !== game.opponentId) {
                await interaction.reply({ content: 'This challenge is not for you!', flags: MessageFlags.Ephemeral });
                return;
            }

            clearTimeout(game.timeout);
            game.state = 'active';

            const container = new ContainerBuilder();
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**🎮 Tic Tac Toe**\n\n${game.challenger} (X) vs ${game.opponent} (O)\n${game.challenger}'s turn (X)`)
            );

            let attachment = null;
            try {
                const imgBuf = await TicTacToeImageGrid.renderFromGrid(game.grid.grid);
                attachment = new AttachmentBuilder(imgBuf, { name: 'tictactoe.png' });
                const mediaGallery = new MediaGalleryBuilder();
                const galleryItem = new MediaGalleryItemBuilder().setURL('attachment://tictactoe.png');
                mediaGallery.addItems(galleryItem);
                container.addMediaGalleryComponents(mediaGallery);
            } catch (err) {
                console.error('Failed to render tic tac toe image:', err);
            }

            const rows = game.grid.renderButtons().map(row => {
                return row.map(b => {
                    const btn = new ButtonBuilder().setCustomId(b.customId).setStyle(b.style).setDisabled(!!b.disabled);
                    if (b.emoji) btn.setEmoji(b.emoji); else btn.setLabel(' ');
                    return btn;
                });
            });
            rows.forEach(rowBtns => container.addActionRowComponents(ar => ar.setComponents(...rowBtns)));

            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            await interaction.update({
                components: [container],
                files: attachment ? [attachment] : [],
                flags: MessageFlags.IsComponentsV2
            });
            return;
        }

        if (interaction.customId === 'ttt_decline') {
            if (interaction.user.id !== game.opponentId) {
                await interaction.reply({ content: 'This challenge is not for you!', flags: MessageFlags.Ephemeral });
                return;
            }

            clearTimeout(game.timeout);

            const declineContainer = new ContainerBuilder();
            declineContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${game.opponent} has declined the challenge.`)
            );

            await interaction.update({
                components: [declineContainer],
                flags: MessageFlags.IsComponentsV2
            });
            delete games[interaction.message.id];
            return;
        }

        if (!interaction.customId.startsWith('ttt_') || game.state !== 'active') return;

        if (interaction.user.id !== game.currentTurn) {
            await interaction.reply({ content: "It's not your turn!", flags: MessageFlags.Ephemeral });
            return;
        }

        const [_, row, col] = interaction.customId.split('_');
        const moveSuccess = game.grid.makeMove(parseInt(row), parseInt(col),
            game.currentTurn === game.challengerId ? 1 : 2);

        if (!moveSuccess) {
            await interaction.reply({ content: 'That space is already taken!', flags: MessageFlags.Ephemeral });
            return;
        }

        const winner = game.grid.checkWinner();
        const isTie = !winner && game.grid.isFull();

        let description;
        if (winner) {
            const winnerUser = winner === 'X' ? game.challenger : game.opponent;
            description = `**🏆 ${winnerUser} Wins!**\n\n${game.challenger} (X) vs ${game.opponent} (O)`;
            game.state = 'ended';
        } else if (isTie) {
            description = `**🤝 It's a Tie!**\n\n${game.challenger} (X) vs ${game.opponent} (O)`;
            game.state = 'ended';
        } else {
            game.currentTurn = game.currentTurn === game.challengerId ? game.opponentId : game.challengerId;
            const currentPlayer = game.currentTurn === game.challengerId ? game.challenger : game.opponent;
            const symbol = game.currentTurn === game.challengerId ? 'X' : 'O';
            description = `**🎮 Tic Tac Toe**\n\n${game.challenger} (X) vs ${game.opponent} (O)\n${currentPlayer}'s turn (${symbol})`;
        }

        const container = new ContainerBuilder();
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(description)
        );

        let attachment = null;
        try {
            const imgBuf = await TicTacToeImageGrid.renderFromGrid(game.grid.grid);
            attachment = new AttachmentBuilder(imgBuf, { name: 'tictactoe.png' });
            const mediaGallery = new MediaGalleryBuilder();
            const galleryItem = new MediaGalleryItemBuilder().setURL('attachment://tictactoe.png');
            mediaGallery.addItems(galleryItem);
            container.addMediaGalleryComponents(mediaGallery);
        } catch (err) {
            console.error('Failed to render tic tac toe image:', err);
        }

        const rows = game.grid.renderButtons(game.state === 'active' ? game.currentTurn : null).map(row => {
            return row.map(b => {
                const btn = new ButtonBuilder().setCustomId(b.customId).setStyle(b.style).setDisabled(!!b.disabled);
                if (b.emoji) btn.setEmoji(b.emoji); else btn.setLabel(' ');
                return btn;
            });
        });
        rows.forEach(rowBtns => container.addActionRowComponents(ar => ar.setComponents(...rowBtns)));

        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

        await interaction.update({
            components: [container],
            files: attachment ? [attachment] : [],
            flags: MessageFlags.IsComponentsV2
        });

        if (game.state === 'ended') {
            delete games[interaction.message.id];
        }
    },

    games
};
