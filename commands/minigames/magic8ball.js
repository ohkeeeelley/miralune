const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { sendOrFallback } = require('../../utils/safeReply');

const POSITIVE = [
    'It is certain.',
    'It is decidedly so.',
    'Without a doubt.',
    'Yes, definitely.',
    'You may rely on it.',
    'As I see it, yes.',
    'Most likely.',
    'Outlook good.',
    'Yes.',
    'Signs point to yes.',
];

const NEUTRAL = [
    'Reply hazy, try again.',
    'Ask again later.',
    'Better not tell you now.',
    'Cannot predict now.',
    'Concentrate and ask again.',
];

const NEGATIVE = [
    "Don't count on it.",
    'No',
    'My sources say no.',
    'Not likely.',
    'Very doubtful.',
    'Absolutely not.',
    'The stars say no.',
    'HAH! No way.',
];

function getResponse() {
    const roll = Math.random();
    if (roll < 0.5) return { answer: POSITIVE[Math.floor(Math.random() * POSITIVE.length)], type: 'positive' };
    if (roll < 0.75) return { answer: NEUTRAL[Math.floor(Math.random() * NEUTRAL.length)], type: 'neutral' };
    return { answer: NEGATIVE[Math.floor(Math.random() * NEGATIVE.length)], type: 'negative' };
}

const ACCENT = {
    positive: 0x57F287,
    neutral: 0xFEE75C,
    negative: 0xED4245,
};

const EMOJI = {
    positive: '🟢',
    neutral: '🟡',
    negative: '🔴',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the Magic 8 Ball a question')
        .addStringOption(opt =>
            opt.setName('question')
                .setDescription('What do you want to ask?')
                .setRequired(true)
                .setMaxLength(200)
        ),

    async execute(interaction) {
        await interaction.deferReply().catch(() => {});
        await interaction.editReply({ content: '<a:loading:1488385574405406751> Shaking the 8 Ball...' }).catch(() => {});

        const question = interaction.options.getString('question');
        const { answer, type } = getResponse();

        const container = new ContainerBuilder().setAccentColor(ACCENT[type]);

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## 🎱 Magic 8 Ball')
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${interaction.user.displayName}** asked:\n> ${question}`)
        );
        container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${EMOJI[type]} **${answer}**`)
        );

        await sendOrFallback(interaction, {
            components: [container.toJSON()],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
