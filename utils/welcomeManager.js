const fs   = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const dataDir = path.join(__dirname, '..', 'data', 'welcome');
const BG_PATH = path.join(__dirname, '..', 'assets', 'other_assets', 'ponyville_background.jpg');

function ensureDir() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadWelcome(guildId) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    if (!fs.existsSync(p)) return { channelId: null, roleId: null, activeWelcome: null, welcomes: {} };
    try {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
            channelId:     raw.channelId     || null,
            roleId:        raw.roleId        || null,
            activeWelcome: raw.activeWelcome  || null,
            welcomes:      raw.welcomes       || {},
        };
    }
    catch { return { channelId: null, roleId: null, activeWelcome: null, welcomes: {} }; }
}

function saveWelcome(guildId, data) {
    ensureDir();
    const p = path.join(dataDir, `${guildId}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

async function generateWelcomeCard(member, titleTemplate, descTemplate) {
    const W = 1100, H = 450;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    try {
        const bg    = await loadImage(BG_PATH);
        const scale = Math.max(W / bg.width, H / bg.height);
        const bw    = bg.width  * scale;
        const bh    = bg.height * scale;
        ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
    } catch {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);
    }

    const overlay = ctx.createLinearGradient(0, 0, W, 0);
    overlay.addColorStop(0,   'rgba(0,0,0,0.78)');
    overlay.addColorStop(0.28,'rgba(0,0,0,0.55)');
    overlay.addColorStop(0.5, 'rgba(0,0,0,0.50)');
    overlay.addColorStop(0.72,'rgba(0,0,0,0.55)');
    overlay.addColorStop(1,   'rgba(0,0,0,0.78)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    const vOverlay = ctx.createLinearGradient(0, H * 0.5, 0, H);
    vOverlay.addColorStop(0, 'rgba(0,0,0,0)');
    vOverlay.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vOverlay;
    ctx.fillRect(0, 0, W, H);

    const avatarR = 80;
    const avatarX = W / 2;
    const avatarY = 160;

    try {
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar    = await loadImage(avatarURL);

        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();
    } catch (err) {
        console.warn('[Welcome] Avatar load failed, using fallback:', err.message);

        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#dddddd';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = '#667080';
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font      = 'bold 40px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(member.user.username[0].toUpperCase(), avatarX, avatarY);
    }

    const vars = {
        '{user}':        member.user.username,
        '{displayname}': member.displayName,
        '{server}':      member.guild.name,
        '{count}':       member.guild.memberCount.toLocaleString(),
        '{mention}':     `@${member.user.username}`,
    };
    const apply = str => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(k, v), String(str));

    const title = apply(titleTemplate || '{user} just joined the server');
    const desc  = apply(descTemplate  || 'Member #{count}');

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#ffffff';
    ctx.font        = 'bold 38px Arial, sans-serif';
    ctx.fillText(title, W / 2, 320);

    ctx.shadowBlur = 8;
    ctx.fillStyle  = '#c0c4e0';
    ctx.font       = '24px Arial, sans-serif';
    ctx.fillText(desc, W / 2, 370);

    ctx.shadowBlur = 0;

    return canvas.toBuffer('image/png');
}

module.exports = { loadWelcome, saveWelcome, generateWelcomeCard };
