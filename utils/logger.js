const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'app.log');

function timestamp() {
  return new Date().toISOString();
}

function appendLog(level, msg) {
  const line = `[${timestamp()}] [${level}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line, 'utf8'); } catch (e) { /* ignore */ }
}

function formatError(err) {
  if (!err) return '';
  if (err instanceof Error) return `${err.stack || err.message}`;
  try { return JSON.stringify(err); } catch { return String(err); }
}

module.exports = {
  info: (msg) => { console.log(msg); appendLog('INFO', msg); },
  warn: (msg) => { console.warn(msg); appendLog('WARN', msg); },
  error: (msg) => { console.error(msg); appendLog('ERROR', typeof msg === 'string' ? msg : formatError(msg)); }
};
