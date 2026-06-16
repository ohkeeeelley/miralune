const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags
} = require('discord.js');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { BITS } = require('../economy/currencyEmojis');
const { sendNoProfile } = require('../../utils/noProfileResponse');

const cooldowns = new Map();
const COOLDOWN_MS = 8 * 60 * 1000;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob bits from another user!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to rob')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of bits to steal')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const robber = interaction.user;
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (robber.id === target.id) {
            return interaction.reply({
                content: "You can't rob yourself!",
                flags: MessageFlags.Ephemeral
            });
        }

        if (target.bot) {
            return interaction.reply({
                content: "You can't rob a bot!",
                flags: MessageFlags.Ephemeral
            });
        }

        const lastRob = cooldowns.get(robber.id);
        if (lastRob) {
            const remaining = COOLDOWN_MS - (Date.now() - lastRob);
            if (remaining > 0) {
                const mins = Math.floor(remaining / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                return interaction.reply({
                    content: `⏳ You need to wait **${mins}m ${secs}s** before robbing again!`,
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        const robberProfile = getProfile(robber.id);
        if (!robberProfile) {
            return sendNoProfile(interaction);
        }

        const targetProfile = getProfile(target.id);
        if (!targetProfile) {
            return interaction.reply({
                content: "That user doesn't have a profile!",
                flags: MessageFlags.Ephemeral
            });
        }

        robberProfile.wallet = robberProfile.wallet || { bits: 0 };
        targetProfile.wallet = targetProfile.wallet || { bits: 0 };
        const robberBits = robberProfile.wallet.bits || 0;
        const targetBits = targetProfile.wallet.bits || 0;

        if (targetBits < amount) {
            return interaction.reply({
                content: `That user only has **${targetBits.toLocaleString()}** ${BITS} bits. They don't have enough to rob that amount!`,
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply();
        await interaction.editReply({ content: '<a:loading:1488385574405406751> Planning Heist...' }).catch(() => {});

        cooldowns.set(robber.id, Date.now());

        const success = Math.random() < 0.5;

        const container = new ContainerBuilder();

        if (success) {

            robberProfile.wallet.bits = (robberProfile.wallet.bits || 0) + amount;
            targetProfile.wallet.bits = (targetProfile.wallet.bits || 0) - amount;
            updateProfile(robber.id, robberProfile);
            updateProfile(target.id, targetProfile);

            container.setAccentColor(0x00FF00);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 🔫 Robbery Successful!`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `You robbed **${amount.toLocaleString()}** ${BITS} from ${target}!\n\n` +
                    `**Your balance:** ${(robberProfile.wallet.bits).toLocaleString()} ${BITS}\n` +
                    `**Their balance:** ${(targetProfile.wallet.bits).toLocaleString()} ${BITS}`
                )
            );
        } else {

            let penalty;
            if (robberBits >= amount) {

                penalty = amount;
            } else {

                penalty = Math.floor(robberBits * 0.6);
            }

            robberProfile.wallet.bits = (robberProfile.wallet.bits || 0) - penalty;
            targetProfile.wallet.bits = (targetProfile.wallet.bits || 0) + penalty;
            updateProfile(robber.id, robberProfile);
            updateProfile(target.id, targetProfile);

            container.setAccentColor(0xFF0000);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## 🚨 You Got Caught!`)
            );
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `You tried to rob ${target} but got caught!\n` +
                    `You had to pay them **${penalty.toLocaleString()}** ${BITS} as a fine.\n\n` +
                    `**Your balance:** ${(robberProfile.wallet.bits).toLocaleString()} ${BITS}\n` +
                    `**Their balance:** ${(targetProfile.wallet.bits).toLocaleString()} ${BITS}`
                )
            );
        }

        await sendOrFallback(interaction, {
            components: [container.toJSON()],
            flags: MessageFlags.IsComponentsV2
        });
    }
};
