const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'verification');

const DEFAULT_PASSCODE_TITLE = 'Server Verification';
const DEFAULT_PASSCODE_DESCRIPTION = 'Click Verify and enter the passcode digits.';
const DEFAULT_QUIZ_TITLE = 'Server Verification';
const DEFAULT_QUIZ_DESCRIPTION = 'Click Verify and answer the quiz modal correctly.';

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function normalizeUiText(value, fallback, maxLen = 180) {
  const txt = String(value || '').trim();
  if (!txt) return fallback;
  return txt.slice(0, maxLen);
}

function defaultConfig() {
  return {
    channelId: null,
    verifiedRoleId: null,
    unverifiedRoleId: null,
    type: 'basic',
    passcode: null,
    quiz: {
      core: [null, null, null, null],
      extra: []
    },
    ui: {
      passcode: {
        title: DEFAULT_PASSCODE_TITLE,
        description: DEFAULT_PASSCODE_DESCRIPTION
      },
      quiz: {
        title: DEFAULT_QUIZ_TITLE,
        description: DEFAULT_QUIZ_DESCRIPTION
      }
    },
    panelChannelId: null,
    panelMessageId: null,
    updatedAt: Date.now()
  };
}

function normalizeQuestionAnswer(item) {
  if (!item || typeof item !== 'object') return null;
  const question = String(item.question || '').trim();
  const answer = String(item.answer || '').trim();
  if (!question || !answer) return null;
  return { question, answer };
}

function normalizeAnswer(input) {
  return String(input || '').trim().toLowerCase();
}

function parseQuestionAnswer(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return null;
  const sep = txt.indexOf('|');
  if (sep < 1 || sep === txt.length - 1) return null;

  const question = txt.slice(0, sep).trim();
  const answer = txt.slice(sep + 1).trim();
  if (!question || !answer) return null;
  return { question, answer };
}

function loadVerificationConfig(guildId) {
  ensureDir();
  const configPath = path.join(dataDir, `${guildId}.json`);
  if (!fs.existsSync(configPath)) return defaultConfig();

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const cfg = defaultConfig();

    cfg.channelId = raw.channelId || null;
    cfg.verifiedRoleId = raw.verifiedRoleId || null;
    cfg.unverifiedRoleId = raw.unverifiedRoleId || null;
    cfg.type = ['basic', 'passcode', 'quiz'].includes(raw.type) ? raw.type : 'basic';

    const passcodeRaw = raw.passcode === null || raw.passcode === undefined ? null : String(raw.passcode).trim();
    cfg.passcode = passcodeRaw && /^\d{4,12}$/.test(passcodeRaw) ? passcodeRaw : null;

    const coreRaw = Array.isArray(raw.quiz?.core) ? raw.quiz.core : [];
    const core = [null, null, null, null];
    for (let i = 0; i < 4; i++) {
      core[i] = normalizeQuestionAnswer(coreRaw[i]);
    }

    const extraRaw = Array.isArray(raw.quiz?.extra) ? raw.quiz.extra : [];
    const extra = extraRaw.map(normalizeQuestionAnswer).filter(Boolean).slice(0, 2);

    cfg.quiz = { core, extra };

  cfg.ui.passcode.title = normalizeUiText(raw.ui?.passcode?.title, DEFAULT_PASSCODE_TITLE, 80);
  cfg.ui.passcode.description = normalizeUiText(raw.ui?.passcode?.description, DEFAULT_PASSCODE_DESCRIPTION, 220);
  cfg.ui.quiz.title = normalizeUiText(raw.ui?.quiz?.title, DEFAULT_QUIZ_TITLE, 80);
  cfg.ui.quiz.description = normalizeUiText(raw.ui?.quiz?.description, DEFAULT_QUIZ_DESCRIPTION, 220);

    cfg.panelChannelId = raw.panelChannelId || null;
    cfg.panelMessageId = raw.panelMessageId || null;
    cfg.updatedAt = Number(raw.updatedAt || Date.now());

    return cfg;
  } catch (e) {
    console.error('[verificationManager] load parse error:', e.message);
    return defaultConfig();
  }
}

