const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const GIFEncoder = require('gif-encoder-2');

const CARDS_DIR = path.join(__dirname, '../assets/level_assets/level_cards');
const CARD_WIDTH = 800;
const CARD_HEIGHT = 200;

const PROGRESS_STYLES = [
  { key: 'static',  label: 'Static',  description: 'No animation' },
  { key: 'shimmer', label: 'Shimmer', description: 'Diagonal stripes sliding across the bar' },
  { key: 'pulse',   label: 'Pulse',   description: 'Gentle brightness pulsing glow' },
  { key: 'wave',    label: 'Wave',    description: 'Layered water-surface waves with ripples' },
  { key: 'tidal',   label: 'Tidal',   description: 'Rolling tidal currents with swirling undertow' },
  { key: 'midnight_galaxy', label: 'Midnight Galaxy', description: 'Deep galaxy core, nebula layers, twinkling stars, and comet trails' },
  { key: 'rainbow', label: 'Rainbow', description: 'Aurora rainbow ribbons with glossy sweep' },
  { key: 'prism',   label: 'Prism',   description: 'Crystal facets with refracted light sweeps' },
  { key: 'stardust',label: 'Stardust',description: 'Layered cosmic dust, bright twinkles, and drifting sparkle trails' },
  { key: 'ember',   label: 'Lava',    description: 'Still molten lava with bubble pops and heat shimmer' },
  { key: 'glitch',  label: 'Glitch',  description: 'Retro scanline jitter and RGB offsets' },
  { key: 'nebula',  label: 'Nebula',  description: 'Cosmic clouds and starfield drift' },
];

const CARD_THEMES = [
  { key: 'default_bg',              label: 'Default',              file: 'default_bg.png',              requiredLevel: 0 },
  { key: 'welcome_to_ponyville_bg', label: 'Welcome to Ponyville', file: 'welcome_to_ponyville_bg.png', requiredLevel: 5 },
  { key: 'snowy_ponyville_bg',      label: 'Snowy Ponyville',      file: 'snowy_ponyville_bg.png',      requiredLevel: 10 },
  { key: 'fluttershy_bg',           label: "Fluttershy's Cottage",  file: 'fluttershy_bg.png',           requiredLevel: 15 },
  { key: 'cmc_treehouse_bg',        label: 'CMC Treehouse',         file: 'cmc_treehouse_bg.png',        requiredLevel: 20 },
  { key: 'manehattan_bg',           label: 'Manehattan',            file: 'manehattan_bg.png',           requiredLevel: 25 },
  { key: 'rarityshop_bg',           label: "Rarity's Boutique",     file: 'rarityshop_bg.png',           requiredLevel: 30 },
  { key: 'crystalempire_bg',        label: 'Crystal Empire',        file: 'crystalempire_bg.png',        requiredLevel: 35 },
  { key: 'wonderbolt_classroom_bg', label: 'Wonderbolt Academy',    file: 'wonderbolt_classroom_bg.png', requiredLevel: 40 },
  { key: 'equestria_night_bg',      label: 'Equestria at Night',    file: 'equestria_night_bg.png',      requiredLevel: 45 },
  { key: 'derpyboom_bg',            label: 'Derpy Boom',            file: 'derpyboom_bg.png',            requiredLevel: 50 },
];

const bgCache = new Map();

async function loadBackground(themeKey) {
  if (bgCache.has(themeKey)) return bgCache.get(themeKey);
  const theme = CARD_THEMES.find(t => t.key === themeKey) || CARD_THEMES[0];
  const filePath = path.join(CARDS_DIR, theme.file);
  if (!fs.existsSync(filePath)) {
    const fallback = path.join(CARDS_DIR, 'default_bg.png');
    const img = await loadImage(fallback);
    bgCache.set(themeKey, img);
    return img;
  }
  const img = await loadImage(filePath);
  bgCache.set(themeKey, img);
  return img;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function normalizeProgressStyle(style) {
  return PROGRESS_STYLES.some(s => s.key === style) ? style : 'static';
}

function getDefaultProgressColors(style) {
  switch (style) {
    case 'pulse': return ['#8B5CF6', '#EC4899'];
    case 'wave': return ['#06B6D4', '#22D3EE'];
    case 'tidal': return ['#0284C7', '#34D399'];
    case 'midnight_galaxy': return ['#0B1028', '#8B5CF6'];
    case 'rainbow': return ['#FF2DB5', '#38D7FF'];
    case 'prism': return ['#67E8F9', '#C4B5FD'];
    case 'stardust': return ['#6366F1', '#22D3EE'];
    case 'ember': return ['#FF6A00', '#B91C1C'];
    case 'glitch': return ['#22D3EE', '#F43F5E'];
    case 'nebula': return ['#A855F7', '#3B82F6'];
    case 'shimmer':
    case 'static':
    default:
      return ['#3B82F6', '#60A5FA'];
  }
}

function drawProgressTrack(ctx, barX, barY, barWidth, barHeight, barRadius, style, t) {
  const trackGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
  let top = 'rgba(255,255,255,0.20)';
  let bottom = 'rgba(255,255,255,0.08)';
  let border = 'rgba(255,255,255,0.25)';

  switch (style) {
    case 'pulse':
      top = 'rgba(183,148,246,0.28)';
      bottom = 'rgba(76,29,149,0.20)';
      border = 'rgba(216,180,254,0.34)';
      break;
    case 'wave':

      top = 'rgba(255,255,255,0.16)';
      bottom = 'rgba(255,255,255,0.07)';
      border = 'rgba(255,255,255,0.24)';
      break;
    case 'tidal':

      top = 'rgba(255,255,255,0.15)';
      bottom = 'rgba(255,255,255,0.06)';
      border = 'rgba(255,255,255,0.23)';
      break;
    case 'midnight_galaxy':
      top = 'rgba(76, 29, 149, 0.34)';
      bottom = 'rgba(10, 15, 34, 0.30)';
      border = 'rgba(192,132,252,0.34)';
      break;
    case 'rainbow':
      top = 'rgba(165,180,252,0.28)';
      bottom = 'rgba(67,56,202,0.20)';
      border = 'rgba(196,181,253,0.36)';
      break;
    case 'prism':
      top = 'rgba(186,230,253,0.30)';
      bottom = 'rgba(139,92,246,0.20)';
      border = 'rgba(216,180,254,0.38)';
      break;
    case 'stardust':
    case 'nebula':
      top = 'rgba(99,102,241,0.28)';
      bottom = 'rgba(15,23,42,0.32)';
      border = 'rgba(129,140,248,0.34)';
      break;
    case 'ember':
      top = 'rgba(255,106,0,0.30)';
      bottom = 'rgba(127, 29, 29,0.34)';
      border = 'rgba(255, 164, 74,0.36)';
      break;
    case 'glitch':
      top = 'rgba(100,116,139,0.26)';
      bottom = 'rgba(30,41,59,0.28)';
      border = 'rgba(148,163,184,0.34)';
      break;
    case 'shimmer':
    case 'static':
    default:
      break;
  }

  trackGrad.addColorStop(0, top);
  trackGrad.addColorStop(1, bottom);
  ctx.fillStyle = trackGrad;
  drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barRadius);
  ctx.fill();

  ctx.save();
  drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barRadius);
  ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  if (style !== 'wave' && style !== 'tidal' && style !== 'midnight_galaxy' && style !== 'ember') {
    for (let x = barX + 18; x < barX + barWidth; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, barY + 2);
      ctx.lineTo(x, barY + barHeight - 2);
      ctx.stroke();
    }
  }

  if (style === 'glitch') {
    ctx.globalAlpha = 0.12;
    for (let y = barY + 1; y < barY + barHeight; y += 3) {
      const jitter = Math.sin((y - barY) * 0.8 + t * Math.PI * 8) * 4;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(barX + jitter, y, barWidth, 1);
    }
  }

  if (style === 'stardust' || style === 'nebula' || style === 'midnight_galaxy') {
    const starCount = 14;
    for (let i = 0; i < starCount; i++) {
      const x = barX + ((i * 43 + Math.floor(t * barWidth * 1.4)) % barWidth);
      const y = barY + ((i * 17) % barHeight);
      const alpha = 0.16 + 0.14 * Math.max(0, Math.sin(t * Math.PI * 2 * 1.6 + i));
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  ctx.restore();

  ctx.strokeStyle = border;
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, barX + 0.5, barY + 0.5, barWidth - 1, barHeight - 1, Math.max(2, barRadius - 1));
  ctx.stroke();
}

