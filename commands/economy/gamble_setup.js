const {
  SlashCommandBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');
const lottery = require('../../utils/lotteryManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble_setup')
    .setDescription('Set up the lottery (Owner only)'),

  async execute(interaction) {
    if (interaction.user.id !== (process.env.OWNER_ID || '').trim()) {
      return interaction.reply({
        content: '❌ Only the bot owner can use this command.',
        flags: MessageFlags.Ephemeral
      });
    }

    const existing = lottery.load();
    if (existing && lottery.isActive(existing)) {
      return interaction.reply({
        content: '❌ A lottery is already active! Wait for it to end before starting a new one.',
        flags: MessageFlags.Ephemeral
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('lottery_setup_modal')
      .setTitle('🎰 Lottery Setup');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('bits_prize')
          .setLabel('Base Bits Prize')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 500000')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('harmony_prize')
          .setLabel('Base Harmony Prize (0 = none)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 200000')
          .setValue('0')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('diamonds_prize')
          .setLabel('Base Diamonds Prize (0 = none)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 0')
          .setValue('0')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('max_winners')
          .setLabel('Number of Winners (1–5)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g. 1')
          .setValue('1')
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  },

  async handleSetupModal(interaction) {
    const client = interaction.client;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const rawBits     = interaction.fields.getTextInputValue('bits_prize').replace(/,/g, '').trim();
    const rawHarmony  = interaction.fields.getTextInputValue('harmony_prize').replace(/,/g, '').trim();
    const rawDiamonds = interaction.fields.getTextInputValue('diamonds_prize').replace(/,/g, '').trim();
    const rawWinners  = interaction.fields.getTextInputValue('max_winners').trim();

    const baseBits     = parseInt(rawBits, 10);
    const baseHarmony  = parseInt(rawHarmony, 10) || 0;
    const baseDiamonds = parseInt(rawDiamonds, 10) || 0;
    const maxWinners   = parseInt(rawWinners, 10);

    if (isNaN(baseBits) || baseBits <= 0) {
      return interaction.editReply({ content: '❌ Invalid bits amount. Must be a positive number.' });
    }
    if (isNaN(maxWinners) || maxWinners < 1 || maxWinners > 5) {
      return interaction.editReply({ content: '❌ Number of winners must be between 1 and 5.' });
    }

    const gambleChannelId = process.env.GAMBLE_CHANNEL_ID;
    if (!gambleChannelId) {
      return interaction.editReply({ content: '❌ GAMBLE_CHANNEL_ID is not set in .env' });
    }

    const channel = await client.channels.fetch(gambleChannelId).catch(() => null);
    if (!channel) {
      return interaction.editReply({ content: '❌ Could not find the gamble channel. Check GAMBLE_CHANNEL_ID in .env' });
    }

    const endsAt = Date.now() + lottery.LOTTERY_DURATION_MS;

    const newLottery = {
      active: true,
      baseBits,
      baseHarmony,
      baseDiamonds,
      maxWinners,
      endsAt,
      createdAt: Date.now(),
      createdBy: interaction.user.id,
      channelId: gambleChannelId,
      messageId: null,
      participants: {},
      totalTicketsSold: 0,
      winners: [],
      ended: false
    };

    lottery.save(newLottery);

    const payload = lottery.buildLotteryPayload(newLottery);
    const msg = await channel.send(payload);

    newLottery.messageId = msg.id;
    lottery.save(newLottery);

    lottery.scheduleEnd(client);

    await interaction.editReply({
      content: `✅ Lottery started! Prize: **${baseBits.toLocaleString()} bits**${baseHarmony > 0 ? `, **${baseHarmony.toLocaleString()} harmony**` : ''}${baseDiamonds > 0 ? `, **${baseDiamonds.toLocaleString()} diamonds**` : ''} | Winners: **${maxWinners}** | Ends: <t:${Math.floor(endsAt / 1000)}:R>`
    });
  }
};
