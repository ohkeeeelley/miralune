const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback } = require('../../utils/safeReply');
const { sendNoProfile } = require('../../utils/noProfileResponse');
const {
  MAX_HIRED_PONIES,
  ensurePonyProgress,
  findOwnedPonyByQuery,
  hirePony,
  unhirePony,
  getHiredPonyEntries,
  getAggregateHiredBonuses,
  formatBonusText,
  formatAggregateBonusLines,
  describePonyBakeryBonus,
} = require('../../utils/ponyProgressionManager');

function formatHiredList(entries) {
  if (!entries || entries.length === 0) {
    return 'No ponies hired yet. Use `/hire add` with a pony name or id from your collection.';
  }

  return entries
    .map((entry, index) => {
      const xpText = entry.nextLevelXP ? `${entry.xp}/${entry.nextLevelXP}` : 'MAX';
      return `${index + 1}. **${entry.name}** (${entry.rarity}) - Lv ${entry.level} [${xpText}]\n   ${formatBonusText(entry)}`;
    })
    .join('\n');
}

function findHiredByQuery(entries, query) {
  const text = String(query || '').trim();
  if (!text) return { match: null, matches: [] };

  const asId = Number(text);
  if (Number.isFinite(asId)) {
    const byId = entries.find((e) => Number(e.ponyId) === asId);
    if (byId) return { match: byId, matches: [byId] };
  }

  const exact = entries.find((e) => String(e.name || '').toLowerCase() === text.toLowerCase());
  if (exact) return { match: exact, matches: [exact] };

  const partial = entries.filter((e) => String(e.name || '').toLowerCase().includes(text.toLowerCase()));
  if (partial.length === 1) return { match: partial[0], matches: partial };

  return { match: null, matches: partial.slice(0, 25) };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hire')
    .setDescription('Hire ponies from your collection to boost your bakery')
    .addSubcommand((sub) => sub
      .setName('list')
      .setDescription('Show your currently hired ponies and their bonuses'))
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Hire one pony from your collection')
      .addStringOption((opt) => opt
        .setName('pony')
        .setDescription('Pony name or id from your collection')
        .setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove one hired pony')
      .addStringOption((opt) => opt
        .setName('pony')
        .setDescription('Hired pony name or id')
        .setRequired(true))),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    const profile = getProfile(userId);
    if (!profile) return sendNoProfile(interaction);

    ensurePonyProgress(profile, userId);

    if (sub === 'list') {
      const hiredEntries = getHiredPonyEntries(profile, userId);
      const aggregate = getAggregateHiredBonuses(profile, userId);
      const aggregateLines = formatAggregateBonusLines(aggregate);

      const content = [
        `## Hired Ponies (${hiredEntries.length}/${MAX_HIRED_PONIES})`,
        '',
        formatHiredList(hiredEntries),
      ];

      if (aggregateLines.length > 0) {
        content.push('', '**Total Active Bonuses**');
        for (const line of aggregateLines) content.push(`- ${line}`);
      }

      return sendOrFallback(interaction, {
        content: content.join('\n'),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'add') {
      const query = interaction.options.getString('pony', true);
      const found = findOwnedPonyByQuery(profile, query);

      if (!found.match) {
        if (found.matches.length > 1) {
          const suggestion = found.matches.slice(0, 8).map((p) => `- ${p.name} (ID: ${p.id})`).join('\n');
          return sendOrFallback(interaction, {
            content: `I found multiple ponies. Be more specific:\n${suggestion}`,
            flags: MessageFlags.Ephemeral,
          });
        }

        return sendOrFallback(interaction, {
          content: 'I could not find that pony in your collection.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = hirePony(profile, found.match.id, userId);
      if (!result.ok) {
        return sendOrFallback(interaction, {
          content: result.error,
          flags: MessageFlags.Ephemeral,
        });
      }

      updateProfile(userId, {
        bakery: {
          hired: profile.bakery.hired,
          ponyProgress: profile.bakery.ponyProgress,
          lastPonyBakeryLevelAwarded: profile.bakery.lastPonyBakeryLevelAwarded,
        },
      });

      const hiredEntries = getHiredPonyEntries(profile, userId);
      const bonusText = formatBonusText(result.entry);
      const configuredBonus = describePonyBakeryBonus(result.pony);

      const lines = [
        `✅ Hired **${result.pony.name}** (${result.pony.rarity || result.entry.rarity}).`,
        `Level ${result.entry.level} pony: ${bonusText}`,
        `Hired slots: ${hiredEntries.length}/${MAX_HIRED_PONIES}`,
      ];

      if (configuredBonus) {
        lines.push(`Natural talent: ${configuredBonus}`);
      }

      return sendOrFallback(interaction, {
        content: lines.join('\n'),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'remove') {
      const query = interaction.options.getString('pony', true);
      const hiredEntries = getHiredPonyEntries(profile, userId);

      if (hiredEntries.length === 0) {
        return sendOrFallback(interaction, {
          content: 'You do not have any hired ponies yet.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const found = findHiredByQuery(hiredEntries, query);
      if (!found.match) {
        if (found.matches.length > 1) {
          const suggestion = found.matches.slice(0, 8).map((p) => `- ${p.name} (ID: ${p.ponyId})`).join('\n');
          return sendOrFallback(interaction, {
            content: `I found multiple hired ponies. Be more specific:\n${suggestion}`,
            flags: MessageFlags.Ephemeral,
          });
        }

        return sendOrFallback(interaction, {
          content: 'That pony is not currently hired.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const result = unhirePony(profile, found.match.ponyId, userId);
      if (!result.ok) {
        return sendOrFallback(interaction, {
          content: result.error,
          flags: MessageFlags.Ephemeral,
        });
      }

      updateProfile(userId, {
        bakery: {
          hired: profile.bakery.hired,
          ponyProgress: profile.bakery.ponyProgress,
          lastPonyBakeryLevelAwarded: profile.bakery.lastPonyBakeryLevelAwarded,
        },
      });

      return sendOrFallback(interaction, {
        content: `✅ Removed **${result.pony.name}** from your hired team.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    return sendOrFallback(interaction, {
      content: 'Unknown subcommand.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
