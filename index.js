const { Telegraf } = require('telegraf');
const express = require('express');
const https = require('https');
const app = express();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "8852120494:AAGxTDoAtrwJ_wLm46JJD_3umqtxEP8LcZ8";
const WEB_APP_URL = "https://job-bingo.onrender.com";

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.use(express.json());
app.use(express.static('public'));

const bot = new Telegraf(BOT_TOKEN);

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

// Fixed 1-second background state ticker
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
    } catch (e) {
        console.error("Timer error:", e);
    }
}, 1000);

// Keep-Alive Self Ping (Prevents Render Free Tier from spinning down)
setInterval(() => {
    https.get(WEB_APP_URL, (res) => {
        console.log("Self-ping status:", res.statusCode);
    }).on('error', (e) => {
        console.error("Self-ping failed:", e.message);
    });
}, 5 * 60 * 1000); // Ping every 5 minutes

// Bot Handlers
function sendLobbyLink(ctx) {
    const freshUrl = `${WEB_APP_URL}?v=${Date.now()}`;
    return ctx.reply('🎮 *Welcome to Job Bingo!*', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: "🎯 ENTER GAME LOBBY", web_app: { url: freshUrl } }]]
        }
    });
}

bot.start((ctx) => sendLobbyLink(ctx));
bot.command('play', (ctx) => sendLobbyLink(ctx));
bot.command('deposit', (ctx) => sendLobbyLink(ctx));

// Endpoints
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

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
bot.launch().catch(err => console.error("Bot launch failed:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
