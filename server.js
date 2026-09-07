const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Seeded random number generator for consistent unique cards per ID
function getRandomNumbers(min, max, count, seedStr) {
    let numbers = [];
    for (let i = min; i <= max; i++) numbers.push(i);
    
    // Simple hash for seed
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
    }

    let result = [];
    for (let i = 0; i < count; i++) {
        let index = Math.abs(hash + i * 17) % numbers.length;
        result.push(numbers.splice(index, 1)[0]);
    }
    return result.sort((a, b) => a - b);
}

function generateBingoCard(cardId) {
    const idStr = String(cardId);
    let b = getRandomNumbers(1, 15, 5, idStr + '-B');
    let i = getRandomNumbers(16, 30, 5, idStr + '-I');
    let n = getRandomNumbers(31, 45, 5, idStr + '-N');
    let g = getRandomNumbers(46, 60, 5, idStr + '-G');
    let o = getRandomNumbers(61, 75, 5, idStr + '-O');

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

    const isMarked = (val) => {
        if (val === 'FREE' || val === 'F') return true;
        return calledSet.has(Number(val));
    };

    // Rows
    for (let r = 0; r < 5; r++) {
        if ([0,1,2,3,4].every(c => isMarked(matrix[r][c]))) return true;
    }
    // Columns
    for (let c = 0; c < 5; c++) {
        if ([0,1,2,3,4].every(r => isMarked(matrix[r][c]))) return true;
    }
    // Main Diagonal
    if ([0,1,2,3,4].every(i => isMarked(matrix[i][i]))) return true;
    // Anti Diagonal
    if ([0,1,2,3,4].every(i => isMarked(matrix[i][4 - i]))) return true;
    // 4 Corners
    if (isMarked(matrix[0][0]) && isMarked(matrix[0][4]) && isMarked(matrix[4][0]) && isMarked(matrix[4][4])) return true;

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
            if (Object.keys(gameState.userCards).length > 0) {
                gameState.status = 'PLAYING';
                gameState.calledNumbers = [];
                gameState.winner = null;
                remainingBalls = shuffle(Array.from({ length: 75 }, (_, index) => index + 1));
            } else {
                gameState.timer = 30; // Reset countdown if no cards selected
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
                        player: 'Player',
                        prize: gameState.derash,
                        cardId: cardId,
                        cardMatrix: matrix
                    };
                    gameState.timer = 10;
                    break;
                }
            }
        } else {
            resetToWaiting();
        }
    } else if (gameState.status === 'WINNER') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            resetToWaiting();
        }
    }
}, 1000);

function resetToWaiting() {
    gameState.status = 'WAITING';
    gameState.timer = 30;
    gameState.winner = null;
    gameState.calledNumbers = [];
    gameState.userCards = {};
    gameState.playersCount = 0;
    gameState.derash = 0;
    gameState.currentBall = null;
}

app.get('/api/game/state', (req, res) => {
    res.json(gameState);
});

app.post('/api/game/select-card', (req, res) => {
    const { cardId } = req.body;
    if (gameState.status !== 'WAITING') {
        return res.json({ success: false, message: 'Game in progress. Please wait for next round.' });
    }

    const key = String(cardId);
    if (gameState.userCards[key]) {
        delete gameState.userCards[key];
    } else {
        gameState.userCards[key] = generateBingoCard(key);
    }

    const totalSelected = Object.keys(gameState.userCards).length;
    gameState.playersCount = totalSelected > 0 ? 1 : 0;
    gameState.derash = totalSelected * 10;

    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