/**
 * Draw animated overlay on the progress bar fill area.
 * @param {number} t - normalized time 0..1 (loops seamlessly at 1)
 */
function drawAnimationOverlay(ctx, barX, barY, fillWidth, barHeight, barRadius, style, t, colors = null) {
  ctx.save();
  drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, barRadius);
  ctx.clip();

  if (style === 'shimmer') {

    const stripeW = 14;
    const gap = 32;
    const totalCycle = gap;
    const offset = t * totalCycle;

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#FFFFFF';
    for (let sx = -barHeight - gap + offset; sx < fillWidth + barHeight + gap; sx += gap) {
      ctx.beginPath();
      ctx.moveTo(barX + sx, barY + barHeight);
      ctx.lineTo(barX + sx + stripeW, barY + barHeight);
      ctx.lineTo(barX + sx + stripeW + barHeight, barY);
      ctx.lineTo(barX + sx + barHeight, barY);
      ctx.closePath();
      ctx.fill();
    }

    const sweepRange = fillWidth + 160;
    const sweepPos = t * sweepRange - 80;
    const sweepGrad = ctx.createLinearGradient(barX + sweepPos - 50, barY, barX + sweepPos + 50, barY);
    sweepGrad.addColorStop(0, 'rgba(255,255,255,0)');
    sweepGrad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    sweepGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

  } else if (style === 'pulse') {

    const rawPhase = (Math.sin(t * Math.PI * 2 - Math.PI / 2) + 1) / 2;
    const phase = rawPhase * rawPhase * (3 - 2 * rawPhase);

    const pulseAlpha = 0.07 + 0.14 * phase;
    ctx.globalAlpha = pulseAlpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const glowX = barX + fillWidth * (0.25 + phase * 0.5);
    const glow = ctx.createRadialGradient(glowX, barY + barHeight / 2, 0, glowX, barY + barHeight / 2, barHeight * 1.9);
    glow.addColorStop(0, 'rgba(255,255,255,0.38)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = glow;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const innerTop = 0.10 + 0.12 * phase;
    const innerBottom = 0.03 + 0.05 * phase;
    const innerGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    innerGrad.addColorStop(0, `rgba(255,255,255,${innerTop.toFixed(3)})`);
    innerGrad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    innerGrad.addColorStop(1, `rgba(255,255,255,${innerBottom.toFixed(3)})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = innerGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

  } else if (style === 'wave') {

    const waveColors = Array.isArray(colors)
      ? [colors[0] || '#06B6D4', colors[1] || colors[0] || '#22D3EE']
      : ['#06B6D4', '#22D3EE'];
    const deepColor = waveColors[0];
    const lightColor = waveColors[1];

    const phase = t * Math.PI * 2;
    const surfaceBase = barY + barHeight * 0.56;
    const ampMain = barHeight * 0.16;
    const ampDetail = barHeight * 0.07;
    const surfaceY = (px, offset = 0) => (
      surfaceBase
      + Math.sin(px / 34 + phase * 1.15 + offset) * ampMain
      + Math.sin(px / 17 - phase * 2.1 + offset * 1.7) * ampDetail
    );

    const backGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    backGrad.addColorStop(0, lightColor);
    backGrad.addColorStop(1, deepColor);
    ctx.globalAlpha = 0.56;
    ctx.fillStyle = backGrad;
    ctx.beginPath();
    ctx.moveTo(barX, barY + barHeight);
    for (let px = 0; px <= fillWidth; px += 4) {
      ctx.lineTo(barX + px, surfaceY(px, 1.2) + barHeight * 0.06);
    }
    ctx.lineTo(barX + fillWidth, barY + barHeight);
    ctx.closePath();
    ctx.fill();

    const frontGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    frontGrad.addColorStop(0, lightColor);
    frontGrad.addColorStop(1, deepColor);
    ctx.globalAlpha = 1;
    ctx.fillStyle = frontGrad;
    ctx.beginPath();
    ctx.moveTo(barX, barY + barHeight);
    for (let px = 0; px <= fillWidth; px += 3) {
      ctx.lineTo(barX + px, surfaceY(px));
    }
    ctx.lineTo(barX + fillWidth, barY + barHeight);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.40)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let px = 0; px <= fillWidth; px += 3) {
      const y = surfaceY(px) - 0.7;
      if (px === 0) ctx.moveTo(barX + px, y);
      else ctx.lineTo(barX + px, y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let px = -24; px < fillWidth + 24; px += 26) {
      const x = barX + px + Math.sin(phase * 1.1 + px * 0.12) * 7;
      const y = barY + barHeight * 0.64
        + Math.sin((px / 30) + phase * 1.6) * (barHeight * 0.10);
      ctx.beginPath();
      ctx.ellipse(x, y, 8, 1.2, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

  } else if (style === 'tidal') {

    const tidalColors = Array.isArray(colors)
      ? [colors[0] || '#0284C7', colors[1] || colors[0] || '#34D399']
      : ['#0284C7', '#34D399'];
    const deepColor = tidalColors[0];
    const brightColor = tidalColors[1];

    const phase = t * Math.PI * 2;
    const tideY = (px, offset = 0) => (
      barY + barHeight * 0.57
      + Math.sin(px / 72 + phase * 0.92 + offset) * (barHeight * 0.12)
      + Math.sin(px / 30 - phase * 1.55 + offset * 1.8) * (barHeight * 0.045)
    );

    const deepGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    deepGrad.addColorStop(0, brightColor);
    deepGrad.addColorStop(1, deepColor);
    ctx.globalAlpha = 0.70;
    ctx.fillStyle = deepGrad;
    ctx.beginPath();
    ctx.moveTo(barX, barY + barHeight);
    for (let px = 0; px <= fillWidth; px += 3) {
      ctx.lineTo(barX + px, tideY(px, 1.25) + barHeight * 0.06);
    }
    ctx.lineTo(barX + fillWidth, barY + barHeight);
    ctx.closePath();
    ctx.fill();

    const frontGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    frontGrad.addColorStop(0, brightColor);
    frontGrad.addColorStop(1, deepColor);
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = frontGrad;
    ctx.beginPath();
    ctx.moveTo(barX, barY + barHeight);
    for (let px = 0; px <= fillWidth; px += 3) {
      ctx.lineTo(barX + px, tideY(px));
    }
    ctx.lineTo(barX + fillWidth, barY + barHeight);
    ctx.closePath();
    ctx.fill();

    const undertowGrad = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
    undertowGrad.addColorStop(0, 'rgba(125,211,252,0.02)');
    undertowGrad.addColorStop(0.5, 'rgba(125,211,252,0.14)');
    undertowGrad.addColorStop(1, 'rgba(125,211,252,0.02)');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = undertowGrad;
    ctx.lineWidth = barHeight * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let px = 0; px <= fillWidth; px += 3) {
      const y = barY + barHeight * 0.43
        + Math.sin(px / 65 - phase * 1.05) * (barHeight * 0.095)
        + Math.sin(px / 27 + phase * 1.95) * (barHeight * 0.03);
      if (px === 0) ctx.moveTo(barX + px, y);
      else ctx.lineTo(barX + px, y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(186,230,253,0.12)';
    for (let px = -30; px < fillWidth + 30; px += 34) {
      const x = barX + px + Math.sin(phase * 1.35 + px * 0.08) * 5;
      const y = barY + barHeight * 0.49 + Math.sin(px / 26 - phase * 1.65) * (barHeight * 0.07);
      ctx.beginPath();
      ctx.ellipse(x, y, 5.6, 1.0, -0.10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(186,230,253,0.24)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let px = 0; px <= fillWidth; px += 3) {
      const y = tideY(px) - 0.6;
      if (px === 0) ctx.moveTo(barX + px, y);
      else ctx.lineTo(barX + px, y);
    }
    ctx.stroke();

  } else if (style === 'midnight_galaxy') {
    const galaxyColors = Array.isArray(colors)
      ? [colors[0] || '#0B1028', colors[1] || colors[0] || '#8B5CF6']
      : ['#0B1028', '#8B5CF6'];
    const deepColor = galaxyColors[0];
    const glowColor = galaxyColors[1];

    const phase = t * Math.PI * 2;
    const safeWidth = Math.max(1, fillWidth);

    const baseGrad = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    baseGrad.addColorStop(0, 'rgba(7,10,26,0.96)');
    baseGrad.addColorStop(0.50, deepColor);
    baseGrad.addColorStop(1, 'rgba(2,4,14,0.98)');
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = baseGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const coreX = barX + fillWidth * (0.44 + 0.11 * Math.sin(phase * 0.45));
    const coreY = barY + barHeight * (0.50 + 0.06 * Math.sin(phase * 0.65 + 0.9));
    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, barHeight * 2.5);
    coreGrad.addColorStop(0, 'rgba(236,245,255,0.30)');
    coreGrad.addColorStop(0.18, 'rgba(147,197,253,0.31)');
    coreGrad.addColorStop(0.55, 'rgba(139,92,246,0.27)');
    coreGrad.addColorStop(1, 'rgba(139,92,246,0.00)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = coreGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const nebulaA = barX + fillWidth * (0.18 + 0.10 * Math.sin(phase * 0.82));
    const nebulaAGrad = ctx.createRadialGradient(nebulaA, barY + barHeight * 0.42, 0, nebulaA, barY + barHeight * 0.42, barHeight * 2.0);
    nebulaAGrad.addColorStop(0, 'rgba(167,139,250,0.36)');
    nebulaAGrad.addColorStop(1, 'rgba(167,139,250,0.00)');
    ctx.fillStyle = nebulaAGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const nebulaB = barX + fillWidth * (0.70 + 0.12 * Math.sin(phase * 1.08 + 1.2));
    const nebulaBGrad = ctx.createRadialGradient(nebulaB, barY + barHeight * 0.65, 0, nebulaB, barY + barHeight * 0.65, barHeight * 1.7);
    nebulaBGrad.addColorStop(0, 'rgba(56,189,248,0.34)');
    nebulaBGrad.addColorStop(1, 'rgba(56,189,248,0.00)');
    ctx.fillStyle = nebulaBGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const nebulaC = barX + fillWidth * (0.52 + 0.09 * Math.sin(phase * 0.92 + 2.1));
    const nebulaCGrad = ctx.createRadialGradient(nebulaC, barY + barHeight * 0.34, 0, nebulaC, barY + barHeight * 0.34, barHeight * 1.35);
    nebulaCGrad.addColorStop(0, 'rgba(244,114,182,0.27)');
    nebulaCGrad.addColorStop(1, 'rgba(244,114,182,0.00)');
    ctx.fillStyle = nebulaCGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const laneY = barY + barHeight * (0.60 + 0.05 * Math.sin(phase * 0.55));
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = 'rgba(6,8,20,0.85)';
    ctx.beginPath();
    for (let px = 0; px <= fillWidth; px += 4) {
      const y = laneY
        + Math.sin(px / 47 + phase * 0.7) * (barHeight * 0.07)
        + Math.sin(px / 21 - phase * 1.25) * (barHeight * 0.03);
      if (px === 0) ctx.moveTo(barX + px, y);
      else ctx.lineTo(barX + px, y);
    }
    for (let px = fillWidth; px >= 0; px -= 4) {
      const y = laneY + barHeight * 0.13
        + Math.sin(px / 47 + phase * 0.7) * (barHeight * 0.06)
        + Math.sin(px / 21 - phase * 1.25) * (barHeight * 0.025);
      ctx.lineTo(barX + px, y);
    }
    ctx.closePath();
    ctx.fill();

    const farStarCount = Math.max(44, Math.floor(fillWidth / 7.2));
    for (let i = 0; i < farStarCount; i++) {
      const baseX = ((i * 29) % safeWidth);
      const x = barX + baseX;
      const y = barY + (((i * 13) % Math.max(1, Math.floor(barHeight * 100))) / 100);
      const twinkle = 0.10 + 0.34 * Math.max(0, Math.sin(phase * 2.0 + i * 0.93));
      ctx.fillStyle = `rgba(255,255,255,${twinkle.toFixed(3)})`;
      ctx.fillRect(x, y, 1.0, 1.0);
    }

    const nearStarCount = Math.max(20, Math.floor(fillWidth / 14.5));
    for (let i = 0; i < nearStarCount; i++) {
      const baseX = ((i * 47 + 19) % safeWidth);
      const x = barX + baseX;
      const y = barY + barHeight * (0.10 + ((i * 17) % 72) / 100);
      const pulse = 0.22 + 0.48 * Math.max(0, Math.sin(phase * 2.5 + i * 0.77));
      const size = (i % 4 === 0) ? 2.1 : 1.45;

      ctx.fillStyle = `rgba(255,255,255,${pulse.toFixed(3)})`;
      ctx.fillRect(x, y, size, size);

      if (i % 3 === 0) {
        const halo = (pulse * 0.85).toFixed(3);
        ctx.fillStyle = `rgba(125,211,252,${halo})`;
        ctx.fillRect(x - 0.4, y + 0.4, 1.0, 1.0);
      }
    }

    const sparkleCount = Math.max(7, Math.floor(fillWidth / 64));
    for (let i = 0; i < sparkleCount; i++) {
      const sx = barX + fillWidth * (0.08 + i * 0.12 + 0.01 * Math.sin(i * 1.8));
      const sy = barY + barHeight * (0.16 + ((i * 23) % 58) / 100);
      const flare = 0.18 + 0.46 * Math.max(0, Math.sin(phase * 2.2 + i * 0.9));
      const arm = 1.8 + 1.0 * Math.max(0, Math.sin(phase * 1.4 + i));

      ctx.strokeStyle = `rgba(255,255,255,${flare.toFixed(3)})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(sx - arm, sy);
      ctx.lineTo(sx + arm, sy);
      ctx.moveTo(sx, sy - arm * 0.82);
      ctx.lineTo(sx, sy + arm * 0.82);
      ctx.stroke();

      ctx.fillStyle = `rgba(186,230,253,${(flare * 0.78).toFixed(3)})`;
      ctx.fillRect(sx - 0.45, sy - 0.45, 0.9, 0.9);
    }

    const nodeCount = 5;
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: barX + fillWidth * (0.12 + i * 0.19),
        y: barY + barHeight * (0.16 + 0.12 * (i % 2))
      });
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(186,230,253,${(0.08 + 0.06 * (0.5 + 0.5 * Math.sin(phase))).toFixed(3)})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      if (i === 0) ctx.moveTo(nodes[i].x, nodes[i].y);
      else ctx.lineTo(nodes[i].x, nodes[i].y);
    }
    ctx.stroke();

    for (let i = 0; i < nodes.length; i++) {
      const glow = 0.15 + 0.25 * Math.max(0, Math.sin(phase * 2.8 + i * 0.6));
      ctx.fillStyle = `rgba(219,234,254,${glow.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(nodes[i].x, nodes[i].y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    const shine = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    shine.addColorStop(0, 'rgba(255,255,255,0.22)');
    shine.addColorStop(0.48, 'rgba(255,255,255,0.03)');
    shine.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = shine;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const tint = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
    tint.addColorStop(0, 'rgba(30,64,175,0.08)');
    tint.addColorStop(0.5, `rgba(139,92,246,${(0.09 + 0.04 * (0.5 + 0.5 * Math.sin(phase * 0.8))).toFixed(3)})`);
    tint.addColorStop(1, 'rgba(6,182,212,0.08)');
    ctx.fillStyle = tint;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

  } else if (style === 'rainbow') {

    const phase = t * Math.PI * 2;
    const palette = ['#ff2f2f', '#ff6a00', '#fff200', '#68ff3d', '#2bd8ff', '#8f63ff', '#ff2fb0'];
    const offset = (phase / (Math.PI * 2)) * fillWidth;

    const paintRainbowBand = (startX) => {
      const grad = ctx.createLinearGradient(startX, barY, startX + fillWidth, barY);
      const step = 1 / (palette.length - 1);
      for (let i = 0; i < palette.length; i++) {
        grad.addColorStop(i * step, palette[i]);
      }
      ctx.globalAlpha = 0.76;
      ctx.fillStyle = grad;
      ctx.fillRect(startX, barY, fillWidth, barHeight);
    };

    paintRainbowBand(barX - offset);
    paintRainbowBand(barX - offset + fillWidth);

    const glowCenter = barX + fillWidth * (0.5 + 0.45 * Math.sin(phase));
    const gloss = ctx.createLinearGradient(glowCenter - 48, barY, glowCenter + 48, barY);
    gloss.addColorStop(0, 'rgba(255,255,255,0)');
    gloss.addColorStop(0.5, 'rgba(255,255,255,0.44)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = gloss;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const neonGlow = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY + barHeight);
    neonGlow.addColorStop(0, 'rgba(255, 36, 186, 0.14)');
    neonGlow.addColorStop(0.5, 'rgba(74, 255, 219, 0.14)');
    neonGlow.addColorStop(1, 'rgba(130, 99, 255, 0.14)');
    ctx.fillStyle = neonGlow;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const topShine = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    topShine.addColorStop(0, 'rgba(255,255,255,0.28)');
    topShine.addColorStop(0.5, 'rgba(255,255,255,0.07)');
    topShine.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = topShine;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

  } else if (style === 'prism') {

    const phase = t * Math.PI * 2;
    const cycle = fillWidth * 0.62;
    const shift = (phase / (Math.PI * 2)) * cycle;

    const beamSpecs = [
      { hue: 'rgba(103, 232, 249, 0.36)', offset: 0 },
      { hue: 'rgba(196, 181, 253, 0.34)', offset: cycle * 0.33 },
      { hue: 'rgba(253, 224, 71, 0.26)', offset: cycle * 0.66 }
    ];

    for (const beam of beamSpecs) {
      const startX = barX - cycle + shift + beam.offset;
      const beamGrad = ctx.createLinearGradient(startX, barY, startX + cycle * 0.8, barY + barHeight);
      beamGrad.addColorStop(0, 'rgba(255,255,255,0.00)');
      beamGrad.addColorStop(0.45, beam.hue);
      beamGrad.addColorStop(1, 'rgba(255,255,255,0.00)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = beamGrad;
      ctx.fillRect(barX, barY, fillWidth, barHeight);
    }

    const facetCount = 7;
    const segment = fillWidth / facetCount;
    for (let i = 0; i < facetCount; i++) {
      const fx = barX + i * segment + Math.sin(phase + i * 0.7) * 1.8;
      const w = segment * 0.92;
      const isEven = i % 2 === 0;
      ctx.globalAlpha = isEven ? 0.18 : 0.12;
      ctx.fillStyle = isEven ? 'rgba(255,255,255,0.34)' : 'rgba(196,181,253,0.28)';
      ctx.beginPath();
      if (isEven) {
        ctx.moveTo(fx, barY + barHeight);
        ctx.lineTo(fx + w * 0.56, barY + barHeight * 0.16);
        ctx.lineTo(fx + w, barY + barHeight);
      } else {
        ctx.moveTo(fx, barY);
        ctx.lineTo(fx + w * 0.44, barY + barHeight * 0.86);
        ctx.lineTo(fx + w, barY);
      }
      ctx.closePath();
      ctx.fill();
    }

    const edgeX = barX + (phase / (Math.PI * 2)) * fillWidth;
    const edgeGrad = ctx.createLinearGradient(edgeX - 26, barY, edgeX + 26, barY);
    edgeGrad.addColorStop(0, 'rgba(255,255,255,0)');
    edgeGrad.addColorStop(0.5, 'rgba(255,255,255,0.42)');
    edgeGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const prismTopShine = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    prismTopShine.addColorStop(0, 'rgba(255,255,255,0.26)');
    prismTopShine.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    prismTopShine.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = prismTopShine;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

  } else if (style === 'stardust') {
    const phase = t * Math.PI * 2;
    const safeWidth = Math.max(1, Math.floor(fillWidth));

    const haze = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY + barHeight);
    haze.addColorStop(0, 'rgba(99,102,241,0.18)');
    haze.addColorStop(0.5, 'rgba(34,211,238,0.15)');
    haze.addColorStop(1, 'rgba(167,139,250,0.18)');
    ctx.fillStyle = haze;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const auroraY = barY + barHeight * (0.40 + 0.10 * Math.sin(phase * 0.7));
    const auroraGrad = ctx.createLinearGradient(barX, auroraY - barHeight * 0.4, barX, auroraY + barHeight * 0.4);
    auroraGrad.addColorStop(0, 'rgba(99,102,241,0.00)');
    auroraGrad.addColorStop(0.35, `rgba(124,58,237,${(0.12 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 0.65))).toFixed(3)})`);
    auroraGrad.addColorStop(0.65, `rgba(56,189,248,${(0.12 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 0.65 + 1))).toFixed(3)})`);
    auroraGrad.addColorStop(1, 'rgba(167,139,250,0.00)');
    ctx.fillStyle = auroraGrad;
    ctx.fillRect(barX, auroraY - barHeight * 0.4, fillWidth, barHeight * 0.8);

    const nebX = barX + fillWidth * (0.55 + 0.12 * Math.sin(phase * 0.75 + 0.9));
    const nebGrad = ctx.createRadialGradient(nebX, barY + barHeight * 0.52, 0, nebX, barY + barHeight * 0.52, barHeight * 1.6);
    nebGrad.addColorStop(0, 'rgba(244,114,182,0.22)');
    nebGrad.addColorStop(1, 'rgba(244,114,182,0.00)');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const neb2X = barX + fillWidth * (0.22 + 0.10 * Math.sin(phase * 0.82 + 2.1));
    const neb2Grad = ctx.createRadialGradient(neb2X, barY + barHeight * 0.42, 0, neb2X, barY + barHeight * 0.42, barHeight * 1.4);
    neb2Grad.addColorStop(0, 'rgba(34,211,238,0.18)');
    neb2Grad.addColorStop(1, 'rgba(34,211,238,0.00)');
    ctx.fillStyle = neb2Grad;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const farCount = Math.max(48, Math.floor(fillWidth / 7));
    for (let i = 0; i < farCount; i++) {
      const x = barX + ((i * 31 + 9) % safeWidth);
      const yBase = barY + (((i * 17) % Math.max(1, Math.floor(barHeight * 100))) / 100);
      const y = yBase + Math.sin(phase * 1.2 + i * 0.72) * 0.85;
      const twinkle = 0.06 + 0.30 * Math.max(0, Math.sin(phase * 2.1 + i * 0.83));
      ctx.fillStyle = `rgba(241,245,249,${twinkle.toFixed(3)})`;
      ctx.fillRect(x, y, 1.0, 1.0);
    }

    const midCount = Math.max(24, Math.floor(fillWidth / 13));
    for (let i = 0; i < midCount; i++) {
      const x = barX + ((i * 43 + 21) % safeWidth);
      const y = barY + barHeight * (0.12 + ((i * 23) % 72) / 100)
        + Math.sin(phase * 1.05 + i * 0.51) * 1.15;
      const pulse = 0.16 + 0.42 * Math.max(0, Math.sin(phase * 2.35 + i * 0.67));
      const size = (i % 4 === 0) ? 2.0 : 1.4;

      ctx.fillStyle = `rgba(255,255,255,${pulse.toFixed(3)})`;
      ctx.fillRect(x, y, size, size);

      if (i % 3 === 0) {
        ctx.fillStyle = `rgba(56,189,248,${(pulse * 0.72).toFixed(3)})`;
        ctx.fillRect(x + 0.6, y - 0.4, 1.0, 1.0);
      }

      if (i % 5 === 0) {
        ctx.fillStyle = `rgba(244,114,182,${(pulse * 0.60).toFixed(3)})`;
        ctx.fillRect(x - 0.5, y + 0.5, 1.0, 1.0);
      }
    }

    const sparkleCount = Math.max(9, Math.floor(fillWidth / 56));
    for (let i = 0; i < sparkleCount; i++) {
      const sx = barX + fillWidth * (0.06 + i * (0.88 / sparkleCount) + 0.01 * Math.sin(i * 1.9));
      const sy = barY + barHeight * (0.16 + ((i * 29) % 60) / 100);
      const flare = 0.22 + 0.50 * Math.max(0, Math.sin(phase * 2.0 + i * 0.95));
      const arm = 1.6 + 1.1 * Math.max(0, Math.sin(phase * 1.45 + i));

      ctx.strokeStyle = `rgba(255,255,255,${flare.toFixed(3)})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(sx - arm, sy);
      ctx.lineTo(sx + arm, sy);
      ctx.moveTo(sx, sy - arm * 0.88);
      ctx.lineTo(sx, sy + arm * 0.88);
      ctx.stroke();

      if (i % 2 === 0) {
        const diagArm = arm * 0.62;
        ctx.strokeStyle = `rgba(255,255,255,${(flare * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(sx - diagArm, sy - diagArm * 0.7);
        ctx.lineTo(sx + diagArm, sy + diagArm * 0.7);
        ctx.moveTo(sx + diagArm, sy - diagArm * 0.7);
        ctx.lineTo(sx - diagArm, sy + diagArm * 0.7);
        ctx.stroke();
      }

      const dotColor = (i % 2 === 0) ? `rgba(186,230,253,${(flare * 0.75).toFixed(3)})` : `rgba(251,207,232,${(flare * 0.68).toFixed(3)})`;
      ctx.fillStyle = dotColor;
      ctx.fillRect(sx - 0.45, sy - 0.45, 0.9, 0.9);
    }

    for (let i = 0; i < 5; i++) {
      const tx = barX + fillWidth * (0.12 + i * 0.18 + 0.05 * Math.sin(phase * 0.88 + i * 1.6));
      const ty = barY + barHeight * (0.24 + i * 0.14 + 0.04 * Math.cos(phase * 1.05 + i));
      const trailAlpha = 0.14 + 0.14 * Math.max(0, Math.sin(phase * 1.2 + i * 0.9));
      const trail = ctx.createLinearGradient(tx - 28, ty + 3, tx + 4, ty - 2);
      trail.addColorStop(0, 'rgba(255,255,255,0.00)');
      trail.addColorStop(1, `rgba(224,242,254,${trailAlpha.toFixed(3)})`);
      ctx.fillStyle = trail;
      ctx.fillRect(tx - 30, ty - 2, 34, 6);
      ctx.fillStyle = `rgba(255,255,255,${(trailAlpha * 1.2).toFixed(3)})`;
      ctx.fillRect(tx + 1, ty, 1.5, 1.0);
    }

    const glowPulseX = barX + fillWidth * (0.5 + 0.4 * Math.sin(phase * 0.6));
    const glowPulse = ctx.createRadialGradient(glowPulseX, barY + barHeight * 0.5, 0, glowPulseX, barY + barHeight * 0.5, barHeight * 2.2);
    glowPulse.addColorStop(0, `rgba(167,139,250,${(0.10 + 0.06 * (0.5 + 0.5 * Math.sin(phase * 0.8))).toFixed(3)})`);
    glowPulse.addColorStop(1, 'rgba(167,139,250,0.00)');
    ctx.fillStyle = glowPulse;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const stardustShine = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    stardustShine.addColorStop(0, 'rgba(255,255,255,0.18)');
    stardustShine.addColorStop(0.52, 'rgba(255,255,255,0.03)');
    stardustShine.addColorStop(1, 'rgba(255,255,255,0.00)');
    ctx.fillStyle = stardustShine;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

  } else if (style === 'ember') {

    const lavaColors = Array.isArray(colors)
      ? [colors[0] || '#FF6A00', colors[1] || colors[0] || '#B91C1C']
      : ['#FF6A00', '#B91C1C'];
    const hotColor = lavaColors[0];
    const deepColor = lavaColors[1];

    const phase = t * Math.PI * 2;

    const lavaBase = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
    lavaBase.addColorStop(0, 'rgba(255, 206, 120, 0.92)');
    lavaBase.addColorStop(0.30, hotColor);
    lavaBase.addColorStop(1, deepColor);
    ctx.globalAlpha = 0.98;
    ctx.fillStyle = lavaBase;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    ctx.globalAlpha = 0.30;
    ctx.fillStyle = 'rgba(22, 8, 8, 0.92)';
    const crustCount = Math.max(6, Math.floor(fillWidth / 70));
    const safeWidth = Math.max(1, Math.floor(fillWidth));
    for (let i = 0; i < crustCount; i++) {
      const x = barX + ((i * 61 + 17) % safeWidth);
      const y = barY + barHeight * (0.24 + ((i * 37) % 46) / 100);
      const rx = 8 + (i % 3) * 3;
      const ry = 2.4 + (i % 2) * 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, -0.18 + (i % 5) * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }

    const bubbleCount = Math.max(10, Math.floor(fillWidth / 38));
    for (let i = 0; i < bubbleCount; i++) {
      const cycle = (t * 0.72 + i * 0.137) % 1;
      const x = barX + ((i * 53 + 11) % safeWidth);
      const y = barY + barHeight * (0.86 - cycle * 0.58);
      const r = 0.9 + (1 - cycle) * 1.8;
      const bubbleA = 0.10 + 0.20 * (1 - cycle);

      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(255,215,140,${bubbleA.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      if (cycle > 0.80) {
        const pop = (cycle - 0.80) / 0.20;
        const ringR = 2 + pop * 5;
        const ringA = 0.34 * (1 - pop);
        ctx.strokeStyle = `rgba(255,235,170,${ringA.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        const splatA = 0.26 * (1 - pop);
        ctx.fillStyle = `rgba(255,200,120,${splatA.toFixed(3)})`;
        for (let d = 0; d < 4; d++) {
          const ang = d * (Math.PI / 2) + i * 0.2;
          const dx = Math.cos(ang) * (ringR + 1.5);
          const dy = Math.sin(ang) * (ringR * 0.55);
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 0.8 + (1 - pop) * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const shimmer = ctx.createLinearGradient(barX, barY + barHeight, barX, barY);
    shimmer.addColorStop(0, 'rgba(255,100,0,0.28)');
    shimmer.addColorStop(1, 'rgba(255,180,90,0.00)');
    ctx.fillStyle = shimmer;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    ctx.strokeStyle = 'rgba(255,243,190,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX, barY + barHeight * 0.24);
    ctx.lineTo(barX + fillWidth, barY + barHeight * 0.24);
    ctx.stroke();

  } else if (style === 'glitch') {
    const bandH = 3;
    for (let by = 0; by < barHeight; by += bandH + 1) {
      const offset = Math.sin(by * 0.9 + t * Math.PI * 2 * 3.2) * 6;
      const alpha = 0.08 + 0.10 * Math.max(0, Math.sin(t * Math.PI * 2 * 1.4 + by));
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fillRect(barX + offset, barY + by, fillWidth, bandH);

      ctx.fillStyle = 'rgba(34,211,238,0.14)';
      ctx.fillRect(barX + offset + 1, barY + by, fillWidth, 1);
      ctx.fillStyle = 'rgba(244,63,94,0.14)';
      ctx.fillRect(barX + offset - 1, barY + by + 1, fillWidth, 1);
    }

  } else if (style === 'nebula') {
    const cx1 = barX + ((t * 1.1) % 1) * fillWidth;
    const cy1 = barY + barHeight * 0.35;
    const n1 = ctx.createRadialGradient(cx1, cy1, 1, cx1, cy1, barHeight * 1.7);
    n1.addColorStop(0, 'rgba(168,85,247,0.38)');
    n1.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = n1;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    const cx2 = barX + ((t * 0.8 + 0.45) % 1) * fillWidth;
    const cy2 = barY + barHeight * 0.68;
    const n2 = ctx.createRadialGradient(cx2, cy2, 1, cx2, cy2, barHeight * 1.6);
    n2.addColorStop(0, 'rgba(59,130,246,0.34)');
    n2.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = n2;
    ctx.fillRect(barX, barY, fillWidth, barHeight);

    for (let i = 0; i < Math.max(10, Math.floor(fillWidth / 30)); i++) {
      const x = barX + ((i * 61 + Math.floor(t * fillWidth * 0.9)) % Math.max(1, Math.floor(fillWidth)));
      const y = barY + ((i * 7) % Math.max(1, Math.floor(barHeight)));
      const alpha = 0.08 + 0.20 * Math.max(0, Math.sin(t * Math.PI * 2 + i));
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.fillRect(x, y, 1.3, 1.3);
    }
  }

  ctx.restore();
}

/**
 * Draw one frame of the level card.
 */
function drawLevelFrame(ctx, { username, level, xp, neededXP, rank, progressColor, progressStyle }, bg, avatar, t) {
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.drawImage(bg, 0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  drawRoundedRect(ctx, 10, 10, 690, 180, 16);
  ctx.fill();

  const avatarSize = 90;
  const avatarX = 30;
  const avatarY = Math.floor((CARD_HEIGHT - avatarSize) / 2);

  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#555555';
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const textLeft = avatarX + avatarSize + 22;

  ctx.font = 'bold 26px Arial';
  ctx.fillStyle = '#FFFFFF';
  const maxNameWidth = 350;
  let displayName = username;
  while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 3) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== username) displayName += '…';
  ctx.fillText(displayName, textLeft, 55);

  ctx.font = 'bold 20px Arial';
  ctx.fillStyle = '#B0B0B0';
  ctx.fillText(`Level ${level}`, textLeft, 82);

  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = '#FFD700';
  const rankText = `#${rank}`;
  const rankWidth = ctx.measureText(rankText).width;
  ctx.fillText(rankText, 670 - rankWidth, 55);

  ctx.font = '14px Arial';
  ctx.fillStyle = '#AAAAAA';
  const rankLabel = 'RANK';
  const rankLabelWidth = ctx.measureText(rankLabel).width;
  ctx.fillText(rankLabel, 670 - rankLabelWidth, 28);

  const barX = textLeft;
  const barY = 130;
  const barWidth = 520;
  const barHeight = 24;
  const barRadius = 12;
  const style = normalizeProgressStyle(progressStyle || 'static');
  const progress = Math.min(xp / neededXP, 1);

  drawProgressTrack(ctx, barX, barY, barWidth, barHeight, barRadius, style, t);

  if (progress > 0.01) {
    const fillWidth = Math.max(barHeight, barWidth * progress);
    const defaultColors = getDefaultProgressColors(style);
    const colors = Array.isArray(progressColor)
      ? [progressColor[0] || defaultColors[0], progressColor[1] || progressColor[0] || defaultColors[1]]
      : (progressColor ? [progressColor, progressColor] : defaultColors);
    if (style === 'wave' || style === 'tidal' || style === 'midnight_galaxy' || style === 'ember') {

      drawAnimationOverlay(ctx, barX, barY, fillWidth, barHeight, barRadius, style, t, colors);
    } else {
      const gradient = ctx.createLinearGradient(barX, barY, barX + fillWidth, barY);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1] || colors[0]);
      ctx.fillStyle = gradient;
      drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, barRadius);
      ctx.fill();

      const gloss = ctx.createLinearGradient(barX, barY, barX, barY + barHeight);
      gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
      gloss.addColorStop(0.55, 'rgba(255,255,255,0.06)');
      gloss.addColorStop(1, 'rgba(255,255,255,0.00)');
      ctx.fillStyle = gloss;
      drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, barRadius);
      ctx.fill();

      if (style !== 'static') {
        drawAnimationOverlay(ctx, barX, barY, fillWidth, barHeight, barRadius, style, t, colors);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, barX + 0.5, barY + 0.5, Math.max(2, fillWidth - 1), barHeight - 1, Math.max(2, barRadius - 1));
    ctx.stroke();
  }

  ctx.font = 'bold 13px Arial';
  ctx.fillStyle = '#FFFFFF';
  const xpText = `${xp.toLocaleString()} / ${neededXP.toLocaleString()} XP`;
  const xpTextWidth = ctx.measureText(xpText).width;
  ctx.fillText(xpText, barX + (barWidth - xpTextWidth) / 2, barY + 17);

  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = '#CCCCCC';
  const lvlLabel = `LVL ${level}`;
  const lvlLabelWidth = ctx.measureText(lvlLabel).width;
  ctx.fillText(lvlLabel, barX + barWidth - lvlLabelWidth, barY - 8);
}

