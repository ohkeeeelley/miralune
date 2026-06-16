const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

class LeaderboardRenderer {
  static backgroundCache = null;

  /**
   * @param {string} title - Category title (e.g. "Top 10 Richest Bits")
   * @param {Array<{rank: number, username: string, value: string}>} entries - Top 10 entries
   * @returns {Promise<Buffer>} PNG buffer
   */
  static async generateLeaderboardImage(title, entries) {
    const bgPath = path.join(__dirname, '../assets/leaderboard_assets/leaderboard_bg.png');
    if (!fs.existsSync(bgPath)) {
      throw new Error(`Leaderboard background not found at ${bgPath}`);
    }

    let bg = this.backgroundCache;
    if (!bg) {
      bg = await loadImage(bgPath);
      this.backgroundCache = bg;
    }

    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bg, 0, 0);

    const width = bg.width;
    const height = bg.height;

    ctx.font = 'bold 26px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 45);
    ctx.textAlign = 'left';

    const startY = 100;
    const rowHeight = (height - startY - 20) / 10;

    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

    for (let i = 0; i < 10; i++) {
      const y = startY + i * rowHeight + rowHeight / 2 + 6;
      const entry = entries[i];

      const rankText = `${i + 1}.`;
      if (i < 3) {
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = medalColors[i];
      } else {
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = '#DDDDDD';
      }
      ctx.fillText(rankText, 30, y);

      if (!entry) {
        ctx.font = '20px Arial';
        ctx.fillStyle = '#888888';
        ctx.fillText('—', 75, y);
        continue;
      }

      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#FFFFFF';
      const displayName = entry.username.length > 18
        ? entry.username.slice(0, 16) + '…'
        : entry.username;
      ctx.fillText(displayName, 75, y);

      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'right';
      ctx.fillText(entry.value, width - 30, y);
      ctx.textAlign = 'left';
    }

    return canvas.toBuffer('image/png');
  }
}

module.exports = LeaderboardRenderer;
