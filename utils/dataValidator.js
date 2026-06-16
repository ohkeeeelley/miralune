const fs = require('fs');
const path = require('path');
const concurrencyManager = require('./concurrencyManager');

class DataValidator {
  constructor() {
    this.requiredFiles = [
      'data/clans.json',
      'data/profile/profiles.json',
      'data/alert/alerts.json',
      'data/alert/alerthistory.json',
      'data/allTimeLeaderboard.json',
      'data/ClanLeaderboard.json',
      'data/xp_tracker.json'
    ];
  }

  /**
   * Validate all critical data files on startup
   */
  async validateAllData(basePath) {
    console.log('[VALIDATOR] Starting data validation...');

    for (const file of this.requiredFiles) {
      const filePath = path.join(basePath, file);
      const isValid = await this.validateFile(filePath);

      if (!isValid) {
        console.warn(`[VALIDATOR] File failed validation: ${file}`);

        await this.attemptRecovery(filePath);
      } else {
        console.log(`[VALIDATOR] ✓ ${file} is valid`);
      }
    }

    console.log('[VALIDATOR] Data validation complete');
  }

  /**
   * Validate a single JSON file
   */
  async validateFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`[VALIDATOR] File not found: ${filePath}`);
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf8');

      if (content.length < 2) {
        console.warn(`[VALIDATOR] File is empty: ${filePath}`);
        return false;
      }

      JSON.parse(content);
      return true;
    } catch (e) {
      console.error(`[VALIDATOR] Error validating ${filePath}:`, e.message);
      return false;
    }
  }

  /**
   * Attempt recovery using backups
   */
  attemptRecovery(filePath) {
    const dir = path.dirname(filePath);
    const backupDir = path.join(dir, 'backups');

    if (!fs.existsSync(backupDir)) {
      console.warn(`[RECOVERY] No backups directory found for ${filePath}`);
      return false;
    }

    try {
      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(path.basename(filePath)))
        .sort()
        .reverse();

      if (backups.length === 0) {
        console.warn(`[RECOVERY] No backups found for ${filePath}`);
        return false;
      }

      for (const backup of backups) {
        try {
          const backupPath = path.join(backupDir, backup);
          const content = fs.readFileSync(backupPath, 'utf8');

          JSON.parse(content);

          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`[RECOVERY] ✓ Restored ${path.basename(filePath)} from backup: ${backup}`);
          return true;
        } catch (e) {
          console.warn(`[RECOVERY] Backup ${backup} is also corrupted, trying older backup...`);
          continue;
        }
      }

      console.error(`[RECOVERY] Could not recover ${filePath} - all backups are corrupted`);
      return false;
    } catch (e) {
      console.error(`[RECOVERY] Error during recovery:`, e.message);
      return false;
    }
  }

  /**
   * Create empty data files if they don't exist
   */
  ensureFiles(basePath) {
    const fileDefaults = {
      'data/clans.json': {},
      'data/profile/profiles.json': {},
      'data/alert/alerts.json': {},
      'data/alert/alerthistory.json': {},
      'data/allTimeLeaderboard.json': {},
      'data/ClanLeaderboard.json': {},
      'data/xp_tracker.json': {}
    };

    for (const [file, defaultContent] of Object.entries(fileDefaults)) {
      const filePath = path.join(basePath, file);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf8');
        console.log(`[INIT] Created ${file}`);
      }
    }
  }
}

module.exports = new DataValidator();
