const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: Events.GuildDelete,
  once: false,
  async execute(guild) {
    try {
      const dataDir = path.join(__dirname, '..', '..', 'data', 'ponyspawn');
      const p = path.join(dataDir, `${guild.id}.json`);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); console.log(`Removed server data for ${guild.id}`); } catch (e) { console.error('Failed removing server data', e); }
      }
    } catch (err) {
      console.error('guildRemove handler error', err);
    }
  }
};
