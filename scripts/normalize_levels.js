const fs = require('fs');
const path = require('path');

const levelsDir = path.join(__dirname, '..', 'levels');

function getNext(level) {
  return 1000 * (level || 1);
}

fs.readdirSync(levelsDir).forEach(file => {
  if (!file.startsWith('levels_') || !file.endsWith('.json')) return;
  const fp = path.join(levelsDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8')) || {};
    let changed = false;
    Object.keys(data).forEach(uid => {
      const user = data[uid] || {};
      const lvl = (typeof user.level === 'number' ? user.level : 1);
      const newLvl = Math.max(1, lvl);
      if (user.level !== newLvl) { user.level = newLvl; changed = true; }
      const next = getNext(newLvl);
      if (user.nextlevels !== next) { user.nextlevels = next; changed = true; }
      // keep xp as-is
      data[uid] = user;
    });
    if (changed) {
      fs.writeFileSync(fp, JSON.stringify(data, null, 2));
      console.log(`Updated ${file}`);
    } else {
      console.log(`No change ${file}`);
    }
  } catch (err) {
    console.error(`Failed to process ${file}:`, err);
  }
});
