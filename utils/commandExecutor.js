const { MessageFlags } = require('discord.js');
const concurrencyManager = require('./concurrencyManager');

/**
 * Wrapper for safe command execution with comprehensive error handling
 */
class CommandExecutor {
  /**
   * Execute a command with error handling and recovery
   */
  static async executeWithErrorHandling(interaction, commandExecuteFn, options = {}) {
    const {
      defer = true,
      deferFlags = MessageFlags.IsLoading,
      errorTitle = '❌ Command Failed',
      showDetails = false,
      timeout = 30000,
      retryCount = 1
    } = options;

    try {

      if (defer && !interaction.deferred && !interaction.replied) {
        try {
          await interaction.deferReply({ flags: deferFlags });
        } catch (e) {
          console.warn('[EXECUTOR] Could not defer reply:', e.message);
        }
      }

      return await Promise.race([
        commandExecuteFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Command timeout after ${timeout}ms`)), timeout)
        )
      ]);
    } catch (error) {
      console.error('[EXECUTOR] Command execution error:', error);

      try {
        const errorResponse = this.createErrorResponse(error, errorTitle, showDetails);

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorResponse).catch(() => {});
        } else {
          await interaction.reply(errorResponse).catch(() => {});
        }
      } catch (e) {
        console.error('[EXECUTOR] Could not send error response:', e.message);
      }

      throw error;
    }
  }

  /**
   * Create a formatted error response
   */
  static createErrorResponse(error, title, showDetails = false) {
    const { EmbedBuilder } = require('discord.js');

    let description = 'An unexpected error occurred while executing this command.';

    if (error.message.includes('timeout')) {
      description = 'The command took too long to complete. Please try again.';
    } else if (error.message.includes('Invalid Form Body')) {
      description = 'Discord API returned an error. This may be temporary - please try again.';
    } else if (error.message.includes('file')) {
      description = 'There was an issue accessing server data. Please try again.';
    } else if (error.message.includes('not a member')) {
      description = 'You must be a member of the clan to perform this action.';
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor('#FF0000');

    if (showDetails && error.message) {
      embed.addFields({
        name: 'Error Details',
        value: `\`\`\`${error.message.slice(0, 200)}\`\`\``,
        inline: false
      });
    }

    return {
      embeds: [embed],
      flags: MessageFlags.Ephemeral
    };
  }

  /**
   * Execute an operation with retry logic
   */
  static async executeWithRetry(operation, options = {}) {
    const {
      retries = 3,
      timeout = 5000,
      operationName = 'Operation'
    } = options;

    let lastError;
    let delay = 100;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operationName} timeout`)), timeout)
          )
        ]);
      } catch (error) {
        lastError = error;
        console.warn(`[EXECUTOR] ${operationName} attempt ${attempt + 1}/${retries} failed:`, error.message);

        if (attempt < retries - 1) {

          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 2000);
        }
      }
    }

    throw new Error(`${operationName} failed after ${retries} attempts: ${lastError.message}`);
  }

  /**
   * Safe data operation with concurrency management
   */
  static async safeDataOperation(filePath, operation, operationName = 'Data Operation') {
    try {
      return await this.executeWithRetry(
        () => operation(concurrencyManager),
        {
          retries: 3,
          timeout: 5000,
          operationName
        }
      );
    } catch (error) {
      console.error(`[EXECUTOR] Safe data operation failed (${operationName}):`, error.message);
      throw error;
    }
  }
}

module.exports = CommandExecutor;
