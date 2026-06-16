const fs = require('fs');
const path = require('path');

const TICKETS_DIR = path.join(__dirname, '..', 'data', 'tickets');

function ensureDir() {
    if (!fs.existsSync(TICKETS_DIR)) fs.mkdirSync(TICKETS_DIR, { recursive: true });
}

function configPath(guildId) {
    ensureDir();
    return path.join(TICKETS_DIR, `${guildId}_config.json`);
}

function loadConfig(guildId) {
    const p = configPath(guildId);
    if (!fs.existsSync(p)) return { categoryId: null, roleId: null, logChannelId: null };
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { categoryId: null, roleId: null, logChannelId: null }; }
}

function saveConfig(guildId, cfg) {
    fs.writeFileSync(configPath(guildId), JSON.stringify(cfg, null, 2));
}

function ticketsPath(guildId) {
    ensureDir();
    return path.join(TICKETS_DIR, `${guildId}_tickets.json`);
}

function loadTickets(guildId) {
    const p = ticketsPath(guildId);
    if (!fs.existsSync(p)) return {};
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function saveTickets(guildId, tickets) {
    fs.writeFileSync(ticketsPath(guildId), JSON.stringify(tickets, null, 2));
}

function getTicketByChannel(guildId, channelId) {
    const tickets = loadTickets(guildId);
    return Object.values(tickets).find(t => t.channelId === channelId) || null;
}

function getTicketByUser(guildId, userId) {
    const tickets = loadTickets(guildId);
    return Object.values(tickets).find(t => t.ownerId === userId && t.open) || null;
}

function createTicket(guildId, ticketNumber, ownerId, channelId) {
    const tickets = loadTickets(guildId);
    tickets[String(ticketNumber)] = {
        number: ticketNumber,
        ownerId,
        channelId,
        open: true,
        createdAt: Date.now(),
        participants: [ownerId]
    };
    saveTickets(guildId, tickets);
    return tickets[String(ticketNumber)];
}

function closeTicket(guildId, channelId) {
    const tickets = loadTickets(guildId);
    const ticket = Object.values(tickets).find(t => t.channelId === channelId);
    if (ticket) {
        ticket.open = false;
        ticket.closedAt = Date.now();
        saveTickets(guildId, tickets);
    }
    return ticket;
}

function nextTicketNumber(guildId) {
    const tickets = loadTickets(guildId);
    const nums = Object.keys(tickets).map(Number);
    return nums.length === 0 ? 1 : Math.max(...nums) + 1;
}

module.exports = {
    loadConfig, saveConfig,
    loadTickets, saveTickets,
    getTicketByChannel, getTicketByUser,
    createTicket, closeTicket, nextTicketNumber
};
