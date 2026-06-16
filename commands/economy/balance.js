const {
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  SeparatorBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder
} = require('discord.js');
const { fmtNumber } = require('./_bakeryUtils');
const { BITS, HARMONY, DIAMONDS } = require('./currencyEmojis');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getProfile, updateProfile } = require('../../utils/profileManager');
const { sendOrFallback, MessageFlags } = require('../../utils/safeReply');
const { renderBalance } = require('../../model/BalanceRenderer');
const { sendNoProfile } = require('../../utils/noProfileResponse');

/**
 * Normalise file descriptors so discord.js always gets a readable stream
 * or buffer, never a stale stream from a previous send.
 */
function normalizeFiles(files) {
  if (!files || !Array.isArray(files)) return [];
  const out = [];
  for (const f of files) {
    try {
      if (!f) continue;
      const att = f.attachment || f.file || f.data || f;
      const name = f.name || (f.options && f.options.name) || 'BalanceDisplay.png';

      if (typeof att === 'string' && fs.existsSync(att)) {
        out.push({ attachment: fs.createReadStream(att), name: path.basename(att) });
        continue;
      }
      if (att && typeof att.pipe === 'function') {
        out.push({ attachment: att, name: name });
        continue;
      }
      if (Buffer.isBuffer(att)) {
        const tmp = path.join(os.tmpdir(), `miralune-${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`);
        try {
          fs.writeFileSync(tmp, att);
          out.push({ attachment: fs.createReadStream(tmp), name });
        } catch (e) {
          out.push({ attachment: att, name });
        }
        continue;
      }
      out.push(f);
    } catch (e) {
      out.push(f);
    }
  }
  return out;
}

/**
 * Build a V2 ContainerBuilder that wraps:
 *   [MediaGallery with balance image]  ← only when files provided
 *   [Separator]
 *   [ActionRow(s) with buttons / select menus]
 *
 * @param {Array}  actionRows  Array of ActionRowBuilder instances to embed
 * @param {Array}  files       Normalised file array (used to get filename for attachment:// URL)
 * @param {string} [accentHex] Optional accent colour as hex number e.g. 0xFF1493
 */
