/**
 * Seed script: register the demo serial used by RCA-2026-001
 * (SN-VMC03-2026-09174) as a real asset so the Raise Ticket serial search
 * finds it and auto-fills customer and product.
 *
 * Creates the "Bajaj Auto Ltd., Chakan Plant" customer and the
 * STL-VCB-11KV-630A product when they are missing. Idempotent: safe to re-run.
 *
 * Usage:  node seed_rca_asset.js
 * Also called by seed_rca_report.js so the report and the asset stay in sync.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Customer = require('./models/Customer');
const Product = require('./models/Product');
const Asset = require('./models/Asset');
const AssetHistory = require('./models/AssetHistory');

const DEMO = {
    serialNumber: 'SN-VMC03-2026-09174',
    customer: {
        customerName: 'Bajaj Auto Ltd., Chakan Plant',
        companyName: 'Bajaj Auto Ltd., Chakan Plant',
        billingAddress: {
            line1: 'Plot No. 2, MIDC Chakan Industrial Area, Phase II',
            line2: 'Village Mahalunge, Taluka Khed',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '410501'
        },
        shippingAddress: {
            line1: 'Plot No. 2, MIDC Chakan Industrial Area, Phase II',
            line2: 'Village Mahalunge, Taluka Khed',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '410501'
        },
        mobile: '9822011184',
        email: 'maintenance.chakan@bajajauto.co.in',
        industry: 'Automotive',
        status: 'Active',
        segment: 'Enterprise'
    },
    product: {
        productCode: 'STL-VCB-11KV-630A',
        productName: '11kV Vacuum Circuit Breaker, 630A, 25kA, Indoor Panel Mounted – Model VCB-11/630',
        hsnCode: '85352190',
        gstPercentage: 18,
        basePrice: 185000,
        mrp: 215000,
        uom: 'Nos',
        status: 'Active',
        catalogType: 'Product',
        warrantyDetails: '24 months from date of invoice'
    },
    invoiceNumber: 'INV-2026-00847',
    saleDate: new Date('2026-03-12'),
    location: 'Chakan Plant – Cell-2 / CNC Shop Floor (VMC-03)'
};

const escapeRegex = (s) => String(s).replace(/[-\/\^$*+?.()|[\]{}]/g, '\$&');
const exactCI = (s) => new RegExp(`^${escapeRegex(String(s).trim())}$`, 'i');

/**
 * Ensure the demo customer, product, asset and history row exist for a company.
 * @param {{ companyId: any, userId?: any, log?: (msg: string) => void }} opts
 * @returns {Promise<{ customer: any, product: any, asset: any, created: { customer: boolean, product: boolean, asset: boolean } }>}
 */
async function ensureRcaDemoAsset({ companyId, userId = null, log = () => {} }) {
    if (!companyId) throw new Error('ensureRcaDemoAsset: companyId is required');
    const created = { customer: false, product: false, asset: false };

    // ── Customer ──────────────────────────────────────────────────────
    let customer = await Customer.findOne({ companyId, companyName: exactCI(DEMO.customer.companyName) });
    if (!customer) {
        customer = await Customer.create({ ...DEMO.customer, companyId, createdBy: userId || undefined });
        created.customer = true;
    }
    log(`${created.customer ? '➕ Created' : '✔️  Found'} customer: ${customer.companyName} (${customer._id})`);

    // ── Product ───────────────────────────────────────────────────────
    let product = await Product.findOne({ companyId, productCode: exactCI(DEMO.product.productCode) });
    if (!product) {
        product = await Product.create({ ...DEMO.product, companyId });
        created.product = true;
    }
    log(`${created.product ? '➕ Created' : '✔️  Found'} product: ${product.productCode} (${product._id})`);

    // ── Asset (serial number) ─────────────────────────────────────────
    const warrantyStart = DEMO.saleDate;
    const warrantyEnd = new Date(DEMO.saleDate);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + 24);

    let asset = await Asset.findOne({ companyId, serialNumber: exactCI(DEMO.serialNumber) });
    if (!asset) {
        asset = await Asset.create({
            companyId,
            customerId: customer._id,
            customerCode: customer.externalCode || '',
            customerNameStr: customer.companyName || customer.customerName,
            customerPostalCode: customer.billingAddress?.pincode || '',
            customerMobile: customer.mobile || '',
            productId: product._id,
            productCode: product.productCode,
            productName: product.productName,
            serialNumber: DEMO.serialNumber,
            status: 'SOLD',
            invoiceNumber: DEMO.invoiceNumber,
            invoiceDate: DEMO.saleDate,
            saleDate: DEMO.saleDate,
            warrantyStart,
            warrantyEnd,
            assignedAt: DEMO.saleDate,
            installationDate: DEMO.saleDate,
            location: DEMO.location,
            createdBy: userId || undefined
        });
        created.asset = true;

        await AssetHistory.create({
            companyId,
            assetId: asset._id,
            serialNumber: DEMO.serialNumber,
            productCode: product.productCode,
            productName: product.productName,
            productId: product._id,
            customerId: customer._id,
            customerCode: customer.externalCode || '',
            customerName: customer.companyName || customer.customerName,
            customerPostalCode: customer.billingAddress?.pincode || '',
            customerMobile: customer.mobile || '',
            invoiceNumber: DEMO.invoiceNumber,
            saleDate: DEMO.saleDate,
            location: DEMO.location,
            transactionType: 'SINGLE_ENTRY',
            status: 'SOLD',
            createdBy: userId || undefined
        });
    }
    log(`${created.asset ? '➕ Registered' : '✔️  Found'} asset: ${asset.serialNumber} (${asset._id}) status=${asset.status}`);

    return { customer, product, asset, created };
}

module.exports = { ensureRcaDemoAsset, DEMO };

if (require.main === module) {
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    (async () => {
        try {
            await mongoose.connect(process.env.MONGO_URI);
            console.log('✅ Connected to MongoDB');

            const user = await User.findOne({ email: 'super@gmail.com' });
            if (!user) {
                console.error('❌ User super@gmail.com not found');
                process.exit(1);
            }
            if (!user.companyId) {
                console.error('❌ User super@gmail.com has no companyId');
                process.exit(1);
            }
            console.log(`👤 Found user: ${user.name || user.email}  (companyId: ${user.companyId})`);

            await ensureRcaDemoAsset({ companyId: user.companyId, userId: user._id, log: (m) => console.log('   ' + m) });
            console.log(`\n🎉 Serial ${DEMO.serialNumber} is now registered and searchable from Raise Ticket.\n`);
        } catch (err) {
            console.error('❌ Error:', err);
            process.exitCode = 1;
        } finally {
            await mongoose.disconnect();
            console.log('🔌 Disconnected from MongoDB');
        }
    })();
}
