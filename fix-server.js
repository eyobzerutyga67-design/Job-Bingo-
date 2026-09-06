const fs = require('fs');

let serverContent = fs.readFileSync('server.js', 'utf8');

// Replace the game evaluation loop to explicitly check checkBingoWin
const updatedContent = serverContent.replace(
    /for\s*\(\s*let\s+cardId\s+in\s+gameState\.userCards\s*\)\s*\{[\s\S]*?break;\s*\}/g,
    `for (let cardId in gameState.userCards) {
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
            }`
);

fs.writeFileSync('server.js', updatedContent);
console.log("server.js updated successfully!");
