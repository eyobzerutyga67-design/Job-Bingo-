const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Deterministic matrix generator for card IDs 1 to 500
function generateCardMatrix(cardId) {
    let seed = cardId * 16807;
    function rand() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }
    function getColumn(min, max, count) {
        let pool = [];
        for (let i = min; i <= max; i++) pool.push(i);
        for (let i = pool.length - 1; i > 0; i--) {
            let j = Math.floor(rand() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, count).sort((a, b) => a - b);
    }

    let b = getColumn(1, 15, 5);
    let colI = getColumn(16, 30, 5);
    let n = getColumn(31, 45, 5);
    let g = getColumn(46, 60, 5);
    let o = getColumn(61, 75, 5);

    let matrix = [];
    for (let r = 0; r < 5; r++) {
        let row = [
            b[r],
            colI[r],
            r === 2 ? 'FREE' : n[r],
            g[r],
            o[r]
        ];
        matrix.push(row);
    }
    return matrix;
}

// Game State Variables
let gameState = {
    status: 'WAITING', // WAITING -> STARTING -> PLAYING -> WINNER
    timer: 45,
    userCards: {}, // cardId -> { cardId, ownerId, userName, matrix }
    calledNumbers: [],
    currentBall: null,
    winner: null,
    derash: 0,
    stake: 10
};

let remainingBalls = [];

function resetGame() {
    gameState.status = 'WAITING';
    gameState.timer = 45;
    gameState.userCards = {};
    gameState.calledNumbers = [];
    gameState.currentBall = null;
    gameState.winner = null;
    gameState.derash = 0;
    
    remainingBalls = [];
    for (let i = 1; i <= 75; i++) remainingBalls.push(i);
    // Shuffle balls
    for (let i = remainingBalls.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [remainingBalls[i], remainingBalls[j]] = [remainingBalls[j], remainingBalls[i]];
    }
}

resetGame();

// Central Game Timer Loop (Runs every 1 second)
setInterval(() => {
    if (gameState.status === 'WAITING') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            gameState.status = 'STARTING';
            gameState.timer = 4; // 4s calculation phase
        }
    } else if (gameState.status === 'STARTING') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            gameState.status = 'PLAYING';
            gameState.timer = 0;
        }
    } else if (gameState.status === 'PLAYING') {
        if (remainingBalls.length > 0) {
            let num = remainingBalls.pop();
            gameState.calledNumbers.push(num);

            let letter = 'B';
            if (num >= 16 && num <= 30) letter = 'I';
            else if (num >= 31 && num <= 45) letter = 'N';
            else if (num >= 46 && num <= 60) letter = 'G';
            else if (num >= 61 && num <= 75) letter = 'O';

            gameState.currentBall = { letter, number: num };

            // Check if any card won
            checkWinner();
        } else {
            // No more balls
            gameState.status = 'WINNER';
            gameState.timer = 8;
        }
    } else if (gameState.status === 'WINNER') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            resetGame(); // Reset back to WAITING automatically
        }
    }
}, 1000);

function checkWinner() {
    let calledSet = new Set(gameState.calledNumbers.map(n => String(n)));
    calledSet.add('FREE');
    calledSet.add('F');

    for (let key in gameState.userCards) {
        let cardObj = gameState.userCards[key];
        let matrix = cardObj.matrix;

        // Check horizontal, vertical, diagonal lines
        let hasWon = false;

        // Horizontal
        for (let r = 0; r < 5; r++) {
            if (matrix[r].every(val => calledSet.has(String(val)))) hasWon = true;
        }
        // Vertical
        for (let c = 0; c < 5; c++) {
            let col = [matrix[0][c], matrix[1][c], matrix[2][c], matrix[3][c], matrix[4][c]];
            if (col.every(val => calledSet.has(String(val)))) hasWon = true;
        }

        if (hasWon) {
            gameState.status = 'WINNER';
            gameState.timer = 8; // Display winner screen for 8s
            gameState.winner = {
                player: cardObj.userName || 'Player',
                cardId: cardObj.cardId,
                prize: gameState.derash || 30,
                cardMatrix: matrix
            };
            break;
        }
    }
}

// API Endpoints
app.get('/api/game/state', (req, res) => {
    let playerCount = Object.keys(gameState.userCards).length;
    res.json({
        ...gameState,
        playerCount,
        derash: playerCount * gameState.stake
    });
});

app.get('/api/game/card-matrix/:cardId', (req, res) => {
    let cardId = parseInt(req.params.cardId) || 1;
    res.json({ cardId, matrix: generateCardMatrix(cardId) });
});

app.post('/api/game/select-card', (req, res) => {
    if (gameState.status !== 'WAITING') {
        return res.status(400).json({ success: false, message: 'Card selection closed for this round!' });
    }

    const { cardId, userId, userName } = req.body;
    if (gameState.userCards[cardId]) {
        if (gameState.userCards[cardId].ownerId === userId) {
            delete gameState.userCards[cardId];
            return res.json({ success: true, userCards: gameState.userCards });
        } else {
            return res.status(400).json({ success: false, message: 'Card already taken by another player!' });
        }
    }

    let matrix = generateCardMatrix(cardId);
    gameState.userCards[cardId] = { cardId, ownerId: userId, userName, matrix };
    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
