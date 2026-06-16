const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');
const {
    loadConfig,
    saveConfig,
    setBirthday,
    getBirthday,
    removeBirthday,
    formatBirthday,
    MONTH_NAMES,
} = require('../../utils/birthdayManager');

const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function reply(color, content) {
    const c = new ContainerBuilder().setAccentColor(color);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
    return { components: [c.toJSON()], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Birthday system')
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set your birthday')
                .addIntegerOption(opt =>
                    opt.setName('month')
                        .setDescription('Month (1–12)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(12)
                )
                .addIntegerOption(opt =>
                    opt.setName('day')
                        .setDescription('Day of the month')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(31)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove your birthday')
        )
        .addSubcommand(sub =>
            sub.setName('check')
                .setDescription('Check your saved birthday (or another user\'s)')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User to check (default: you)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('(Admin) Configure the birthday announcement channel and optional role')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel where birthday messages are sent')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to temporarily assign on a user\'s birthday (optional)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('config')
                .setDescription('(Admin) View current birthday configuration')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if ((sub === 'setup' || sub === 'config') &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply(reply(0xE74C3C, '❌ You need **Manage Server** permission to use this subcommand.'));
            return;
        }

        if (sub === 'set') {
            const month = interaction.options.getInteger('month');
            const day   = interaction.options.getInteger('day');

            if (day > DAYS_IN_MONTH[month]) {
                await interaction.reply(reply(0xE74C3C, `❌ **${MONTH_NAMES[month]}** only has **${DAYS_IN_MONTH[month]}** days.`));
                return;
            }

            setBirthday(interaction.user.id, month, day);

            await interaction.reply(reply(
                0x2ECC71,
                `## 🎂 Birthday Set!\nYour birthday has been saved as **${formatBirthday(month, day)}**.\nI'll wish you a happy birthday when the day comes! 🎉`
            ));
            return;
        }

        if (sub === 'remove') {
            const existing = getBirthday(interaction.user.id);
            if (!existing) {
                await interaction.reply(reply(0xE67E22, `⚠️ You don't have a birthday saved.`));
                return;
            }
            removeBirthday(interaction.user.id);
            await interaction.reply(reply(0x95A5A6, `🗑️ Your birthday has been removed.`));
            return;
        }

        if (sub === 'check') {
            const target = interaction.options.getUser('user') || interaction.user;
            const bday = getBirthday(target.id);
            if (!bday) {
                const isSelf = target.id === interaction.user.id;
                await interaction.reply(reply(
                    0xE67E22,
                    isSelf
                        ? `⚠️ You haven't set a birthday yet. Use \`/birthday set\` to add yours!`
                        : `⚠️ **${target.username}** hasn't set a birthday yet.`
                ));
                return;
            }
            await interaction.reply(reply(
                0x3498DB,
                `## 🎂 Birthday\n**${target.username}'s** birthday is **${formatBirthday(bday.month, bday.day)}**.`
            ));
            return;
        }

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel');
            const role    = interaction.options.getRole('role');
            const cfg     = loadConfig(interaction.guild.id);

            cfg.channelId = channel.id;
            cfg.roleId    = role ? role.id : (cfg.roleId || null);
            saveConfig(interaction.guild.id, cfg);

            const roleNote = cfg.roleId
                ? `\n**Birthday Role:** <@&${cfg.roleId}> — assigned for the whole birthday day.`
                : `\n**Birthday Role:** None *(use \`/birthday setup\` with a role to add one)*`;

            await interaction.reply(reply(
                0x2ECC71,
                `## ✅ Birthday Setup Saved!\n**Announcement Channel:** <#${channel.id}>${roleNote}`
            ));
            return;
        }

        if (sub === 'config') {
            const cfg = loadConfig(interaction.guild.id);
            const channelLine = cfg.channelId ? `<#${cfg.channelId}>` : '❌ Not set';
            const roleLine    = cfg.roleId    ? `<@&${cfg.roleId}>`   : '❌ Not set';
            await interaction.reply(reply(
                0x9B59B6,
                `## 🎂 Birthday Config\n**Channel:** ${channelLine}\n**Birthday Role:** ${roleLine}`
            ));
            return;
        }
    }
};
