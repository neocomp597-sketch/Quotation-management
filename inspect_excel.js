const XLSX = require('./backend/node_modules/xlsx');
try {
    const wb = XLSX.readFile('D:/tally/Quotations/sale ragistor.xlsx');
    const ws = wb.Sheets[wb.SheetNames[0]];
    const d = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log('Sheets:', JSON.stringify(wb.SheetNames));
    console.log('Headers:', JSON.stringify(d[0]));
    console.log('Row1:', JSON.stringify(d[1]));
    console.log('Row2:', JSON.stringify(d[2]));
    console.log('Row3:', JSON.stringify(d[3]));
} catch(e) { console.error(e.message); }
