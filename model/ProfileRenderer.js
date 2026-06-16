const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

class ProfileRenderer {
  static config = {
    avatar: {
      x: 43,
      y: 40,
      size: 110
    },
    name: {
      x: 175,
      y: 110,
      fontSize: 32,
      color: '#FFFFFF'
    },
    motto: {
      x: 945,
      y: 657,
      fontSize: 18,
      color: '#E0E0E0',
      maxWidth: 440,
      lineHeight: 20,
      maxLines: 3
    },
    profileId: {
      x: 1220,
      y: 475,
      fontSize: 22,
      color: '#ffffff'
    },
    createdDate: {
      x: 950,
      y: 475,
      fontSize: 24,
      color: '#ffffff'
    },
    bakeryLevel: {
      x: 908,
      y: 290,
      fontSize: 32,
      color: '#ffffff'
    },
    totalBakeries: {
      x: 600,
      y: 212,
      fontSize: 28,
      color: '#ffffff'
    },
    progressBar: {
      x: 600,
      y: 308,
      width: 345,
      height: 15,
      borderColor: '#FFFFFF',
      fillColor: '#1E90FF',
      backgroundColor: '#33333300',
      borderWidth: 2,
      borderRadius: 12
    },
    bakeryRank: {
      x: 1280,
      y: 570,
      fontSize: 22,
      color: '#ffffff'
    },
    location: {
      x: 665,
      y: 102,
      fontSize: 18,
      color: '#ffffff'
    },
    favoritePony: {
      x: 1010,
      y: 570,
      fontSize: 22,
      color: '#ffffff'
    },
    statsValues: {
      x: 610,
      fontSize: 16,
      color: '#ffffff',
      rows: [460, 525, 585, 655]
    },
    tagValues: {
      x: 268,
      fontSize: 24,
      color: '#ffffff',
      rows: [470, 540, 610, 676]
    }
  };

  static backgroundCache = null;
  static backgroundCachePath = null;

