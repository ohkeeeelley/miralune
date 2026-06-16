const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
const { loadBakeries } = require('./_bakeryUtils');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const AssetManager = require('../../model/AssetManager');
const { BITS } = require('./currencyEmojis');
const { sendOrFallback } = require('../../utils/safeReply');
const lottery = require('../../utils/lotteryManager');
const { sendNoProfile } = require('../../utils/noProfileResponse');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy a bakery or lottery tickets')
    .addSubcommand(sub =>
      sub.setName('bakery')
        .setDescription('Buy a bakery by ID')
        .addIntegerOption(o => o.setName('id').setDescription('Bakery ID from the list').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('tickets')
        .setDescription('Buy lottery tickets (max 200)')
        .addIntegerOption(o =>
          o.setName('amount')
            .setDescription('Number of tickets to buy (1–200). 1 ticket = 1,000 bits.')
            .setMinValue(1)
            .setMaxValue(lottery.MAX_TICKETS_PER_USER)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'This command must be used in a server.', flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === 'bakery') return handleBakery(interaction);
    if (sub === 'tickets') return handleTickets(interaction);
  }
};

async function handleBakery(interaction) {
  const userId = interaction.user.id;
  try {
    const id = interaction.options.getInteger('id');
    const bakeriesMeta = loadBakeries();
    const meta = bakeriesMeta[String(id)];
    if (!meta) return interaction.reply({ content: `Bakery ID ${id} not found. Use /shop to see available bakeries.`, flags: MessageFlags.Ephemeral });
    if (meta.shop === false) return interaction.reply({ content: `${meta.name} (ID ${id}) is not for sale right now.`, flags: MessageFlags.Ephemeral });

    const price = meta.price || Math.max(1, Math.round(((meta.min || 0) + (meta.max || 0)) * 10));
    const profile = getProfile(userId);
    if (!profile) return sendNoProfile(interaction);

    const user = profile;

    const wallet = user.wallet || user.balances || {};
    const bits = Number(wallet.bits || 0);
    if (bits < price) return interaction.reply({ content: `You need ${price.toLocaleString()} Bits to buy ${meta.name} (ID ${id}), but you only have ${bits.toLocaleString()} Bits.`, flags: MessageFlags.Ephemeral });

    if (!user.bakery) user.bakery = { items: {}, itemsOwned: [], menu: [] };
    if (!user.bakery.items) user.bakery.items = {};
    if (!user.bakery.itemsOwned) user.bakery.itemsOwned = [];

    if (user.bakery.itemsOwned.includes(id)) {
      return interaction.reply({ content: `You already own **${meta.name}**!`, flags: MessageFlags.Ephemeral });
    }

    const prevBakeryIds = Object.keys(bakeriesMeta)
      .map(Number)
      .filter(bakeryId => bakeryId < id && bakeriesMeta[bakeryId].shop)
      .sort((a, b) => a - b);
    const missingPrev = prevBakeryIds.filter(bakeryId => !user.bakery.itemsOwned.includes(bakeryId));
    if (missingPrev.length > 0) {
      const missingList = missingPrev.map(bakeryId => `${bakeryId}: ${bakeriesMeta[bakeryId].name}`).join(', ');
      return interaction.reply({ content: `You must buy bakeries in order! Please buy these first: ${missingList}`, flags: MessageFlags.Ephemeral });
    }

    user.bakery.itemsOwned.push(id);
    user.bakery.items[String(id)] = { id: id, name: meta.name || `Bakery ${id}`, accumulated: 0, bakeTime: meta.bakeTime, lastCycleTime: Date.now() };

    if (user.wallet) user.wallet.bits = bits - price;
    if (user.balances) user.balances.bits = bits - price;
    updateProfile(userId, user);

    const bakeryEmoji = AssetManager.getBakeryEmoji(meta.emoji || meta.name);

    const container = new ContainerBuilder()
      .setAccentColor(0x2ECC71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ${bakeryEmoji} Purchased ${meta.name}!\n` +
        `You bought 1x ${bakeryEmoji} **${meta.name}** (ID ${id}) for ${BITS} ${price.toLocaleString()} bits.`
      ))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${BITS} **Remaining:** ${user.balances.bits.toLocaleString()} bits\n` +
        `📦 **Owned:** ${user.bakery.itemsOwned.length} bakery item(s)`
      ))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        '💡 **Next Step:** Use `/myMenu` and click "➕ Add Item" to add this bakery to your menu before you can use it to earn bits!'
      ));

    return await sendOrFallback(interaction, { components: [container], flags: MessageFlags.IsComponentsV2 });
  } catch (err) {
    console.error('buy bakery err', err);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'An error occurred while buying.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function handleTickets(interaction) {
  const userId = interaction.user.id;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const currentLottery = lottery.load();

    if (!currentLottery || !lottery.isActive(currentLottery)) {
      return interaction.editReply({ content: '❌ There is no active lottery right now. Keep an eye on the announcements!' });
    }

    const amount = interaction.options.getInteger('amount');

    const profile = getProfile(userId);
    if (!profile) {
      return sendNoProfile(interaction);
    }

    const alreadyOwned = currentLottery.participants[userId] || 0;
    if (alreadyOwned >= lottery.MAX_TICKETS_PER_USER) {
      return interaction.editReply({ content: `❌ You already own the maximum of **${lottery.MAX_TICKETS_PER_USER} tickets**.` });
    }

    const canBuy = lottery.MAX_TICKETS_PER_USER - alreadyOwned;
    const buying = Math.min(amount, canBuy);
    const totalCost = buying * lottery.TICKET_COST;

    const wallet = profile.wallet || profile.balances || {};
    const userBits = Number(wallet.bits || 0);

    if (userBits < totalCost) {
      return interaction.editReply({
        content: `❌ You need **${totalCost.toLocaleString()} bits** for ${buying} ticket${buying !== 1 ? 's' : ''}, but you only have **${userBits.toLocaleString()} bits**.`
      });
    }

    wallet.bits = userBits - totalCost;
    if (profile.wallet) profile.wallet = wallet;
    else profile.balances = wallet;
    updateProfile(userId, profile.wallet ? { wallet } : { balances: wallet });

    currentLottery.participants[userId] = alreadyOwned + buying;
    currentLottery.totalTicketsSold = (currentLottery.totalTicketsSold || 0) + buying;
    lottery.save(currentLottery);

    lottery.updateLotteryMessage(interaction.client);

    const newTotal = currentLottery.participants[userId];
    const totalTickets = currentLottery.totalTicketsSold;
    const winChancePct = ((newTotal / totalTickets) * 100).toFixed(1);

    const prizeNow = lottery.getTotalPrize(currentLottery);
    const prizeText = [
      prizeNow.bits > 0     ? `🪙 ${prizeNow.bits.toLocaleString()} bits` : '',
      prizeNow.harmony > 0  ? `🌙 ${prizeNow.harmony.toLocaleString()} harmony` : '',
      prizeNow.diamonds > 0 ? `💎 ${prizeNow.diamonds.toLocaleString()} diamonds` : ''
    ].filter(Boolean).join(' • ');

    const container = new ContainerBuilder()
      .setAccentColor(0xF1C40F)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## 🎟️ Tickets Purchased!\n` +
        `You bought **${buying} ticket${buying !== 1 ? 's' : ''}** for **${totalCost.toLocaleString()} bits**.`
      ))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `📊 **Your tickets:** ${newTotal} / ${lottery.MAX_TICKETS_PER_USER}\n` +
        `🎯 **Win chance:** ~${winChancePct}%\n` +
        `🪙 **Bits remaining:** ${wallet.bits.toLocaleString()}`
      ))
      .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `💰 **Current prize pool:** ${prizeText}\n` +
        `-# Ends <t:${Math.floor(currentLottery.endsAt / 1000)}:R>`
      ));

    await interaction.editReply({ content: '', components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });

  } catch (err) {
    console.error('buy tickets err', err);
    if (!interaction.replied) await interaction.editReply({ content: 'An error occurred while buying tickets.' }).catch(() => {});
  }
}
