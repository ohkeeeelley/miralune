const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { BITS } = require('./currencyEmojis');
const { sendNoProfile } = require('../../utils/noProfileResponse');

const pendingTransfers = new Map();

module.exports = {
    pendingTransfers,
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Transfer bits to another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to send bits to')
                .setRequired(true)),

    async execute(interaction) {
        try { await interaction.deferReply({ flags: MessageFlags.IsLoading }).catch(() => {}); } catch (e) { }
        try {
            const sender = interaction.user;
            const recipient = interaction.options.getUser('user');

            if (sender.id === recipient.id) {
                return await sendOrFallback(interaction, {
                    content: "You can't transfer bits to yourself!",
                    flags: MessageFlags.Ephemeral
                });
            }

            const senderProfile = getProfile(sender.id);
            if (!senderProfile) {
                return await sendNoProfile(interaction);
            }

            const recipientProfile = getProfile(recipient.id);
            if (!recipientProfile) {
                return await sendOrFallback(interaction, {
                    content: "The recipient doesn't have a profile yet!",
                    flags: MessageFlags.Ephemeral
                });
            }

            const transferKey = `${sender.id}-${recipient.id}`;
            if (pendingTransfers.has(transferKey)) {
                return await sendOrFallback(interaction, {
                    content: "You already have a pending transfer to this user! Wait for it to expire or be accepted/declined.",
                    flags: MessageFlags.Ephemeral
                });
            }

            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`transfer_accept_${sender.id}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`transfer_decline_${sender.id}`)
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setTitle('💰 Bits Transfer Request')
                .setColor(0x00FF00)
                .setDescription(`${recipient}, ${sender} wants to transfer bits to you!\nYou have 20 seconds to accept this request.`)
                .setTimestamp();
            pendingTransfers.set(transferKey, {
                senderId: sender.id,
                recipientId: recipient.id,
                timestamp: Date.now(),
                state: 'pending'
            });

            await interaction.reply({
                content: `${recipient}`,
                embeds: [embed],
                components: [buttons],
                flags: 0
            });

            const message = await interaction.fetchReply();

            setTimeout(async () => {
                const transfer = pendingTransfers.get(transferKey);
                if (transfer && transfer.state === 'pending') {
                    transfer.state = 'expired';
                    try {
                        const expiredEmbed = new EmbedBuilder()
                            .setTitle('⏰ Transfer Request Expired')
                            .setColor(0xFF0000)
                            .setDescription('The transfer request has expired.')
                            .setTimestamp();

                        await message.edit({
                            embeds: [expiredEmbed],
                            components: []
                        });
                    } catch (e) {
                        console.error('Failed to update expired transfer message:', e);
                    }
                    pendingTransfers.delete(transferKey);
                }
            }, 20000);

        } catch (error) {
            console.error('Transfer command error:', error);
            await sendOrFallback(interaction, {
                content: 'An error occurred while processing the transfer request.',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
