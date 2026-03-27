const XLSX = require('xlsx');
const path = require('path');

// Jaguar Bathroom Products Data
const products = [
    { productCode: 'JAG-BM-001', productName: 'Jaguar Single Lever Basin Mixer', hsnCode: '84818020', gstPercentage: 18, basePrice: 4500, mrp: 5800, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-SM-002', productName: 'Jaguar Single Lever Sink Mixer', hsnCode: '84818020', gstPercentage: 18, basePrice: 5200, mrp: 6700, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-WB-003', productName: 'Jaguar Wall Mounted Basin Tap', hsnCode: '84818020', gstPercentage: 18, basePrice: 2800, mrp: 3600, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-PC-004', productName: 'Jaguar Pillar Cock', hsnCode: '84818020', gstPercentage: 18, basePrice: 1800, mrp: 2400, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-BC-005', productName: 'Jaguar Bib Cock (Long Body)', hsnCode: '84818020', gstPercentage: 18, basePrice: 1500, mrp: 2000, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-AV-006', productName: 'Jaguar Angle Valve', hsnCode: '84818090', gstPercentage: 18, basePrice: 800, mrp: 1100, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-CS-007', productName: 'Jaguar Concealed Stop Cock', hsnCode: '84818090', gstPercentage: 18, basePrice: 1200, mrp: 1600, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-OS-008', productName: 'Jaguar Overhead Shower (Round)', hsnCode: '84242000', gstPercentage: 18, basePrice: 3500, mrp: 4500, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-HS-009', productName: 'Jaguar Hand Shower with Hose', hsnCode: '84242000', gstPercentage: 18, basePrice: 1800, mrp: 2400, uom: 'Set', status: 'Active' },
    { productCode: 'JAG-HF-010', productName: 'Jaguar Health Faucet (Jet Spray)', hsnCode: '84818020', gstPercentage: 18, basePrice: 950, mrp: 1300, uom: 'Set', status: 'Active' },
    { productCode: 'JAG-TM-011', productName: 'Jaguar Thermostatic Shower Mixer', hsnCode: '84818020', gstPercentage: 18, basePrice: 12500, mrp: 16000, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-SD-012', productName: 'Jaguar Concealed Shower Diverter (3-way)', hsnCode: '84818090', gstPercentage: 18, basePrice: 4800, mrp: 6200, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-TR-013', productName: 'Jaguar Towel Rod', hsnCode: '83024900', gstPercentage: 18, basePrice: 1200, mrp: 1600, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-TG-014', productName: 'Jaguar Towel Ring', hsnCode: '83024900', gstPercentage: 18, basePrice: 650, mrp: 900, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-SO-015', productName: 'Jaguar Soap Dish (Wall Mounted)', hsnCode: '83024900', gstPercentage: 18, basePrice: 550, mrp: 750, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-DP-016', productName: 'Jaguar Soap Dispenser', hsnCode: '84798999', gstPercentage: 18, basePrice: 1100, mrp: 1500, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-RH-017', productName: 'Jaguar Robe Hook', hsnCode: '83024900', gstPercentage: 18, basePrice: 450, mrp: 650, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-BS-018', productName: 'Jaguar Bathroom Shelf (Glass)', hsnCode: '83024900', gstPercentage: 18, basePrice: 1400, mrp: 1900, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-FD-019', productName: 'Jaguar Floor Drain / Grating', hsnCode: '73249090', gstPercentage: 18, basePrice: 850, mrp: 1150, uom: 'Nos', status: 'Active' },
    { productCode: 'JAG-FC-020', productName: 'Jaguar Flush Cock (Concealed)', hsnCode: '84818090', gstPercentage: 18, basePrice: 2200, mrp: 2900, uom: 'Nos', status: 'Active' },
];

// Convert to worksheet format with proper headers matching import template
const worksheetData = products.map(p => ({
    'Product Code': p.productCode,
    'Product Name': p.productName,
    'HSN Code': p.hsnCode,
    'GST %': p.gstPercentage,
    'Base Price': p.basePrice,
    'MRP': p.mrp,
    'UOM': p.uom,
    'Vendor Name': 'Sample Vendor',
    'Vendor Price': p.basePrice,
    'Vendor Stock': 10,
    'Is Primary': true,
    'Image URL': '',
    'Status': p.status
}));

// Create workbook and worksheet
const worksheet = XLSX.utils.json_to_sheet(worksheetData);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

// Set column widths
worksheet['!cols'] = [
    { wch: 15 },  // Product Code
    { wch: 40 },  // Product Name
    { wch: 12 },  // HSN Code
    { wch: 8 },   // GST %
    { wch: 12 },  // Base Price
    { wch: 12 },  // MRP
    { wch: 8 },   // UOM
    { wch: 20 },  // Vendor Name
    { wch: 12 },  // Vendor Price
    { wch: 12 },  // Vendor Stock
    { wch: 10 },  // Is Primary
    { wch: 30 },  // Image URL
    { wch: 10 },  // Status
];

// Save the file
const outputPath = path.join(__dirname, '..', 'jaguar_products_import.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Excel file created successfully at: ${outputPath}`);
console.log(`📦 Total products: ${products.length}`);
