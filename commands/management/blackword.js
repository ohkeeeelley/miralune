const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');
const { addBlackword, removeBlackword, getBlackwords, resetBlackwords, DEFAULT_BLACKWORDS } = require('../../utils/moderationManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blackword')
        .setDescription('Manage auto-moderated words')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Add a word to the blackword list')
            .addStringOption(opt => opt.setName('word').setDescription('Word or phrase to block').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a word from the blackword list')
            .addStringOption(opt => opt.setName('word').setDescription('Word or phrase to unblock').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('View all blacklisted words'))

        .addSubcommand(sub => sub
            .setName('reset')
            .setDescription('Reset blackwords to the default list')),

    async execute(interaction) {
        if (!interaction.guild) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'add') {
            const word  = interaction.options.getString('word').toLowerCase().trim();
            const added = addBlackword(guildId, word);

            if (!added) {
                return interaction.reply({ content: `**${word}** is already on the list.`, flags: MessageFlags.Ephemeral });
            }

            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## ✅ Word Added\n\n\`${word}\` will now be auto-deleted from messages.`
            ));
            return interaction.reply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (sub === 'remove') {
            const word    = interaction.options.getString('word').toLowerCase().trim();
            const removed = removeBlackword(guildId, word);

            if (!removed) {
                return interaction.reply({ content: `**${word}** is not on the list.`, flags: MessageFlags.Ephemeral });
            }

            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## ✅ Word Removed\n\n\`${word}\` will no longer be auto-deleted.`
            ));
            return interaction.reply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (sub === 'list') {
            const words = getBlackwords(guildId);

            if (words.length === 0) {
                const c = new ContainerBuilder().setAccentColor(0xEB4145);
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `## 📋 Blackwords\n\nNo blackwords configured. Use \`/blackword add\` or \`/blackword reset\` to add the defaults.`
                ));
                return interaction.reply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }

            const list = words.map(w => `\`${w}\``).join(' · ');
            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 📋 Blackwords — ${words.length} word(s)`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(list));
            return interaction.reply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (sub === 'reset') {
            resetBlackwords(guildId);

            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `## ✅ Blackwords Reset\n\nRestored **${DEFAULT_BLACKWORDS.length}** default blackwords.`
            ));
            return interaction.reply({ components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }
    },
};
