const { MessageFlags } = require('discord.js');

function getActionRowsOnly(components) {
  if (!components || !Array.isArray(components)) return [];
  return components.filter(comp => comp && comp.type === 1);
}

function toJSONIfPossible(value) {
  if (value && typeof value.toJSON === 'function') {
    try {
      return value.toJSON();
    } catch {
      return value;
    }
  }
  return value;
}

function isComponentsV2Payload(payload) {
  if (!payload || !payload.flags) return false;

  const v2Flag = typeof MessageFlags.IsComponentsV2 === 'number'
    ? MessageFlags.IsComponentsV2
    : 32768;
  return !!(payload.flags & v2Flag);
}

function hasV2Components(components) {
  if (!Array.isArray(components)) return false;
  return components.some(comp => {
    const c = toJSONIfPossible(comp);
    return c && typeof c.type === 'number' && c.type !== 1;
  });
}

function normalizePayload(payload, { forEdit = false, forChannelSend = false } = {}) {
  if (!payload || typeof payload !== 'object') return payload;

  const normalized = { ...payload };
  const ephemeralFlag = typeof MessageFlags.Ephemeral === 'number' ? MessageFlags.Ephemeral : 64;
  const loadingFlag = typeof MessageFlags.IsLoading === 'number' ? MessageFlags.IsLoading : 128;
  const v2Flag = typeof MessageFlags.IsComponentsV2 === 'number' ? MessageFlags.IsComponentsV2 : 32768;

  if (Array.isArray(normalized.components)) {
    normalized.components = normalized.components.map(toJSONIfPossible).filter(Boolean);

    const payloadLooksV2 = hasV2Components(normalized.components);
    const shouldUseV2 = payloadLooksV2;

    if (shouldUseV2) {
      const currentFlags = typeof normalized.flags === 'number' ? normalized.flags : 0;
      normalized.flags = currentFlags | v2Flag;
    } else {
      normalized.components = getActionRowsOnly(normalized.components);
    }
  }

  const componentsAreV2 = hasV2Components(normalized.components);

  if (typeof normalized.flags === 'number' && (normalized.flags & v2Flag) && !componentsAreV2) {
    const withoutV2 = normalized.flags & ~v2Flag;
    if (withoutV2) normalized.flags = withoutV2;
    else delete normalized.flags;
  }

  if (componentsAreV2 && Object.prototype.hasOwnProperty.call(normalized, 'content')) {
    const contentText = typeof normalized.content === 'string' ? normalized.content : '';
    if (contentText.trim().length > 0) {
      const textDisplay = { type: 10, content: contentText };
      normalized.components = [textDisplay, ...(Array.isArray(normalized.components) ? normalized.components : [])];
    }
    delete normalized.content;
  }

  if (forEdit && componentsAreV2) {
    normalized.content = '';
  }

  if (Object.prototype.hasOwnProperty.call(normalized, 'ephemeral')) {
    if (normalized.ephemeral && !forEdit && !forChannelSend) {
      const currentFlags = typeof normalized.flags === 'number' ? normalized.flags : 0;
      normalized.flags = currentFlags | ephemeralFlag;
    }
    delete normalized.ephemeral;
  }

  if (typeof normalized.flags === 'number') {
    let cleanedFlags = normalized.flags;

    cleanedFlags &= ~loadingFlag;

    if (forEdit || forChannelSend) {

      cleanedFlags &= ~ephemeralFlag;
    }

    if (forChannelSend && !(cleanedFlags & v2Flag)) {
      cleanedFlags = 0;
    }

    if (cleanedFlags) normalized.flags = cleanedFlags;
    else delete normalized.flags;
  }

  return normalized;
}

function forceRepairV2ContentConflict(payload, { forEdit = false, forChannelSend = false } = {}) {
  const repaired = normalizePayload(payload, { forEdit, forChannelSend });
  if (!repaired || typeof repaired !== 'object') return repaired;

  const v2Flag = typeof MessageFlags.IsComponentsV2 === 'number' ? MessageFlags.IsComponentsV2 : 32768;
  const hasV2Flag = typeof repaired.flags === 'number' && !!(repaired.flags & v2Flag);

  if (!hasV2Flag) return repaired;

  if (Object.prototype.hasOwnProperty.call(repaired, 'content')) {
    const text = typeof repaired.content === 'string' ? repaired.content : '';
    if (text.trim().length > 0 && Array.isArray(repaired.components)) {
      repaired.components = [{ type: 10, content: text }, ...repaired.components];
    }

    if (forEdit && text.trim().length === 0) {
      repaired.content = '';
    } else {
      delete repaired.content;
    }
  }

  return repaired;
}

function isV2LegacyContentError(err) {
  if (!err || err.code !== 50035) return false;
  const details = JSON.stringify((err.rawError && err.rawError.errors) || {});
  return details.includes('MESSAGE_CANNOT_USE_LEGACY_FIELDS_WITH_COMPONENTS_V2');
}

