const fs = require('fs');
const path = require('path');
const profilesPath = path.join(__dirname, '..', 'data', 'profile', 'profiles.json');

function loadProfiles() {
  if (!fs.existsSync(profilesPath)) return {};
  try { return JSON.parse(fs.readFileSync(profilesPath, 'utf8') || '{}'); } catch (e) { console.error('Failed to parse profiles.json', e); return {}; }
}
function saveProfiles(p) { fs.writeFileSync(profilesPath, JSON.stringify(p, null, 2), 'utf8'); }

const profiles = loadProfiles();
let changed = 0;
for (const [id, profile] of Object.entries(profiles)) {
  if (!profile || !profile.server) continue;
  const pt = profile.server.PurchasedThemes;
  if (!pt) continue;
  const arr = Array.isArray(pt) ? pt : [pt];
  const deduped = Array.from(new Set(arr));
  if (deduped.length !== arr.length) {
    profiles[id].server.PurchasedThemes = deduped;
    console.log(`Deduped PurchasedThemes for user ${id}: ${arr} -> ${deduped}`);
    changed++;
  }
}

if (changed > 0) {
  saveProfiles(profiles);
  console.log(`Wrote ${changed} updated profile(s) to ${profilesPath}`);
} else {
  console.log('No duplicates found in PurchasedThemes.');
}
