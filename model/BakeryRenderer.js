const { AttachmentBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createCanvas, loadImage } = require('canvas');

function fetchBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    try {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).toString();
          return resolve(fetchBuffer(next, redirectCount + 1));
        }
        if (res.statusCode !== 200) return reject(new Error(`Failed to fetch image, status ${res.statusCode}`));
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    } catch (e) { reject(e); }
  });
}

const defaultConfig = {
  backgroundPath: path.join(__dirname, '..', 'assets', 'bakery_assets', 'canvas1.jpg'),
  compose: true,
  showAvatar: true,
  avatarFetchSize: 512,
  avatar: { x: 0.04, y: 0.04, size: 0.18 },
  textOpacity: 1.0,
  positions: {
    bakeryName: { x: 0.25, y: 0.08, fontPct: 0.065, weight: 'bold' },
    owner: { x: 0.25, y: 0.16, fontPct: 0.045 },
    location: { x: 0.25, y: 0.25, fontPct: 0.045 },
    level: { x: 0.55, y: 0.08, fontPct: 0.055, weight: 'bold' },
    age: { x: 0.55, y: 0.16, fontPct: 0.045 },
    bits: { x: 0.25, y: 0.38, fontPct: 0.050 },
    harmony: { x: 0.55, y: 0.38, fontPct: 0.050 },
    totalSold: { x: 0.25, y: 0.50, fontPct: 0.045 },
    status: { x: 0.25, y: 0.62, fontPct: 0.055, weight: 'bold' },
    menuTitle: { x: 0.05, y: 0.72, fontPct: 0.050, weight: 'bold' },
    menu: { x: 0.05, y: 0.82, fontPct: 0.040 }
  },
  colors: {
    primary: '#FFFFFF',
    secondary: '#E0E0E0',
    accent: '#FFD700',
    status: '#90EE90',
    statusReady: '#00FF00'
  }
};

let config = { ...defaultConfig };

function getConfig() { return { ...config }; }
function setConfig(partial) { config = { ...config, ...partial }; return getConfig(); }
function resetConfig() { config = { ...defaultConfig }; return getConfig(); }