function buildV2Container(actionRows, files = [], accentHex = null) {
  const container = new ContainerBuilder();
  if (accentHex !== null) container.setAccentColor(accentHex);

  if (files && files.length > 0) {
    const fileName = (files[0] && (files[0].name || (files[0].options && files[0].options.name))) || 'BalanceDisplay.png';
    try {
      const gallery = new MediaGalleryBuilder();
      const galleryItem = new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`);
      gallery.addItems(galleryItem);
      container.addMediaGalleryComponents(gallery);
    } catch (e) {
      console.warn('balance: failed to add media gallery to container:', e && e.message);
    }
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  for (const row of actionRows) {
    if (!row) continue;
    try {

      container.addActionRowComponents(r => r.setComponents(...row.components));
    } catch (e) {
      console.warn('balance: failed to add action row to container:', e && e.message);
    }
  }

  return container;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Show your Bits and Harmony balance'),

  async execute(interaction) {
    if (!interaction.guild) {
      return await sendOrFallback(interaction, {
        content: 'This command must be used in a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    const userId = interaction.user.id;

    try {
      let profile = getProfile(userId);
      if (!profile) {
        return await sendNoProfile(interaction);
      }

      profile.balances = profile.balances || { bits: 0, harmony: 0, diamonds: 0 };
      profile.balances.bank = profile.balances.bank || { bits: 0, harmony: 0 };

      const equippedTheme = profile.server && profile.server.BalanceTheme ? profile.server.BalanceTheme : 'default';

      const renderPromise = renderBalance(profile, interaction.user, { showAvatar: true, theme: equippedTheme });

      let deferred = false;
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply();
          deferred = true;
        } else {
          deferred = interaction.deferred;
        }
      } catch (e) { deferred = false; }

      const rendered = await renderPromise;
      const rawFiles = rendered.files || [];
      let filesToSend = normalizeFiles(rawFiles);

      const depositBtn  = new ButtonBuilder().setCustomId('balance_deposit') .setLabel('Deposit') .setStyle(ButtonStyle.Secondary);
      const withdrawBtn = new ButtonBuilder().setCustomId('balance_withdraw').setLabel('Withdraw').setStyle(ButtonStyle.Secondary);
      const refreshBtn  = new ButtonBuilder().setCustomId('balance_refresh') .setLabel('Refresh') .setStyle(ButtonStyle.Secondary);
      const themeBtn    = new ButtonBuilder().setCustomId('balance_theme')   .setLabel('Themes')  .setStyle(ButtonStyle.Primary);
      const mainActionRow = new ActionRowBuilder().addComponents(depositBtn, withdrawBtn, refreshBtn, themeBtn);

      const initialContainer = buildV2Container([mainActionRow], filesToSend);

      let reply = null;
      let replyIsChannel = false;

      const v2Payload = {
        components: [initialContainer.toJSON()],
        files: filesToSend,
        flags: MessageFlags.IsComponentsV2
      };

      try {
        if (deferred) {
          reply = await interaction.editReply(v2Payload).catch(() => null);
          replyIsChannel = false;
        } else if (!interaction.replied) {
          reply = await interaction.reply({ ...v2Payload, fetchReply: true }).catch(() => null);
          replyIsChannel = false;
        } else {
          reply = await interaction.followUp({ ...v2Payload, fetchReply: true }).catch(() => null);
          replyIsChannel = false;
        }
      } catch (e) {
        console.error('balance: initial reply error', e);
      }

      if (!reply) return;

      /**
       * Rebuild the V2 container and edit the existing reply.
       * @param {ActionRowBuilder[]} rows   Action rows to embed in the container
       * @param {Array}             files  Raw files from renderBalance
       */
      const editMainReply = async (rows, files) => {
        const normalised = normalizeFiles(files || []);
        const newContainer = buildV2Container(rows, normalised);
        const payload = {
          components: [newContainer.toJSON()],
          files: normalised,
          flags: MessageFlags.IsComponentsV2
        };

        try {
          if (reply && typeof reply.edit === 'function') {
            const r = await reply.edit(payload).catch(e => {
              console.error('balance: reply.edit error', e);
              return null;
            });
            if (r) return r;

            if (reply.channel && typeof reply.channel.send === 'function') {
              console.log('balance: reply.edit failed; falling back to channel.send');
              const chPayload = { components: payload.components, files: normalised, flags: MessageFlags.IsComponentsV2 };
              const newMsg = await reply.channel.send(chPayload).catch(e => {
                console.error('balance: channel.send fallback failed', e);
                return null;
              });
              if (newMsg) {
                try { await reply.delete().catch(() => {}); } catch (_) {}
                reply = newMsg;
                replyIsChannel = true;
                return newMsg;
              }
            }
            return null;
          }

          return await interaction.editReply(payload).catch(e => {
            console.error('balance: interaction.editReply error', e);
            return null;
          });
        } catch (e) {
          console.error('balance: editMainReply outer error', e);
          return null;
        }
      };

      const collector = reply.createMessageComponentCollector({ filter: () => true, time: 3600000 });
      let lastSelectRow = null;

      const THEME_COST_BITS    = 30000;
      const THEME_COST_HARMONY = 3000;

      /**
       * Build the action rows shown in the theme browser.
       */
      const buildThemeRows = (tkey, purchased, idx = 0, total = 1) => {
        const isPurchased = (tkey === 'default') || purchased;

        const equipBtn      = new ButtonBuilder().setCustomId(`theme_equip::${tkey}`)      .setLabel(isPurchased ? 'Equip'    : 'Preview').setStyle(ButtonStyle.Primary);
        const buyBitsBtn    = new ButtonBuilder().setCustomId(`theme_buy_bits::${tkey}`)   .setLabel(fmtNumber(THEME_COST_BITS))          .setStyle(ButtonStyle.Secondary).setEmoji(BITS    || '💰');
        const buyHarmonyBtn = new ButtonBuilder().setCustomId(`theme_buy_harmony::${tkey}`).setLabel(fmtNumber(THEME_COST_HARMONY))       .setStyle(ButtonStyle.Secondary).setEmoji(HARMONY || '💠');
        const closeBtn      = new ButtonBuilder().setCustomId('theme_close')               .setLabel('Close')                             .setStyle(ButtonStyle.Secondary);
        const prevBtn       = new ButtonBuilder().setCustomId(`theme_prev::${idx}`)        .setLabel('◀')                                .setStyle(ButtonStyle.Secondary);
        const nextBtn       = new ButtonBuilder().setCustomId(`theme_next::${idx}`)        .setLabel('▶')                                .setStyle(ButtonStyle.Secondary);

        if (total > 1) {
          const navRow = new ActionRowBuilder().addComponents(prevBtn, equipBtn, nextBtn);
          const actRow = isPurchased
            ? new ActionRowBuilder().addComponents(closeBtn)
            : new ActionRowBuilder().addComponents(buyBitsBtn, buyHarmonyBtn, closeBtn);
          return [navRow, actRow];
        }

        return [
          isPurchased
            ? new ActionRowBuilder().addComponents(equipBtn, closeBtn)
            : new ActionRowBuilder().addComponents(equipBtn, buyBitsBtn, buyHarmonyBtn, closeBtn)
        ];
      };

      /** Scan available theme files */
      const getAvailableThemes = (dir) => {
        if (!fs.existsSync(dir)) return [];
        return fs
          .readdirSync(dir)
          .filter(f => f.toLowerCase().endsWith('.png') &&
                       path.parse(f).name.toLowerCase() !== 'default' &&
                       f.toLowerCase() !== 'balancedisplay.png')
          .map(f => ({ file: f, key: path.parse(f).name }));
      };

      /** Helper: render balance for a given theme and return normalised files */
      const renderForTheme = async (themeKey) => {
        try {
          const prof = getProfile(userId);
          const r = await renderBalance(prof, interaction.user, { showAvatar: true, theme: themeKey });
          return normalizeFiles(r && r.files ? r.files : []);
        } catch (e) {
          console.error('balance: renderForTheme failed', e);
          return [];
        }
      };

      collector.on('collect', async i => {
        try {
          console.log('balance: collect -> customId=', i.customId, 'user=', i.user.id);

          if (i.customId && i.customId.startsWith('theme_')) {
            await i.deferUpdate().catch(() => {});
            const parts   = i.customId.split('::');
            const action   = parts[0];
            let   themeKey = parts[1] || null;

            const themesDir = path.join(__dirname, '..', '..', 'assets', 'balance_assets');
            const available = getAvailableThemes(themesDir);

            if (action === 'theme_select' && i.values && i.values[0]) {
              themeKey = i.values[0];
            }

            if (action === 'theme_preview' || action === 'theme_select') {
              const previewKey = themeKey || 'default';
              const previewFiles = await renderForTheme(previewKey);

              const profNow  = getProfile(userId);
              const owned    = previewKey === 'default' || ((profNow.server && Array.isArray(profNow.server.PurchasedThemes)) ? profNow.server.PurchasedThemes.includes(previewKey) : false);
              const idx      = available.findIndex(a => a.key === previewKey);
              const themeRows = buildThemeRows(previewKey, owned, idx < 0 ? 0 : idx, available.length);

              const selOptions = [
                { label: 'Default', value: 'default', description: 'Preview the default background', default: previewKey === 'default' },
                ...available.map(t => ({ label: t.key, value: t.key, default: t.key === previewKey }))
              ];
              const selRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('theme_select').setPlaceholder('Choose a theme to preview...').addOptions(selOptions)
              );
              lastSelectRow = selRow;

              await editMainReply([selRow, ...themeRows], previewFiles);
              return;
            }

            if (action === 'theme_buy_bits' || action === 'theme_buy_harmony') {
              if (!themeKey) { try { await i.followUp({ content: 'Theme not found.', ephemeral: true }); } catch (_) {} return; }

              const prof        = getProfile(userId);
              const alreadyOwned = prof.server && Array.isArray(prof.server.PurchasedThemes) && prof.server.PurchasedThemes.includes(themeKey);
              if (alreadyOwned) { try { await i.followUp({ content: 'You already own this theme.', ephemeral: true }); } catch (_) {} return; }

              const currency = action === 'theme_buy_bits' ? 'bits' : 'harmony';
              const cost     = action === 'theme_buy_bits' ? THEME_COST_BITS : THEME_COST_HARMONY;
              const current  = (prof.balances && prof.balances[currency]) || 0;
              if (current < cost) { try { await i.followUp({ content: `You don't have enough ${currency}.`, ephemeral: true }); } catch (_) {} return; }

              const purchasedList = Array.from(new Set([...((prof.server && prof.server.PurchasedThemes) || []), themeKey]));
              try {
                updateProfile(userId, { balances: { [currency]: current - cost }, server: { ...(prof.server || {}), PurchasedThemes: purchasedList } });

                const themeFiles = await renderForTheme(themeKey);
                const idx        = available.findIndex(a => a.key === themeKey);
                const themeRows  = buildThemeRows(themeKey, true, idx, available.length);
                const selOptions = [
                  { label: 'Default', value: 'default', description: 'Preview the default background', default: themeKey === 'default' },
                  ...available.map(t => ({ label: t.key, value: t.key, default: t.key === themeKey }))
                ];
                const selRow = new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder().setCustomId('theme_select').setPlaceholder('Choose a theme to preview...').addOptions(selOptions)
                );
                lastSelectRow = selRow;

                await editMainReply([selRow, ...themeRows], themeFiles);
                try { await i.followUp({ content: `Purchased **${themeKey}** for ${fmtNumber(cost)} ${currency}!`, ephemeral: true }); } catch (_) {}
              } catch (e) {
                console.error('balance: purchase failed', e);
                try { await i.followUp({ content: 'Purchase failed.', ephemeral: true }); } catch (_) {}
              }
              return;
            }

            if (action === 'theme_equip') {
              if (!themeKey) return;
              const prof  = getProfile(userId);
              const owned = themeKey === 'default' || ((prof.server && Array.isArray(prof.server.PurchasedThemes)) ? prof.server.PurchasedThemes.includes(themeKey) : false);
              if (!owned) { try { await i.followUp({ content: 'You do not own this theme. Purchase it first.', ephemeral: true }); } catch (_) {} return; }

              updateProfile(userId, { server: { ...(prof.server || {}), BalanceTheme: themeKey } });

              const equippedFiles = await renderForTheme(themeKey);
              await editMainReply([mainActionRow], equippedFiles);

              try {
                const msg = await i.followUp({ content: `Equipped theme **${themeKey}**.`, ephemeral: true, fetchReply: true });
                if (msg && typeof msg.delete === 'function') {
                  setTimeout(() => { try { msg.delete(); } catch (_) {} }, 2000);
                }
              } catch (_) {}
              return;
            }

            if (action === 'theme_prev' || action === 'theme_next') {
              const idx    = parseInt(themeKey || '0', 10) || 0;
              const delta  = action === 'theme_prev' ? -1 : 1;
              if (!available.length) return;
              const newIdx   = (idx + delta + available.length) % available.length;
              const newTheme = available[newIdx];
              if (!newTheme) return;

              const themeFiles = await renderForTheme(newTheme.key);
              const profNow    = getProfile(userId);
              const owned      = (profNow.server && Array.isArray(profNow.server.PurchasedThemes)) ? profNow.server.PurchasedThemes.includes(newTheme.key) : false;
              const themeRows  = buildThemeRows(newTheme.key, owned, newIdx, available.length);

              const selOptions = [
                { label: 'Default', value: 'default', description: 'Preview the default background', default: newTheme.key === 'default' },
                ...available.map(t => ({ label: t.key, value: t.key, default: t.key === newTheme.key }))
              ];
              const selRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('theme_select').setPlaceholder('Choose a theme to preview...').addOptions(selOptions)
              );
              lastSelectRow = selRow;

              await editMainReply([selRow, ...themeRows], themeFiles);
              return;
            }

            if (action === 'theme_close') {
              const prof         = getProfile(userId);
              const activeTheme  = (prof.server && prof.server.BalanceTheme) || 'default';
              const closedFiles  = await renderForTheme(activeTheme);
              await editMainReply([mainActionRow], closedFiles);
              return;
            }
          }

          if (i.customId === 'balance_refresh') {
            await i.deferUpdate().catch(() => {});
            const prof        = getProfile(userId);
            const activeTheme = (prof.server && prof.server.BalanceTheme) || 'default';
            const freshFiles  = await renderForTheme(activeTheme);
            await editMainReply([mainActionRow], freshFiles);
            return;
          }

          if (i.customId === 'balance_theme') {
            await i.deferUpdate().catch(() => {});
            const themesDir = path.join(__dirname, '..', '..', 'assets', 'balance_assets');
            const available = getAvailableThemes(themesDir);
            if (!available.length) {
              try { await i.followUp({ content: 'No themes available.', ephemeral: true }); } catch (_) {}
              return;
            }

            const defaultFiles  = await renderForTheme('default');
            const profNow       = getProfile(userId);
            const owned         = (profNow.server && Array.isArray(profNow.server.PurchasedThemes)) ? profNow.server.PurchasedThemes.includes('default') : false;
            const themeRows     = buildThemeRows('default', owned, 0, available.length);

            const selectOptions = [
              { label: 'Default', value: 'default', description: 'Preview the default background', default: true },
              ...available.map(t => ({ label: t.key, value: t.key }))
            ];
            const selRow = new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder().setCustomId('theme_select').setPlaceholder('Choose a theme to preview...').addOptions(selectOptions)
            );
            lastSelectRow = selRow;

            await editMainReply([selRow, ...themeRows], defaultFiles);
            return;
          }

          if (i.customId === 'balance_deposit' || i.customId === 'balance_withdraw') {
            const isDeposit = i.customId === 'balance_deposit';

            const modal = new ModalBuilder()
              .setCustomId(isDeposit ? 'balance_deposit_modal' : 'balance_withdraw_modal')
              .setTitle(isDeposit ? 'Deposit Money' : 'Withdraw Money');

            const bitsInput    = new TextInputBuilder().setCustomId('bits_amount')   .setLabel('Bits Amount')   .setStyle(TextInputStyle.Short).setPlaceholder('Enter amount of bits...').setRequired(false);
            const harmonyInput = new TextInputBuilder().setCustomId('harmony_amount').setLabel('Harmony Amount').setStyle(TextInputStyle.Short).setPlaceholder('Enter amount of harmony...').setRequired(false);

            modal.addComponents(
              new ActionRowBuilder().addComponents(bitsInput),
              new ActionRowBuilder().addComponents(harmonyInput)
            );

            try {
              await i.showModal(modal);
            } catch (err) {
              try { await i.reply({ content: 'Unable to open modal. Please run /balance again and try.', ephemeral: true }); } catch (_) {}
              return;
            }

            const submitted = await i.awaitModalSubmit({ time: 30000 }).catch(() => null);
            if (!submitted) return;

            const bitsAmount    = parseInt(submitted.fields.getTextInputValue('bits_amount'))    || 0;
            const harmonyAmount = parseInt(submitted.fields.getTextInputValue('harmony_amount')) || 0;

            if (bitsAmount <= 0 && harmonyAmount <= 0) {
              await submitted.reply({ content: 'Please enter a valid amount greater than 0.', flags: MessageFlags.Ephemeral });
              return;
            }

            const p = getProfile(userId);
            if (!p) return;

            if (isDeposit) {
              if (bitsAmount    > (p.balances.bits    || 0)) return await submitted.reply({ content: 'You do not have enough bits in your wallet.',    flags: MessageFlags.Ephemeral });
              if (harmonyAmount > (p.balances.harmony || 0)) return await submitted.reply({ content: 'You do not have enough harmony in your wallet.', flags: MessageFlags.Ephemeral });

              updateProfile(userId, {
                balances: {
                  bits:    (p.balances.bits    || 0) - bitsAmount,
                  harmony: (p.balances.harmony || 0) - harmonyAmount,
                  bank: {
                    ...(p.balances.bank || {}),
                    bits:    (p.balances.bank?.bits    || 0) + bitsAmount,
                    harmony: (p.balances.bank?.harmony || 0) + harmonyAmount
                  }
                }
              });
              await submitted.reply({
                content: `Deposited ${[bitsAmount > 0 ? `${bitsAmount} bits` : '', harmonyAmount > 0 ? `${harmonyAmount} harmony` : ''].filter(Boolean).join(' and ')}.`,
                flags: MessageFlags.Ephemeral
              });
            } else {
              if (bitsAmount    > ((p.balances.bank?.bits    || 0))) return await submitted.reply({ content: 'Not enough bits in your bank account!',    flags: MessageFlags.Ephemeral });
              if (harmonyAmount > ((p.balances.bank?.harmony || 0))) return await submitted.reply({ content: 'Not enough harmony in your bank account!', flags: MessageFlags.Ephemeral });

              updateProfile(userId, {
                balances: {
                  bits:    (p.balances.bits    || 0) + bitsAmount,
                  harmony: (p.balances.harmony || 0) + harmonyAmount,
                  bank: {
                    ...(p.balances.bank || {}),
                    bits:    (p.balances.bank?.bits    || 0) - bitsAmount,
                    harmony: (p.balances.bank?.harmony || 0) - harmonyAmount
                  }
                }
              });
              await submitted.reply({
                content: `Withdrew ${[bitsAmount > 0 ? `${bitsAmount} bits` : '', harmonyAmount > 0 ? `${harmonyAmount} harmony` : ''].filter(Boolean).join(' and ')}.`,
                flags: MessageFlags.Ephemeral
              });
            }

            const updatedProf  = getProfile(userId);
            const activeTheme  = (updatedProf.server && updatedProf.server.BalanceTheme) || 'default';
            const updatedFiles = await renderForTheme(activeTheme);
            await editMainReply([mainActionRow], updatedFiles);
          }

        } catch (err) {
          console.error('balance collector error', err);
        }
      });

      collector.on('end', () => {
        console.log('balance: collector ended');
      });

    } catch (err) {
      console.error('balance command error', err);
      await sendOrFallback(interaction, {
        content: 'An error occurred while retrieving balance.',
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
