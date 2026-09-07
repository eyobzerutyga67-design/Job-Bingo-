const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Force Telegram webview to never cache static files or requests
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Generate 5 unique random numbers for column range without fixed sorting
function getRandomCol(min, max) {
    let pool = [];
    for (let i = min; i <= max; i++) pool.push(i);
    let result = [];
    for (let i = 0; i < 5; i++) {
        let idx = Math.floor(Math.random() * pool.length);
        result.push(pool.splice(idx, 1)[0]);
    }
    return result;
}

// Generate brand new unique card matrix
function generateBingoCard() {
    let b = getRandomCol(1, 15);
    let i = getRandomCol(16, 30);
    let n = getRandomCol(31, 45);
    let g = getRandomCol(46, 60);
    let o = getRandomCol(61, 75);

    n[2] = "FREE";

    let matrix = [];
    for (let r = 0; r < 5; r++) {
        matrix.push([b[r], i[r], n[r], g[r], o[r]]);
    }
    return matrix;
}

// Strict Bingo Win Checker (Requires complete 5-in-a-row or 4 corners)
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
    // Main Diagonal
    if ([0,1,2,3,4].every(idx => isMarked(matrix[idx][idx]))) return true;
    // Anti Diagonal
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
        gameState.userCards[key] = generateBingoCard();
    }

    const count = Object.keys(gameState.userCards).length;
    gameState.derash = count * 10;

    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
