const XLSX = require('xlsx');
const path = require('path');

// Arm Bathroom Products Data
const products = [
    { productCode: 'ARM-BM-001', productName: 'Arm Single Lever Basin Mixer', hsnCode: '84818020', gstPercentage: 18, basePrice: 4500, mrp: 5800, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-SM-002', productName: 'Arm Single Lever Sink Mixer', hsnCode: '84818020', gstPercentage: 18, basePrice: 5200, mrp: 6700, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-WB-003', productName: 'Arm Wall Mounted Basin Tap', hsnCode: '84818020', gstPercentage: 18, basePrice: 2800, mrp: 3600, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-PC-004', productName: 'Arm Pillar Cock', hsnCode: '84818020', gstPercentage: 18, basePrice: 1800, mrp: 2400, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-BC-005', productName: 'Arm Bib Cock (Long Body)', hsnCode: '84818020', gstPercentage: 18, basePrice: 1500, mrp: 2000, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-AV-006', productName: 'Arm Angle Valve', hsnCode: '84818090', gstPercentage: 18, basePrice: 800, mrp: 1100, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-CS-007', productName: 'Arm Concealed Stop Cock', hsnCode: '84818090', gstPercentage: 18, basePrice: 1200, mrp: 1600, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-OS-008', productName: 'Arm Overhead Shower (Round)', hsnCode: '84242000', gstPercentage: 18, basePrice: 3500, mrp: 4500, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-HS-009', productName: 'Arm Hand Shower with Hose', hsnCode: '84242000', gstPercentage: 18, basePrice: 1800, mrp: 2400, uom: 'Set', status: 'Active' },
    { productCode: 'ARM-HF-010', productName: 'Arm Health Faucet (Jet Spray)', hsnCode: '84818020', gstPercentage: 18, basePrice: 950, mrp: 1300, uom: 'Set', status: 'Active' },
    { productCode: 'ARM-TM-011', productName: 'Arm Thermostatic Shower Mixer', hsnCode: '84818020', gstPercentage: 18, basePrice: 12500, mrp: 16000, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-SD-012', productName: 'Arm Concealed Shower Diverter (3-way)', hsnCode: '84818090', gstPercentage: 18, basePrice: 4800, mrp: 6200, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-TR-013', productName: 'Arm Towel Rod', hsnCode: '83024900', gstPercentage: 18, basePrice: 1200, mrp: 1600, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-TG-014', productName: 'Arm Towel Ring', hsnCode: '83024900', gstPercentage: 18, basePrice: 650, mrp: 900, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-SO-015', productName: 'Arm Soap Dish (Wall Mounted)', hsnCode: '83024900', gstPercentage: 18, basePrice: 550, mrp: 750, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-DP-016', productName: 'Arm Soap Dispenser', hsnCode: '84798999', gstPercentage: 18, basePrice: 1100, mrp: 1500, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-RH-017', productName: 'Arm Robe Hook', hsnCode: '83024900', gstPercentage: 18, basePrice: 450, mrp: 650, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-BS-018', productName: 'Arm Bathroom Shelf (Glass)', hsnCode: '83024900', gstPercentage: 18, basePrice: 1400, mrp: 1900, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-FD-019', productName: 'Arm Floor Drain / Grating', hsnCode: '73249090', gstPercentage: 18, basePrice: 850, mrp: 1150, uom: 'Nos', status: 'Active' },
    { productCode: 'ARM-FC-020', productName: 'Arm Flush Cock (Concealed)', hsnCode: '84818090', gstPercentage: 18, basePrice: 2200, mrp: 2900, uom: 'Nos', status: 'Active' },
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
const outputPath = path.join(__dirname, '..', 'arm_products_import.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log(`✅ Excel file created successfully at: ${outputPath}`);
console.log(`📦 Total products: ${products.length}`);
