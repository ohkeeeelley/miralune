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

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    if (process.argv.includes('--global')) {
      console.log('Clearing global commands...');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
      console.log('Cleared global commands.');
      return;
    }

    const targetGuild = process.argv.includes('--guild') ? process.argv[process.argv.indexOf('--guild') + 1] : (GUILD_ID || null);
    if (!targetGuild) {
      console.error('No GUILD_ID provided. Use --global or set GUILD_ID in .env or pass --guild <id>');
      process.exit(1);
    }

    console.log(`Clearing commands for guild ${targetGuild}...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, targetGuild), { body: [] });
    console.log(`Cleared commands for guild ${targetGuild}.`);
  } catch (err) {
    console.error('Failed to clear commands:', err);
  }
})();