  /**
   * @param {Object}
   * @param {string}
   * @param {string}
   * @returns {Promise<Buffer>}
   */
  static async generateProfileImage(userProfile, username, avatarURL) {
    try {
      const bgFile = userProfile.profileBackground || 'Profile_Background.png';
      const bgPath = fs.existsSync(path.join(__dirname, '../assets/profile_assets', bgFile))
        ? path.join(__dirname, '../assets/profile_assets', bgFile)
        : path.join(__dirname, '../assets/profile_assets/Profile_Background.png');
      if (!fs.existsSync(bgPath)) {
        throw new Error(`Background image not found at ${bgPath}`);
      }

      let backgroundImage = this.backgroundCache;
      if (!backgroundImage || this.backgroundCachePath !== bgPath) {
        backgroundImage = await loadImage(bgPath);
        this.backgroundCache = backgroundImage;
        this.backgroundCachePath = bgPath;
      }

      const canvas = createCanvas(backgroundImage.width, backgroundImage.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(backgroundImage, 0, 0);

      try {
        const avatar = await Promise.race([
          loadImage(avatarURL),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Avatar load timeout')), 1500))
        ]);
        const cfg = this.config.avatar;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cfg.x + cfg.size / 2, cfg.y + cfg.size / 2, cfg.size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, cfg.x, cfg.y, cfg.size, cfg.size);
        ctx.restore();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cfg.x + cfg.size / 2, cfg.y + cfg.size / 2, cfg.size / 2, 0, Math.PI * 2);
        ctx.stroke();
      } catch (avatarErr) {
        console.error('Failed to load avatar, skipping:', avatarErr.message);
      }

      const nameCfg = this.config.name;
      ctx.font = `bold ${nameCfg.fontSize}px Arial`;
      ctx.fillStyle = nameCfg.color;
      ctx.fillText(username, nameCfg.x, nameCfg.y);

      const motto = userProfile.motto || '';
      if (motto) {
        const mottoCfg = this.config.motto;
        ctx.font = `${mottoCfg.fontSize}px Arial`;
        ctx.fillStyle = mottoCfg.color;

        const words = motto.split(' ');
        let lines = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? currentLine + ' ' + word : word;
          const metrics = ctx.measureText(testLine);

          if (metrics.width > mottoCfg.maxWidth) {
            if (currentLine) {
              lines.push(currentLine);
            }
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        lines = lines.slice(0, mottoCfg.maxLines);
        if (lines.length === mottoCfg.maxLines && motto.length > lines.join(' ').length) {
          if (lines[lines.length - 1]) {
            lines[lines.length - 1] = lines[lines.length - 1].slice(0, -3) + '...';
          }
        }

        const shouldCenter = lines.length === 1 && ctx.measureText(lines[0]).width < (mottoCfg.maxWidth * 0.5);

        lines.forEach((line, index) => {
          if (shouldCenter) {
            ctx.textAlign = 'center';
            const centerX = mottoCfg.x + (mottoCfg.maxWidth / 2);
            ctx.fillText(line, centerX, mottoCfg.y + (index * mottoCfg.lineHeight));
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(line, mottoCfg.x, mottoCfg.y + (index * mottoCfg.lineHeight));
          }
        });

        ctx.textAlign = 'left';
      }

      const profileIdCfg = this.config.profileId;
      const profileId = userProfile.profileId || 'NO-ID';
      ctx.font = `${profileIdCfg.fontSize}px Arial`;
      ctx.fillStyle = profileIdCfg.color;
      ctx.fillText(profileId, profileIdCfg.x, profileIdCfg.y);

      const createdDate = new Date(userProfile.createdAt || Date.now());
      const formattedDate = createdDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const dateCfg = this.config.createdDate;
      ctx.font = `bold ${dateCfg.fontSize}px Arial`;
      ctx.fillStyle = dateCfg.color;
      ctx.fillText(formattedDate, dateCfg.x, dateCfg.y);

      const levelCfg = this.config.bakeryLevel;
      const currentLevel = userProfile.server?.BakeryLevel || 1;
      ctx.font = `bold ${levelCfg.fontSize}px Arial`;
      ctx.fillStyle = levelCfg.color;
      ctx.fillText(`${currentLevel}`, levelCfg.x, levelCfg.y);

      const bkCfg = this.config.totalBakeries;
      const totalBakeries = userProfile.stats?.allTimeSold || 0;
      ctx.font = `bold ${bkCfg.fontSize}px Arial`;
      ctx.fillStyle = bkCfg.color;
      ctx.fillText(`${totalBakeries}`, bkCfg.x, bkCfg.y);

      const progCfg = this.config.progressBar;
      const currentXP = userProfile.server?.BakeryXP || 0;

      const xpForNextLevel = userProfile.server?.NextLevelXP || currentLevel * 1000;

      const xpInCurrentLevel = Math.max(0, currentXP);
      const progressPercentage = Math.min(1, xpInCurrentLevel / xpForNextLevel);

      const drawRoundedRect = (x, y, width, height, radius, fill) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      };

      drawRoundedRect(progCfg.x, progCfg.y, progCfg.width, progCfg.height, progCfg.borderRadius, progCfg.backgroundColor);

      if (progressPercentage > 0) {
        const fillWidth = progCfg.width * progressPercentage;
        const r = progCfg.borderRadius;
        const bx = progCfg.x;
        const by = progCfg.y;
        const bh = progCfg.height;

        const progressColors = Array.isArray(userProfile.progressColor) && userProfile.progressColor.length >= 2
          ? userProfile.progressColor
          : ['#0050CC', '#87CEFA'];
        const gradient = ctx.createLinearGradient(bx, 0, bx + fillWidth, 0);
        gradient.addColorStop(0, progressColors[0]);
        gradient.addColorStop(1, progressColors[1]);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + fillWidth - (fillWidth >= progCfg.width - r ? r : 0), by);
        if (fillWidth >= progCfg.width - r) {
          ctx.quadraticCurveTo(bx + fillWidth, by, bx + fillWidth, by + r);
          ctx.lineTo(bx + fillWidth, by + bh - r);
          ctx.quadraticCurveTo(bx + fillWidth, by + bh, bx + fillWidth - r, by + bh);
        } else {
          ctx.lineTo(bx + fillWidth, by);
          ctx.lineTo(bx + fillWidth, by + bh);
        }
        ctx.lineTo(bx + r, by + bh);
        ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
      }

      const xpText = `${Math.floor(xpInCurrentLevel)}/${xpForNextLevel}`;
      ctx.font = `bold 14px Arial`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(xpText, progCfg.x + progCfg.width / 2, progCfg.y + progCfg.height / 2 + 5);
      ctx.textAlign = 'left';

      const rankCfg = this.config.bakeryRank;
      const bakeryRank = userProfile.bakeryRank || '—';
      ctx.font = `bold ${rankCfg.fontSize}px Arial`;
      ctx.fillStyle = rankCfg.color;
      ctx.fillText(`#${bakeryRank}`, rankCfg.x, rankCfg.y);

      if (userProfile.location) {
        const locCfg = this.config.location;
        ctx.font = `bold ${locCfg.fontSize}px Arial`;
        ctx.fillStyle = locCfg.color;
        ctx.textAlign = 'left';
        ctx.fillText(userProfile.location, locCfg.x, locCfg.y);
      }

