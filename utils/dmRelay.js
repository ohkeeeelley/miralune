const fs = require('fs');
const path = require('path')
const DM_IDS_PATH = path.join(__dirname, '..', 'data', 'dmIds.json');

function loadDmIds() {
  try {
    if (!fs.existsSync(DM_IDS_PATH)) {
      const empty = { byUserId: {}, byId: {} };
      fs.writeFileSync(DM_IDS_PATH, JSON.stringify(empty, null, 2));
      return empty;
    }
    const raw = fs.readFileSync(DM_IDS_PATH, 'utf8') || '{}';
    const data = JSON.parse(raw);
    if (!data.byUserId) data.byUserId = {};
    if (!data.byId)     data.byId     = {};
    return data;
  } catch (e) {
    console.error('[dmRelay] Failed to load dmIds.json:', e);
    return { byUserId: {}, byId: {} };
  }
}

function saveDmIds(data) {
  try {
    fs.writeFileSync(DM_IDS_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[dmRelay] Failed to save dmIds.json:', e);
  }
}

/**
 * @param {string}
 * @returns {string}
 */
function getOrCreateId(userId) {
  const data = loadDmIds();

  if (data.byUserId[userId]) {
    return data.byUserId[userId];
  }

  let newId;
  let attempts = 0;
  do {
    newId = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
    if (attempts > 9000) {

      newId = String(Math.floor(10000 + Math.random() * 90000));
      break;
    }
  } while (data.byId[newId]);

  data.byUserId[userId] = newId;
  data.byId[newId]      = userId;
  saveDmIds(data);

  console.log(`[dmRelay] Assigned ID ${newId} to user ${userId}`);
  return newId;
}

/**
 * @param {string|number}
 * @returns {string|null}
 */
function getUserIdById(id) {
  const data = loadDmIds();
  return data.byId[String(id)] || null;
}

/**
 * @param {string}
 * @returns {string|null}
 */
function getExistingId(userId) {
  const data = loadDmIds();
  return data.byUserId[userId] || null;
}

module.exports = { getOrCreateId, getUserIdById, getExistingId };
