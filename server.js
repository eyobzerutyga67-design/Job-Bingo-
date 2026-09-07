const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fisher-Yates shuffle algorithm for complete randomness
function shuffleArray(arr) {
    let a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Generate unique non-overlapping Bingo card
function generateBingoCard() {
    const makeRange = (min, max) => Array.from({length: max - min + 1}, (_, i) => min + i);
    
    let b = shuffleArray(makeRange(1, 15)).slice(0, 5);
    let i = shuffleArray(makeRange(16, 30)).slice(0, 5);
    let n = shuffleArray(makeRange(31, 45)).slice(0, 5);
    let g = shuffleArray(makeRange(46, 60)).slice(0, 5);
    let o = shuffleArray(makeRange(61, 75)).slice(0, 5);

    n[2] = "FREE";

    let matrix = [];
    for (let row = 0; row < 5; row++) {
        matrix.push([b[row], i[row], n[row], g[row], o[row]]);
    }
    return matrix;
}

function checkBingoWin(matrix, calledNumbers) {
    if (!matrix || !Array.isArray(matrix)) return false;
    const calledSet = new Set((calledNumbers || []).map(n => Number(n)));

    const isMarked = (val) => (val === 'FREE' || val === 'F') || calledSet.has(Number(val));

    for (let r = 0; r < 5; r++) {
        if (matrix[r].every(val => isMarked(val))) return true;
    }
    for (let c = 0; c < 5; c++) {
        if ([0,1,2,3,4].every(r => isMarked(matrix[r][c]))) return true;
    }
    if ([0,1,2,3,4].every(idx => isMarked(matrix[idx][idx]))) return true;
    if ([0,1,2,3,4].every(idx => isMarked(matrix[idx][4 - idx]))) return true;
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

setInterval(() => {
    if (gameState.status === 'WAITING') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            if (Object.keys(gameState.userCards).length > 0) {
                gameState.status = 'PLAYING';
                gameState.calledNumbers = [];
                gameState.winner = null;
                remainingBalls = shuffleArray(Array.from({ length: 75 }, (_, i) => i + 1));
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
                    gameState.winner = { player: 'Player', prize: gameState.derash, cardId, cardMatrix: matrix };
                    gameState.timer = 10;
                    break;
                }
            }
        } else {
            resetGame();
        }
    } else if (gameState.status === 'WINNER') {
        gameState.timer--;
        if (gameState.timer <= 0) resetGame();
    }
}, 1500);

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

app.get('/api/game/state', (req, res) => res.json(gameState));

app.post('/api/game/select-card', (req, res) => {
    const { cardId } = req.body;
    if (gameState.status !== 'WAITING') {
        return res.json({ success: false, message: 'Game in progress.' });
    }

    const key = String(cardId);
    if (gameState.userCards[key]) {
        delete gameState.userCards[key];
    } else {
        gameState.userCards[key] = generateBingoCard();
    }

    gameState.derash = Object.keys(gameState.userCards).length * 10;
    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