async function renderBakery(profile, user, bakeryData = {}, opts = {}) {
  const cfg = { ...config, ...(opts || {}) };

  const files = [];
  let container = null;

  try {
    const bgExists = cfg.backgroundPath && fs.existsSync(cfg.backgroundPath);
    if (!bgExists) {
      console.warn('BakeryRenderer: background image not found at', cfg.backgroundPath);
    }
    if (cfg.compose && bgExists) {
      try {
        cfg.avatarUrl = (opts && opts.avatarUrl) || (user && typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ extension: 'png', size: cfg.avatarFetchSize }) : null);
        const composedBuf = await composeImage(cfg.backgroundPath, user, profile, bakeryData, cfg);
        if (composedBuf) {
          files.push(new AttachmentBuilder(composedBuf, { name: 'BakeryDisplay.png' }));
          console.log('BakeryRenderer: Canvas generated successfully');
        } else {
          console.warn('BakeryRenderer: composeImage returned null/undefined buffer');
        }
      } catch (e) {
        console.error('BakeryRenderer: composeImage failed', e);
      }
    }
  } catch (e) {
    console.error('BakeryRenderer: error preparing files', e);
  }

  try {
    container = new ContainerBuilder().setAccentColor(0x2b2d31);

    const bakeryName = profile.server?.bakeryName || profile.bakeryName || 'Bakery';
    const headerText = new TextDisplayBuilder().setContent(`**${bakeryName}**\n*Owner: ${user.username}*`);
    container.addTextDisplayComponents(headerText);

    const sepTop = new SeparatorBuilder().setDivider(true);
    container.addSeparatorComponents(sepTop);

    const LocationShop = require('./LocationShop.js');
    let location = 'Unassigned';
    const currentLoc = profile.locations?.currentLocation || profile.server?.locations?.currentLocation;
    if (currentLoc) {

      if (typeof currentLoc === 'number') {
        location = LocationShop.getLocationName(currentLoc) || currentLoc;
      }

      else if (typeof currentLoc === 'string') {
        location = currentLoc;
      }
    } else {
      location = profile.server?.locationName || profile.locationName || profile.location || 'Unassigned';
    }
    const level = profile.server?.BakeryLevel || profile.BakeryLevel || profile.bakery?.level || 1;
    const createdAt = profile.createdAt || Date.now();
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageStr = formatAge(ageMs);

    const infoText = new TextDisplayBuilder().setContent(
      `📍 **Location:** ${location}\n🔷 **Level:** ${level}\n⏳ **Age:** ${ageStr}`
    );
    container.addTextDisplayComponents(infoText);

    const sepMid = new SeparatorBuilder().setDivider(false);
    container.addSeparatorComponents(sepMid);

    const bits = formatNumber(Number(bakeryData.bits || profile.balances?.bits || 0));
    const harmony = formatNumber(Number(bakeryData.harmony || profile.balances?.harmony || 0));
    const balanceText = new TextDisplayBuilder().setContent(
      `💰 **Bits:** ${bits}\n✨ **Harmony:** ${harmony}`
    );
    container.addTextDisplayComponents(balanceText);

    const totalSold = formatNumber(Number(bakeryData.totalSold || profile.server?.stats?.allTimeSold || profile.stats?.allTimeSold || 0));
    const statsText = new TextDisplayBuilder().setContent(
      `📊 **Total Sold:** ${totalSold}`
    );
    container.addTextDisplayComponents(statsText);

    const sepMid2 = new SeparatorBuilder().setDivider(false);
    container.addSeparatorComponents(sepMid2);

    const statusLine = bakeryData.statusLine || '<:emptystart:1488615316643778743><:emptymiddle:1488615211639246868><:emptyend:1488615114495234098>';
    const statusText = new TextDisplayBuilder().setContent(`${statusLine}`);
    container.addTextDisplayComponents(statusText);

    if (bakeryData.menuStr) {
      const menuLines = bakeryData.menuStr.split('\n').slice(0, 3).join('\n');
      const hasMore = bakeryData.menuStr.split('\n').length > 3;

      const menuSeparator = new SeparatorBuilder().setDivider(true);
      container.addSeparatorComponents(menuSeparator);

      const menuContent = `**📋 Menu:**\n${menuLines}${hasMore ? '\n*...and more*' : ''}`;
      const menuText = new TextDisplayBuilder().setContent(menuContent);
      container.addTextDisplayComponents(menuText);
    }

    const sepBottom = new SeparatorBuilder().setDivider(true);
    container.addSeparatorComponents(sepBottom);

    const bakeButton = new ButtonBuilder().setCustomId('bake').setLabel('🔥 Bake').setStyle(ButtonStyle.Primary);
    const viewButton = new ButtonBuilder().setCustomId('bakery_view').setLabel('📋 Details').setStyle(ButtonStyle.Secondary);

    container.addActionRowComponents(ar => ar.setComponents(bakeButton, viewButton));
  } catch (e) {
    console.warn('BakeryRenderer: failed to build container', e);
  }

  return { v2Containers: [container], files };
}

