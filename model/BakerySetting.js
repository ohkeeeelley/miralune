const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

class LevelManager {
    static async generateCooldownImage(options) {
        const {
            username,
            avatarURL,
            remainingTime,
            totalTime,
            bgPath = path.join(__dirname, '../assets/bakeryassets/BakeTimeBG.png')
        } = options;

        const canvas = createCanvas(800, 200);
        const ctx = canvas.getContext('2d');
        const background = await loadImage(bgPath);
        ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

        const progressWidth = 600;
        const progressHeight = 30;
        const progressX = 150;
        const progressY = 120;

        ctx.fillStyle = '#2f3136';
        ctx.beginPath();
        ctx.roundRect(progressX, progressY, progressWidth, progressHeight, 15);
        ctx.fill();

        const progress = Math.max(0, Math.min(1, 1 - (remainingTime / totalTime)));
        ctx.fillStyle = '#5865f2';
        ctx.beginPath();
        ctx.roundRect(progressX, progressY, progressWidth * progress, progressHeight, 15);
        ctx.fill();

        try {
            const avatar = await loadImage(avatarURL);
            ctx.save();
            ctx.beginPath();
            ctx.arc(75, 100, 50, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, 25, 50, 100, 100);
            ctx.restore();
        } catch (error) {
            console.error('Error loading avatar:', error);
        }

        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(username, 150, 80);

        const minutes = Math.floor(remainingTime / 60);
        const seconds = Math.floor(remainingTime % 60);
        const timeText = `${minutes}m ${seconds}s remaining`;

        ctx.font = '24px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(timeText, progressX, progressY - 10);

        return canvas.toBuffer('image/png');
    }

    static formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return {
            minutes,
            seconds: remainingSeconds,
            text: `${minutes} minute${minutes !== 1 ? 's' : ''} and ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`
        };
    }
}

module.exports = LevelManager;
