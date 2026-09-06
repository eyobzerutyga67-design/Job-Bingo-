const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Synchronized Card Generation Algorithm (Matches frontend exactly)
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

    n[2] = "FREE";

    let matrix = [];
    for (let row = 0; row < 5; row++) {
        matrix.push([b[row], i[row], n[row], g[row], o[row]]);
    }
    return matrix;
}

// Strict Bingo Pattern Checker (Row, Col, Diagonals, 4 Corners)
function checkBingoWin(matrix, calledNumbers) {
    if (!matrix || !Array.isArray(matrix)) return false;

    const isMarked = (val) => val === 'FREE' || calledNumbers.includes(val);

    // 1. Horizontal Rows
    for (let r = 0; r < 5; r++) {
        if (matrix[r].every(val => isMarked(val))) return true;
    }

    // 2. Vertical Columns
    for (let c = 0; c < 5; c++) {
        let colWin = true;
        for (let r = 0; r < 5; r++) {
            if (!isMarked(matrix[r][c])) {
                colWin = false;
                break;
            }
        }
        if (colWin) return true;
    }

    // 3. Top-Left to Bottom-Right Diagonal
    let diag1 = true;
    for (let i = 0; i < 5; i++) {
        if (!isMarked(matrix[i][i])) {
            diag1 = false;
            break;
        }
    }
    if (diag1) return true;

    // 4. Top-Right to Bottom-Left Diagonal
    let diag2 = true;
    for (let i = 0; i < 5; i++) {
        if (!isMarked(matrix[i][4 - i])) {
            diag2 = false;
            break;
        }
    }
    if (diag2) return true;

    // 5. Four Corners
    if (isMarked(matrix[0][0]) && isMarked(matrix[0][4]) && isMarked(matrix[4][0]) && isMarked(matrix[4][4])) {
        return true;
    }

    return false;
}

// Game State Storage
let gameState = {
    status: 'WAITING', // WAITING, CALCULATING, PLAYING, WINNER
    timer: 30,
    derash: 0,
    playersCount: 0,
    calledNumbers: [],
    currentBall: null,
    winner: null,
    userCards: {} // Stores active user cards
};

let remainingBalls = Array.from({ length: 75 }, (_, i) => i + 1);

// Shuffle Utility
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Game Loop Timer
setInterval(() => {
    if (gameState.status === 'WAITING') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            gameState.status = 'CALCULATING';
            gameState.timer = 5;
        }
    } else if (gameState.status === 'CALCULATING') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            gameState.status = 'PLAYING';
            gameState.calledNumbers = [];
            remainingBalls = shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
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

            // Check all selected active cards for wins
            for (let cardId in gameState.userCards) {
                const matrix = gameState.userCards[cardId];
                if (checkBingoWin(matrix, gameState.calledNumbers)) {
                    gameState.status = 'WINNER';
                    gameState.winner = {
                        player: 'aemro (*9025)',
                        prize: gameState.derash || 40,
                        cardId: cardId,
                        cardMatrix: matrix
                    };
                    gameState.timer = 10;
                    break;
                }
            }
        } else {
            gameState.status = 'WAITING';
            gameState.timer = 30;
        }
    } else if (gameState.status === 'WINNER') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            gameState.status = 'WAITING';
            gameState.timer = 30;
            gameState.winner = null;
            gameState.calledNumbers = [];
            gameState.userCards = {};
            gameState.playersCount = 0;
            gameState.derash = 0;
        }
    }
}, 1000);

// API Endpoints
app.get('/api/game/state', (req, res) => {
    res.json(gameState);
});

app.post('/api/game/select-card', (req, res) => {
    const { cardId } = req.body;
    if (gameState.status !== 'WAITING') {
        return res.json({ success: false, message: 'Game in progress. Wait for next round.' });
    }

    if (gameState.userCards[cardId]) {
        delete gameState.userCards[cardId];
    } else {
        gameState.userCards[cardId] = generateBingoCard(cardId);
    }

    gameState.playersCount = Object.keys(gameState.userCards).length > 0 ? 1 : 0;
    gameState.derash = Object.keys(gameState.userCards).length * 10;

    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
