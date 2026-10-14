const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Asset = require('../models/Asset');
const AssetHistory = require('../models/AssetHistory');
const Warranty = require('../models/Warranty');
const Ticket = require('../models/Ticket');
const SerialTransfer = require('../models/SerialTransfer');
const BOMMaster = require('../models/BOMMaster');
const Voucher = require('../models/Voucher');

const apply = process.argv.includes('--apply');
const statusPriority = { SOLD: 3, ALLOCATED: 3, IN_STOCK: 3, SCRAPPED: 2, RETURN: 1, RETURNED: 1 };
const BATCH_SIZE = 1000;

async function bulkWriteInBatches(collection, operations) {
    for (let index = 0; index < operations.length; index += BATCH_SIZE) {
        await collection.bulkWrite(operations.slice(index, index + BATCH_SIZE), { ordered: false });
    }
}

async function repointCollection(model, redundantIds, replacementById) {
    const references = await model.collection.find(
        { assetId: { $in: redundantIds } },
        { projection: { _id: 1, assetId: 1 } }
    ).toArray();
    const operations = references.map((doc) => ({
        updateOne: { filter: { _id: doc._id }, update: { $set: { assetId: replacementById.get(String(doc.assetId)) } } }
    }));
    await bulkWriteInBatches(model.collection, operations);
    return references.length;
}

async function repointVoucherReferences(redundantIds, replacementById) {
    const vouchers = await Voucher.collection.find(
        { 'items.serialNumbers.assetId': { $in: redundantIds } },
        { projection: { _id: 1, items: 1 } }
    ).toArray();
    const operations = vouchers.map((voucher) => ({
        updateOne: {
            filter: { _id: voucher._id },
            update: {
                $set: {
                    items: voucher.items.map((item) => ({
                        ...item,
                        serialNumbers: (item.serialNumbers || []).map((serial) => ({
                            ...serial,
                            assetId: replacementById.get(String(serial.assetId)) || serial.assetId,
                        })),
                    })),
                },
            },
        },
    }));
    await bulkWriteInBatches(Voucher.collection, operations);
    return vouchers.length;
}

async function main() {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not configured.');
    await mongoose.connect(process.env.MONGO_URI);

    const assets = await Asset.collection.find(
        { serialNumber: { $type: 'string', $ne: '' } },
        { projection: { _id: 1, companyId: 1, serialNumber: 1, status: 1, createdAt: 1 } }
    ).toArray();
    const groups = new Map();
    for (const asset of assets) {
        const serialNumberKey = String(asset.serialNumber || '').trim().toUpperCase();
        if (!serialNumberKey || !asset.companyId) continue;
        const groupKey = `${asset.companyId}:${serialNumberKey}`;
        groups.set(groupKey, [...(groups.get(groupKey) || []), asset]);
    }

    const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
    const duplicateRows = duplicateGroups.reduce((count, group) => count + group.length - 1, 0);
    console.log(JSON.stringify({ groups: duplicateGroups.length, duplicateRows, mode: apply ? 'apply' : 'dry-run' }, null, 2));
    if (!apply) return;

    const replacementById = new Map();
    for (const group of duplicateGroups) {
        group.sort((a, b) => {
            const priority = (statusPriority[b.status] || 0) - (statusPriority[a.status] || 0);
            return priority || (new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        });
        const [keeper, ...redundant] = group;
        redundant.forEach((asset) => replacementById.set(String(asset._id), keeper._id));
    }
    const redundantIds = [...replacementById.keys()].map((id) => new mongoose.Types.ObjectId(id));

    const referenceCounts = {};
    for (const [name, model] of Object.entries({ AssetHistory, Warranty, Ticket, SerialTransfer, BOMMaster })) {
        referenceCounts[name] = await repointCollection(model, redundantIds, replacementById);
    }
    referenceCounts.Voucher = await repointVoucherReferences(redundantIds, replacementById);

    await Asset.collection.deleteMany({ _id: { $in: redundantIds } });
    const survivors = await Asset.collection.find(
        { serialNumber: { $type: 'string', $ne: '' } },
        { projection: { _id: 1, serialNumber: 1 } }
    ).toArray();
    await bulkWriteInBatches(Asset.collection, survivors.map((asset) => ({
        updateOne: {
            filter: { _id: asset._id },
            update: { $set: { serialNumber: String(asset.serialNumber).trim(), serialNumberKey: String(asset.serialNumber).trim().toUpperCase() } },
        },
    })));
    await Asset.createIndexes();
    console.log(JSON.stringify({ removedAssets: redundantIds.length, normalizedAssets: survivors.length, repointedReferences: referenceCounts }, null, 2));
}

main()
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(async () => { await mongoose.disconnect(); });