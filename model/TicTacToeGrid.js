const { ButtonStyle } = require('discord.js');

class TicTacToeGrid {
    constructor() {
        this.grid = Array(3).fill(null).map(() => Array(3).fill(0));
    }

    renderGridString() {
        const rows = this.grid.map(r => r.map(cell => {
            if (cell === 1) return '❌';
            if (cell === 2) return '⭕';
            return '▫';
        }).join(' '));
        return rows.join('\n');
    }

    makeMove(row, col, player) {
        if (this.grid[row][col] === 0) {
            this.grid[row][col] = player;
            return true;
        }
        return false;
    }

    checkWinner() {
        const lines = [
            ...this.grid,
            ...[0,1,2].map(i => this.grid.map(row => row[i])),
            [0,1,2].map(i => this.grid[i][i]),
            [0,1,2].map(i => this.grid[i][2-i])
        ];
        for (const line of lines) {
            if (line.every(cell => cell === 1)) return 'X';
            if (line.every(cell => cell === 2)) return 'O';
        }
        return null;
    }

    isFull() {
        return this.grid.flat().every(cell => cell !== 0);
    }

    renderButtons(currentPlayer) {
        return this.grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
                let style = ButtonStyle.Secondary;
                let emoji = null;
                let disabled = false;

                if (cell === 1) {
                    emoji = '❌';
                    style = ButtonStyle.Danger;
                    disabled = true;
                } else if (cell === 2) {
                    emoji = '⭕';
                    style = ButtonStyle.Primary;
                    disabled = true;
                } else {
                    emoji = '▫';
                    if (currentPlayer === null) disabled = true;
                }

                return {
                    customId: `ttt_${rowIndex}_${colIndex}`,
                    emoji,
                    style,
                    disabled
                };
            })
        );
    }
}

module.exports = TicTacToeGrid;
