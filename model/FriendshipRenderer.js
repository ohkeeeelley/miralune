const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const WIDTH = 1600;
const HEIGHT = 980;
const PAGE_SIZE = 4;
const FONT_STACK = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';

const imageCache = new Map();
const directoryEntriesCache = new Map();

const RARITY_COLORS = Object.freeze({
  Common: ['#6b7280', '#4b5563'],
  Rare: ['#3b82f6', '#2563eb'],
  Epic: ['#8b5cf6', '#7c3aed'],
  Majestic: ['#14b8a6', '#0d9488'],
  Legend: ['#f59e0b', '#d97706'],
  Goddess: ['#f43f5e', '#e11d48'],
  Secret: ['#ec4899', '#be185d'],
  Radiance: ['#22d3ee', '#0ea5e9'],
  Unique: ['#84cc16', '#65a30d'],
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toTitleCase(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawTagChip(ctx, {
  text,
  x,
  y,
  textColor = '#e2e8f0',
  fillColor = 'rgba(15, 23, 42, 0.72)',
  borderColor = 'rgba(148, 163, 184, 0.35)',
  fontSize = 15,
  height = 30,
  padX = 13,
} = {}) {
  const label = String(text || '').trim();
  if (!label) return 0;

  ctx.font = `bold ${fontSize}px ${FONT_STACK}`;
  const width = Math.ceil(ctx.measureText(label).width + padX * 2);
  const radius = Math.min(12, Math.floor(height / 2));

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();

  ctx.font = `bold ${fontSize}px ${FONT_STACK}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + width / 2, y + height / 2 + 5);
  ctx.textAlign = 'left';

  return width;
}

function drawHorizontalSeparator(ctx, x, y, width, color = 'rgba(148, 163, 184, 0.34)') {
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, 'rgba(148, 163, 184, 0)');
  gradient.addColorStop(0.12, color);
  gradient.addColorStop(0.88, color);
  gradient.addColorStop(1, 'rgba(148, 163, 184, 0)');

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) lines.push(currentLine);
    currentLine = word;

    if (lines.length >= maxLines) break;
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1];
    while (last.length > 3 && ctx.measureText(`${last}...`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}...`;
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

function getRarityColors(rarity) {
  const key = toTitleCase(rarity) || 'Common';
  return RARITY_COLORS[key] || RARITY_COLORS.Common;
}

function getDirectoryEntries(directoryPath) {
  if (directoryEntriesCache.has(directoryPath)) {
    return directoryEntriesCache.get(directoryPath);
  }

  let entriesMap = null;
  try {
    if (fs.existsSync(directoryPath)) {
      entriesMap = new Map();
      for (const fileName of fs.readdirSync(directoryPath)) {
        entriesMap.set(fileName.toLowerCase(), fileName);
      }
    }
  } catch (_) {
    entriesMap = null;
  }

  directoryEntriesCache.set(directoryPath, entriesMap);
  return entriesMap;
}

function resolveCaseInsensitiveFile(directoryPath, fileName) {
  if (!directoryPath || !fileName) return null;

  const exactPath = path.join(directoryPath, fileName);
  if (fs.existsSync(exactPath)) return exactPath;

  const entries = getDirectoryEntries(directoryPath);
  if (!entries) return null;

  const matched = entries.get(String(fileName).toLowerCase());
  if (!matched) return null;

  const resolved = path.join(directoryPath, matched);
  return fs.existsSync(resolved) ? resolved : null;
}

function resolvePonyImagePath(pony) {
  if (!pony || !pony.png) return null;

  const basePath = path.join(__dirname, '..', 'assets', 'ponies_assets');
  const preferredFolder = pony.category === 'Equestria Girls' ? 'equestria_girls' : 'pony';
  const fallbackFolder = preferredFolder === 'equestria_girls' ? 'pony' : 'equestria_girls';

  const preferredPath = resolveCaseInsensitiveFile(path.join(basePath, preferredFolder), pony.png);
  if (preferredPath) return preferredPath;

  return resolveCaseInsensitiveFile(path.join(basePath, fallbackFolder), pony.png);
}

async function loadPonyImage(pony) {
  const imagePath = resolvePonyImagePath(pony);
  if (!imagePath) return null;

  if (imageCache.has(imagePath)) {
    return imageCache.get(imagePath);
  }

  const imagePromise = loadImage(imagePath)
    .then((img) => img)
    .catch(() => null);

  imageCache.set(imagePath, imagePromise);
  return imagePromise;
}

function drawBackground(ctx) {
  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, '#0b1228');
  background.addColorStop(0.56, '#0f1935');
  background.addColorStop(1, '#070c1d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const bloomLeft = ctx.createRadialGradient(170, 110, 24, 170, 110, 410);
  bloomLeft.addColorStop(0, 'rgba(124, 58, 237, 0.34)');
  bloomLeft.addColorStop(1, 'rgba(124, 58, 237, 0)');
  ctx.fillStyle = bloomLeft;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const bloomRight = ctx.createRadialGradient(WIDTH - 190, 140, 30, WIDTH - 190, 140, 460);
  bloomRight.addColorStop(0, 'rgba(14, 165, 233, 0.34)');
  bloomRight.addColorStop(1, 'rgba(14, 165, 233, 0)');
  ctx.fillStyle = bloomRight;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const bloomBottom = ctx.createRadialGradient(WIDTH - 120, HEIGHT - 90, 16, WIDTH - 120, HEIGHT - 90, 300);
  bloomBottom.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
  bloomBottom.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = bloomBottom;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= HEIGHT; y += 96) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(WIDTH, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 180, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.75);
  vignette.addColorStop(0, 'rgba(2, 6, 23, 0)');
  vignette.addColorStop(1, 'rgba(2, 6, 23, 0.52)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawProgressBar(ctx, x, y, width, height, progress, colors, xpText) {
  const ratio = clamp(progress, 0, 1);
  const radius = Math.max(8, Math.floor(height / 2) - 1);

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.fill();
  ctx.restore();

  if (ratio > 0) {
    const fillWidth = Math.max(8, width * ratio);
    const fillGradient = ctx.createLinearGradient(x, y, x + fillWidth, y);
    fillGradient.addColorStop(0, colors[0]);
    fillGradient.addColorStop(1, colors[1]);

    ctx.save();
    ctx.shadowColor = `${colors[0]}aa`;
    ctx.shadowBlur = 11;
    drawRoundedRect(ctx, x, y, fillWidth, height, radius);
    ctx.fillStyle = fillGradient;
    ctx.fill();
    ctx.shadowBlur = 0;

    const sheen = ctx.createLinearGradient(x, y, x, y + height);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    drawRoundedRect(ctx, x, y, fillWidth, height * 0.6, radius);
    ctx.fillStyle = sheen;
    ctx.fill();

    const endCapX = x + fillWidth;
    const capRadius = Math.max(3, Math.floor(height * 0.22));
    ctx.beginPath();
    ctx.arc(endCapX, y + height / 2, capRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.36)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  ctx.font = `bold 15px ${FONT_STACK}`;
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.fillText(xpText, x + width / 2, y + height / 2 + 5);
  ctx.textAlign = 'left';
}

async function drawEntryCard(ctx, entry, x, y, width, height) {
  const pony = entry.pony || {};
  const name = String(entry.name || pony.name || 'Unknown Pony');
  const rarity = toTitleCase(entry.rarity || pony.rarity || 'Common') || 'Common';
  const category = String(entry.category || pony.category || 'Unknown');
  const family = String(entry.family || pony.family || 'Unknown');
  const bonusText = String(entry.bonusText || 'No natural bakery bonus.');
  const isHired = !!entry.isHired;

  const level = clamp(Number(entry.level) || 1, 1, 55);
  const xp = Math.max(0, Number(entry.xp) || 0);
  const nextLevelXP = Number(entry.nextLevelXP);
  const neededXP = Number.isFinite(nextLevelXP) && nextLevelXP > 0 ? nextLevelXP : null;
  const progress = neededXP ? xp / neededXP : 1;

  const colors = getRarityColors(rarity);

  const cardGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  cardGradient.addColorStop(0, 'rgba(15, 23, 42, 0.93)');
  cardGradient.addColorStop(1, 'rgba(22, 34, 57, 0.9)');

  ctx.save();
  ctx.shadowColor = 'rgba(2, 6, 23, 0.58)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 9;
  drawRoundedRect(ctx, x, y, width, height, 20);
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.restore();

  const borderGradient = ctx.createLinearGradient(x, y, x + width, y + height);
  borderGradient.addColorStop(0, `${colors[0]}f0`);
  borderGradient.addColorStop(1, `${colors[1]}d0`);

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, 20);
  ctx.strokeStyle = borderGradient;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, x + 2, y + 2, width - 4, height - 4, 18);
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const imageX = x + 16;
  const imageY = y + 16;
  const imageWidth = 208;
  const imageHeight = height - 32;

  ctx.save();
  const imagePanel = ctx.createLinearGradient(imageX, imageY, imageX, imageY + imageHeight);
  imagePanel.addColorStop(0, 'rgba(2, 6, 23, 0.9)');
  imagePanel.addColorStop(1, 'rgba(7, 13, 30, 0.94)');
  drawRoundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 16);
  ctx.fillStyle = imagePanel;
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const image = await loadPonyImage(pony);
  if (image) {
    const imagePadding = 10;
    const targetWidth = Math.max(1, imageWidth - imagePadding * 2);
    const targetHeight = Math.max(1, imageHeight - imagePadding * 2);
    const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = imageX + (imageWidth - drawWidth) / 2;
    const drawY = imageY + (imageHeight - drawHeight) / 2;

    ctx.save();
    drawRoundedRect(ctx, imageX, imageY, imageWidth, imageHeight, 14);
    ctx.clip();
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  } else {
    ctx.font = `bold 20px ${FONT_STACK}`;
    ctx.fillStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText('No Image', imageX + imageWidth / 2, imageY + imageHeight / 2);
    ctx.textAlign = 'left';
  }

  const separatorX = imageX + imageWidth + 16;
  const separatorGradient = ctx.createLinearGradient(separatorX, y + 24, separatorX, y + height - 24);
  separatorGradient.addColorStop(0, 'rgba(148, 163, 184, 0.02)');
  separatorGradient.addColorStop(0.2, 'rgba(148, 163, 184, 0.45)');
  separatorGradient.addColorStop(0.8, 'rgba(148, 163, 184, 0.45)');
  separatorGradient.addColorStop(1, 'rgba(148, 163, 184, 0.02)');

  ctx.beginPath();
  ctx.moveTo(separatorX, y + 24);
  ctx.lineTo(separatorX, y + height - 24);
  ctx.strokeStyle = separatorGradient;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const textX = separatorX + 24;
  const textWidth = x + width - textX - 16;

  ctx.font = `bold 38px ${FONT_STACK}`;
  ctx.fillStyle = '#f8fafc';
  drawWrappedText(ctx, name, textX, y + 58, textWidth, 35, 2);

  ctx.font = `bold 17px ${FONT_STACK}`;
  ctx.fillStyle = '#bfdbfe';
  ctx.fillText(`ID #${entry.id || pony.id || '-'}`, textX, y + 106);

  let chipX = textX;
  const rarityChipWidth = drawTagChip(ctx, {
    text: `Rarity ${rarity}`,
    x: chipX,
    y: y + 118,
    textColor: '#f8fafc',
    fillColor: `${colors[0]}4d`,
    borderColor: `${colors[0]}c8`,
    fontSize: 14,
    height: 29,
    padX: 12,
  });

  chipX += rarityChipWidth + 9;
  drawTagChip(ctx, {
    text: isHired ? 'Status Hired' : 'Status Collected',
    x: chipX,
    y: y + 118,
    textColor: isHired ? '#d1fae5' : '#fef3c7',
    fillColor: isHired ? 'rgba(16, 185, 129, 0.24)' : 'rgba(245, 158, 11, 0.22)',
    borderColor: isHired ? 'rgba(16, 185, 129, 0.72)' : 'rgba(245, 158, 11, 0.66)',
    fontSize: 14,
    height: 29,
    padX: 12,
  });

  ctx.font = `16px ${FONT_STACK}`;
  ctx.fillStyle = '#dbeafe';
  ctx.fillText(`Category: ${category}`, textX, y + 168);
  drawWrappedText(ctx, `Family: ${family}`, textX, y + 191, textWidth, 20, 2);

  drawHorizontalSeparator(ctx, textX, y + 220, textWidth);

  const bonusBoxY = y + 232;
  const bonusBoxHeight = 62;
  ctx.save();
  drawRoundedRect(ctx, textX, bonusBoxY, textWidth, bonusBoxHeight, 12);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.font = `bold 13px ${FONT_STACK}`;
  ctx.fillStyle = '#93c5fd';
  ctx.fillText('Natural Bonus', textX + 12, bonusBoxY + 20);

  ctx.font = `15px ${FONT_STACK}`;
  ctx.fillStyle = '#cbd5e1';
  drawWrappedText(ctx, bonusText, textX + 12, bonusBoxY + 42, textWidth - 24, 18, 2);

  const progressPanelY = y + height - 82;
  ctx.save();
  drawRoundedRect(ctx, textX, progressPanelY, textWidth, 58, 13);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.44)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.font = `bold 30px ${FONT_STACK}`;
  ctx.fillStyle = '#f1f5f9';
  const levelLabel = neededXP ? `Level ${level}` : `Level ${level} MAX`;
  ctx.fillText(levelLabel, textX + 11, progressPanelY + 30);

  const xpLabel = neededXP
    ? `${Math.floor(xp)} / ${Math.floor(neededXP)} XP`
    : 'MAX XP';
  drawProgressBar(ctx, textX + 11, progressPanelY + 34, textWidth - 22, 18, progress, colors, xpLabel);
}

async function generatePage(options = {}) {
  const username = String(options.username || 'Unknown User');
  const page = Math.max(1, Number(options.page) || 1);
  const totalPages = Math.max(1, Number(options.totalPages) || 1);
  const totalCollected = Math.max(0, Number(options.totalCollected) || 0);
  const showingStart = Math.max(0, Number(options.showingStart) || 0);
  const showingEnd = Math.max(0, Number(options.showingEnd) || 0);
  const entries = Array.isArray(options.entries) ? options.entries : [];

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  drawBackground(ctx);

  const headerX = 34;
  const headerY = 24;
  const headerWidth = WIDTH - 68;
  const headerHeight = 108;

  ctx.save();
  drawRoundedRect(ctx, headerX, headerY, headerWidth, headerHeight, 24);
  const headerGradient = ctx.createLinearGradient(headerX, headerY, headerX + headerWidth, headerY + headerHeight);
  headerGradient.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
  headerGradient.addColorStop(1, 'rgba(30, 41, 59, 0.62)');
  ctx.fillStyle = headerGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();

  ctx.font = `bold 58px ${FONT_STACK}`;
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('Friendship Progress', 58, 84);

  ctx.font = `24px ${FONT_STACK}`;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`${username} • Collected ${totalCollected} ponies`, 58, 118);

  const pageBadgeText = `Page ${page}/${totalPages}`;
  ctx.font = `bold 28px ${FONT_STACK}`;
  const badgeWidth = Math.max(220, ctx.measureText(pageBadgeText).width + 48);
  const badgeX = headerX + headerWidth - badgeWidth - 18;
  const badgeY = headerY + 19;

  ctx.save();
  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 56, 18);
  const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY + 56);
  badgeGradient.addColorStop(0, 'rgba(8, 17, 38, 0.9)');
  badgeGradient.addColorStop(1, 'rgba(18, 38, 67, 0.88)');
  ctx.fillStyle = badgeGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  ctx.font = `bold 30px ${FONT_STACK}`;
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.fillText(pageBadgeText, badgeX + badgeWidth / 2, badgeY + 38);
  ctx.textAlign = 'left';

  if (entries.length > 0) {
    drawTagChip(ctx, {
      text: `Showing ${showingStart}-${showingEnd}`,
      x: badgeX,
      y: badgeY + 64,
      textColor: '#bae6fd',
      fillColor: 'rgba(14, 116, 144, 0.24)',
      borderColor: 'rgba(56, 189, 248, 0.55)',
      fontSize: 15,
      height: 28,
      padX: 12,
    });
  }

  if (entries.length === 0) {
    const emptyX = 54;
    const emptyY = 176;
    const emptyWidth = WIDTH - 108;
    const emptyHeight = HEIGHT - 256;

    ctx.save();
    drawRoundedRect(ctx, emptyX, emptyY, emptyWidth, emptyHeight, 22);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.68)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.font = `bold 42px ${FONT_STACK}`;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText('No ponies to show on this page.', emptyX + 44, emptyY + 140);

    ctx.font = `25px ${FONT_STACK}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Collect ponies first, then run /friendship again.', emptyX + 44, emptyY + 186);

    return canvas.toBuffer('image/png');
  }

  const cardGapX = 24;
  const cardGapY = 20;
  const cardX = 46;
  const cardY = 150;
  const cardWidth = (WIDTH - cardX * 2 - cardGapX);
  const singleCardWidth = Math.floor(cardWidth / 2);
  const cardHeight = 390;

  for (let i = 0; i < entries.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = cardX + col * (singleCardWidth + cardGapX);
    const y = cardY + row * (cardHeight + cardGapY);
    await drawEntryCard(ctx, entries[i], x, y, singleCardWidth, cardHeight);
  }

  drawHorizontalSeparator(ctx, 44, HEIGHT - 54, WIDTH - 88, 'rgba(148, 163, 184, 0.3)');
  const footerText = `Showing ${showingStart}-${showingEnd} of ${totalCollected} collected ponies • Use buttons below to switch pages`;
  ctx.font = `20px ${FONT_STACK}`;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(footerText, 52, HEIGHT - 24);

  return canvas.toBuffer('image/png');
}

module.exports = {
  generatePage,
  PAGE_SIZE,
  WIDTH,
  HEIGHT,
};
