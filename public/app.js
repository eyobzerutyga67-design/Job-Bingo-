function checkBingoWinClient(matrix, calledNumbers) {
    if (!matrix || !Array.isArray(matrix)) return false;

    const isMarked = (val) => val === 'FREE' || val === 'F' || calledNumbers.includes(val);

    // 1. Horizontal Rows (5 matched)
    for (let r = 0; r < 5; r++) {
        let rowWin = true;
        for (let c = 0; c < 5; c++) {
            if (!isMarked(matrix[r][c])) { rowWin = false; break; }
        }
        if (rowWin) return true;
    }

    // 2. Vertical Columns (5 matched)
    for (let c = 0; c < 5; c++) {
        let colWin = true;
        for (let r = 0; r < 5; r++) {
            if (!isMarked(matrix[r][c])) { colWin = false; break; }
        }
        if (colWin) return true;
    }

    // 3. Main Diagonal
    let diag1 = true;
    for (let i = 0; i < 5; i++) {
        if (!isMarked(matrix[i][i])) { diag1 = false; break; }
    }
    if (diag1) return true;

    // 4. Anti-Diagonal
    let diag2 = true;
    for (let i = 0; i < 5; i++) {
        if (!isMarked(matrix[i][4 - i])) { diag2 = false; break; }
    }
    if (diag2) return true;

    // 5. Four Corners
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
