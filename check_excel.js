const XLSX = require('xlsx');

const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
console.log('Reading file:', filePath);

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheet names:', workbook.SheetNames);
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('Total rows:', rows.length);
    console.log('First 15 rows:');
    for (let i = 0; i < Math.min(15, rows.length); i++) {
        console.log(`${i}:`, JSON.stringify(rows[i]).substring(0, 200));
    }
} catch (err) {
    console.error('Error:', err.message);
}