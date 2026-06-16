const fs = require('fs');
const path = require('path');

class FileQueue {
  constructor() {
    this.queues = new Map();
    this.locks = new Map();
  }

  async executeQueued(filePath, operation, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`File operation timeout after ${timeout}ms on ${filePath}`));
      }, timeout);

      const execute = async () => {
        try {
          const result = await operation();
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        } finally {
          this.locks.delete(filePath);
          this.processNext(filePath);
        }
      };

      if (!this.locks.has(filePath)) {
        this.locks.set(filePath, true);
        execute();
      } else {
        if (!this.queues.has(filePath)) {
          this.queues.set(filePath, []);
        }
        this.queues.get(filePath).push(execute);
      }
    });
  }

  processNext(filePath) {
    const queue = this.queues.get(filePath);
    if (queue && queue.length > 0) {
      this.locks.set(filePath, true);
      const execute = queue.shift();
      execute();
    }
  }

  readFile(filePath) {
    return this.executeQueued(filePath, () => {
      return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    });
  }

  writeFile(filePath, content) {
    return this.executeQueued(filePath, () => {
      return new Promise((resolve, reject) => {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true }, (err) => {
            if (err) return reject(err);
            performWrite();
          });
        } else {
          performWrite();
        }

        const performWrite = () => {
          fs.writeFile(filePath, content, 'utf8', (err) => {
            if (err) reject(err);
            else resolve();
          });
        };
      });
    });
  }
}

module.exports = new FileQueue();
