const PREMIUM_USER_IDS = new Set([
  '853496137130835970',
]);

function isPremium(userId) {
  return PREMIUM_USER_IDS.has(String(userId));
}

module.exports = { isPremium, PREMIUM_USER_IDS };
