const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: Events.GuildCreate,
  once: false,
  async execute(guild) {
    try {
      const dataDir = path.join(__dirname, '..', '..', 'data', 'ponyspawn');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const p = path.join(dataDir, `${guild.id}.json`);
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, JSON.stringify({ spawnChannels: [] }, null, 2), 'utf8');
        console.log(`Initialized server data for ${guild.id}`);
      }

      const channel = guild.channels.cache.find(
        ch => ch.isTextBased && ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages')
      );
      if (channel) {
        await channel.send({
          embeds: [
            {
              title: 'Hello!! Welcome to Equestria, Thank you for inviting me!',
              description: '*A magical portal opens before you*\n\nGreetings, everypony! Welcome to the magical world of Equestria! I\'m your guide through this enchanted land where friendship is magic and adventure awaits at every turn!',
              fields: [
                { name: '✨ Start your journey today!', value: '**Begin Adventure**\nUse `/create` to enter the magical world and start your pony journey!' },
                { name: 'Game Features', value: 'Economy system, pony collection, battles, farming, and much more!' },
                { name: 'Need Help?', value: 'Use `/help` to see all available commands and features.' }
              ],
              footer: { text: 'Let the adventure begin!' }
            }
          ]
        });
      }
    } catch (err) {
      console.error('guildCreate handler error', err);
    }
  }
};
