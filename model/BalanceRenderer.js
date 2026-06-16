const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { fmtNumber } = require('../commands/economy/_bakeryUtils');
const { BITS, HARMONY, DIAMONDS } = require('../commands/economy/currencyEmojis');

const imageCache = new Map();
async function loadCachedImage(filePath) {
  if (imageCache.has(filePath)) return imageCache.get(filePath);
  const img = await loadImage(filePath);
  imageCache.set(filePath, img);
  return img;
}

const defaultConfig = {
  backgroundPath: path.join(__dirname, '..', 'assets', 'balance_assets', 'BalanceDisplay.png'),
  compose: true,
  showAvatar: false,

  avatarFetchSize: 256,

  avatar: { x: 0.05, y: -0.920, size: 0.22 },

  positions: {
    username: { x: 0.22, y: 0.75, fontPct: 0.060 },
    cash: { x: 0.31, y: 0.09, fontPct: 0.070 },
    bank: { x: 0.31, y: 0.24, fontPct: 0.070 },
    harmony: { x: 0.70, y: 0.09, fontPct: 0.070 },
    diamonds: { x: 0.70, y: 0.24, fontPct: 0.070 },

    card: { x: 0.09, y: 0.450, fontPct: 0.150 }
  },

  showCard: true,

  showLabels: false,
  headerTemplate: '{username}',
  lines: [
    { key: 'cash', label: 'Cash', template: '{bits}' },
    { key: 'bank', label: 'Bank', template: '{bank}' },
    { key: 'total', label: 'Total', template: '{total}' },
    { key: 'gems', label: 'Gems', template: '{diamonds}' },
    { key: 'harmony', label: 'Harmony', template: '{harmony}' }
  ],
  theme: 'default'
};

let config = { ...defaultConfig };

function getConfig() { return { ...config }; }
function setConfig(partial) { config = { ...config, ...partial }; return getConfig(); }
function resetConfig() { config = { ...defaultConfig }; return getConfig(); }

