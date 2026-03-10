const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    productCode: { type: String, required: true, unique: true },
    productName: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    hsnCode: { type: String, required: true },
    gstPercentage: { type: Number, required: true },
    basePrice: { type: Number, required: true },
    mrp: { type: Number, required: true },
    uom: { type: String, enum: ['Nos', 'Set', 'Box', 'Rft'], required: true },
    productImageUrl: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    mgr1: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr2: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr3: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr4: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    mgr5: { type: mongoose.Schema.Types.ObjectId, ref: 'MGR' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Product', ProductSchema);
