const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Prevent Telegram webview caching
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mulberry32 PRNG for deterministic card generation per card ID
function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Generate unique Bingo card for any cardId (Card #1, Card #2, etc.)
function generateBingoCard(cardId) {
    const seed = parseInt(cardId, 10) || 1;
    const rng = mulberry32(seed * 100003 + 7);

    const getCol = (min, max) => {
        let pool = [];
        for (let i = min; i <= max; i++) pool.push(i);
        let col = [];
        for (let i = 0; i < 5; i++) {
            let idx = Math.floor(rng() * pool.length);
            col.push(pool.splice(idx, 1)[0]);
        }
        return col;
    };

    let b = getCol(1, 15);
    let i = getCol(16, 30);
    let n = getCol(31, 45);
    let g = getCol(46, 60);
    let o = getCol(61, 75);

    n[2] = "FREE";

    let matrix = [];
    for (let row = 0; row < 5; row++) {
        matrix.push([b[row], i[row], n[row], g[row], o[row]]);
    }
    return matrix;
}

// Win Checker: Horizontal, Vertical, Diagonals, and 4 Corners
function checkBingoWin(matrix, calledNumbers) {
    if (!matrix || !Array.isArray(matrix)) return false;
    const calledSet = new Set((calledNumbers || []).map(n => Number(n)));

    const isMarked = (val) => {
        if (val === 'FREE' || val === 'F') return true;
        return calledSet.has(Number(val));
    };

    // Horizontal Rows
    for (let r = 0; r < 5; r++) {
        if (matrix[r].every(val => isMarked(val))) return true;
    }
    // Vertical Columns
    for (let c = 0; c < 5; c++) {
        if ([0,1,2,3,4].every(r => isMarked(matrix[r][c]))) return true;
    }
    // Diagonals
    if ([0,1,2,3,4].every(idx => isMarked(matrix[idx][idx]))) return true;
    if ([0,1,2,3,4].every(idx => isMarked(matrix[idx][4 - idx]))) return true;
    // 4 Corners
    if (isMarked(matrix[0][0]) && isMarked(matrix[0][4]) && isMarked(matrix[4][0]) && isMarked(matrix[4][4])) return true;

    return false;
}

let gameState = {
    status: 'WAITING',
    timer: 25,
    derash: 0,
    calledNumbers: [],
    currentBall: null,
    winner: null,
    userCards: {}
};

let remainingBalls = [];

function shuffle(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function resetGame() {
    gameState.status = 'WAITING';
    gameState.timer = 25;
    gameState.derash = 0;
    gameState.calledNumbers = [];
    gameState.currentBall = null;
    gameState.winner = null;
    gameState.userCards = {};
    remainingBalls = [];
}

setInterval(() => {
    if (gameState.status === 'WAITING') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            if (Object.keys(gameState.userCards).length > 0) {
                gameState.status = 'PLAYING';
                gameState.calledNumbers = [];
                gameState.winner = null;
                remainingBalls = shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
            } else {
                gameState.timer = 25;
            }
        }
    } else if (gameState.status === 'PLAYING') {
        if (remainingBalls.length > 0) {
            const nextNum = remainingBalls.pop();
            gameState.calledNumbers.push(nextNum);

            let letter = 'B';
            if (nextNum > 15) letter = 'I';
            if (nextNum > 30) letter = 'N';
            if (nextNum > 45) letter = 'G';
            if (nextNum > 60) letter = 'O';

            gameState.currentBall = { letter, number: nextNum };

            for (let cardId in gameState.userCards) {
                const matrix = gameState.userCards[cardId];
                if (checkBingoWin(matrix, gameState.calledNumbers)) {
                    gameState.status = 'WINNER';
                    gameState.winner = {
                        player: 'Player (*9025)',
                        prize: gameState.derash,
                        cardId: cardId,
                        cardMatrix: matrix
                    };
                    gameState.timer = 10;
                    break;
                }
            }
        } else {
            resetGame();
        }
    } else if (gameState.status === 'WINNER') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            resetGame();
        }
    }
}, 1500);

app.get('/api/game/state', (req, res) => {
    res.json(gameState);
});

app.post('/api/game/select-card', (req, res) => {
    const { cardId } = req.body;
    if (gameState.status !== 'WAITING') {
        return res.json({ success: false, message: 'Game in progress. Wait for next round.' });
    }

    const key = String(cardId);
    if (gameState.userCards[key]) {
        delete gameState.userCards[key];
    } else {
        gameState.userCards[key] = generateBingoCard(key);
    }

    const count = Object.keys(gameState.userCards).length;
    gameState.derash = count * 10;

    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
