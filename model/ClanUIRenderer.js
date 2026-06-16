const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const PROGRESSION_TIERS = [
    { threshold: 0, bonus: 0, label: "Novice Bakery", color: '#CD7F32', emoji: '🥉' },
    { threshold: 10000, bonus: 0.1, label: "Rising Star", color: '#C0C0C0', emoji: '⭐' },
    { threshold: 25000, bonus: 0.15, label: "Local Favorite", color: '#FFD700', emoji: '🏆' },
    { threshold: 45000, bonus: 0.2, label: "Town Famous", color: '#E5E4E2', emoji: '🌟' },
    { threshold: 60000, bonus: 0.25, label: "Regional Chain", color: '#4169E1', emoji: '🎯' },
    { threshold: 80000, bonus: 0.3, label: "National Brand", color: '#9400D3', emoji: '👑' },
    { threshold: 110000, bonus: 0.35, label: "Master Bakers", color: '#FF4500', emoji: '🔥' },
    { threshold: 140000, bonus: 0.4, label: "Elite Patisserie", color: '#00FF00', emoji: '💫' },
    { threshold: 180000, bonus: 0.45, label: "Legendary Artisans", color: '#FFD700', emoji: '✨' },
    { threshold: 240000, bonus: 0.5, label: "Divine Confection", color: '#FF1493', emoji: '🌈' },
    { threshold: 300000, bonus: 0.55, label: "Celestial Bakery", color: '#7B68EE', emoji: '⚡' }
];

const UI_CONFIG = {
	width: 1200,
	height: 800,

	clanInfo: {
		label: {
			x: 45,
			y: 25,
			font: 'bold 28px Arial',
			color: '#ffd6fdff',
			text: 'Clan Name:'
		},
		name: {
			x: 50,
			y: 65,
			font: 'bold 24px Arial',
			color: '#FFFFFF',
			text: {
				prefix: '',
				suffix: ''
			}
		},
		level: {
			x: 55,
			y: 100,
			font: '28px Arial',
			color: '#FFFFFF',
			text: {
				prefix: 'Level ',
				suffix: ''
			}
		},
		xpBar: {
			x: 60,
			y: 140,
			width: 400,
			height: 30,
			cornerRadius: 15,
			border: {
				width: 1,
				color: '#FFFFFF'
			},
			colors: {
				background: '#2b2d31',
				progress: '#5865f2',
				shine: '#FFFFFF20'
			},
			text: {
				font: '20px Arial',
				color: '#FFFFFF',
				yOffset: -5,
				separator: '/',
				suffix: ' XP'
			}
		}
	},

	memberList: {
		label: {
			x: 35,
			y: 215,
			font: 'bold 36px Arial',
			color: '#b1d7ffff',
			text: 'Clan Members'
		},
		startX: 80,
		startY: 275,
		spacing: 60,
		avatar: {
			size: 55,
			margin: 10,
			borderWidth: 2,
			borderColor: '#FFFFFF',
			fallback: {
				background: '#444444',
				textColor: '#FFFFFF',
				font: 'bold 20px Arial'
			},
			roleBadge: {
				size: 18,
				offsetX: -50,
				offsetY: 5,
				owner: {
					path: 'clan_assets/icons/clanowner.png',
					scale: 2.0
				},
				op: {
					path: 'clan_assets/icons/clanop.png',
					scale: 1.0
				}
			}
		},
		name: {
			x: 15,
			y: 8,
			font: '24px Arial',
			color: '#FFFFFF',
		},
		stats: {
			x: 15,
			y: 32,
			font: '16px Arial',
			color: '#ff8ba0ff',
			text: {
				prefix: 'Baked: ',
				suffix: ''
			}
		},
		maxDisplayed: 10
	},

	clanStats: {
		startX: 540,
		startY: 40,
		lineHeight: 28,
		labelFont: '20px Arial',
		valueFont: '20px Arial',
		labelColor: '#CCCCCC',
		valueColor: '#FFFFFF',
		progression: {

			xOffset: 0,
			yOffset: 560,

			bar: {
				width: 420,
				height: 30,
				radius: 12,
				colors: {
					background: '#2b2d31',
					progress: 'dynamic'
				}
			},

			headerFont: 'bold 22px Arial',
			bonusFont: '16px Arial',
			textFont: '14px Arial',
			markerPercents: [0.25, 0.5, 0.75],
			markerColor: '#FFFFFF',
			startLabelColor: '#ff6b00',
			endLabelColor: '#ffd700'
		}
	},

	badges: {
		startX: 490,
		startY: 130,
		size: 200,
		spacing: 15,
		perRow: 3,
		text: {
			content: 'Achievements (Soon)',
			font: '42px Arial',
			x: 260,
			y: 25,
			color: '#FFFFFF'
		}
	}
};