function saveVerificationConfig(guildId, data) {
  ensureDir();
  const configPath = path.join(dataDir, `${guildId}.json`);

  const cfg = defaultConfig();
  cfg.channelId = data.channelId || null;
  cfg.verifiedRoleId = data.verifiedRoleId || null;
  cfg.unverifiedRoleId = data.unverifiedRoleId || null;
  cfg.type = ['basic', 'passcode', 'quiz'].includes(data.type) ? data.type : 'basic';

  const passcodeRaw = data.passcode === null || data.passcode === undefined ? null : String(data.passcode).trim();
  cfg.passcode = passcodeRaw && /^\d{4,12}$/.test(passcodeRaw) ? passcodeRaw : null;

  const coreRaw = Array.isArray(data.quiz?.core) ? data.quiz.core : [];
  const core = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    core[i] = normalizeQuestionAnswer(coreRaw[i]);
  }

  const extraRaw = Array.isArray(data.quiz?.extra) ? data.quiz.extra : [];
  const extra = extraRaw.map(normalizeQuestionAnswer).filter(Boolean).slice(0, 2);

  cfg.quiz = { core, extra };

  cfg.ui.passcode.title = normalizeUiText(data.ui?.passcode?.title, DEFAULT_PASSCODE_TITLE, 80);
  cfg.ui.passcode.description = normalizeUiText(data.ui?.passcode?.description, DEFAULT_PASSCODE_DESCRIPTION, 220);
  cfg.ui.quiz.title = normalizeUiText(data.ui?.quiz?.title, DEFAULT_QUIZ_TITLE, 80);
  cfg.ui.quiz.description = normalizeUiText(data.ui?.quiz?.description, DEFAULT_QUIZ_DESCRIPTION, 220);

  cfg.panelChannelId = data.panelChannelId || null;
  cfg.panelMessageId = data.panelMessageId || null;
  cfg.updatedAt = Date.now();

  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  return cfg;
}

function verificationTypeLabel(type) {
  if (type === 'passcode') return 'Passcode (Digits)';
  if (type === 'quiz') return 'Quiz';
  return 'Basic ($verify)';
}

function isVerificationConfigured(cfg) {
  if (!cfg || !cfg.channelId || !cfg.verifiedRoleId) return false;

  if (cfg.type === 'passcode') {
    return !!cfg.passcode;
  }

  if (cfg.type === 'quiz') {
    return Array.isArray(cfg.quiz?.core) && cfg.quiz.core.every(Boolean);
  }

  return true;
}

async function applyVerification(member, cfg) {
  try {
    const verifiedRole = member.guild.roles.cache.get(cfg.verifiedRoleId)
      || await member.guild.roles.fetch(cfg.verifiedRoleId).catch(() => null);

    if (!verifiedRole) {
      return { ok: false, error: 'The configured verification role no longer exists.' };
    }

    if (!member.guild.members.me?.permissions?.has('ManageRoles')) {
      return { ok: false, error: 'I need the Manage Roles permission to verify members.' };
    }

    const botHighest = member.guild.members.me.roles.highest;
    if (botHighest.position <= verifiedRole.position) {
      return { ok: false, error: 'My highest role must be above the verification role.' };
    }

    if (!member.roles.cache.has(verifiedRole.id)) {
      await member.roles.add(verifiedRole).catch((e) => { throw e; });
    }

    if (cfg.unverifiedRoleId && member.roles.cache.has(cfg.unverifiedRoleId)) {
      const unverifiedRole = member.guild.roles.cache.get(cfg.unverifiedRoleId)
        || await member.guild.roles.fetch(cfg.unverifiedRoleId).catch(() => null);
      if (unverifiedRole && botHighest.position > unverifiedRole.position) {
        await member.roles.remove(unverifiedRole).catch(() => {});
      }
    }

    return { ok: true };
  } catch (e) {
    console.error('[verificationManager] applyVerification error:', e.message);
    return { ok: false, error: 'Failed to update roles. Check role hierarchy and permissions.' };
  }
}

module.exports = {
  defaultConfig,
  loadVerificationConfig,
  saveVerificationConfig,
  parseQuestionAnswer,
  normalizeAnswer,
  verificationTypeLabel,
  isVerificationConfigured,
  applyVerification
};
