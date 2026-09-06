const { checkBingoWin } = require('./server.js');

// Test Matrix: Standard Layout
const sampleMatrix = [
    [ 1, 16, 31, 46, 61],
    [ 2, 17, 32, 47, 62],
    [ 3, 18, "FREE", 48, 63],
    [ 4, 19, 34, 49, 64],
    [ 5, 20, 35, 50, 65]
];

// Test 1: Random numbers drawn, no complete line (Should be FALSE)
const randomCalls = [1, 16, 32, 49, 65, 3, 20];
console.log("No complete line test:", checkBingoWin(sampleMatrix, randomCalls) === false ? "PASSED" : "FAILED");

// Test 2: Complete Row 1 (1, 16, 31, 46, 61) (Should be TRUE)
const row1Calls = [1, 16, 31, 46, 61];
console.log("Row 1 Win test:", checkBingoWin(sampleMatrix, row1Calls) === true ? "PASSED" : "FAILED");
