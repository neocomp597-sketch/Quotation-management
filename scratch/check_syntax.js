const fs = require('fs');
const path = require('path');

const file1 = path.join(__dirname, '..', 'frontend', 'src', 'components', 'SearchableSelect.jsx');
const file2 = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'CSMTickets.jsx');

console.log('File 1 exists:', fs.existsSync(file1));
console.log('File 2 exists:', fs.existsSync(file2));

const content1 = fs.readFileSync(file1, 'utf8');
const content2 = fs.readFileSync(file2, 'utf8');

console.log('SearchableSelect.jsx lines:', content1.split('\n').length);
console.log('CSMTickets.jsx lines:', content2.split('\n').length);
