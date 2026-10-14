const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Asset = require('../models/Asset');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const AssetHistory = require('../models/AssetHistory');

const WORKBOOK = process.argv.slice(2).find((arg) => arg !== '--apply') || 'C:/Users/wagho/Downloads/invoice upload.xlsx';
const COMPANY_ID = new mongoose.Types.ObjectId('6a8bf304ac99b5d51a116954');
const BRANCH_ID = new mongoose.Types.ObjectId('6a927734d38fc49a298a500a');
const apply = process.argv.includes('--apply');
const BATCH_SIZE = 1000;

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const firstValue = (row, keys) => {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return '';
};
const serialKey = (value) => clean(value).toUpperCase();
const statusOf = (value) => {
    const text = clean(value).toUpperCase().replace(/[\s_-]+/g, '');
    if (text.includes('ALLOCAT')) return 'ALLOCATED';
    if (text.includes('SOLD')) return 'SOLD';
    if (text.includes('RETURN')) return 'RETURN';
    if (text.includes('SCRAP')) return 'SCRAPPED';
    return 'IN_STOCK';
};
const dateOf = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : null;
    }
    const text = clean(value);
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (match) {
        const [, day, month, rawYear] = match;
        const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
        return new Date(Date.UTC(year, Number(month) - 1, Number(day)));
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

async function bulkWrite(collection, operations) {
    for (let start = 0; start < operations.length; start += BATCH_SIZE) {
        await collection.bulkWrite(operations.slice(start, start + BATCH_SIZE), { ordered: false });
    }
}

async function main() {
    const workbook = XLSX.readFile(WORKBOOK, { cellDates: true });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
    const recordsBySerial = new Map();
    for (const row of rows) {
        const serialNumber = clean(firstValue(row, ['Serial Number', 'Serial No', 'Serial No.']));
        if (!serialNumber) continue;
        const key = serialKey(serialNumber);
        if (recordsBySerial.has(key)) continue;
        recordsBySerial.set(key, {
            serialNumber,
            serialNumberKey: key,
            productCode: clean(row['Product Code']) || 'UNSPECIFIED',
            productName: clean(row['Product Name']) || clean(row['Product Code']) || 'Unspecified Product',
            customerCode: clean(row['Customer Code']),
            customerName: clean(row['Customer Name']),
            customerMobile: clean(row['Mobile Number']),
            invoiceNumber: clean(firstValue(row, ['Invoice Ref', 'Invoice Ref No', 'Invoice Number'])),
            saleDate: dateOf(row['Sale Date']),
            status: statusOf(row.Status),
            location: clean(row.Location) || 'USGOAN',
            projectCode: clean(firstValue(row, ['Project Code', 'ProjectCode'])),
            projectName: clean(row['Project Name']),
            indicatorField: clean(row['Indicator_Field']).slice(0, 20),
        });
    }
    const records = [...recordsBySerial.values()];
    const productCodes = [...new Set(records.map((row) => row.productCode))];
    const customerKeys = [...new Set(records.filter((row) => row.customerCode || row.customerName).map((row) => (row.customerCode || row.customerName).toUpperCase()))];

    await mongoose.connect(process.env.MONGO_URI);
    const [existingProducts, branchCustomers, unassignedCustomers, existingAssets] = await Promise.all([
        Product.collection.find({ companyId: COMPANY_ID, productCode: { $in: productCodes } }, { projection: { _id: 1, productCode: 1 } }).toArray(),
        Customer.collection.find({ companyId: COMPANY_ID, branchId: BRANCH_ID, externalCode: { $in: customerKeys } }, { projection: { _id: 1, externalCode: 1 } }).toArray(),
        Customer.collection.find({ companyId: COMPANY_ID, branchId: null, externalCode: { $in: customerKeys } }, { projection: { _id: 1, externalCode: 1 } }).toArray(),
        Asset.collection.find({ companyId: COMPANY_ID, serialNumberKey: { $in: records.map((row) => row.serialNumberKey) } }, { projection: { _id: 1, serialNumberKey: 1, branchId: 1 } }).toArray(),
    ]);

    const productByCode = new Map(existingProducts.map((product) => [product.productCode, product._id]));
    const branchCustomerByKey = new Map(branchCustomers.map((customer) => [String(customer.externalCode).toUpperCase(), customer._id]));
    const unassignedCustomerByKey = new Map(unassignedCustomers.map((customer) => [String(customer.externalCode).toUpperCase(), customer._id]));
    const assetByKey = new Map(existingAssets.map((asset) => [asset.serialNumberKey, asset]));
    const summary = {
        sourceRows: rows.length,
        uniqueSerials: records.length,
        duplicateRowsSkipped: rows.length - records.length,
        productsToCreate: productCodes.filter((code) => !productByCode.has(code)).length,
        customersToCreate: 0,
        unassignedCustomersToAssign: 0,
        assetsToCreate: 0,
        assetsToUpdateInTargetBranch: 0,
        otherBranchSerialConflicts: 0,
        mode: apply ? 'apply' : 'dry-run',
    };

    for (const record of records) {
        const customerKey = (record.customerCode || record.customerName).toUpperCase();
        if (customerKey && !branchCustomerByKey.has(customerKey)) {
            if (unassignedCustomerByKey.has(customerKey)) summary.unassignedCustomersToAssign++;
            else summary.customersToCreate++;
        }
        const asset = assetByKey.get(record.serialNumberKey);
        if (!asset) summary.assetsToCreate++;
        else if (!asset.branchId || String(asset.branchId) === String(BRANCH_ID)) summary.assetsToUpdateInTargetBranch++;
        else summary.otherBranchSerialConflicts++;
    }
    console.log(JSON.stringify(summary, null, 2));
    if (!apply) return;

    const productOps = productCodes.filter((code) => !productByCode.has(code)).map((productCode) => {
        const source = records.find((record) => record.productCode === productCode);
        return { insertOne: { document: { companyId: COMPANY_ID, productCode, productName: source.productName, hsnCode: 'N/A', gstPercentage: 18, basePrice: 0, mrp: 0, uom: 'Nos', status: 'Active', createdAt: new Date(), updatedAt: new Date() } } };
    });
    await bulkWrite(Product.collection, productOps);
    const products = await Product.collection.find({ companyId: COMPANY_ID, productCode: { $in: productCodes } }, { projection: { _id: 1, productCode: 1 } }).toArray();
    products.forEach((product) => productByCode.set(product.productCode, product._id));

    const assignCustomerOps = [...unassignedCustomerByKey.values()].map((id) => ({ updateOne: { filter: { _id: id }, update: { $set: { branchId: BRANCH_ID } } } }));
    await bulkWrite(Customer.collection, assignCustomerOps);
    const newCustomerOps = [];
    for (const record of records) {
        const key = (record.customerCode || record.customerName).toUpperCase();
        if (!key || branchCustomerByKey.has(key) || unassignedCustomerByKey.has(key)) continue;
        branchCustomerByKey.set(key, null);
        newCustomerOps.push({ insertOne: { document: { companyId: COMPANY_ID, branchId: BRANCH_ID, externalCode: record.customerCode || record.customerName, customerName: record.customerName || record.customerCode, companyName: record.customerName || record.customerCode, mobile: record.customerMobile || '', createdAt: new Date() } } });
    }
    await bulkWrite(Customer.collection, newCustomerOps);
    const customers = await Customer.collection.find({ companyId: COMPANY_ID, branchId: BRANCH_ID, externalCode: { $in: customerKeys } }, { projection: { _id: 1, externalCode: 1 } }).toArray();
    customers.forEach((customer) => branchCustomerByKey.set(String(customer.externalCode).toUpperCase(), customer._id));

    const assetOps = [];
    const historyDocs = [];
    for (const record of records) {
        const current = assetByKey.get(record.serialNumberKey);
        if (current?.branchId && String(current.branchId) !== String(BRANCH_ID)) continue;
        const customerId = branchCustomerByKey.get((record.customerCode || record.customerName).toUpperCase()) || null;
        const payload = { branchId: BRANCH_ID, productId: productByCode.get(record.productCode), productCode: record.productCode, productName: record.productName, serialNumber: record.serialNumber, serialNumberKey: record.serialNumberKey, status: record.status, customerId, customerCode: record.customerCode, customerNameStr: record.customerName, customerMobile: record.customerMobile, invoiceNumber: record.invoiceNumber, saleDate: record.saleDate, location: record.location, projectCode: record.projectCode, projectName: record.projectName, indicatorField: record.indicatorField };
        if (current) {
            assetOps.push({ updateOne: { filter: { _id: current._id }, update: { $set: payload } } });
        } else {
            const _id = new mongoose.Types.ObjectId();
            assetOps.push({ insertOne: { document: { _id, companyId: COMPANY_ID, ...payload, createdAt: new Date(), installationDate: new Date() } } });
            historyDocs.push({ companyId: COMPANY_ID, branchId: BRANCH_ID, assetId: _id, serialNumber: record.serialNumber, productCode: record.productCode, productName: record.productName, productId: payload.productId, customerId, customerCode: record.customerCode, customerName: record.customerName, customerMobile: record.customerMobile, invoiceNumber: record.invoiceNumber, saleDate: record.saleDate, location: record.location, projectCode: record.projectCode, projectName: record.projectName, indicatorField: record.indicatorField, transactionType: 'IMPORT', status: record.status, createdAt: new Date() });
        }
    }
    await bulkWrite(Asset.collection, assetOps);
    for (let start = 0; start < historyDocs.length; start += BATCH_SIZE) await AssetHistory.collection.insertMany(historyDocs.slice(start, start + BATCH_SIZE), { ordered: false });
    console.log(JSON.stringify({ seededAssets: assetOps.length, createdHistory: historyDocs.length, skippedOtherBranchConflicts: summary.otherBranchSerialConflicts }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await mongoose.disconnect(); });