const BASE_XP_PER_LEVEL = 1500;

function mergeOverrides(target, overrides) {
	if (!overrides) return target;
	const result = { ...target };
	for (const key of Object.keys(overrides)) {
		const val = overrides[key];
		if (val && typeof val === 'object' && !Array.isArray(val)) {
			result[key] = mergeOverrides(result[key] || {}, val);
		} else {
			result[key] = val;
		}
	}
	return result;
}

class ClanUIRenderer {
    static calculateProgression(totalBaked) {
        let currentTier = 0;
        let nextTier = 0;
        let progress = 0;
        let bonus = 0;

        for (let i = PROGRESSION_TIERS.length - 1; i >= 0; i--) {
            if (totalBaked >= PROGRESSION_TIERS[i].threshold) {
                currentTier = i;
                nextTier = Math.min(i + 1, PROGRESSION_TIERS.length - 1);
                bonus = PROGRESSION_TIERS[i].bonus;
                break;
            }
        }

        const currentThreshold = PROGRESSION_TIERS[currentTier].threshold;
        const nextThreshold = PROGRESSION_TIERS[nextTier]?.threshold || PROGRESSION_TIERS[currentTier].threshold;

        if (currentThreshold === nextThreshold) {
            progress = 1;
        } else {
            progress = Math.min(1, Math.max(0, (totalBaked - currentThreshold) / (nextThreshold - currentThreshold)));
        }

        return {
            currentTier,
            nextTier,
            progress,
            bonus,
            currentThreshold,
            nextThreshold,
            totalBaked
        };
    }

    static calculateBakeBonus(totalBaked, baseAmount, memberBaked) {
        try {
            const { bonus } = this.calculateProgression(totalBaked);

            if (memberBaked > 0) {
                const contributionRatio = Math.min(memberBaked / totalBaked, 1);
                return Math.floor(baseAmount * (1 + (bonus * contributionRatio)));
            }

            return baseAmount;
        } catch (error) {
            console.error('Error calculating bake bonus:', error);
            return baseAmount;
        }
    }

	static calculateLevel(totalXP) {
		totalXP = Math.max(0, Math.floor(totalXP || 0));
		let level = 1;
		let remaining = totalXP;
		let xpForLevel = BASE_XP_PER_LEVEL;

		while (remaining >= xpForLevel) {
			remaining -= xpForLevel;
			level += 1;
			xpForLevel += BASE_XP_PER_LEVEL;
		}

		return {
			level,
			currentXP: remaining,
			nextLevelXP: xpForLevel,
			progress: xpForLevel > 0 ? (remaining / xpForLevel) : 0
		};
	}

