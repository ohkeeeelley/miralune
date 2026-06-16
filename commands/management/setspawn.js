const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const dataDir = path.join(__dirname, '..', '..', 'data', 'ponyspawn');

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function loadServerConfig(guildId) {
  ensureDir();
  const p = path.join(dataDir, `${guildId}.json`);
  if (!fs.existsSync(p)) return { spawnChannels: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8') || '{}'); } catch (e) { return { spawnChannels: [] }; }
}

function saveServerConfig(guildId, cfg) {
  ensureDir();
  const p = path.join(dataDir, `${guildId}.json`);
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setspawn')
    .setDescription('Add a channel to receive spawns (max 5).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to add for spawns').setRequired(true)),
  async execute(interaction) {
    try {
      if (!interaction.guild) return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'You need the **Manage Server** permission to use this command.', ephemeral: true });
      }
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already acknowledged */ }
      const channel = interaction.options.getChannel('channel');
      if (!channel) return interaction.reply({ content: 'Invalid channel.', ephemeral: true });
      if (channel.guildId !== interaction.guild.id) return interaction.reply({ content: 'Please choose a channel from this server.', ephemeral: true });

      const guildId = interaction.guild.id;
      const cfg = loadServerConfig(guildId);
      cfg.spawnChannels = (cfg.spawnChannels || []).map(s => String(s).trim());

      if (cfg.spawnChannels.some(s => String(s) === String(channel.id))) {
        const alreadyEmbed = new EmbedBuilder()
          .setTitle('Spawn Channel')
          .setDescription(`${channel.toString()} is already registered as a spawn channel.`)
          .setColor(0x000000)
          .setFooter({ text: 'Maximum 5 spawn channels per server' });
        return interaction.editReply({ embeds: [alreadyEmbed] }).catch(() => {});
      }
      if (cfg.spawnChannels.length >= 5) {
        const fullEmbed = new EmbedBuilder()
          .setTitle('Spawn Channels Full')
          .setDescription('You may only register up to 5 spawn channels. Remove one before adding another.')
          .setColor(0x000000);
        return interaction.editReply({ embeds: [fullEmbed] }).catch(() => {});
      }
      cfg.spawnChannels.push(String(channel.id));

      cfg.spawnChannels = Array.from(new Set((cfg.spawnChannels || []).map(s => String(s).trim()))).slice(0, 5);
      cfg.channelTargets = cfg.channelTargets || {};
      cfg.channelCounters = cfg.channelCounters || {};
      if (!cfg.channelTargets[channel.id]) {
        const MIN = 30; const MAX = 40;
        cfg.channelTargets[channel.id] = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
      }
      if (!cfg.channelCounters[channel.id]) cfg.channelCounters[channel.id] = 0;
      saveServerConfig(guildId, cfg);

      const count = cfg.spawnChannels.length;

      let activeChannelsText = '';
      for (const chId of cfg.spawnChannels) {
        activeChannelsText += `<#${chId}>\n`;
      }
      if (!activeChannelsText) activeChannelsText = 'None';

      const embed = new EmbedBuilder()
        .setTitle('Spawn Channel Added')
        .setColor(0x000000)
        .setDescription(`${channel.toString()} has been added to automatic pony spawning.`)
        .addFields(
          { name: `Active spawn channels (${count}/5):`, value: activeChannelsText }
        )
        .setFooter({ text: `Use /removespawn to remove channels.` });

      await interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('setspawn error', err);
      try { await interaction.reply({ content: 'An error occurred while setting the spawn channel.', ephemeral: true }); } catch {}
    }
  }
};
