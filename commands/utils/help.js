const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { sendOrFallback } = require('../../utils/safeReply');

const HELP_CATEGORIES = {
  collections: {
    label: 'Ponies',
    summary: 'Find, befriend, and manage your pony roster.',
    commands: [
      ['Adventure', 'Search for new ponies and friendship encounters', '/adventure'],
      ['Collections', 'Browse your pony index with filters and details', '/collections'],
      ['Friendship', 'View friendship progress pages for your ponies', '/friendship'],
      ['Hire', 'Assign up to 6 ponies for bakery bonuses', '/hire'],
      ['Trade', 'Trade ponies directly with another player', '/trade']
    ]
  },
  statistics: {
    label: 'Stats',
    summary: 'Track your progress, rankings, and profile growth.',
    commands: [
      ['Profile', 'Show your full profile card and totals', '/profile'],
      ['Level', 'Check your current level and XP progress', '/level'],
      ['Leaderboard', 'View top players in multiple categories', '/leaderboard'],
      ['Balance', 'See your currencies and balances', '/balance']
    ]
  },
  features: {
    label: 'Economy',
    summary: 'Build your bakery setup and maximize production.',
    commands: [
      ['Shop', 'Browse bakeries, locations, and themes', '/shop'],
      ['Buy', 'Purchase bakery items and tickets', '/buy'],
      ['MyMenu', 'Manage active bakery lineup and slots', '/mymenu'],
      ['Bakery', 'View bakery status and production', '/bakery'],
      ['Bake', 'Collect production from your active menu', '/bake'],
      ['Upgrade', 'Buy upgrades that strengthen your setup', '/upgrade'],
      ['Daily', 'Claim daily rewards', '/daily']
    ]
  },
  utility: {
    label: 'Games',
    summary: 'Play minigames and risky economy commands.',
    commands: [
      ['Coinflip', 'Bet bits on heads or tails', '/coinflip'],
      ['Slots', 'Spin a slot machine for rewards', '/slots'],
      ['Spin', 'Use wheel spins for prizes', '/spin'],
      ['GambleFlip', 'Challenge another user to a flip match', '/gambleflip'],
      ['TicTacToe', 'Play tic-tac-toe against another user', '/tictactoe'],
      ['8Ball', 'Ask the magic 8-ball a question', '/8ball']
    ]
  },
  admin: {
    label: 'Server',
    summary: 'Moderation and server management tools.',
    commands: [
      ['Alert', 'Create and manage global user alerts', '/alert'],
      ['Logs', 'Configure logging channels and events', '/logs'],
      ['Welcome', 'Set up and manage welcome messages', '/welcome'],
      ['Ticket', 'Configure and manage ticket channels', '/ticket'],
      ['Verification', 'Set up verification flow and roles', '/verification_setup'],
      ['Starboard', 'Configure reaction-based starboard', '/starboard']
    ]
  }
};

function buildCommandsText(categoryKey) {
  const selected = HELP_CATEGORIES[categoryKey] || HELP_CATEGORIES.collections;
  const lines = [`### ${selected.label} Commands`, selected.summary, ''];
  for (const [name, description, command] of selected.commands) {
    lines.push(`**${name}**`);
    lines.push(`${description} ${command}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

function renderHelpMenu(category = 'collections') {
  const container = new ContainerBuilder().setAccentColor(0x2b2d31);
  const title = new TextDisplayBuilder().setContent('Miralune Help');
  container.addTextDisplayComponents(title);
  const subtitle = new TextDisplayBuilder().setContent('Choose a category below to view the most useful commands and what they do.');
  container.addTextDisplayComponents(subtitle);

  const getStyle = (cat) => cat === category ? ButtonStyle.Success : ButtonStyle.Secondary;
  container.addActionRowComponents(row => row.setComponents(
    new ButtonBuilder().setCustomId('help_collections').setLabel('Ponies').setStyle(getStyle('collections')),
    new ButtonBuilder().setCustomId('help_statistics').setLabel('Stats').setStyle(getStyle('statistics')),
    new ButtonBuilder().setCustomId('help_features').setLabel('Economy').setStyle(getStyle('features')),
    new ButtonBuilder().setCustomId('help_utility').setLabel('Games').setStyle(getStyle('utility')),
    new ButtonBuilder().setCustomId('help_admin').setLabel('Server').setStyle(getStyle('admin'))
  ));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  const commandsText = buildCommandsText(category);
  const commandsDisplay = new TextDisplayBuilder().setContent(commandsText);
  container.addTextDisplayComponents(commandsDisplay);

  return container;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show the help menu with important commands'),
  async execute(interaction) {
    const container = renderHelpMenu('collections');

    await sendOrFallback(interaction, { components: [container.toJSON()], flags: MessageFlags.IsComponentsV2 });
  },
  renderHelpMenu
};
