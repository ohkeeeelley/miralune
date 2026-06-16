const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { sendOrFallback } = require('./safeReply');

function buildNoProfileContainer(createCommand = '/create') {
  const container = new ContainerBuilder().setAccentColor(0x2f3136);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## No Pony Found')
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('You need to create a pony before using this command!')
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`Use \`${createCommand}\` to create your own pony and start your adventure in Equestria.`)
  );
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('🎯 **How to get started:**')
  );
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`Use \`${createCommand}\` to create your own pony and begin your magical journey in Equestria.`)
  );

  return container;
}

function buildNoProfilePayload(options = {}) {
  const createCommand = options.createCommand || '/create';
  const ephemeral = options.ephemeral !== false;

  const container = buildNoProfileContainer(createCommand);
  const flags = MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0);

  return {
    components: [container.toJSON()],
    flags
  };
}

async function sendNoProfile(interaction, options = {}) {
  return sendOrFallback(interaction, buildNoProfilePayload(options));
}

function isNoProfileMessage(message) {
  if (typeof message !== 'string') return false;
  const normalized = message.toLowerCase();
  return normalized.includes("don't have a profile")
    || normalized.includes('do not have a profile')
    || normalized.includes('profile not found');
}

module.exports = {
  buildNoProfileContainer,
  buildNoProfilePayload,
  sendNoProfile,
  isNoProfileMessage
};
