const path = require('path');
const XLSX = require('xlsx');

const excelPath = path.join(__dirname, '../../Employee Report Writer - 1509.xlsx');
const workbook = XLSX.readFile(excelPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);

const allKeys = new Set();
rows.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
console.log("All unique keys in Excel:", Array.from(allKeys));
console.log("Total rows:", rows.length);
console.log("Sample first 3 rows:");
console.log(rows.slice(0, 3));