      const favCfg = this.config.favoritePony;
      const favPony = userProfile.favoritePony || 'None';
      ctx.font = `bold ${favCfg.fontSize}px Arial`;
      ctx.fillStyle = favCfg.color;
      ctx.textAlign = 'left';
      ctx.fillText(favPony, favCfg.x, favCfg.y);

      const statsCfg = this.config.statsValues;
      const statsRows = [
        `${userProfile.streak ?? 0} / ${userProfile.bestStreak ?? 0}`,
        `${userProfile.questCompleted ?? 0}`,
        `${userProfile.poniesBefriended ?? 0}`,
        `${userProfile.totalMessages ?? 0}`,
      ];
      ctx.font = `bold ${statsCfg.fontSize}px Arial`;
      for (let i = 0; i < statsRows.length; i++) {
        if (i === 0) {
          const streakText = `${userProfile.streak ?? 0}`;
          const bestStreakText = `${userProfile.bestStreak ?? 0}`;
          const prefixText = `${streakText} / `;
          const fullText = `${prefixText}${bestStreakText}`;
          const startX = statsCfg.x - (ctx.measureText(fullText).width / 2);

          ctx.textAlign = 'left';
          ctx.fillStyle = statsCfg.color;
          ctx.fillText(prefixText, startX, statsCfg.rows[i]);
          ctx.fillStyle = '#FFD700';
          ctx.fillText(bestStreakText, startX + ctx.measureText(prefixText).width, statsCfg.rows[i]);
          continue;
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = statsCfg.color;
        ctx.fillText(statsRows[i], statsCfg.x, statsCfg.rows[i]);
      }

      const tagsCfg = this.config.tagValues;
      const tags = userProfile.tags || ['No Tag', 'No Tag', 'No Tag', 'No Tag'];
      ctx.font = `bold ${tagsCfg.fontSize}px Arial`;
      ctx.fillStyle = tagsCfg.color;
      ctx.textAlign = 'center';
      for (let i = 0; i < 4; i++) {
        ctx.fillText((tags[i] || 'No Tag').slice(0, 24), tagsCfg.x, tagsCfg.rows[i]);
      }

      ctx.textAlign = 'left';

      return canvas.toBuffer('image/png');
    } catch (err) {
      console.error('Error generating profile image:', err);
      throw err;
    }
  }

  /**
   * @param {number} 
   * @param {number}
   */
  static setAvatarPosition(x, y) {
    this.config.avatar.x = x;
    this.config.avatar.y = y;
  }

  /**
   * @param {number}
   * @param {number}
   */
  static setNamePosition(x, y) {
    this.config.name.x = x;
    this.config.name.y = y;
  }

  /**
   * @param {number}
   * @param {number}
   */
  static setCreatedDatePosition(x, y) {
    this.config.createdDate.x = x;
    this.config.createdDate.y = y;
  }

  /**
   * @param {number}
   * @param {number}
   */
  static setLevelPosition(x, y) {
    this.config.bakeryLevel.x = x;
    this.config.bakeryLevel.y = y;
  }

  /**
   * @param {number}
   * @param {number}
   * @param {number}
   * @param {string}
   */
  static setTotalBakeriesPosition(x, y, fontSize = null, color = null) {
    this.config.totalBakeries.x = x;
    this.config.totalBakeries.y = y;
    if (fontSize) this.config.totalBakeries.fontSize = fontSize;
    if (color) this.config.totalBakeries.color = color;
  }

  /**
   * @param {number}
   * @param {number}
   * @param {number} 
   * @param {number}
   */
  static setProgressBarPosition(x, y, width, height) {
    this.config.progressBar.x = x;
    this.config.progressBar.y = y;
    if (width) this.config.progressBar.width = width;
    if (height) this.config.progressBar.height = height;
  }

  /**
   * @param {number}
   * @param {number}
   * @param {number}
   * @param {string}
   * @param {number}
   */
  static setMottoPosition(x, y, fontSize = null, color = null, maxWidth = null) {
    this.config.motto.x = x;
    this.config.motto.y = y;
    if (fontSize) this.config.motto.fontSize = fontSize;
    if (color) this.config.motto.color = color;
    if (maxWidth) this.config.motto.maxWidth = maxWidth;
  }

  /**
   * @param {number}
   * @param {number}
   */
  static setMottoWrapping(lineHeight = null, maxLines = null) {
    if (lineHeight) this.config.motto.lineHeight = lineHeight;
    if (maxLines) this.config.motto.maxLines = maxLines;
  }

  /**
   * @returns {Object}
   */
  static getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  static clearCache() {
    this.backgroundCache = null;
    this.backgroundCachePath = null;
  }
}

module.exports = ProfileRenderer;
