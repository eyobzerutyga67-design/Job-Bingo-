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

// Seeded generator for 500 unique card layouts
function mulberry32(a) {
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function generateBingoCard(cardId) {
    const seed = parseInt(cardId, 10) || 1;
    const rng = mulberry32(seed * 100003 + 7);

    const getCol = (min, max) => {
        let pool = Array.from({length: max - min + 1}, (_, i) => min + i);
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
    for (let r = 0; r < 5; r++) {
        matrix.push([b[r], i[r], n[r], g[r], o[r]]);
    }
    return matrix;
}

function checkBingoWin(matrix, calledNumbers) {
    if (!matrix || !Array.isArray(matrix)) return { won: false };
    const calledSet = new Set((calledNumbers || []).map(n => Number(n)));
    const isMarked = (val) => (val === 'FREE' || val === 'F') || calledSet.has(Number(val));

    for (let r = 0; r < 5; r++) {
        if (matrix[r].every(val => isMarked(val))) return { won: true, pattern: `Row #${r + 1}` };
    }
    for (let c = 0; c < 5; c++) {
        if ([0,1,2,3,4].every(r => isMarked(matrix[r][c]))) return { won: true, pattern: `Column #${c + 1}` };
    }
    if ([0,1,2,3,4].every(idx => isMarked(matrix[idx][idx]))) return { won: true, pattern: 'Main Diagonal' };
    if ([0,1,2,3,4].every(idx => isMarked(matrix[idx][4 - idx]))) return { won: true, pattern: 'Anti Diagonal' };
    if (isMarked(matrix[0][0]) && isMarked(matrix[0][4]) && isMarked(matrix[4][0]) && isMarked(matrix[4][4])) {
        return { won: true, pattern: '4 Corners' };
    }

    return { won: false };
}

let gameState = {
    status: 'WAITING', // WAITING (45s) -> STARTING (5s) -> PLAYING -> WINNER (10s)
    timer: 45,
    derash: 0,
    calledNumbers: [],
    currentBall: null,
    winner: null,
    userCards: {}
};

let remainingBalls = [];

function shuffle(arr) {
    let a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function resetGame() {
    gameState.status = 'WAITING';
    gameState.timer = 45;
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
                gameState.status = 'STARTING';
                gameState.timer = 5;
            } else {
                gameState.timer = 45;
            }
        }
    } else if (gameState.status === 'STARTING') {
        gameState.timer--;
        if (gameState.timer <= 0) {
            gameState.status = 'PLAYING';
            gameState.calledNumbers = [];
            gameState.winner = null;
            remainingBalls = shuffle(Array.from({ length: 75 }, (_, i) => i + 1));
        }
    } else if (gameState.status === 'PLAYING') {
        if (remainingBalls.length > 0) {
            const nextNum = remainingBalls.pop();
            gameState.calledNumbers.push(nextNum);

            let letter = 'B', color = 'green';
            if (nextNum > 15 && nextNum <= 30) { letter = 'I'; color = 'yellow'; }
            else if (nextNum > 30 && nextNum <= 45) { letter = 'N'; color = 'red'; }
            else if (nextNum > 45 && nextNum <= 60) { letter = 'G'; color = 'blue'; }
            else if (nextNum > 60) { letter = 'O'; color = 'green'; }

            gameState.currentBall = { letter, number: nextNum, color };

            for (let key in gameState.userCards) {
                const item = gameState.userCards[key];
                const winCheck = checkBingoWin(item.matrix, gameState.calledNumbers);
                if (winCheck.won) {
                    gameState.status = 'WINNER';
                    gameState.winner = {
                        player: item.playerName || 'Player',
                        prize: gameState.derash,
                        cardId: item.cardId,
                        winPattern: winCheck.pattern,
                        cardMatrix: item.matrix
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
    const { cardId, userId, userName } = req.body;
    if (gameState.status !== 'WAITING') {
        return res.json({ success: false, message: 'Game in progress. Please wait for card selection stage.' });
    }

    const cId = parseInt(cardId, 10);
    if (isNaN(cId) || cId < 1 || cId > 500) {
        return res.json({ success: false, message: 'Select card between 1 and 500.' });
    }

    const playerKey = String(userId || 'user_default');
    let userCardCount = 0;
    let existingKeyForCard = null;

    for (let k in gameState.userCards) {
        if (gameState.userCards[k].ownerId === playerKey) {
            userCardCount++;
        }
        if (gameState.userCards[k].cardId === cId) {
            existingKeyForCard = k;
        }
    }

    if (existingKeyForCard) {
        if (gameState.userCards[existingKeyForCard].ownerId === playerKey) {
            delete gameState.userCards[existingKeyForCard];
        } else {
            return res.json({ success: false, message: 'Card taken by another player.' });
        }
    } else {
        if (userCardCount >= 4) {
            return res.json({ success: false, message: 'Maximum 4 cards allowed per player.' });
        }
        gameState.userCards[`${playerKey}_${cId}`] = {
            cardId: cId,
            ownerId: playerKey,
            playerName: userName || 'Player',
            matrix: generateBingoCard(cId)
        };
    }

    const totalCards = Object.keys(gameState.userCards).length;
    gameState.derash = totalCards * 10;

    res.json({ success: true, userCards: gameState.userCards });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