async function sendOrFallback(interaction, payload) {
  try {
    const isComponentInteraction = typeof interaction.isMessageComponent === 'function' && interaction.isMessageComponent();
    const canEditExistingReply = !!interaction.replied && !isComponentInteraction;

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply(normalizePayload(payload));
    } else if (interaction.deferred && !interaction.replied) {

      if (isComponentInteraction) {
        await interaction.followUp(normalizePayload(payload));
      } else {
        await interaction.editReply(normalizePayload(payload, { forEdit: true }));
      }
    } else if (canEditExistingReply) {
      await interaction.editReply(normalizePayload(payload, { forEdit: true }));
    } else {
      await interaction.followUp(normalizePayload(payload));
    }
  } catch (err) {

    if (isV2LegacyContentError(err)) {
      try {
        const retryIsComponentInteraction = typeof interaction.isMessageComponent === 'function' && interaction.isMessageComponent();
        const retryCanEdit = (!!interaction.deferred || !!interaction.replied) && !retryIsComponentInteraction;
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply(forceRepairV2ContentConflict(payload));
        } else if (retryCanEdit) {
          await interaction.editReply(forceRepairV2ContentConflict(payload, { forEdit: true }));
        } else {
          await interaction.followUp(forceRepairV2ContentConflict(payload));
        }
        return;
      } catch (retryErr) {
        err = retryErr;
      }
    }

    if (err && err.code === 40060) {
      const normalizedForReply = normalizePayload(payload);
      const normalizedForEdit = normalizePayload(payload, { forEdit: true });

      const recoveryAttempts = [];
      if (interaction.deferred && !interaction.replied) {
        recoveryAttempts.push(() => interaction.editReply(normalizedForEdit));
      }
      recoveryAttempts.push(() => interaction.followUp(normalizedForReply));
      recoveryAttempts.push(() => interaction.editReply(normalizedForEdit));

      for (const attempt of recoveryAttempts) {
        try {
          await attempt();
          return;
        } catch (recoverErr) {
          err = recoverErr;
        }
      }
    }

    if (err && err.code === 10062) {
      try {
        const ch = interaction.channel || (interaction.message && interaction.message.channel);
        if (ch && ch.send) {
          const normalizedForChannel = normalizePayload(payload, { forChannelSend: true });
          const sendPayload = {};
          if (normalizedForChannel.content) sendPayload.content = normalizedForChannel.content;
          if (normalizedForChannel.embeds) sendPayload.embeds = normalizedForChannel.embeds;
          if (normalizedForChannel.files) sendPayload.files = normalizedForChannel.files;

          if (isComponentsV2Payload(normalizedForChannel)) {
            if (normalizedForChannel.components) sendPayload.components = normalizedForChannel.components;

            if (normalizedForChannel.flags) sendPayload.flags = normalizedForChannel.flags;
          } else {
            if (normalizedForChannel.components) sendPayload.components = getActionRowsOnly(normalizedForChannel.components);
          }

          await ch.send(sendPayload);
          console.debug('[safeReply] Fallback: sent to channel after Unknown interaction');
          return;
        }
      } catch (sendErr) {
        console.error('[safeReply] channel.send fallback failed after 10062:', sendErr);
        return;
      }
    }

    const rawDetails = (err && err.rawError && err.rawError.errors)
      ? JSON.stringify(err.rawError.errors)
      : (err && err.rawError && err.rawError.message) || (err && err.message) || 'unknown';
    console.warn('[safeReply] interaction reply/followUp failed:', err && err.code, rawDetails);
    try {
      const ch = interaction.channel || (interaction.message && interaction.message.channel);
      if (ch && ch.send) {
        const normalizedForChannel = normalizePayload(payload, { forChannelSend: true });
        const sendPayload = {};

        if (normalizedForChannel.content && normalizedForChannel.content.trim() !== '') sendPayload.content = normalizedForChannel.content;
        if (normalizedForChannel.embeds && normalizedForChannel.embeds.length > 0) sendPayload.embeds = normalizedForChannel.embeds;
        if (normalizedForChannel.files) sendPayload.files = normalizedForChannel.files;

        if (isComponentsV2Payload(normalizedForChannel)) {
          if (normalizedForChannel.components) sendPayload.components = normalizedForChannel.components;
          if (normalizedForChannel.flags) sendPayload.flags = normalizedForChannel.flags;
        } else {
          const filteredComponents = getActionRowsOnly(normalizedForChannel.components);
          if (filteredComponents && filteredComponents.length > 0) sendPayload.components = filteredComponents;
        }

        if (!sendPayload.content && !sendPayload.embeds && !sendPayload.components) {
          sendPayload.content = 'An error occurred. Please try again.';
        }

        await ch.send(sendPayload);
        console.debug('[safeReply] Fallback: sent to channel after reply failure');
      }
    } catch (sendErr) {
      console.error('[safeReply] channel.send fallback failed:', sendErr);
    }
  }
}

module.exports = { sendOrFallback, MessageFlags };
