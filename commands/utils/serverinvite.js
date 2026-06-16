const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { sendOrFallback } = require('../../utils/safeReply');
const MAIN_SERVER_ID = '1475754440441991200';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get an invite to the main server!'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      await interaction.editReply({ content: '<a:loading:1488385574405406751> Loading Invite...' }).catch(() => {});
    } catch (e) {
      console.error('Defer error:', e);
    }
    try {
      console.log('Starting invite command...');

      const guild = await interaction.client.guilds.fetch(MAIN_SERVER_ID).catch((err) => {
        console.error('Guild fetch error:', err);
        return null;
      });

      if (!guild) {
        console.log('Guild not found');
        return await sendOrFallback(interaction, {
          content: 'Sorry, I could not find the main server.',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log('Guild found:', guild.name);

      const channels = await guild.channels.fetch().catch((err) => {
        console.error('Channels fetch error:', err);
        return new Map();
      });

      console.log('Channels count:', channels.size);

      const textChannel = channels.find(ch => {
        if (!ch) return false;
        if (!ch.isTextBased || !ch.isTextBased()) return false;
        const perms = ch.permissionsFor(guild.members.me);
        if (!perms) return false;
        return perms.has('CreateInstantInvite');
      });

      if (!textChannel) {
        console.log('No text channel found');
        return await sendOrFallback(interaction, {
          content: 'Sorry, I could not find a channel to create an invite.',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log('Creating invite...');
      const invite = await textChannel.createInvite({
        reason: `Public invite requested by ${interaction.user.tag}`,
        maxAge: 0,
        maxUses: 0
      }).catch((err) => {
        console.error('Invite creation error:', err);
        return null;
      });

      if (!invite) {
        return await sendOrFallback(interaction, {
          content: 'Could not create invite.',
          flags: MessageFlags.Ephemeral
        });
      }

      console.log('Fetching member count...');
      const memberCount = guild.memberCount || 0;

      console.log('Creating container...');

      const container = new ContainerBuilder();

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('✨ **Join Our Main Server!**')
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`🏰 **${guild.name}**`)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`👥 ${memberCount} Members`)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`#️⃣ ${channels.size} Channels`)
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      );

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent('Join our community and make new friends!')
      );

      container.addActionRowComponents(row =>
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Join Server')
            .setStyle(ButtonStyle.Link)
            .setURL(invite.url)
            .setEmoji('🎉')
        )
      );

      console.log('Sending response...');
      await sendOrFallback(interaction, {
        components: [container.toJSON()],
        flags: MessageFlags.IsComponentsV2
      });
      console.log('Invite command complete!');

    } catch (err) {
      console.error('invite command error:', err);
      await sendOrFallback(interaction, {
        content: 'An error occurred while creating the invite.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
