const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { BITS } = require('./currencyEmojis');
const { sendNoProfile } = require('../../utils/noProfileResponse');
const path = require('path');
const fs = require('fs');

const TRADES_DIR = path.join(__dirname, '..', '..', 'data', 'trades');
const TRADES_PATH = path.join(TRADES_DIR, 'trades.json');

if (!fs.existsSync(TRADES_DIR)) fs.mkdirSync(TRADES_DIR, { recursive: true });

const pendingTrades = new Map();

function _loadTrades() {
  try {

    const oldPath = path.join(__dirname, '..', '..', 'data', 'trades.json');
    if (!fs.existsSync(TRADES_PATH) && fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, TRADES_PATH);
      console.log('[TRADE] Migrated trades.json to data/trades/trades.json');
    }

    if (fs.existsSync(TRADES_PATH)) {
      const data = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8') || '{}');
      for (const [id, trade] of Object.entries(data)) {
        if (trade.state !== 'active') continue;
        pendingTrades.set(id, trade);
      }
      console.log(`[TRADE] Loaded ${pendingTrades.size} active trades from trades.json`);
    }
  } catch (e) {
    console.error('[TRADE] Error loading trades.json:', e.message);
  }
}

let _tradeSaveTimer = null;
function saveTrades() {
  if (_tradeSaveTimer) return;
  _tradeSaveTimer = setTimeout(() => {
    _tradeSaveTimer = null;
    try {
      const obj = {};
      for (const [id, trade] of pendingTrades) {
        obj[id] = trade;
      }
      fs.writeFileSync(TRADES_PATH, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      console.error('[TRADE] Error saving trades.json:', e.message);
    }
  }, 500);
}

/** Flush pending save immediately (for critical operations) */
function flushTrades() {
  if (_tradeSaveTimer) {
    clearTimeout(_tradeSaveTimer);
    _tradeSaveTimer = null;
  }
  try {
    const obj = {};
    for (const [id, trade] of pendingTrades) {
      obj[id] = trade;
    }
    fs.writeFileSync(TRADES_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('[TRADE] Error flushing trades.json:', e.message);
  }
}

/** Touch a trade to reset its idle timer */
function touchTrade(tradeId) {
  const trade = pendingTrades.get(tradeId);
  if (trade) trade.lastActivity = Date.now();
}

/** Get trade from Map, falling back to disk if not found */
function getTrade(tradeId) {
  let trade = pendingTrades.get(tradeId);
  if (trade) return trade;

  try {
    if (fs.existsSync(TRADES_PATH)) {
      const data = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf8') || '{}');
      if (data[tradeId] && data[tradeId].state === 'active') {
        trade = data[tradeId];
        pendingTrades.set(tradeId, trade);
        console.log(`[TRADE] Recovered trade from disk fallback: ${tradeId}`);
        return trade;
      }
    }
  } catch (e) {
    console.error('[TRADE] Error recovering trade from disk:', e.message);
  }
  return null;
}

setInterval(() => {
  const now = Date.now();
  let pruned = 0;
  for (const [id, trade] of pendingTrades) {
    const lastActive = trade.lastActivity || trade.timestamp;
    if (now - lastActive > 180_000 && trade.state === 'active') {
      trade.state = 'expired';
      pendingTrades.delete(id);
      pruned++;
    }
  }
  if (pruned > 0) {
    console.log(`[TRADE] Pruned ${pruned} idle trade(s)`);
    saveTrades();
  }
}, 30_000);

_loadTrades();

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s; }

/* ── Build the trade offer UI with V2 Components ── */
function buildTradeView(trade) {
  const container = new ContainerBuilder().setAccentColor(0xE67E22);

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `## 🔄 Trade\n<@${trade.senderId}> ↔️ <@${trade.recipientId}>`
  ));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  if (!trade.accepted) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `<@${trade.recipientId}>, <@${trade.senderId}> wants to trade with you!`
    ));
    container.addActionRowComponents(row => row.addComponents(
      new ButtonBuilder().setCustomId(`trade:accept:${trade.id}`).setLabel('Accept').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`trade:reject:${trade.id}`).setLabel('Reject').setEmoji('❌').setStyle(ButtonStyle.Danger)
    ));
  } else {

    const senderPonyList = (trade.senderPonies && trade.senderPonies.length > 0)
      ? trade.senderPonies.map(p => `**${p.name}**`).join(', ')
      : '*None selected*';
    const senderBits = trade.senderBits || 0;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**<@${trade.senderId}>'s Offer:**\n🦄 Ponies: ${senderPonyList}\n${BITS} Bits: **${senderBits.toLocaleString()}**`
    ));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const recipientPonyList = (trade.recipientPonies && trade.recipientPonies.length > 0)
      ? trade.recipientPonies.map(p => `**${p.name}**`).join(', ')
      : '*None selected*';
    const recipientBits = trade.recipientBits || 0;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**<@${trade.recipientId}>'s Offer:**\n🦄 Ponies: ${recipientPonyList}\n${BITS} Bits: **${recipientBits.toLocaleString()}**`
    ));

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

    const senderReady = trade.senderReady ? '✅' : '⬜';
    const recipientReady = trade.recipientReady ? '✅' : '⬜';
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `${senderReady} <@${trade.senderId}> · ${recipientReady} <@${trade.recipientId}>\n*Both users must confirm to complete the trade.*`
    ));

    container.addActionRowComponents(row => row.addComponents(
      new ButtonBuilder().setCustomId(`trade:pony:${trade.id}`).setLabel('Select Pony').setEmoji('🦄').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`trade:bits:${trade.id}`).setLabel('Set Bits').setEmoji('💰').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`trade:confirm:${trade.id}`).setLabel('Confirm').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`trade:cancel:${trade.id}`).setLabel('Cancel').setEmoji('❌').setStyle(ButtonStyle.Danger)
    ));
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
  pendingTrades,
  buildTradeViewExternal: buildTradeView,
  saveTrades,
  flushTrades,
  touchTrade,
  getTrade,
  data: new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Trade ponies or bits with another user')
    .addUserOption(o => o.setName('user').setDescription('The user to trade with').setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const sender = interaction.user;
      const recipient = interaction.options.getUser('user');

      if (sender.id === recipient.id) {
        return await interaction.editReply({ content: "❌ You can't trade with yourself!" });
      }
      if (recipient.bot) {
        return await interaction.editReply({ content: "❌ You can't trade with a bot!" });
      }

      const senderProfile = getProfile(sender.id);
      if (!senderProfile) {
        return await sendNoProfile(interaction);
      }
      const recipientProfile = getProfile(recipient.id);
      if (!recipientProfile) {
        return await interaction.editReply({ content: "❌ That user doesn't have a profile yet!" });
      }

      for (const [, t] of pendingTrades) {
        if (t.state === 'active' && (t.senderId === sender.id || t.recipientId === sender.id || t.senderId === recipient.id || t.recipientId === recipient.id)) {
          return await interaction.editReply({ content: "⚠️ One of you already has an active trade! Complete or cancel it first." });
        }
      }

      const tradeId = `${sender.id}-${recipient.id}-${Date.now()}`;
      const trade = {
        id: tradeId,
        senderId: sender.id,
        recipientId: recipient.id,
        accepted: false,
        senderPonies: [],
        recipientPonies: [],
        senderBits: 0,
        recipientBits: 0,
        senderReady: false,
        recipientReady: false,
        state: 'active',
        messageId: null,
        timestamp: Date.now(),
        lastActivity: Date.now()
      };
      pendingTrades.set(tradeId, trade);
      console.log(`[TRADE] Created trade id="${tradeId}", pendingTrades.size=${pendingTrades.size}`);
      flushTrades();

      const tradeMessage = buildTradeView(trade);
      const sentMessage = await interaction.editReply({
        ...tradeMessage
      });
      trade.messageId = sentMessage.id;
    } catch (err) {
      console.error('[TRADE] Error executing trade command:', err);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: `❌ Error: ${err.message}` });
        } else {
          await interaction.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
        }
      } catch (_) {}
    }
  }
};
