let selectedCards = [];
let drawnNumbers = [];
let currentView = 'pick';

document.addEventListener('DOMContentLoaded', () => {
    renderCardPicker();
    renderVerticalBoard();
    pollServer();
    setInterval(pollServer, 1000);
});

function switchView(view) {
    currentView = view;
    if (view === 'pick') {
        document.getElementById('viewPick').style.display = 'grid';
        document.getElementById('viewGame').style.display = 'none';
        document.getElementById('btnPickView').classList.add('active');
        document.getElementById('btnGameView').classList.remove('active');
    } else {
        document.getElementById('viewPick').style.display = 'none';
        document.getElementById('viewGame').style.display = 'flex';
        document.getElementById('btnPickView').classList.remove('active');
        document.getElementById('btnGameView').classList.add('active');
    }
}

function renderCardPicker() {
    const grid = document.getElementById('viewPick');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 1; i <= 500; i++) {
        const btn = document.createElement('button');
        btn.className = `picker-btn ${selectedCards.includes(i) ? 'taken' : ''}`;
        btn.innerText = i;
        btn.onclick = () => selectCardNumber(i);
        grid.appendChild(btn);
    }
}

async function selectCardNumber(num) {
    try {
        const res = await fetch('/api/game/select-card', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId: num })
        });
        const data = await res.json();
        if (data.success) {
            selectedCards = data.selectedCards;
            document.getElementById('derashVal').innerText = `${data.derash} ETB`;
            renderCardPicker();
        }
    } catch (e) { console.error(e); }
}

function renderVerticalBoard() {
    const board = document.getElementById('vBoardGrid');
    if (!board) return;
    board.innerHTML = '';
    for (let i = 1; i <= 75; i++) {
        const cell = document.createElement('div');
        cell.className = `v-cell ${drawnNumbers.includes(i) ? 'called' : ''}`;
        cell.innerText = i;
        board.appendChild(cell);
    }
}

async function pollServer() {
    try {
        const res = await fetch('/api/game/state?t=' + Date.now());
        if (!res.ok) return;
        const state = await res.json();

        document.getElementById('derashVal').innerText = `${state.derash} ETB`;
        document.getElementById('playersVal').innerText = state.playersCount;
        document.getElementById('callCount').innerText = `${state.calledNumbers.length}/75`;
        selectedCards = state.selectedCards || [];

        const timerSpan = document.getElementById('timerVal');
        const modal = document.getElementById('winnerModal');

        if (state.status === "WAITING") {
            if (timerSpan) timerSpan.innerText = `${state.timer}s`;
            if (modal) modal.style.display = 'none';
            drawnNumbers = [];
            document.getElementById('ballCallBox').innerText = "B--";
            renderVerticalBoard();
        } else if (state.status === "PLAYING") {
            if (timerSpan) timerSpan.innerText = "Game Started!";
            if (modal) modal.style.display = 'none';

            if (currentView === 'pick' && state.calledNumbers.length === 1) {
                switchView('game');
            }

            if (state.currentBall) {
                document.getElementById('ballCallBox').innerText = `${getLetter(state.currentBall)}${state.currentBall}`;
                if (!drawnNumbers.includes(state.currentBall)) {
                    drawnNumbers.push(state.currentBall);
                    renderVerticalBoard();
                }
            }
        } else if (state.status === "WINNER") {
            if (timerSpan) timerSpan.innerText = `Winner Display (${state.timer}s)`;
            if (state.winner) {
                showWinnerModal(state.winner, state.timer);
            }
        }
    } catch (e) { console.error("Poll error:", e); }
}

function getLetter(num) {
    if (num <= 15) return 'B';
    if (num <= 30) return 'I';
    if (num <= 45) return 'N';
    if (num <= 60) return 'G';
    return 'O';
}

function showWinnerModal(w, countdown) {
    document.getElementById('winPlayer').innerText = w.player || "aemro (*9025)";
    document.getElementById('winPrize').innerText = `Prize: ${w.prize} ETB`;
    document.getElementById('winCardNo').innerText = `Card# ${w.cardId}`;
    document.getElementById('winTimer').innerText = countdown;

    const modalGrid = document.getElementById('modalCardGrid');
    if (modalGrid && modalGrid.children.length === 0) {
        modalGrid.innerHTML = '';
        const cardData = [
            [14, 8, 15, 11, 4],
            [28, 30, 29, 20, 16],
            [42, 43, 'F', 45, 34],
            [56, 53, 47, 46, 57],
            [70, 69, 65, 72, 61]
        ];

        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                const val = cardData[c][r];
                const cell = document.createElement('div');
                cell.className = 'm-cell';
                if (val === 'F') {
                    cell.classList.add('free');
                    cell.innerText = 'F';
                } else {
                    if ([8, 30, 29, 20, 16, 43, 45, 47, 46, 72].includes(val)) {
                        cell.classList.add('hit');
                    } else {
                        cell.classList.add('red-hit');
                    }
                    cell.innerText = val;
                }
                modalGrid.appendChild(cell);
            }
        }
    }

    const modal = document.getElementById('winnerModal');
    if (modal) modal.style.display = 'flex';
}
