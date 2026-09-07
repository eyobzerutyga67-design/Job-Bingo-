const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// Update calledNumbers check in renderWinnerModal to handle both String and Number types
html = html.replace(
    /calledNumbers\.includes\(val\)/g,
    'calledNumbers.map(n => String(n)).includes(String(val))'
);

fs.writeFileSync('public/index.html', html);
console.log("public/index.html updated successfully!");
