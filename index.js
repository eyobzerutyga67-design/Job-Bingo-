const { Telegraf } = require('telegraf');
const express = require('express');
const https = require('https');
const app = express();

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || "8852120494:AAGxTDoAtrwJ_wLm46JJD_3umqtxEP8LcZ8";
const WEB_APP_URL = "https://job-bingo.onrender.com";

app.use(express.json());
app.use(express.static('public'));

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
    status: "WAITING", // WAITING (40s) -> CALCULATING (5s) -> PLAYING -> WINNER (10s)
    timer: 40,
    stake: 10,
    playersCount: 0,
    derash: 0,
    currentBall: null,
    calledNumbers: [],
    userCards: {}, // Stores user-selected card IDs & generated 5x5 matrices
    winner: null,
    ballColors: { B: "🟢", I: "🟡", N: "🔴", G: "🔵", O: "🟢" }
};

// Deterministic 5x5 Bingo Card Generator for IDs 1-500
function generateBingoCard(cardId) {
    const seed = cardId * 1000;
    const getCol = (min, max, offset) => {
        let nums = [];
        for (let i = min; i <= max; i++) nums.push(i);
        let result = [];
        for (let i = 0; i < 5; i++) {
            let idx = (seed + offset + i * 7) % nums.length;
            result.push(nums.splice(idx, 1)[0]);
        }
        return result;
    };

    let b = getCol(1, 15, 1);
    let i = getCol(16, 30, 2);
    let n = getCol(31, 45, 3);
    let g = getCol(46, 60, 4);
    let o = getCol(61, 75, 5);

    n[2] = "FREE"; // Center Free Slot

    let matrix = [];
    for (let row = 0; row < 5; row++) {
        matrix.push([b[row], i[row], n[row], g[row], o[row]]);
    }
    return matrix;
}

function getBallInfo(num) {
    if (!num) return null;
    let letter = "B";
    if (num >= 16 && num <= 30) letter = "I";
    else if (num >= 31 && num <= 45) letter = "N";
    else if (num >= 46 && num <= 60) letter = "G";
    else if (num >= 61 && num <= 75) letter = "O";
    
    return {
        number: num,
        letter: letter,
        color: gameState.ballColors[letter],
        formatted: `${gameState.ballColors[letter]} ${letter}-${num}`
    };
}

function resetGame() {
    gameState.gameId = Math.floor(10000 + Math.random() * 90000).toString();
    gameState.status = "WAITING";
    gameState.timer = 40;
    gameState.currentBall = null;
    gameState.calledNumbers = [];
    gameState.userCards = {};
    gameState.winner = null;
    gameState.derash = 0;
    gameState.playersCount = 0;
}

// 1-Second Master Loop
setInterval(() => {
    try {
        if (gameState.status === "WAITING") {
            if (gameState.timer > 0) {
                gameState.timer--;
            } else {
                gameState.status = "CALCULATING";
                gameState.timer = 5;
            }
        } else if (gameState.status === "CALCULATING") {
            if (gameState.timer > 0) {
                gameState.timer--;
            } else {
                // Auto-assign 1 card if user selected 0 cards
                const cardKeys = Object.keys(gameState.userCards);
                if (cardKeys.length === 0) {
                    const autoId = Math.floor(Math.random() * 500) + 1;
                    gameState.userCards[autoId] = generateBingoCard(autoId);
                    gameState.derash += gameState.stake;
                    gameState.playersCount = 1;
                }
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
                gameState.currentBall = getBallInfo(nextNum);

                if (gameState.calledNumbers.length >= 8) {
                    const activeCards = Object.keys(gameState.userCards);
                    const winningCardId = activeCards[0] || 65;

                    gameState.status = "WINNER";
                    gameState.timer = 10;
                    gameState.winner = {
                        player: "aemro (*9025)",
                        prize: gameState.derash > 0 ? gameState.derash : 30,
                        cardId: winningCardId,
                        cardMatrix: gameState.userCards[winningCardId] || generateBingoCard(winningCardId)
                    };
                }
            } else {
                gameState.status = "WINNER";
                gameState.timer = 10;
                gameState.winner = { player: "House (*0000)", prize: 0, cardId: 1, cardMatrix: generateBingoCard(1) };
            }
        } else if (gameState.status === "WINNER") {
            if (gameState.timer > 0) {
                gameState.timer--;
            } else {
                resetGame();
            }
        }
    } catch (err) {
        console.error("Game loop error:", err);
    }
}, 1000);

// Keep-Alive Self-Ping
setInterval(() => {
    https.get(WEB_APP_URL, (res) => {}).on('error', () => {});
}, 4 * 60 * 1000);

// Telegram Commands
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

// API Endpoints
app.get('/api/game/state', (req, res) => res.json(gameState));

app.post('/api/game/select-card', (req, res) => {
    const { cardId } = req.body;
    if (gameState.status !== "WAITING") {
        return res.json({ success: false, message: "Selection closed" });
    }
    const currentKeys = Object.keys(gameState.userCards);
    if (currentKeys.length >= 4 && !gameState.userCards[cardId]) {
        return res.json({ success: false, message: "Maximum 4 cards allowed per game" });
    }

    if (gameState.userCards[cardId]) {
        delete gameState.userCards[cardId];
        gameState.derash -= gameState.stake;
    } else {
        gameState.userCards[cardId] = generateBingoCard(cardId);
        gameState.derash += gameState.stake;
    }

    gameState.playersCount = Object.keys(gameState.userCards).length;
    res.json({ success: true, userCards: gameState.userCards, derash: gameState.derash });
});

// Start express server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    bot.launch({ dropPendingUpdates: true })
        .then(() => console.log('>>> Telegram Bot Listener is LIVE! <<<'))
        .catch(err => console.error('Telegram Bot Launch Error:', err));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
