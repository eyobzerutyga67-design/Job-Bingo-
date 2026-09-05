const { Telegraf } = require('telegraf');
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "8852120494:AAGxTDoAtrwJ_wLm46JJD_3umqtxEP8LcZ8";
const WEB_APP_URL = "https://job-bingo.onrender.com";

// Disable caching so Telegram WebApp always fetches live data
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.use(express.json());
app.use(express.static('public'));

const bot = new Telegraf(BOT_TOKEN);

// Global Game State Engine
let gameState = {
    gameId: "10001",
    status: "WAITING", // WAITING -> PLAYING -> WINNER
    timer: 40,
    stake: 10,
    playersCount: 0,
    derash: 0,
    currentBall: null,
    calledNumbers: [],
    selectedCards: [],
    winner: null
};

function resetGame() {
    gameState.gameId = Math.floor(10000 + Math.random() * 90000).toString();
    gameState.status = "WAITING";
    gameState.timer = 40;
    gameState.currentBall = null;
    gameState.calledNumbers = [];
    gameState.selectedCards = [];
    gameState.winner = null;
    gameState.derash = 0;
    gameState.playersCount = 0;
}

// Fixed 1-Second Server Ticker
setInterval(() => {
    if (gameState.status === "WAITING") {
        if (gameState.timer > 0) {
            gameState.timer--;
        } else {
            gameState.status = "PLAYING";
            gameState.timer = 0;
        }
    } else if (gameState.status === "PLAYING") {
        if (gameState.calledNumbers.length < 75) {
            let nextNum;
            do {
                nextNum = Math.floor(Math.random() * 75) + 1;
            } while (gameState.calledNumbers.includes(nextNum));

            gameState.calledNumbers.push(nextNum);
            gameState.currentBall = nextNum;

            // Trigger Winner view after 10 drawn balls for live test verification
            if (gameState.calledNumbers.length >= 10) {
                gameState.status = "WINNER";
                gameState.timer = 10;
                gameState.winner = {
                    player: "aemro (*9025)",
                    prize: gameState.derash > 0 ? gameState.derash : 150,
                    cardId: 9
                };
            }
        } else {
            gameState.status = "WINNER";
            gameState.timer = 10;
            gameState.winner = { player: "House (*0000)", prize: 0, cardId: 1 };
        }
    } else if (gameState.status === "WINNER") {
        if (gameState.timer > 0) {
            gameState.timer--;
        } else {
            resetGame();
        }
    }
}, 1000);

// Telegram Bot Commands
const getWebAppButton = () => ({
    reply_markup: {
        inline_keyboard: [[{ text: "🎯 ENTER GAME LOBBY", web_app: { url: `${WEB_APP_URL}?v=${Date.now()}` } }]]
    }
});

bot.start((ctx) => ctx.reply('🎮 *Welcome to Job Bingo!*', { parse_mode: 'Markdown', ...getWebAppButton() }));
bot.command('play', (ctx) => ctx.reply('🎮 *Entering Game Lobby...*', { parse_mode: 'Markdown', ...getWebAppButton() }));
bot.command('deposit', (ctx) => ctx.reply('💳 *Deposit Funds*\n\nTap below to open deposit screen:', { parse_mode: 'Markdown', ...getWebAppButton() }));

// Express API Routes
app.get('/api/game/state', (req, res) => res.json(gameState));

app.post('/api/game/select-card', (req, res) => {
    const { cardId } = req.body;
    if (gameState.status !== "WAITING") {
        return res.json({ success: false, message: "Game already in progress" });
    }
    if (!gameState.selectedCards.includes(cardId)) {
        gameState.selectedCards.push(cardId);
        gameState.derash += gameState.stake;
        gameState.playersCount = gameState.selectedCards.length;
    }
    res.json({ success: true, selectedCards: gameState.selectedCards, derash: gameState.derash });
});

// Serve frontend fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
bot.launch().catch(err => console.error("Bot launch error:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
