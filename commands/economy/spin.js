const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    AttachmentBuilder
} = require('discord.js');
const { createCanvas } = require('canvas');
const GIFEncoder = require('gif-encoder-2');
const { sendOrFallback } = require('../../utils/safeReply');

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
const DEGREE_PER_NUMBER = 360 / 20;

const COLORS = [
    '#FF6B6B', '#FF8E72', '#FFA07A', '#FFB84D', '#FFD700',
    '#FFE66D', '#C1FF72', '#98D82B', '#52D914', '#00D9A3',
    '#00D9D9', '#00C8FF', '#0099FF', '#5B5FFF', '#8B7AFF',
    '#BB86FC', '#FF6EC7', '#FF79E8', '#FF5E8E', '#FF7B54'
];

const WHEEL_SIZE = 400;
const CENTER = WHEEL_SIZE / 2;
const RADIUS = 160;

function hexToRgb(hex) {
    const num = parseInt(hex.replace('#', ''), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function brighten(hex, pct) {
    const [r, g, b] = hexToRgb(hex);
    const amt = Math.round(2.55 * pct);
    return `rgb(${Math.min(255, r + amt)},${Math.min(255, g + amt)},${Math.min(255, b + amt)})`;
}

/**
 * Draw wheel frame onto a canvas context at a given rotation angle
 */
function drawWheelFrame(ctx, rotationAngle) {

    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, WHEEL_SIZE, WHEEL_SIZE);

    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS + 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.rotate((rotationAngle * Math.PI) / 180);

    for (let i = 0; i < 20; i++) {
        const startAngle = (i * DEGREE_PER_NUMBER * Math.PI) / 180;
        const endAngle = ((i + 1) * DEGREE_PER_NUMBER * Math.PI) / 180;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, RADIUS, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = COLORS[i];
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const midAngle = startAngle + (DEGREE_PER_NUMBER * Math.PI) / 360;
        const tx = Math.cos(midAngle) * (RADIUS * 0.7);
        const ty = Math.sin(midAngle) * (RADIUS * 0.7);

        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(NUMBERS[i].toString(), 0, 0);
        ctx.restore();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CENTER, CENTER, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0f1e';
    ctx.fill();

    const arrowCanvasAngle = 270;

    const effectiveAngle = ((arrowCanvasAngle - rotationAngle) % 360 + 360) % 360;
    const sectionIndex = Math.floor(effectiveAngle / DEGREE_PER_NUMBER) % 20;
    const arrowColor = COLORS[sectionIndex];

    const ax = CENTER;
    const ay = CENTER - RADIUS - 5;
    ctx.fillStyle = arrowColor;
    ctx.beginPath();
    ctx.moveTo(ax, ay + 30);
    ctx.lineTo(ax - 16, ay);
    ctx.lineTo(ax + 16, ay);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/**
 * Generate an animated GIF of the wheel spinning and landing on a result
 * Uses physics-based friction — wheel loses speed gradually like a real wheel
 */
function generateSpinGif(landingAngle) {
    const encoder = new GIFEncoder(WHEEL_SIZE, WHEEL_SIZE);
    encoder.start();
    encoder.setRepeat(-1);
    encoder.setQuality(20);
    encoder.setTransparent(null);

    const canvas = createCanvas(WHEEL_SIZE, WHEEL_SIZE);
    const ctx = canvas.getContext('2d');

    const FRAME_DELAY = 50;

    const totalSpin = 1080 + landingAngle;
    const friction = 0.93;

    const initialVelocity = totalSpin * (1 - friction);

    let velocity = initialVelocity;
    let angle = 0;
    const frames = [];

    while (velocity > 0.15) {
        frames.push(angle % 360);
        angle += velocity;
        velocity *= friction;
    }

    for (let i = 0; i < 3; i++) {
        frames.push(landingAngle);
    }

    for (let i = 0; i < frames.length; i++) {
        encoder.setDelay(FRAME_DELAY);
        drawWheelFrame(ctx, frames[i]);
        encoder.addFrame(ctx);
    }

    encoder.setDelay(2000);
    drawWheelFrame(ctx, landingAngle);
    encoder.addFrame(ctx);

    encoder.finish();

    const totalDuration = (frames.length + 1) * FRAME_DELAY + 2000;
    return { buffer: encoder.out.getData(), duration: totalDuration };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spin')
        .setDescription('Spin the wheel and land on a number!'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            await interaction.editReply({
                content: `<a:loading:1488385574405406751> Loading The Wheel...`
            });

            const resultNumber = NUMBERS[Math.floor(Math.random() * NUMBERS.length)];

            const landingAngle = (270 - (resultNumber - 1) * DEGREE_PER_NUMBER - DEGREE_PER_NUMBER / 2 + 360) % 360;
            console.log('Spin: will land on', resultNumber, 'at', landingAngle, 'degrees');

            const { buffer: gifBuffer, duration: gifDuration } = generateSpinGif(landingAngle);
            console.log('GIF generated:', gifBuffer.length, 'bytes,', gifDuration, 'ms duration');

            const gifAttachment = new AttachmentBuilder(gifBuffer, { name: 'spin.gif' });

            let message = await interaction.editReply({
                content: `**🎡 Spinning the wheel...**`,
                files: [gifAttachment]
            });

            await new Promise(r => setTimeout(r, gifDuration));

            try {
                const canvas = createCanvas(WHEEL_SIZE, WHEEL_SIZE);
                const ctx = canvas.getContext('2d');
                drawWheelFrame(ctx, landingAngle);
                const finalBuffer = canvas.toBuffer('image/png');

                const resultContainer = new ContainerBuilder().setAccentColor(0xFFE66D);
                resultContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎡 You Landed On`));
                resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                const gallery = new MediaGalleryBuilder();
                gallery.addItems(new MediaGalleryItemBuilder().setURL('attachment://wheel.png'));
                resultContainer.addMediaGalleryComponents(gallery);
                resultContainer.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

                resultContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `# ${resultNumber}\n-# The wheel has spoken!`
                ));

                const finalAttachment = new AttachmentBuilder(finalBuffer, { name: 'wheel.png' });

                await message.edit({
                    content: null,
                    components: [resultContainer.toJSON()],
                    flags: MessageFlags.IsComponentsV2,
                    files: [finalAttachment]
                }).catch(async (err) => {
                    console.error('V2 edit failed:', err.message);
                    await message.edit({
                        content: `🎉 You landed on: **${resultNumber}**`,
                        components: [],
                        files: [finalAttachment]
                    });
                });
            } catch (e) {
                console.error('Final result error:', e);
                await message.edit({
                    content: `🎉 You landed on: **${resultNumber}**`,
                    components: []
                });
            }

        } catch (err) {
            console.error('Spin command error:', err);
            try {
                await sendOrFallback(interaction, {
                    content: '❌ An error occurred while spinning the wheel: ' + err.message
                });
            } catch (e) {
                console.error('Fallback error:', e);
            }
        }
    }
};
