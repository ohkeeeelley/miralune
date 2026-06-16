const fs = require('fs');
const path = require('path');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  AttachmentBuilder
} = require('discord.js');

const LOTTERY_PATH = path.join(__dirname, '../data/gamble/lottery.json');
const { BITS, HARMONY, DIAMONDS } = require('../commands/economy/currencyEmojis');

const TICKET_COST = 1000;
const MAX_TICKETS_PER_USER = 200;
const LOTTERY_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

const PARTICIPANT_BONUS_PCT = 0.05;

function load() {
  if (!fs.existsSync(LOTTERY_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(LOTTERY_PATH, 'utf8')); } catch { return null; }
}

function save(data) {
  fs.writeFileSync(LOTTERY_PATH, JSON.stringify(data, null, 2));
}

function isActive(lottery) {
  if (!lottery) return false;
  return lottery.active && !lottery.ended && Date.now() < lottery.endsAt;
}

function getParticipantCount(lottery) {
  return Object.keys(lottery.participants || {}).length;
}

function getTotalPrize(lottery) {
  const count = getParticipantCount(lottery);
  const multiplier = 1 + count * PARTICIPANT_BONUS_PCT;
  return {
    bits: Math.floor((lottery.baseBits || 0) * multiplier),
    harmony: Math.floor((lottery.baseHarmony || 0) * multiplier),
    diamonds: Math.floor((lottery.baseDiamonds || 0) * multiplier)
  };
}

function getTimeLeftText(endsAt) {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function fmt(n) {
  return Number(n || 0).toLocaleString();
}

function buildLotteryPayload(lottery) {
  const prize = getTotalPrize(lottery);
  const participants = getParticipantCount(lottery);
  const totalTickets = lottery.totalTicketsSold || 0;
  const timeLeft = getTimeLeftText(lottery.endsAt);
  const winnersText = lottery.maxWinners === 1
    ? '🏆 1 winner takes everything'
    : `🏆 ${lottery.maxWinners} winners share equally`;

  const prizeLines = [];
  if (prize.bits > 0)     prizeLines.push(`${BITS} **${fmt(prize.bits)} Bits**`);
  if (prize.harmony > 0)  prizeLines.push(`${HARMONY} **${fmt(prize.harmony)} Harmony**`);
  if (prize.diamonds > 0) prizeLines.push(`${DIAMONDS} **${fmt(prize.diamonds)} Diamonds**`);

  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## 🎟️ The Lottery`)
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `🎫 **Total Tickets Purchased:** ${fmt(totalTickets)}\n` +
      `👥 **Participants:** ${fmt(participants)}\n` +
      `⏳ **Ends:** <t:${Math.floor(lottery.endsAt / 1000)}:R>`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## 💰 Total Prize Pool\n` +
      (prizeLines.length > 0 ? prizeLines.join('\n') : '*No prize set*') + '\n\n' +
      `-# Prize grows 5% for every unique participant!`
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `🛒 **To buy tickets:** \`/buy tickets [amount]\`\n` +
      `📌 Max 200 tickets per user • 1 ticket = 1,000 ${BITS}\n` +
      winnersText
    )
  );

  return {
    components: [container.toJSON()],
    flags: 1 << 15
  };
}