async function renderBalance(profile, user, opts = {}) {
  const cfg = { ...config, ...(opts || {}) };

  const bits = Number(profile.balances?.bits || 0);
  const bankBits = Number(profile.balances?.bank?.bits || 0);
  const total = bits + bankBits;
  const harmony = Number(profile.balances?.harmony || 0);
  const diamonds = Number(profile.balances?.diamonds || 0);

  const lines = cfg.lines.map(l => {
    return l.template.replace('{bits}', fmtNumber(bits)).replace('{bank}', fmtNumber(bankBits)).replace('{total}', fmtNumber(total)).replace('{harmony}', fmtNumber(harmony)).replace('{diamonds}', fmtNumber(diamonds));
  }).join('\n');

  const container = new ContainerBuilder();
  if (!cfg.compose) {

    const headerText = cfg.headerTemplate.replace('{username}', user.username || '');
    const header = new TextDisplayBuilder().setContent(headerText);
    const sep = new SeparatorBuilder().setDivider(false);
    const body = new TextDisplayBuilder().setContent('\n\n' + lines);
    container.addTextDisplayComponents(header).addSeparatorComponents(sep).addTextDisplayComponents(body);
  }

  const files = [];
  try {
    const bgExists = cfg.backgroundPath && fs.existsSync(cfg.backgroundPath);
    if (cfg.compose && bgExists) {
      try {

        cfg.avatarUrl = (opts && opts.avatarUrl) || (user && typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ extension: 'png', size: cfg.avatarFetchSize }) : null);
        const composedBuf = await composeImage(cfg.backgroundPath, user, profile, cfg);
        if (composedBuf) {

          files.push(new AttachmentBuilder(composedBuf, { name: 'BalanceDisplay.png' }));

          try { if (typeof container.setImage === 'function') container.setImage('attachment://BalanceDisplay.png'); } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.error('BalanceRenderer: composeImage failed', e);
      }
    } else if (bgExists) {
      files.push(new AttachmentBuilder(cfg.backgroundPath, { name: 'BalanceDisplay.png' }));
      try { if (typeof container.setImage === 'function') container.setImage('attachment://BalanceDisplay.png'); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.error('BalanceRenderer: error preparing files', e);
  }

  return { container, files };
}

module.exports = { renderBalance, getConfig, setConfig, resetConfig };

  async function composeImage(bgPath, user, profile, cfg) {
    try {
      const bg = await loadCachedImage(bgPath);
      const canvas = createCanvas(bg.width, bg.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(bg, 0, 0, bg.width, bg.height);

      try {
        const themeKey = (cfg && typeof cfg.theme !== 'undefined') ? cfg.theme : (profile && profile.server && profile.server.BalanceTheme ? profile.server.BalanceTheme : null);
        if (themeKey && themeKey !== 'default') {
          const themePath = path.join(__dirname, '..', 'assets', 'balance_assets', `${themeKey}.png`);
          if (fs.existsSync(themePath)) {
            try {
              const themeImg = await loadCachedImage(themePath);

              ctx.drawImage(themeImg, 0, 0, bg.width, bg.height);
            } catch (e) {
              console.warn('BalanceRenderer: failed to draw theme overlay', e && e.message ? e.message : e);
            }
          }
        }
      } catch (e) { /* ignore theme overlay errors */ }
      const resolveCoord = (v, total) => {
        if (v === undefined || v === null) return 0;
        const num = Number(v);
        if (Number.isNaN(num)) return 0;

        if (Math.abs(num) <= 1) {
          if (num >= 0) return Math.floor(num * total);

          return Math.floor(total + num * total);
        }

        if (num >= 0) return Math.floor(num);
        return Math.floor(total + num);
      };

      const minSide = Math.min(bg.width, bg.height);
      const avatarCfg = (cfg.avatar || {});

      const avatarSize = Math.floor((Math.abs(avatarCfg.size || 0.14) <= 1 ? (avatarCfg.size || 0.14) * minSide : (avatarCfg.size || 0.14)));
      const avatarX = resolveCoord(avatarCfg.x ?? 0.03, bg.width);
      const avatarY = resolveCoord(avatarCfg.y ?? 0.06, bg.height);
      if (cfg.showAvatar) {
        try {
          const avatarUrl = cfg.avatarUrl || (user && typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ extension: 'png', size: cfg.avatarFetchSize }) : null);
          if (avatarUrl) {
            const img = await Promise.race([
              loadImage(avatarUrl),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
            ]).catch((err) => {
              console.warn('BalanceRenderer: failed to fetch avatar', err && err.message ? err.message : err);
              return null;
            });
            if (img) {

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
          console.warn('BalanceRenderer: error drawing avatar', e && e.message ? e.message : e);
        }
      }

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';

      const pos = cfg.positions || {};
      const usernamePos = pos.username || { x: 0.2, y: 0.06, fontPct: 0.045 };
      const computeFontPx = (fontPctOrPx) => {
        const v = Number(fontPctOrPx || 0.04);
        if (Number.isNaN(v)) return Math.max(10, Math.floor(bg.height * 0.04));
        if (Math.abs(v) <= 1) return Math.max(10, Math.floor(bg.height * v));
        return Math.max(10, Math.floor(v));
      };
      const drawTextAt = (text, px, py, fontPct) => {
        const x = resolveCoord(px ?? 0, bg.width);
        const y = resolveCoord(py ?? 0, bg.height);
        const fontPx = computeFontPx(fontPct);
        ctx.font = `${fontPx}px Sans`;
        ctx.fillText(text, x, y);
      };

      drawTextAt(user.username || '', usernamePos.x, usernamePos.y, usernamePos.fontPct);

      const bitsVal = fmtNumber(profile.balances?.bits || 0);
      const bankVal = fmtNumber(profile.balances?.bank?.bits || 0);
      const harmonyVal = fmtNumber(profile.balances?.harmony || 0);
      const diamondsVal = fmtNumber(profile.balances?.diamonds || 0);

    const cashPos = pos.cash || { x: 0.2, y: 0.18, fontPct: 0.04 };
    const bankPos = pos.bank || { x: 0.2, y: 0.26, fontPct: 0.04 };
    const harmonyPos = pos.harmony || { x: 0.2, y: 0.34, fontPct: 0.04 };
    const diamondsPos = pos.diamonds || { x: 0.2, y: 0.42, fontPct: 0.04 };

    drawTextAt(`${bitsVal}`, cashPos.x, cashPos.y, cashPos.fontPct);
    drawTextAt(`${bankVal}`, bankPos.x, bankPos.y, bankPos.fontPct);
    drawTextAt(`${harmonyVal}`, harmonyPos.x, harmonyPos.y, harmonyPos.fontPct);
    drawTextAt(`${diamondsVal}`, diamondsPos.x, diamondsPos.y, diamondsPos.fontPct);

    try {
      if (cfg.showCard && profile && profile.paymentCard && profile.paymentCard.number) {
        const cardPos = pos.card || { x: 0.22, y: 0.85, fontPct: 0.035 };
        const raw = String(profile.paymentCard.number || '');

        const formatCardNumber = (digits, masked) => {
          const onlyDigits = digits.replace(/\D/g, '');
          if (!onlyDigits) return '';
          let out = onlyDigits;
          if (masked) {
            const keep = 4;
            const maskedLen = Math.max(0, onlyDigits.length - keep);
            out = '*'.repeat(maskedLen) + onlyDigits.slice(-keep);
          }

          return out.match(/.{1,4}/g)?.join(' ') || out;
        };

        const cardNumber = formatCardNumber(raw, Boolean(cfg.maskCard));
        drawTextAt(`${cardNumber}`, cardPos.x, cardPos.y, cardPos.fontPct);
      }
    } catch (e) {
      console.warn('BalanceRenderer: failed to draw card number', e && e.message ? e.message : e);
    }

      return canvas.toBuffer('image/png');
    } catch (e) {
      console.error('composeImage error', e);
      return null;
    }
  }
