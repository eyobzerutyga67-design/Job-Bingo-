const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Generate standard 5x5 matrix where B=Col0, I=Col1, N=Col2, G=Col3, O=Col4
function generateBingoCard(cardId) {
    const numericId = parseInt(cardId, 10);
    const seed = numericId * 1000;
    
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

    n[2] = "FREE"; // Center Free Space

    let matrix = [];
    for (let r = 0; r < 5; r++) {
        matrix.push([b[r], i[r], n[r], g[r], o[r]]);
    }
    return matrix;
}

// Check standard Bingo rules (Requires 5 marked tiles in a valid line or 4 corners)
function checkBingoWin(matrix, calledNumbers) {
    if (!matrix || !Array.isArray(matrix)) return false;

    const calledSet = new Set(calledNumbers.map(n => Number(n)));

    const isMarked = (val) => {
        if (val === 'FREE' || val === 'F') return true;
        return calledSet.has(Number(val));
    };

    // 1. Check Horizontal Rows (5 matched)
    for (let r = 0; r < 5; r++) {
        let win = true;
        for (let c = 0; c < 5; c++) {
            if (!isMarked(matrix[r][c])) {
                win = false;
                break;
            }
        }
        if (win) return true;
    }

    // 2. Check Vertical Columns (5 matched)
    for (let c = 0; c < 5; c++) {
        let win = true;
        for (let r = 0; r < 5; r++) {
            if (!isMarked(matrix[r][c])) {
                win = false;
                break;
            }
        }
        if (win) return true;
    }

    // 3. Diagonal Top-Left to Bottom-Right
    if (
        isMarked(matrix[0][0]) &&
        isMarked(matrix[1][1]) &&
        isMarked(matrix[2][2]) &&
        isMarked(matrix[3][3]) &&
        isMarked(matrix[4][4])
    ) {
        return true;
    }

    // 4. Diagonal Top-Right to Bottom-Left
    if (
        isMarked(matrix[0][4]) &&
        isMarked(matrix[1][3]) &&
        isMarked(matrix[2][2]) &&
        isMarked(matrix[3][1]) &&
        isMarked(matrix[4][0])
    ) {
        return true;
    }

    // 5. Four Outer Corners
    if (
        isMarked(matrix[0][0]) &&
        isMarked(matrix[0][4]) &&
        isMarked(matrix[4][0]) &&
        isMarked(matrix[4][4])
    ) {
        return true;
    }

    return false;
}

let gameState = {
    status: 'WAITING',
    timer: 30,
    derash: 0,
    playersCount: 0,
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

            let foundWinner = false;
            for (let cardId in gameState.userCards) {
                const matrix = gameState.userCards[cardId];
                if (checkBingoWin(matrix, gameState.calledNumbers) === true) {
                    gameState.status = 'WINNER';
                    gameState.winner = {
                        player: 'aemro (*9025)',
                        prize: gameState.derash || 40,
                        cardId: cardId,
                        cardMatrix: matrix
                    };
                    gameState.timer = 10;
                    foundWinner = true;
                    break;
                }
            }

            if (!foundWinner && remainingBalls.length === 0) {
                gameState.status = 'WAITING';
                gameState.timer = 30;
                gameState.winner = null;
                gameState.calledNumbers = [];
                gameState.userCards = {};
                gameState.playersCount = 0;
                gameState.derash = 0;
            }
        } else {
            gameState.status = 'WAITING';
            gameState.timer = 30;
            gameState.winner = null;
            gameState.calledNumbers = [];
            gameState.userCards = {};
            gameState.playersCount = 0;
            gameState.derash = 0;
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

    gameState.playersCount = Object.keys(gameState.userCards).length > 0 ? 1 : 0;
    gameState.derash = Object.keys(gameState.userCards).length * 10;

    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