function selectWinners(lottery) {
  const participants = lottery.participants || {};

  const pool = [];
  for (const [userId, tickets] of Object.entries(participants)) {
    for (let i = 0; i < tickets; i++) pool.push(userId);
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const winners = [];
  const seen = new Set();
  for (const userId of pool) {
    if (!seen.has(userId)) {
      seen.add(userId);
      winners.push(userId);
      if (winners.length >= lottery.maxWinners) break;
    }
  }
  return winners;
}

async function endLottery(client) {
  const lottery = load();
  if (!lottery || lottery.ended) return;

  lottery.ended = true;
  lottery.active = false;

  const participants = Object.keys(lottery.participants || {});
  if (participants.length === 0) {

    save(lottery);
    try {
      const channel = await client.channels.fetch(lottery.channelId).catch(() => null);
      if (channel) {
        const container = new ContainerBuilder().setAccentColor(0x95A5A6);
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent('## 🎰 Lottery Ended\n> No one bought any tickets. The lottery ended with no winners.')
        );
        await channel.send({ components: [container.toJSON()], flags: 1 << 15 });
      }
    } catch (e) {
      console.error('[Lottery] Could not send no-winner message:', e);
    }
    return;
  }

  const winners = selectWinners(lottery);
  const prize = getTotalPrize(lottery);

  const perWinner = {
    bits: Math.floor(prize.bits / winners.length),
    harmony: Math.floor(prize.harmony / winners.length),
    diamonds: Math.floor(prize.diamonds / winners.length)
  };

  const { getProfile, updateProfile } = require('./profileManager');
  for (const winnerId of winners) {
    try {
      const profile = getProfile(winnerId);
      if (!profile) continue;

      const wallet = profile.wallet || {};
      wallet.bits = (Number(wallet.bits) || 0) + perWinner.bits;
      wallet.harmony = (Number(wallet.harmony) || 0) + perWinner.harmony;
      wallet.diamonds = (Number(wallet.diamonds) || 0) + perWinner.diamonds;

      updateProfile(winnerId, { wallet });
    } catch (e) {
      console.error(`[Lottery] Failed to award winner ${winnerId}:`, e);
    }
  }

  lottery.winners = winners;
  save(lottery);

  try {
    const channel = await client.channels.fetch(lottery.channelId).catch(() => null);
    if (!channel) return;

    const mentions = winners.map(id => `<@${id}>`).join(', ');
    const prizeLines = [];
    if (perWinner.bits > 0)     prizeLines.push(`${BITS} **${fmt(perWinner.bits)} Bits**`);
    if (perWinner.harmony > 0)  prizeLines.push(`${HARMONY} **${fmt(perWinner.harmony)} Harmony**`);
    if (perWinner.diamonds > 0) prizeLines.push(`${DIAMONDS} **${fmt(perWinner.diamonds)} Diamonds**`);

    const container = new ContainerBuilder().setAccentColor(0x2ECC71);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## 🎉 Lottery Ended!`)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🏆 **Winner${winners.length > 1 ? 's' : ''}:** ${mentions}\n\n` +
        `Each winner receives:\n${prizeLines.join('\n') || '*Nothing*'}\n\n` +
        `-# Total tickets sold: ${fmt(lottery.totalTicketsSold)} • Participants: ${fmt(participants.length)}`
      )
    );

    await channel.send({ components: [container.toJSON()], flags: 1 << 15 });

    if (lottery.messageId) {
      try {
        const msg = await channel.messages.fetch(lottery.messageId).catch(() => null);
        if (msg) {
          const endedContainer = new ContainerBuilder().setAccentColor(0x95A5A6);
          endedContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## 🎰 Taco Lottery — Ended\n` +
              `🏆 **Winner${winners.length > 1 ? 's' : ''}:** ${mentions}\n` +
              `-# This lottery has concluded.`
            )
          );
          await msg.edit({ components: [endedContainer.toJSON()], flags: 1 << 15 });
        }
      } catch (e) {
        console.error('[Lottery] Could not edit original message:', e);
      }
    }
  } catch (e) {
    console.error('[Lottery] End announcement failed:', e);
  }
}

let _endTimer = null;

function scheduleEnd(client) {
  if (_endTimer) { clearTimeout(_endTimer); _endTimer = null; }

  const lottery = load();
  if (!lottery || lottery.ended || !lottery.active) return;

  const ms = Math.max(0, lottery.endsAt - Date.now());
  _endTimer = setTimeout(() => endLottery(client), ms);
  console.log(`[Lottery] Scheduled end in ${Math.round(ms / 60000)} minutes`);
}

async function updateLotteryMessage(client) {
  try {
    const lottery = load();
    if (!lottery || !isActive(lottery) || !lottery.messageId) return;
    const channel = await client.channels.fetch(lottery.channelId).catch(() => null);
    if (!channel) return;
    const msg = await channel.messages.fetch(lottery.messageId).catch(() => null);
    if (!msg) return;
    await msg.edit(buildLotteryPayload(lottery));
  } catch (e) {
    console.error('[Lottery] Could not update message:', e);
  }
}

module.exports = {
  load,
  save,
  isActive,
  getTotalPrize,
  buildLotteryPayload,
  selectWinners,
  endLottery,
  scheduleEnd,
  updateLotteryMessage,
  TICKET_COST,
  MAX_TICKETS_PER_USER,
  LOTTERY_DURATION_MS
};