	static async renderClanImage(clan = {}, memberProfiles = [], overrides = {}) {
		const cfg = mergeOverrides(UI_CONFIG, overrides);
		const canvas = createCanvas(cfg.width, cfg.height);
		const ctx = canvas.getContext('2d');

		try {
			const bgPath = path.join(__dirname, '..', 'assets', 'clan_assets', 'ClansBG.png');
			let bg = null;
			try { bg = await loadImage(bgPath); } catch (e) { bg = null; }

			if (bg) {
				canvas.width = bg.width || canvas.width;
				canvas.height = bg.height || canvas.height;
				ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
			} else {
				ctx.fillStyle = '#1e1f22';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}

			const labelConfig = cfg.clanInfo.label;
			ctx.font = labelConfig.font;
			ctx.fillStyle = labelConfig.color;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.fillText(labelConfig.text, labelConfig.x, labelConfig.y);

			const nameConfig = cfg.clanInfo.name;
			ctx.font = nameConfig.font;
			ctx.fillStyle = nameConfig.color;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.fillText(
				nameConfig.text.prefix + (clan.name || 'Unnamed Clan') + nameConfig.text.suffix,
				nameConfig.x,
				nameConfig.y
			);

			const xpInfo = this.calculateLevel(clan.xp || 0);
			const levelConfig = cfg.clanInfo.level;
			ctx.font = levelConfig.font;
			ctx.fillStyle = levelConfig.color;
			ctx.fillText(
				levelConfig.text.prefix + xpInfo.level + levelConfig.text.suffix,
				levelConfig.x,
				levelConfig.y
			);

			const bar = cfg.clanInfo.xpBar;

			function drawRoundedRect(ctx, x, y, width, height, radius) {
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
			}

			ctx.fillStyle = bar.colors.background;
			if (bar.cornerRadius > 0) {
				drawRoundedRect(ctx, bar.x, bar.y, bar.width, bar.height, bar.cornerRadius);
			} else {
				ctx.beginPath();
				ctx.rect(bar.x, bar.y, bar.width, bar.height);
			}
			ctx.fill();

			const progressWidth = Math.max(0, bar.width * xpInfo.progress);
			ctx.fillStyle = bar.colors.progress;
			if (bar.cornerRadius > 0) {
				drawRoundedRect(ctx, bar.x, bar.y, progressWidth, bar.height, bar.cornerRadius);
			} else {
				ctx.beginPath();
				ctx.rect(bar.x, bar.y, progressWidth, bar.height);
			}
			ctx.fill();

			if (bar.colors.shine) {
				const shineGradient = ctx.createLinearGradient(bar.x, bar.y, bar.x, bar.y + bar.height * 0.5);
				shineGradient.addColorStop(0, bar.colors.shine);
				shineGradient.addColorStop(1, 'transparent');
				ctx.fillStyle = shineGradient;
				if (bar.cornerRadius > 0) {
					drawRoundedRect(ctx, bar.x, bar.y, progressWidth, bar.height, bar.cornerRadius);
				} else {
					ctx.beginPath();
					ctx.rect(bar.x, bar.y, progressWidth, bar.height);
				}
				ctx.fill();
			}

			if (bar.border && bar.border.width > 0) {
				ctx.strokeStyle = bar.border.color;
				ctx.lineWidth = bar.border.width;
				if (bar.cornerRadius > 0) {
					drawRoundedRect(ctx, bar.x, bar.y, bar.width, bar.height, bar.cornerRadius);
				} else {
					ctx.beginPath();
					ctx.rect(bar.x, bar.y, bar.width, bar.height);
				}
				ctx.stroke();
			}

			const textConfig = bar.text;
			ctx.font = textConfig.font;
			ctx.fillStyle = textConfig.color;
			ctx.textAlign = 'center';
			ctx.fillText(
				Math.floor(xpInfo.currentXP) + textConfig.separator + xpInfo.nextLevelXP + textConfig.suffix,
				bar.x + bar.width / 2,
				bar.y + (bar.height / 2) + textConfig.yOffset
			);

			try {
				const stats = cfg.clanStats;
				ctx.textAlign = 'left';
				ctx.textBaseline = 'top';
				ctx.fillStyle = stats.labelColor;
				ctx.font = stats.labelFont;
				const membersLabelY = stats.startY;
				ctx.fillText('Members', stats.startX, membersLabelY);
				ctx.fillText('Total Baked', stats.startX, membersLabelY + stats.lineHeight);
				ctx.fillText('All-Time Baked', stats.startX, membersLabelY + stats.lineHeight * 2);

				ctx.fillStyle = stats.valueColor;
				ctx.font = stats.valueFont;
				const membersVal = (clan.members || []).length;
				const totalVal = (clan.TotalClanBaked || 0).toLocaleString();
				const allTimeVal = (clan.AllTimeBaked || 0).toLocaleString();

				const valueX = stats.startX + 180;
				ctx.fillText(membersVal.toString(), valueX, membersLabelY);
				ctx.fillText(totalVal, valueX, membersLabelY + stats.lineHeight);
				ctx.fillText(allTimeVal, valueX, membersLabelY + stats.lineHeight * 2);

				const total = clan.TotalClanBaked || 0;
				const progression = this.calculateProgression(total);
				const progCfg = stats.progression || {};
				const barX = stats.startX + (progCfg.xOffset || 0);
				const barWidth = (progCfg.bar && progCfg.bar.width) || 300;
				const barHeight = (progCfg.bar && progCfg.bar.height) || (progCfg.bar && progCfg.bar.height) || 30;
				const barRadius = (progCfg.bar && progCfg.bar.radius) || 12;
				const progressBarY = membersLabelY + stats.lineHeight * 3 + (progCfg.yOffset || 40);

				ctx.font = (progCfg.headerFont) || 'bold 22px Arial';
				ctx.fillStyle = '#FFFFFF';
				ctx.textAlign = 'left';
				ctx.fillText('Clan Progression', barX, progressBarY - 28);

				const bonusText = `Bonus: +${Math.floor((progression.bonus || 0) * 100)}%`;
				ctx.font = (progCfg.bonusFont) || '16px Arial';
				ctx.fillStyle = '#88ff88';
				ctx.textAlign = 'right';
				ctx.fillText(bonusText, barX + barWidth, progressBarY - 28);

				ctx.fillStyle = (progCfg.bar && progCfg.bar.colors && progCfg.bar.colors.background) || '#2b2d31';
				drawRoundedRect(ctx, barX, progressBarY, barWidth, barHeight, barRadius);
				ctx.fill();

				const fillWidth = Math.max(0, Math.min(barWidth, Math.round(barWidth * progression.progress)));
				ctx.fillStyle = PROGRESSION_TIERS[progression.currentTier] ? PROGRESSION_TIERS[progression.currentTier].color : '#5865f2';
				if (fillWidth > 0) {
					drawRoundedRect(ctx, barX, progressBarY, fillWidth, barHeight, Math.min(barRadius, fillWidth / 2));
					ctx.fill();
				}

				const range = Math.max(1, progression.nextThreshold - progression.currentThreshold);
				const markerPercents = (progCfg.markerPercents) || [0.25, 0.5, 0.75];
				ctx.font = (progCfg.textFont) || '14px Arial';
				markerPercents.forEach((p, idx) => {
					const value = Math.ceil(progression.currentThreshold + range * p);
					const rel = (value - progression.currentThreshold) / range;
					const mx = barX + Math.round(rel * barWidth);

					ctx.fillStyle = progCfg.markerColor || '#FFFFFF';
					ctx.fillRect(mx - 1, progressBarY - 6, 2, barHeight + 12);

					ctx.fillStyle = '#FFFFFF';
					ctx.textAlign = 'center';
					ctx.fillText(value.toLocaleString(), mx, progressBarY + barHeight + 20);
				});

				ctx.font = (progCfg.textFont) || '14px Arial';
				ctx.fillStyle = progCfg.startLabelColor || '#ff6b00';
				ctx.textAlign = 'left';
				ctx.fillText(progression.currentThreshold.toLocaleString(), barX, progressBarY + barHeight + 20);
				ctx.fillStyle = progCfg.endLabelColor || '#ffd700';
				ctx.textAlign = 'right';
				ctx.fillText(progression.nextThreshold.toLocaleString(), barX + barWidth, progressBarY + barHeight + 20);

			} catch (e) {
				console.error('Failed drawing clan stats on image', e);
			}

			const memberLabelConfig = cfg.memberList.label;
			ctx.font = memberLabelConfig.font;
			ctx.fillStyle = memberLabelConfig.color;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			ctx.fillText(memberLabelConfig.text, memberLabelConfig.x, memberLabelConfig.y);

			const memberConfig = cfg.memberList;
			let y = memberConfig.startY;
			for (let i = 0; i < Math.min(memberProfiles.length, memberConfig.maxDisplayed); i++) {
				const member = memberProfiles[i];
				if (!member) { y += memberConfig.spacing; continue; }

				const ax = memberConfig.startX;
				const ay = y;
				const asz = memberConfig.avatar.size;
				let drewAvatar = false;
				const fetchBuffer = (url) => new Promise((resolve, reject) => {
					try {
						const client = url.startsWith('https') ? https : http;
						const options = {
							headers: {
								'User-Agent': 'Miralune Discord Bot',
								'Accept': 'image/*'
							}
						};

						client.get(url, options, (res) => {
							if (res.statusCode === 302 || res.statusCode === 301) {

								return fetchBuffer(res.headers.location).then(resolve).catch(reject);
							}
							if (res.statusCode !== 200) return reject(new Error('Status ' + res.statusCode));

							const chunks = [];
							res.on('data', (c) => chunks.push(c));
							res.on('end', () => resolve(Buffer.concat(chunks)));
						}).on('error', reject);
					} catch (err) { reject(err); }
				});

				try {
					if (member.avatarURL) {
						let avatarUrl = member.avatarURL;
						console.log('Original avatarURL:', avatarUrl);
						if (!avatarUrl) {
							console.log('No avatar URL provided for member:', member.displayName);
							throw new Error('No avatar URL provided');
						}

						avatarUrl = avatarUrl.split('?')[0];
						console.log('Cleaned avatarURL:', avatarUrl);

						avatarUrl += '?size=256&format=png';
						console.log('Final avatarURL:', avatarUrl);

						const buf = await fetchBuffer(avatarUrl);
						const avatar = await loadImage(buf);

						ctx.save();
						console.log('Drawing avatar for:', member.displayName, 'at:', ax, ay, 'size:', asz);

						ctx.beginPath();
						ctx.arc(ax + asz / 2, ay + asz / 2, asz / 2, 0, Math.PI * 2);
						ctx.closePath();
						ctx.clip();

						ctx.fillStyle = '#5865f2';
						ctx.fillRect(ax, ay, asz, asz);

						try {
							console.log('Avatar dimensions:', avatar.width, 'x', avatar.height);
							ctx.drawImage(avatar, ax, ay, asz, asz);
							console.log('Successfully drew avatar for:', member.displayName);
						} catch (drawError) {
							console.error('Error drawing avatar:', drawError);
							drewAvatar = false;
							ctx.restore();
							return;
						}

						ctx.restore();

						ctx.beginPath();
						ctx.arc(ax + asz / 2, ay + asz / 2, asz / 2, 0, Math.PI * 2);
						ctx.strokeStyle = memberConfig.avatar.borderColor;
						ctx.lineWidth = memberConfig.avatar.borderWidth;
						ctx.stroke();

						drewAvatar = true;
					}
				} catch (e) {
					console.error('Avatar load failed for', member.id, member.displayName, 'URL:', member.avatarURL, 'Error:', e.message);
					drewAvatar = false;
					console.log('Falling back to initials for:', member.displayName);
				}

				if (!drewAvatar) {

					ctx.save();
					ctx.fillStyle = memberConfig.avatar.fallback.background;
					ctx.beginPath();
					ctx.arc(ax + asz / 2, ay + asz / 2, asz / 2, 0, Math.PI * 2);
					ctx.fill();
					ctx.fillStyle = memberConfig.avatar.fallback.textColor;
					ctx.font = memberConfig.avatar.fallback.font;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					const initials = (member.displayName || '').split(/\s+/).map(s => s[0]).slice(0,2).join('').toUpperCase() || '?';
					ctx.fillText(initials, ax + asz / 2, ay + asz / 2);
					ctx.restore();
				}

				ctx.beginPath();
				ctx.lineWidth = memberConfig.avatar.borderWidth;
				ctx.strokeStyle = memberConfig.avatar.borderColor;
				ctx.arc(ax + asz / 2, ay + asz / 2, asz / 2, 0, Math.PI * 2);
				ctx.stroke();

				if (member.role) {
					console.log('Drawing role badge for member:', member.displayName, 'Role:', member.role);
					const badgeConfig = memberConfig.avatar.roleBadge;
					const badgePath = member.role === 'owner' ? badgeConfig.owner.path :
								  member.role === 'op' ? badgeConfig.op.path : null;

					console.log('Badge path:', badgePath);

					if (badgePath) {
						try {
							const badgeFullPath = path.join(__dirname, '..', 'assets', 'bakeryassets', badgePath);
							console.log('Full badge path:', badgeFullPath);
							console.log('Checking if file exists:', fs.existsSync(badgeFullPath));

							const badge = await loadImage(badgeFullPath);
							console.log('Badge image loaded successfully');

							const scale = member.role === 'owner' ? badgeConfig.owner.scale : badgeConfig.op.scale;
							const badgeSize = badgeConfig.size * scale;

							const badgeX = ax + asz - badgeSize + badgeConfig.offsetX;
							const badgeY = ay + badgeConfig.offsetY;

							console.log('Drawing badge at:', badgeX, badgeY, 'size:', badgeSize);
							ctx.drawImage(badge, badgeX, badgeY, badgeSize, badgeSize);
							console.log('Badge drawn successfully');
						} catch (e) {
							console.error('Failed to load role badge:', e.message);
							console.error('Full error:', e);
						}
					} else {
						console.log('No badge path for role:', member.role);
					}
				} else {
					console.log('No role for member:', member.displayName);
				}

				const nameConfig = memberConfig.name;
				ctx.font = nameConfig.font;
				ctx.fillStyle = nameConfig.color;
				ctx.textAlign = 'left';
				ctx.fillText(
					member.displayName || 'Unknown',
					memberConfig.startX + memberConfig.avatar.size + nameConfig.x,
					y + nameConfig.y
				);

				const statsConfig = memberConfig.stats;
				ctx.font = statsConfig.font;
				ctx.fillStyle = statsConfig.color;
				ctx.fillText(
					statsConfig.text.prefix + (member.clanBaked ? member.clanBaked.toLocaleString() : '0') + statsConfig.text.suffix,
					memberConfig.startX + memberConfig.avatar.size + statsConfig.x,
					y + statsConfig.y
				);

				y += memberConfig.spacing;
			}

			const badgeConfig = cfg.badges;
			const badgeTextConfig = badgeConfig.text;
			ctx.font = badgeTextConfig.font;
			ctx.fillStyle = badgeTextConfig.color;
			ctx.textAlign = 'center';
			ctx.fillText(badgeTextConfig.content, badgeConfig.startX + badgeTextConfig.x, badgeConfig.startY + badgeTextConfig.y);

			return canvas.toBuffer();
		} catch (err) {
			console.error('Error generating clan image:', err);

			ctx.fillStyle = '#1e1f22';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.font = '20px Arial';
			ctx.fillStyle = '#fff';
			ctx.textAlign = 'center';
			ctx.fillText('Error generating clan image', canvas.width / 2, canvas.height / 2);
			return canvas.toBuffer();
		}
	}
}

module.exports = ClanUIRenderer;
