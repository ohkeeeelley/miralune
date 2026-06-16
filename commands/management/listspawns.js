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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('listspawns')
    .setDescription('List currently configured spawn channels for this server.'),
  async execute(interaction) {
    try {
      if (!interaction.guild) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* ignore */ }
      const cfg = loadServerConfig(interaction.guild.id);
      const channels = (cfg.spawnChannels || []).slice(0, 5);

      const embed = new EmbedBuilder()
        .setTitle('Configured Spawn Channels')
  .setColor(0x000000)
        .setFooter({ text: 'Up to 5 channels may be configured' });

      if (!channels.length) {
        embed.setDescription('No spawn channels configured — spawns will appear in any channel by default.');
        return interaction.editReply({ embeds: [embed] }).catch(() => {});
      }

      const list = channels.map((id, idx) => `${idx + 1}. <#${id}>`).join('\n');
      embed.setDescription(list);
  return interaction.editReply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      console.error('listspawns error', err);
      try { await interaction.reply({ content: 'An error occurred.', ephemeral: true }); } catch {}
    }
  }
};
