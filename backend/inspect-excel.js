const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2] || 'D:/tally/Quotations/CUSTOMER MASTER WITH OCRD TABLE ALL COLUMNS AS ON 20-4-26(13.16PM) (2).xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length === 0) {
        console.log('File is empty');
        process.exit(0);
    }

    // First row contains headers
    const headers = data[0];
    console.log('=== Excel File Headers ===');
    console.log('Total columns:', headers.length);
    headers.forEach((h, i) => {
        console.log(`Column ${i + 1}: "${h}"`);
    });

    console.log('\n=== First Data Row ===');
    if (data.length > 1) {
        const firstRow = data[1];
        headers.forEach((header, i) => {
            console.log(`${header}: ${firstRow[i]}`);
        });
    }

    console.log('\n=== Total Data Rows (excluding header) ===');
    console.log(data.length - 1);
} catch (err) {
    console.error('Error reading file:', err.message);
    process.exit(1);
}
