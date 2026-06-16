const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

let _backgroundPromise = null;
let _xImagePromise = null;
let _oImagePromise = null;

class TicTacToeImageGrid {
  static async loadImages() {
    const assetsPath = path.join(__dirname, '..', 'assets', 'minigame_assets');
    const bgPath = path.join(assetsPath, 'tictactoe.png');
    const xPath = path.join(assetsPath, 'X.png');
    const oPath = path.join(assetsPath, 'O.png');

    if (!fs.existsSync(bgPath)) throw new Error('Missing tictactoe.png background');
    if (!fs.existsSync(xPath)) throw new Error('Missing X.png');
    if (!fs.existsSync(oPath)) throw new Error('Missing O.png');

    if (!_backgroundPromise) _backgroundPromise = loadImage(bgPath);
    if (!_xImagePromise) _xImagePromise = loadImage(xPath);
    if (!_oImagePromise) _oImagePromise = loadImage(oPath);

    const imgs = await Promise.all([_backgroundPromise, _xImagePromise, _oImagePromise]);
    return imgs;
  }

  static drawGridLines(ctx, width, height, options = {}) {
    const lineColor = options.lineColor || '#FFFFFF';
    const vAlpha = typeof options.vLineAlpha === 'number' ? options.vLineAlpha : 1;
    const hAlpha = typeof options.hLineAlpha === 'number' ? options.hLineAlpha : 1;
    const lineWidth = typeof options.lineWidth === 'number' ? options.lineWidth : 8;

    const cellW = width / 3;
    const cellH = height / 3;
    const pad = Math.max(6, Math.floor(Math.min(width, height) * 0.02));

    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = TicTacToeImageGrid._hexToRgba(lineColor, vAlpha);
    ctx.beginPath();
    ctx.moveTo(cellW, pad);
    ctx.lineTo(cellW, height - pad);
    ctx.moveTo(cellW * 2, pad);
    ctx.lineTo(cellW * 2, height - pad);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = TicTacToeImageGrid._hexToRgba(lineColor, hAlpha);
    ctx.beginPath();
    ctx.moveTo(pad, cellH);
    ctx.lineTo(width - pad, cellH);
    ctx.moveTo(pad, cellH * 2);
    ctx.lineTo(width - pad, cellH * 2);
    ctx.stroke();
    ctx.restore();
  }

  static _hexToRgba(hex, alpha) {
    const h = hex.replace('#', '').trim();
    if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(h.slice(0,2), 16);
    const g = parseInt(h.slice(2,4), 16);
    const b = parseInt(h.slice(4,6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  static async renderFromGrid(grid, options = {}) {
    const [bg, xImg, oImg] = await this.loadImages();
    const width = bg.width || (options.maxSize || 512);
    const height = bg.height || (options.maxSize || 512);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bg, 0, 0, width, height);

  this.drawGridLines(ctx, width, height, options);

    const cellW = width / 3;
    const cellH = height / 3;
    const imgSize = Math.min(cellW, cellH) * (options.sizeMultiplier || 0.7);

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const val = (grid && grid[r] && grid[r][c]) || 0;
        if (!val) continue;
        const img = val === 1 ? xImg : oImg;
        const x = c * cellW + (cellW - imgSize) / 2;
        const y = r * cellH + (cellH - imgSize) / 2;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        try {
          ctx.drawImage(img, x, y, imgSize, imgSize);
        } catch (e) {
          console.error('Error drawing X/O image:', e);
        }
        ctx.restore();
      }
    }

    return canvas.toBuffer();
  }
}

module.exports = TicTacToeImageGrid;
