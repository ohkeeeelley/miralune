const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const dataDir = path.join(__dirname, '..', '..', 'data', 'ponyspawn');

function ensureDir() { if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true }); }
function loadServerConfig(guildId) {
  ensureDir();
  const p = path.join(dataDir, `${guildId}.json`);
  if (!fs.existsSync(p)) return { spawnChannels: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8') || '{}'); } catch (e) { return { spawnChannels: [] }; }
}
function saveServerConfig(guildId, cfg) { ensureDir(); const p = path.join(dataDir, `${guildId}.json`); fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8'); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removespawn')
    .setDescription('Remove a channel from spawn channels.')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to remove').setRequired(true)),
  async execute(interaction) {
    try {
      if (!interaction.guild) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* ignore */ }
      const channel = interaction.options.getChannel('channel');
      if (!channel || channel.guildId !== interaction.guild.id) return interaction.reply({ content: 'Invalid channel.', ephemeral: true });

      const guildId = interaction.guild.id;
      const cfg = loadServerConfig(guildId);
      cfg.spawnChannels = cfg.spawnChannels || [];
      if (!cfg.spawnChannels.includes(channel.id)) {
  const e = new EmbedBuilder().setTitle('Not Registered').setDescription(`${channel.toString()} is not in the spawn list.`).setColor(0x000000);
        return interaction.editReply({ embeds: [e] }).catch(() => {});
      }
      cfg.spawnChannels = cfg.spawnChannels.filter(id => id !== channel.id);
      saveServerConfig(guildId, cfg);

      const e = new EmbedBuilder()
        .setTitle('Spawn Channel Removed')
        .setDescription(`Removed ${channel.toString()} from spawn channels.`)
        .addFields({ name: 'Total Remaining', value: `${(cfg.spawnChannels || []).length}/5`, inline: true })
  .setColor(0x000000)
        .setFooter({ text: 'Spawns will no longer appear in removed channels.' });

      return interaction.editReply({ embeds: [e] }).catch(() => {});
    } catch (err) {
      console.error('removespawn error', err);
      try { await interaction.reply({ content: 'An error occurred.', ephemeral: true }); } catch {}
    }
  }
};
