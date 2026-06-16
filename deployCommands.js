const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error('TOKEN and CLIENT_ID are required in .env');
  process.exit(1);
}

const commands = [];
const seenNames = new Set();
const commandsPath = path.join(__dirname, 'commands');

function collectCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { collectCommands(full); continue; }
    if (!entry.name.endsWith('.js')) continue;
    try {
      delete require.cache[require.resolve(full)];
      const cmd = require(full);
      if (cmd && cmd.data && typeof cmd.data.toJSON === 'function') {
        const name = cmd.data.name;
        if (seenNames.has(name)) {
          console.warn(`Skipping duplicate command name: ${name} (file: ${full})`);
        } else {
          commands.push(cmd.data.toJSON());
          seenNames.add(name);
          console.log(`Queued ${name}`);
        }
      }
    } catch (err) { console.error('Failed loading command for deploy:', full, err); }
  }
}

if (fs.existsSync(commandsPath)) collectCommands(commandsPath);

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    if (process.argv.includes('--guild')) {
      const targetGuild = process.argv[process.argv.indexOf('--guild') + 1];
      if (!targetGuild) {
        console.error('No guild ID provided with --guild flag');
        process.exit(1);
      }
      console.log(`Registering ${commands.length} commands for guild ${targetGuild}...`);
      const res = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, targetGuild), { body: commands });
      console.log(`Successfully registered ${res.length} commands for guild ${targetGuild}.`);
      return;
    }

    console.log(`Registering ${commands.length} commands globally...`);
    const res = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`Successfully registered ${res.length} global commands.`);
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();