/**
 * Generate the level card image.
 * Returns { buffer, isAnimated }.
 */
async function generateLevelCard({ username, avatarURL, level, xp, neededXP, rank, cardTheme, progressColor, progressStyle }) {
  const bg = await loadBackground(cardTheme || 'default_bg');

  let avatar = null;
  try {
    avatar = await Promise.race([
      loadImage(avatarURL),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))
    ]);
  } catch {}

  const style = normalizeProgressStyle(progressStyle || 'static');
  const opts = { username, level, xp, neededXP, rank, progressColor, progressStyle: style };

  if (style === 'static') {
    const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
    const ctx = canvas.getContext('2d');
    drawLevelFrame(ctx, opts, bg, avatar, 0);
    return { buffer: canvas.toBuffer('image/png'), isAnimated: false };
  }

  const isFluidStyle = (style === 'wave' || style === 'tidal' || style === 'rainbow' || style === 'prism' || style === 'midnight_galaxy' || style === 'ember' || style === 'stardust');
  const totalFrames = style === 'midnight_galaxy' ? 56 : (style === 'stardust' ? 48 : (isFluidStyle ? 40 : 24));

  const encoder = new GIFEncoder(CARD_WIDTH, CARD_HEIGHT, 'neuquant', true, totalFrames);
  encoder.setDelay(style === 'midnight_galaxy' ? 28 : (style === 'stardust' ? 30 : (isFluidStyle ? 32 : 50)));
  encoder.setRepeat(0);
  encoder.setDispose(2);
  encoder.setThreshold(0);
  encoder.setQuality(style === 'midnight_galaxy' ? 1 : ((style === 'tidal' || style === 'rainbow' || style === 'prism' || style === 'ember' || style === 'stardust') ? 2 : 3));
  encoder.start();

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames;
    drawLevelFrame(ctx, opts, bg, avatar, t);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return { buffer: encoder.out.getData(), isAnimated: true };
}

module.exports = { generateLevelCard, CARD_THEMES, PROGRESS_STYLES, CARD_WIDTH, CARD_HEIGHT };
