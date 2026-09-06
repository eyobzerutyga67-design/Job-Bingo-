let selectedCards = {};
let pollingInterval = null;

async function fetchGameState() {
    try {
        const res = await fetch('/api/game/state');
        const state = await res.json();
        updateUI(state);
    } catch (err) {
        console.error("Failed to fetch game state:", err);
    }
}

function updateUI(state) {
    // 1. Update Timer & Status Header
    const timerElem = document.getElementById('timer') || document.querySelector('.next-round');
    if (timerElem) {
        if (state.status === 'WAITING') {
            timerElem.innerText = `Next Round in: ${state.timer}s`;
        } else if (state.status === 'PLAYING') {
            timerElem.innerText = `Game in Progress...`;
        } else if (state.status === 'WINNER') {
            timerElem.innerText = `Winner Announced!`;
        }
    }

    // 2. Update Stats
    const derashElem = document.getElementById('derash-val');
    if (derashElem) derashElem.innerText = `${state.derash} ETB`;

    const playersElem = document.getElementById('players-val');
    if (playersElem) playersElem.innerText = state.playersCount;

    // 3. Highlight Called Numbers on UI Cards
    if (state.calledNumbers && state.calledNumbers.length > 0) {
        state.calledNumbers.forEach(num => {
            const cells = document.querySelectorAll(`.card-cell[data-num="${num}"]`);
            cells.forEach(cell => cell.classList.add('called'));
        });
    } else {
        // Reset highlights if round reset
        document.querySelectorAll('.card-cell').forEach(cell => {
            if (cell.innerText !== 'FREE' && cell.innerText !== 'F') {
                cell.classList.remove('called');
            }
        });
    }

    // 4. Handle Winner Popup (ONLY when server says WINNER)
    const winnerModal = document.getElementById('winner-modal');
    if (state.status === 'WINNER' && state.winner) {
        if (winnerModal) {
            winnerModal.style.display = 'flex';
            document.getElementById('winner-name').innerText = state.winner.player;
            document.getElementById('winner-prize').innerText = `${state.winner.prize} ETB`;
            document.getElementById('winner-card-id').innerText = `Card# ${state.winner.cardId}`;
        }
    } else {
        if (winnerModal) {
            winnerModal.style.display = 'none';
        }
    }
}

// Card Selection Handler
async function selectCard(cardId) {
    try {
        const res = await fetch('/api/game/select-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId })
        });
        const data = await res.json();
        if (data.success) {
            fetchGameState();
        } else {
            alert(data.message);
        }
    } catch (err) {
        console.error("Card selection failed:", err);
    }
}

// Start polling game state every second
setInterval(fetchGameState, 1000);
fetchGameState();
