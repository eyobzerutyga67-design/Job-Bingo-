const { Telegraf } = require('telegraf');
const express = require('express');
const https = require('https');
const app = express();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "8852120494:AAGxTDoAtrwJ_wLm46JJD_3umqtxEP8LcZ8";
const WEB_APP_URL = "https://job-bingo.onrender.com";

app.use(express.json());
app.use(express.static('public'));

// Prevent caching for WebApp static files
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

const bot = new Telegraf(BOT_TOKEN);

// Global Game State
let gameState = {
    gameId: "36374",
    status: "WAITING",
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

// Fixed 1-Second Timer Engine
setInterval(() => {
    try {
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

                if (gameState.calledNumbers.length >= 8) {
                    gameState.status = "WINNER";
                    gameState.timer = 10;
                    gameState.winner = {
                        player: "aemro (*9025)",
                        prize: gameState.derash > 0 ? gameState.derash : 152,
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
    } catch (err) {
        console.error("Timer error:", err);
    }
}, 1000);

// Keep Alive Self-Ping for Render Free Tier
setInterval(() => {
    https.get(WEB_APP_URL, (res) => {
        console.log(`[Keep-Alive] Ping status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error("[Keep-Alive] Ping failed:", err.message);
    });
}, 4 * 60 * 1000);

// Telegram Command Reply Handler
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

// Express Web App Endpoints
app.get('/api/game/state', (req, res) => res.json(gameState));

app.post('/api/game/select-card', (req, res) => {
    const { cardId } = req.body;
    if (gameState.status !== "WAITING") {
        return res.json({ success: false, message: "Game in progress" });
    }
    if (!gameState.selectedCards.includes(cardId)) {
        gameState.selectedCards.push(cardId);
        gameState.derash += gameState.stake;
        gameState.playersCount = gameState.selectedCards.length;
    }
    res.json({ success: true, selectedCards: gameState.selectedCards, derash: gameState.derash });
});

// Start Express and Bot Listener
app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
    
    bot.launch({ dropPendingUpdates: true })
        .then(() => console.log('>>> Telegram Bot Listener is LIVE! <<<'))
        .catch(err => console.error('Telegram Bot Launch Failed:', err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
