const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN || "8852120494:AAGxTDoAtrwJ_wLm46JJD_3umqtxEP8LcZ8";
const WEB_APP_URL = "https://job-bingo.onrender.com";

const bot = new Telegraf(BOT_TOKEN);

function sendLobbyMenu(ctx) {
    const freshUrl = `${WEB_APP_URL}?v=${Date.now()}`;
    return ctx.reply('🎮 *Welcome to Best Bingo!*', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: "🎯 ENTER GAME LOBBY", web_app: { url: freshUrl } }]]
        }
    });
}

bot.start((ctx) => sendLobbyMenu(ctx));
bot.command('play', (ctx) => sendLobbyMenu(ctx));
bot.command('deposit', (ctx) => sendLobbyMenu(ctx));

bot.launch({ dropPendingUpdates: true })
    .then(() => console.log('✅ Telegram Bot Listener connected!'))
    .catch(err => console.error('❌ Telegram Bot Error:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