async function composeImage(bgPath, user, profile, bakeryData = {}, cfg) {
  try {
    const bg = await loadImage(bgPath);
    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(bg, 0, 0, bg.width, bg.height);

    const resolveCoord = (v, total) => {
      if (v === undefined || v === null) return 0;
      const num = Number(v);
      if (Number.isNaN(num)) return 0;
      if (Math.abs(num) <= 1) {
        return num >= 0 ? Math.floor(num * total) : Math.floor(total + num * total);
      }
      return num >= 0 ? Math.floor(num) : Math.floor(total + num);
    };

    const minSide = Math.min(bg.width, bg.height);

    if (cfg.showAvatar) {
      try {
        const avatarUrl = cfg.avatarUrl || (user && typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ extension: 'png', size: cfg.avatarFetchSize }) : null);
        if (avatarUrl) {
          const avatarBuf = await fetchBuffer(avatarUrl).catch(() => null);
          if (avatarBuf) {
            const img = await loadImage(avatarBuf);
            const avatarCfg = cfg.avatar || {};
            const avatarSize = Math.floor((Math.abs(avatarCfg.size || 0.14) <= 1 ? (avatarCfg.size || 0.14) * minSide : (avatarCfg.size || 0.14)));
            const avatarX = resolveCoord(avatarCfg.x ?? 0.03, bg.width);
            const avatarY = resolveCoord(avatarCfg.y ?? 0.06, bg.height);

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
          }
        }
      } catch (e) {
        console.warn('BakeryRenderer: error drawing avatar', e);
      }
    }

    const applyOpacity = (colorStr, opacity) => {
      if (!colorStr) return `rgba(255, 255, 255, ${opacity})`;
      if (colorStr.startsWith('#')) {
        const hex = colorStr.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
      return colorStr;
    };

    const computeFontPx = (fontPctOrPx) => {
      const v = Number(fontPctOrPx || 0.04);
      if (Number.isNaN(v)) return Math.max(10, Math.floor(bg.height * 0.04));
      if (Math.abs(v) <= 1) return Math.max(10, Math.floor(bg.height * v));
      return Math.max(10, Math.floor(v));
    };

    const drawTextAt = (text, px, py, fontPct, color = cfg.colors.primary, weight = 'normal') => {
      const x = resolveCoord(px ?? 0, bg.width);
      const y = resolveCoord(py ?? 0, bg.height);
      const fontPx = computeFontPx(fontPct);
      ctx.font = `${weight} ${fontPx}px "Arial", sans-serif`;
      ctx.fillStyle = applyOpacity(color, cfg.textOpacity);
      ctx.textBaseline = 'top';
      ctx.fillText(text, x, y);
    };

    const pos = cfg.positions || {};
    const colors = cfg.colors || {};

    drawTextAt(
      profile.server?.bakeryName || profile.bakeryName || 'Bakery',
      pos.bakeryName?.x ?? 0.25,
      pos.bakeryName?.y ?? 0.08,
      pos.bakeryName?.fontPct ?? 0.065,
      colors.primary,
      pos.bakeryName?.weight ?? 'bold'
    );

    drawTextAt(
      `Owner: ${user.username || 'Unknown'}`,
      pos.owner?.x ?? 0.25,
      pos.owner?.y ?? 0.16,
      pos.owner?.fontPct ?? 0.045,
      colors.secondary
    );

    const location = profile.locations?.currentLocation || profile.server?.locations?.currentLocation || profile.server?.locationName || profile.locationName || profile.location || 'Unassigned';
    drawTextAt(
      `📍 ${location}`,
      pos.location?.x ?? 0.25,
      pos.location?.y ?? 0.25,
      pos.location?.fontPct ?? 0.045,
      colors.secondary
    );

    const level = profile.server?.BakeryLevel || profile.BakeryLevel || profile.bakery?.level || 1;
    drawTextAt(
      `Level: ${level}`,
      pos.level?.x ?? 0.55,
      pos.level?.y ?? 0.08,
      pos.level?.fontPct ?? 0.055,
      colors.accent,
      pos.level?.weight ?? 'bold'
    );

    const createdAt = profile.createdAt || Date.now();
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const ageStr = formatAge(ageMs);
    drawTextAt(
      `Age: ${ageStr}`,
      pos.age?.x ?? 0.55,
      pos.age?.y ?? 0.16,
      pos.age?.fontPct ?? 0.045,
      colors.secondary
    );

    const bits = Number(bakeryData.bits || profile.balances?.bits || 0);
    const harmony = Number(bakeryData.harmony || profile.balances?.harmony || 0);
    const bitsStr = formatNumber(bits);
    const harmonyStr = formatNumber(harmony);

    drawTextAt(
      `💰 Bits: ${bitsStr}`,
      pos.bits?.x ?? 0.25,
      pos.bits?.y ?? 0.38,
      pos.bits?.fontPct ?? 0.050,
      colors.primary
    );

    drawTextAt(
      `✨ Harmony: ${harmonyStr}`,
      pos.harmony?.x ?? 0.55,
      pos.harmony?.y ?? 0.38,
      pos.harmony?.fontPct ?? 0.050,
      colors.primary
    );

    const totalSold = Number(bakeryData.totalSold || profile.server?.stats?.allTimeSold || profile.stats?.allTimeSold || 0);
    drawTextAt(
      `📊 Total Sold: ${formatNumber(totalSold)}`,
      pos.totalSold?.x ?? 0.25,
      pos.totalSold?.y ?? 0.50,
      pos.totalSold?.fontPct ?? 0.045,
      colors.secondary
    );

    drawTextAt(
      '📋 Menu:',
      pos.menuTitle?.x ?? 0.05,
      pos.menuTitle?.y ?? 0.72,
      pos.menuTitle?.fontPct ?? 0.050,
      colors.accent,
      pos.menuTitle?.weight ?? 'bold'
    );

    const menuStr = bakeryData.menuStr || 'No items';
    const menuLines = menuStr.split('\n');
    let currentY = pos.menu?.y ?? 0.82;
    const menuFontPct = pos.menu?.fontPct ?? 0.040;
    const lineHeight = computeFontPx(menuFontPct) * 1.4;

    for (const line of menuLines) {
      drawTextAt(
        line,
        pos.menu?.x ?? 0.05,
        currentY,
        menuFontPct,
        colors.secondary
      );
      currentY += lineHeight / bg.height;
    }

    return canvas.toBuffer('image/png');
  } catch (e) {
    console.error('BakeryRenderer: composeImage error', e);
    return null;
  }
}

function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatAge(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

module.exports = { renderBakery, getConfig, setConfig, resetConfig };
