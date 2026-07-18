const XLSX = require('xlsx');

const filePath = 'D:/tally/Quotations/CUSTOMER MASTER WITH OCRD TABLE ALL COLUMNS AS ON 20-4-26(13.16PM) (2).xlsx';
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('First 5 rows:');
rows.slice(0, 5).forEach((row, i) => {
    console.log(`Row ${i}:`, row.slice(0, 10)); // first 10 columns
});