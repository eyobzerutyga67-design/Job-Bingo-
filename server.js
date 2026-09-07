const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Hardcoded 10 unique standard Bingo card layouts
const BINGO_CARDS = {
    "1": [
        [5, 18, 33, 52, 67],
        [12, 24, 40, 48, 71],
        [2, 29, "FREE", 59, 63],
        [9, 16, 37, 46, 75],
        [14, 27, 42, 55, 68]
    ],
    "2": [
        [8, 22, 35, 50, 61],
        [1, 19, 44, 57, 73],
        [11, 26, "FREE", 47, 69],
        [4, 30, 31, 54, 64],
        [15, 17, 39, 58, 70]
    ],
    "3": [
        [3, 21, 38, 49, 66],
        [10, 25, 32, 53, 74],
        [7, 20, "FREE", 56, 62],
        [13, 28, 41, 47, 72],
        [6, 16, 45, 60, 68]
    ],
    "4": [
        [14, 17, 36, 51, 65],
        [4, 29, 43, 58, 70],
        [9, 23, "FREE", 46, 75],
        [1, 20, 34, 59, 63],
        [11, 27, 40, 52, 69]
    ],
    "5": [
        [2, 26, 31, 55, 62],
        [15, 18, 45, 48, 72],
        [6, 22, "FREE", 54, 67],
        [10, 30, 37, 60, 71],
        [8, 24, 42, 49, 64]
    ],
    "6": [
        [12, 19, 41, 53, 74],
        [7, 28, 35, 47, 66],
        [3, 21, "FREE", 57, 68],
        [13, 25, 39, 50, 73],
        [5, 16, 33, 56, 61]
    ],
    "7": [
        [9, 30, 32, 58, 69],
        [11, 23, 38, 52, 64],
        [1, 17, "FREE", 48, 75],
        [15, 26, 44, 51, 67],
        [4, 22, 36, 59, 70]
    ],
    "8": [
        [6, 24, 40, 46, 63],
        [13, 20, 34, 56, 72],
        [10, 29, "FREE", 50, 65],
        [2, 18, 43, 54, 71],
        [8, 27, 37, 60, 66]
    ],
    "9": [
        [1, 28, 37, 57, 70],
        [5, 21, 42, 49, 68],
        [14, 25, "FREE", 53, 61],
        [7, 19, 35, 58, 74],
        [12, 30, 45, 46, 62]
    ],
    "10": [
        [10, 16, 39, 54, 67],
        [3, 27, 33, 60, 75],
        [8, 22, "FREE", 51, 64],
        [15, 24, 41, 47, 69],
        [2, 18, 38, 55, 73]
    ]
};

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
    // Four Corners
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
        if (BINGO_CARDS[key]) {
            gameState.userCards[key] = BINGO_CARDS[key];
        }
    }

    const count = Object.keys(gameState.userCards).length;
    gameState.derash = count * 10;

    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
