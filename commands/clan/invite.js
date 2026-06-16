const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const ClansManager = require('../../model/ClansManager');
const { checkClanAccess, Colors } = require('./utils');
const { sendOrFallback } = require('../../utils/safeReply');

async function execute(interaction, profile) {
  try {
    await interaction.deferReply().catch(() => {});
    await interaction.editReply({ content: '<a:loading:1488385574405406751> Sending Invite...' }).catch(() => {});
  } catch (e) { }
  const clan = checkClanAccess(interaction, profile);
  if (!clan) return;

  const target = interaction.options.getUser('user');
  if (!target) {
    return await sendOrFallback(interaction, {
      content: '❌ User not found',
      flags: MessageFlags.Ephemeral
    });
  }

  if (target.bot) {
    return await sendOrFallback(interaction, {
      content: '❌ You cannot invite bots to your clan.',
      flags: MessageFlags.Ephemeral
    });
  }

  const role = clan.roles && clan.roles[interaction.user.id];
  if (interaction.user.id !== clan.ownerId && role !== 'co') {
    return await sendOrFallback(interaction, {
      content: '❌ Only the owner or co-leaders can invite members.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (clan.members && clan.members.includes(target.id)) {
    return await sendOrFallback(interaction, {
      content: `❌ ${target.tag} is already a member of **${clan.name}**.`,
      flags: MessageFlags.Ephemeral
    });
  }

  try {
    const key = ClansManager.createInvite(clan.id, interaction.user.id, target.id);

    const dmEmbed = new EmbedBuilder()
      .setTitle(`🏰 You've Been Invited to ${clan.name}!`)
      .setDescription(`Join **${clan.name}** and become part of an amazing community!`)
      .setColor(Colors.PRIMARY)
      .setThumbnail(clan.icon || null)
      .addFields(
        {
          name: '👤 Invited By',
          value: `<@${interaction.user.id}>`,
          inline: true
        },
        {
          name: '👥 Current Members',
          value: `${(clan.members?.length || 0).toLocaleString()}`,
          inline: true
        },
        {
          name: '🍪 Total Clan Baked',
          value: `${(clan.TotalClanBaked || 0).toLocaleString()} cookies`,
          inline: true
        },
        {
          name: '📝 Clan Description',
          value: clan.description || '*No description set*',
          inline: false
        }
      )
      .setFooter({ text: '⏰ This invite expires in 24 hours' })
      .setTimestamp();

    const dmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`clan_invite_accept_${key}`)
        .setLabel('Accept Invite')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`clan_invite_decline_${key}`)
        .setLabel('Decline')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    try {
      await target.send({ embeds: [dmEmbed], components: [dmRow] });

      const confirmEmbed = new EmbedBuilder()
        .setTitle('✉️ Invite Sent Successfully!')
        .setDescription(`**${target.tag}** has been sent an invite to join **${clan.name}**`)
        .setColor(Colors.SUCCESS)
        .addFields(
          {
            name: 'Recipient',
            value: `${target.tag}`,
            inline: true
          },
          {
            name: 'Expires In',
            value: '24 hours',
            inline: true
          }
        )
        .setFooter({ text: 'They can accept via DM or using /clans accept' });

      await sendOrFallback(interaction, {
        embeds: [confirmEmbed],
        flags: MessageFlags.Ephemeral
      });
    } catch (dmError) {

      const fallbackEmbed = new EmbedBuilder()
        .setTitle('📨 Invite Could Not Be Sent via DM')
        .setDescription(`${target.tag} has DMs disabled, but the invite has been recorded!\n\nThey can accept using:\n\`/clans accept\``)
        .setColor(Colors.WARNING)
        .addFields(
          {
            name: '⚠️ Note',
            value: 'They need to run the command to see pending invites',
            inline: false
          }
        )
        .setFooter({ text: 'Invite will expire in 24 hours' });

      await sendOrFallback(interaction, {
        embeds: [fallbackEmbed],
        flags: MessageFlags.Ephemeral
      });
    }
  } catch (e) {
    console.error('Invite error:', e);
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Failed to Create Invite')
      .setDescription(`Something went wrong while creating the invite.`)
      .setColor(Colors.ERROR)
      .addFields(
        {
          name: 'Error',
          value: `\`\`\`${e.message.slice(0, 100)}\`\`\``,
          inline: false
        }
      );

    await sendOrFallback(interaction, {
      embeds: [errorEmbed],
      flags: MessageFlags.Ephemeral
    });
  }
}

module.exports = { execute };
