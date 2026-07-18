const XLSX = require('xlsx');
const wb = XLSX.readFile('D:/tally/Quotations/Ularia_1+3M FY27 Revenue Plan_09_04_26R.xlsx');
console.log('Sheet names:', JSON.stringify(wb.SheetNames));
wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    console.log(`\nSheet: "${name}", Rows: ${range.e.r+1}, Cols: ${range.e.c+1}`);
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    for(let i=0; i<Math.min(50, rows.length); i++) {
        const row = rows[i] || [];
        const display = row.slice(0, 25).map(c => c === '' ? '' : c);
        console.log(`R${i}: ${JSON.stringify(display)}`);
    }
});
