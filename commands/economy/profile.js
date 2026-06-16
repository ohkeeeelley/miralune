const { SlashCommandBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags } = require('discord.js');
const { getProfile, getAllProfiles } = require('../../utils/profileManager');
const ProfileRenderer = require('../../model/ProfileRenderer');
const fs = require('fs');
const path = require('path');

const trackerPath = path.join(__dirname, '../../data', 'xp_tracker.json');

function loadTracker() {
  if (fs.existsSync(trackerPath)) {
    try {
      return JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
    } catch (e) {
      console.error('Failed to load xp_tracker.json:', e);
      return {};
    }
  }
  return {};
}

function saveTracker(tracker) {
  fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2), 'utf8');
}

function checkNextLevelXPChange(userId, currentNextLevelXP, username) {
  const tracker = loadTracker();
  const storedValue = tracker[userId];

  if (storedValue !== undefined && storedValue !== currentNextLevelXP) {
    console.log(`[Profile] ${username} has changed their nextLevelXP from ${storedValue} to ${currentNextLevelXP}`);
  }

  tracker[userId] = currentNextLevelXP;
  saveTracker(tracker);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your profile and XP stats')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to view (default: yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const profile = getProfile(targetUser.id);

    if (!profile) {
      await interaction.reply({
        content: `${targetUser.username} doesn't have a profile yet.`,
        ephemeral: true
      });
      return;
    }

    const bakeryLevel = profile.BakeryLevel || profile.bakery?.level || 1;
    const bakeryXP = profile.BakeryXP || profile.bakery?.xp || 0;
    const currentNextLevelXP = (profile.NextLevelXP || profile.bakery?.nextLevelXP) || (bakeryLevel * 1000);
    checkNextLevelXPChange(targetUser.id, currentNextLevelXP, targetUser.username);

    const nextLevelXP = currentNextLevelXP;

    const allProfiles = getAllProfiles();
    const ranked = Object.entries(allProfiles)
      .map(([uid, p]) => ({
        uid,
        level: p.bakery?.level || 1,
        sold: p.stats?.allTimeSold || 0
      }))
      .sort((a, b) => b.level - a.level || b.sold - a.sold);
    const bakeryRank = ranked.findIndex(r => r.uid === targetUser.id) + 1 || ranked.length + 1;

    const rendererProfile = {
      createdAt: profile.createdAt || new Date().toISOString(),
      profileId: profile.profileId || targetUser.id,
      motto: profile.Motto || '',
      bakeryRank: bakeryRank,
      stats: {
        allTimeSold: profile.stats?.allTimeSold || 0,
        totalBitsEarned: profile.stats?.totalBitsEarned || 0,
        adventureSuccesses: profile.stats?.adventureSuccesses || 0,
        adventureFailures: profile.stats?.adventureFailures || 0
      },
      server: {
        BakeryLevel: bakeryLevel,
        BakeryXP: bakeryXP,
        NextLevelXP: nextLevelXP
      },
      streak: profile.stats?.streak ?? 0,
      bestStreak: profile.stats?.beststreak ?? 0,
      questCompleted: profile.stats?.questcompleted ?? 0,
      poniesBefriended: profile.stats?.totalponiesbefriended ?? profile.befriendedPonies?.length ?? 0,
      totalMessages: profile.stats?.totalMessages ?? 0,
      favoritePony: profile.favs?.[0]?.name || null,
      tags: [
        (profile.ProfileTags?.tag1 || 'No Tag').slice(0, 24),
        (profile.ProfileTags?.tag2 || 'No Tag').slice(0, 24),
        (profile.ProfileTags?.tag3 || 'No Tag').slice(0, 24),
        (profile.ProfileTags?.tag4 || 'No Tag').slice(0, 24),
      ],
      location: profile.CurrentLocation || null,
      progressColor: profile.ProfileProgressColor || null,
      profileBackground: profile.ActiveProfileBackground || null,
    };

    try {

      await interaction.reply({
        content: `<a:loading:1488385574405406751> Loading Profile...`,
        ephemeral: false
      });

      const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
      const buf = await ProfileRenderer.generateProfileImage(rendererProfile, targetUser.username, avatarURL);
      const mainAttachment = new AttachmentBuilder(buf, { name: 'profile.png' });

      const container = new ContainerBuilder();

      container.addTextDisplayComponents(
        new TextDisplayBuilder()
          .setContent(`**${targetUser.username}'s Profile**`)
      );

      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      );

      const gallery = new MediaGalleryBuilder();
      const galleryItem = new MediaGalleryItemBuilder().setURL('attachment://profile.png');
      gallery.addItems(galleryItem);
      container.addMediaGalleryComponents(gallery);

      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true)
      );

      container.addActionRowComponents(ar => ar.setComponents(
        new ButtonBuilder().setCustomId(`profile_customize:${targetUser.id}`).setLabel('✏️ Customize').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`profile_stats:${targetUser.id}`).setLabel('Stats & History').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`profile_achievements:${targetUser.id}`).setLabel('Achievements').setStyle(ButtonStyle.Secondary)
      ));

      const files = [mainAttachment];
      try {
        const bgList = profile.ProfileBackground || [];
        if (Array.isArray(bgList) && bgList.length > 0) {
          for (const bg of bgList) {
            try {
              const bgPath = path.join(__dirname, '..', 'assets', 'profile_assets', String(bg));
              if (fs.existsSync(bgPath)) {
                const bbuf = fs.readFileSync(bgPath);
                files.push(new AttachmentBuilder(bbuf, { name: String(bg) }));
              }
            } catch (e) { /* ignore individual background errors */ }
          }
        }
      } catch (e) { /* ignore gallery build errors */ }

      await interaction.editReply({ files, components: [container], content: '', flags: MessageFlags.IsComponentsV2 });
    } catch (err) {
      console.error('Profile render failed:', err);
      try {
        if (interaction.replied) await interaction.editReply({ content: 'Failed to load profile. Please try again later.', components: [] });
        else await interaction.reply({ content: 'Failed to load profile. Please try again later.', ephemeral: true });
      } catch (e) {
        try { await interaction.followUp({ content: 'Failed to load profile.', ephemeral: true }); } catch (_) {}
      }
    }
  }
};
