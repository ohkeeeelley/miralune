const fs = require('fs');
const path = require('path');

class ConcurrencyManager {
  constructor() {
    this.operationCounts = new Map();
    this.maxConcurrent = 5;
    this.waitingQueues = new Map();
    this.lastModified = new Map();
  }

  /**
   * Safely execute a data operation with retry logic and timeout handling
   */
  async safeOperation(operationId, operation, options = {}) {
    const {
      retries = 3,
      timeout = 5000,
      backoffMultiplier = 1.5
    } = options;

    let lastError;
    let delay = 100;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {

        return await Promise.race([
          operation(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timeout after ${timeout}ms`)), timeout)
          )
        ]);
      } catch (error) {
        lastError = error;
        console.error(`[CONCURRENCY] ${operationId} attempt ${attempt + 1}/${retries} failed:`, error.message);

        if (error.message.includes('Invalid') || error.message.includes('not found')) {
          throw error;
        }

        if (attempt < retries - 1) {

          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * backoffMultiplier, 3000);
        }
      }
    }

    throw new Error(`Operation failed after ${retries} attempts: ${lastError.message}`);
  }

  /**
   * Verify file integrity after write
   */
  verifyFileIntegrity(filePath, expectedContent) {
    try {
      const actualContent = fs.readFileSync(filePath, 'utf8');
      if (actualContent !== expectedContent) {
        console.error(`[INTEGRITY] File mismatch at ${filePath}`);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`[INTEGRITY] Failed to verify ${filePath}:`, e.message);
      return false;
    }
  }

  /**
   * Recover from backup if file is corrupted
   */
  recoverFromBackup(filePath) {
    try {
      const backupDir = path.join(path.dirname(filePath), 'backups');
      if (!fs.existsSync(backupDir)) return null;

      const backups = fs.readdirSync(backupDir)
        .filter(f => f.startsWith(path.basename(filePath)))
        .sort()
        .reverse();

      if (backups.length === 0) return null;

      const backupPath = path.join(backupDir, backups[0]);
      const backupContent = fs.readFileSync(backupPath, 'utf8');

      console.warn(`[RECOVERY] Restoring ${filePath} from backup: ${backups[0]}`);
      fs.writeFileSync(filePath, backupContent, 'utf8');
      return JSON.parse(backupContent);
    } catch (e) {
      console.error(`[RECOVERY] Failed to recover backup:`, e.message);
      return null;
    }
  }

  /**
   * Safely read and parse JSON with corruption detection
   */
  async safeReadJson(filePath, defaultValue = {}) {
    return this.safeOperation(`readJson:${filePath}`, async () => {
      try {
        if (!fs.existsSync(filePath)) {
          return defaultValue;
        }

        const content = fs.readFileSync(filePath, 'utf8');

        if (!content.trim().startsWith('{') && !content.trim().startsWith('[')) {
          console.warn(`[CORRUPTION] Detected corrupted JSON in ${filePath}`);
          const recovered = this.recoverFromBackup(filePath);
          return recovered || defaultValue;
        }

        try {
          return JSON.parse(content);
        } catch (parseError) {
          console.error(`[CORRUPTION] JSON parse error in ${filePath}:`, parseError.message);
          const recovered = this.recoverFromBackup(filePath);
          return recovered || defaultValue;
        }
      } catch (e) {
        console.error(`[READ] Error reading ${filePath}:`, e.message);
        throw e;
      }
    }, { retries: 3, timeout: 3000 });
  }

  /**
   * Safely write JSON with verification
   */
  async safeWriteJson(filePath, data, backupFirst = true) {
    return this.safeOperation(`writeJson:${filePath}`, async () => {
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (backupFirst && fs.existsSync(filePath)) {
        try {
          const backupDir = path.join(dir, 'backups');
          fs.mkdirSync(backupDir, { recursive: true });
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = path.join(backupDir, `${path.basename(filePath)}.${timestamp}.bak`);
          fs.copyFileSync(filePath, backupPath);
        } catch (e) {
          console.warn(`[BACKUP] Failed to create backup:`, e.message);

        }
      }

      const content = JSON.stringify(data, null, 2);

      const tempPath = `${filePath}.tmp`;
      fs.writeFileSync(tempPath, content, 'utf8');

      if (!this.verifyFileIntegrity(tempPath, content)) {
        fs.unlinkSync(tempPath);
        throw new Error('Failed to verify temporary file');
      }

      fs.renameSync(tempPath, filePath);

      if (!this.verifyFileIntegrity(filePath, content)) {
        console.error(`[VERIFY] File verification failed after write to ${filePath}`);

        const recovered = this.recoverFromBackup(filePath);
        if (!recovered) {
          throw new Error('File write verification failed and no backup available');
        }
      }

      return true;
    }, { retries: 2, timeout: 5000 });
  }
}

module.exports = new ConcurrencyManager();
