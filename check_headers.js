const XLSX = require('xlsx');
const path = require('path');

const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('First 10 rows:');
rows.slice(0, 10).forEach((row, i) => {
    console.log(`Row ${i}:`, row);
});