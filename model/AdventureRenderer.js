const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const UI_CONFIG = {
  width: 950,
  height: 1400,
  backgroundColor: '#2a2623',
  accentColor: '#3a3733',
  borderColor: '#5a5a5a',
  borderWidth: 2,
  cornerRadius: 16,
  padding: 25,

  header: {
    font: 'bold 36px Arial',
    color: '#ffffff',
    y: 50,
    textAlign: 'center'
  },

  subtitle: {
    font: '16px Arial',
    color: '#b5bac1',
    y: 80,
    textAlign: 'center'
  },

  separator: {
    color: '#5a5a5a',
    width: 1,
    margin: 10
  },

  mediaGallery: {
    label: {
      font: '14px Arial',
      color: '#949ba4',
      y: 115
    }
  },

  rarityLabel: {
    font: 'bold 24px Arial',
    textAlign: 'center',
    rarityColors: {
      'Common': '#a0a0a0',
      'Rare': '#4da6ff',
      'Epic': '#b366cc',
      'Majestic': '#ff5555',
      'Legend': '#ffb830',
      'Goddess': '#ff4db3',
      'Secret': '#2dd4bf',
      'Radiance': '#ffd700'
    },
    rarityEmojis: {
      'Common': '⚪',
      'Rare': '🔵',
      'Epic': '🟣',
      'Majestic': '🔴',
      'Legend': '🟠',
      'Goddess': '🩷',
      'Secret': '💎',
      'Radiance': '⭐'
    }
  },

  ponyImage: {
    x: 100,
    y: 150,
    width: 750,
    height: 500,
    cornerRadius: 12,
    borderColor: '#5a5a5a',
    borderWidth: 2
  },

  exploringText: {
    font: '14px Arial',
    color: '#b5bac1',
    y: 705,
    textAlign: 'center'
  },

  hintSection: {
    y: 755,
    font: 'bold 16px Arial',
    labelColor: '#b5bac1',
    hintColor: '#ffffff',
    hintBgColor: '#3a3733',
    hintPadding: 15,
    cornerRadius: 8,
    lineHeight: 28
  },

  instructionsSection: {
    y: 1050,
    font: '15px Arial',
    color: '#949ba4',
    textAlign: 'center',
    maxWidth: 850,
    lineHeight: 22
  },

  timer: {
    y: 1350,
    font: 'bold 16px Arial',
    color: '#5865f2',
    textAlign: 'center'
  }
};

function fetchBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    try {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).toString();
          return resolve(fetchBuffer(next, redirectCount + 1));
        }
        if (res.statusCode !== 200) return reject(new Error(`Failed to fetch image, status ${res.statusCode}`));
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function renderAdventure(ponyData = {}, options = {}) {
  const cfg = { ...UI_CONFIG, ...(options || {}) };

  const canvas = createCanvas(cfg.width, cfg.height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = cfg.backgroundColor;
  ctx.fillRect(0, 0, cfg.width, cfg.height);

  ctx.strokeStyle = cfg.borderColor;
  ctx.lineWidth = cfg.borderWidth;
  roundRect(ctx, 0, 0, cfg.width, cfg.height, cfg.cornerRadius);
  ctx.stroke();

  ctx.fillStyle = cfg.header.color;
  ctx.font = cfg.header.font;
  ctx.textAlign = cfg.header.textAlign;
  const rarityColor = cfg.rarityLabel.rarityColors[ponyData.rarity] || '#ffffff';
  const rarityEmoji = cfg.rarityLabel.rarityEmojis[ponyData.rarity] || '❓';
  const headerText = `[Ponyville] A pony appeared! ${ponyData.rarity || 'BASIC'}`;
  ctx.fillText(headerText, cfg.width / 2, cfg.header.y);

  ctx.strokeStyle = cfg.separator.color;
  ctx.lineWidth = cfg.separator.width;
  ctx.beginPath();
  ctx.moveTo(cfg.padding + 25, cfg.header.y + 15);
  ctx.lineTo(cfg.width - cfg.padding - 25, cfg.header.y + 15);
  ctx.stroke();

  ctx.fillStyle = cfg.subtitle.color;
  ctx.font = cfg.subtitle.font;
  ctx.textAlign = cfg.subtitle.textAlign;
  ctx.fillText('A mysterious encounter awaits your decision!', cfg.width / 2, cfg.subtitle.y);

  ctx.strokeStyle = cfg.separator.color;
  ctx.lineWidth = cfg.separator.width;
  ctx.beginPath();
  ctx.moveTo(cfg.padding + 25, cfg.subtitle.y + 12);
  ctx.lineTo(cfg.width - cfg.padding - 25, cfg.subtitle.y + 12);
  ctx.stroke();

  ctx.fillStyle = cfg.mediaGallery.label.color;
  ctx.font = cfg.mediaGallery.label.font;
  ctx.textAlign = 'left';
  ctx.fillText('Media Gallery:', cfg.padding + 25, cfg.mediaGallery.label.y);

  try {
    let ponyImage;
    if (ponyData.imagePath && fs.existsSync(ponyData.imagePath)) {
      ponyImage = await loadImage(ponyData.imagePath);
    } else if (ponyData.imageUrl) {
      const buffer = await fetchBuffer(ponyData.imageUrl);
      ponyImage = await loadImage(buffer);
    }

    if (ponyImage) {

      ctx.strokeStyle = cfg.ponyImage.borderColor;
      ctx.lineWidth = cfg.ponyImage.borderWidth;
      roundRect(
        ctx,
        cfg.ponyImage.x,
        cfg.ponyImage.y,
        cfg.ponyImage.width,
        cfg.ponyImage.height,
        cfg.ponyImage.cornerRadius
      );
      ctx.stroke();

      ctx.save();
      roundRect(
        ctx,
        cfg.ponyImage.x,
        cfg.ponyImage.y,
        cfg.ponyImage.width,
        cfg.ponyImage.height,
        cfg.ponyImage.cornerRadius
      );
      ctx.clip();

      const imgWidth = ponyImage.width;
      const imgHeight = ponyImage.height;
      const canvasAspect = cfg.ponyImage.width / cfg.ponyImage.height;
      const imgAspect = imgWidth / imgHeight;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > canvasAspect) {

        drawWidth = cfg.ponyImage.width;
        drawHeight = drawWidth / imgAspect;
        drawX = cfg.ponyImage.x;
        drawY = cfg.ponyImage.y + (cfg.ponyImage.height - drawHeight) / 2;
      } else {

        drawHeight = cfg.ponyImage.height;
        drawWidth = drawHeight * imgAspect;
        drawX = cfg.ponyImage.x + (cfg.ponyImage.width - drawWidth) / 2;
        drawY = cfg.ponyImage.y;
      }

      ctx.drawImage(ponyImage, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
    }
  } catch (err) {
    console.error('Failed to load pony image:', err);
  }

  ctx.fillStyle = cfg.hintSection.labelColor;
  ctx.font = cfg.hintSection.font;
  ctx.textAlign = 'left';
  ctx.fillText('Name:', cfg.padding + 15, cfg.hintSection.y);

  ctx.fillStyle = cfg.exploringText.color;
  ctx.font = cfg.exploringText.font;
  ctx.textAlign = cfg.exploringText.textAlign;
  ctx.fillText('While exploring Equestria, you\'ve encountered a pony.', cfg.width / 2, cfg.exploringText.y);

  ctx.strokeStyle = cfg.separator.color;
  ctx.lineWidth = cfg.separator.width;
  ctx.beginPath();
  ctx.moveTo(cfg.padding + 25, cfg.exploringText.y + 12);
  ctx.lineTo(cfg.width - cfg.padding - 25, cfg.exploringText.y + 12);
  ctx.stroke();

  const hintY = cfg.hintSection.y + 8;
  const hintBoxX = cfg.padding + 15;
  const hintBoxY = hintY + 12;
  const hintBoxWidth = cfg.width - cfg.padding * 2 - 30;
  const hintBoxHeight = 110;

  ctx.fillStyle = cfg.hintSection.hintBgColor;
  roundRect(
    ctx,
    hintBoxX,
    hintBoxY,
    hintBoxWidth,
    hintBoxHeight,
    cfg.hintSection.cornerRadius
  );
  ctx.fill();

  ctx.strokeStyle = cfg.borderColor;
  ctx.lineWidth = 1;
  roundRect(
    ctx,
    hintBoxX,
    hintBoxY,
    hintBoxWidth,
    hintBoxHeight,
    cfg.hintSection.cornerRadius
  );
  ctx.stroke();

  ctx.fillStyle = cfg.hintSection.hintColor;
  ctx.font = '32px monospace';
  ctx.textAlign = 'center';
  const maskedName = ponyData.maskedName || 'L e _ _ _ _ _ _ _ _ t';
  ctx.fillText(maskedName, cfg.width / 2, hintBoxY + hintBoxHeight / 2 + 12);

  ctx.fillStyle = cfg.instructionsSection.color;
  ctx.font = cfg.instructionsSection.font;
  ctx.textAlign = 'center';
  const instructionText = 'Guess the pony\'s name using the buttons or type in chat!';
  const instructionLines = wrapText(
    ctx,
    instructionText,
    cfg.instructionsSection.maxWidth
  );
  instructionLines.forEach((line, index) => {
    ctx.fillText(line, cfg.width / 2, cfg.instructionsSection.y + index * cfg.instructionsSection.lineHeight);
  });

  ctx.fillStyle = cfg.timer.color;
  ctx.font = cfg.timer.font;
  ctx.textAlign = cfg.timer.textAlign;
  ctx.fillText('You have a minute and 30 seconds to befriend this pony!', cfg.width / 2, cfg.timer.y);

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderAdventure,
  getConfig: () => ({ ...UI_CONFIG }),
  setConfig: (partial) => {
    Object.assign(UI_CONFIG, partial);
    return { ...UI_CONFIG };
  }
};
