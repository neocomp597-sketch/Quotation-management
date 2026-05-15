const Voucher = require('../models/Voucher');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');

// Get all vouchers
exports.getVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find()
            .select('voucherNo voucherType date vendorId items totalAmount createdAt updatedAt')
            .sort({ createdAt: -1 })
            .populate('vendorId', 'name vendorName')
            .lean();
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vouchers', error: error.message });
    }
};

// Get single voucher
exports.getVoucherById = async (req, res) => {
    try {
        const voucher = await Voucher.findById(req.params.id).lean();
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }
        res.status(200).json(voucher);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching voucher details', error: error.message });
    }
};

// Create a new voucher
exports.createVoucher = async (req, res) => {
    try {
        const voucherData = req.body;
        
        // Ensure standard fields formatting
        voucherData.date = new Date(voucherData.date);
        
        // Prevent Mongoose CastError by deleting empty ObjectIds
        if (voucherData.vendorId === '') delete voucherData.vendorId;
        if (voucherData.items && Array.isArray(voucherData.items)) {
            voucherData.items.forEach(item => {
                if (item.productId === '') delete item.productId;
            });
        }
        
        const newVoucher = new Voucher(voucherData);
        await newVoucher.save();

        // Update Inventory in Products
        // Both Purchase and Sale Return effectively INCREASE the physical stock in hand
        for (const item of voucherData.items) {
            if (item.productId) {
                const product = await Product.findById(item.productId);
                if (product) {
                    let vendorUpdated = false;
                    const stockIncrease = Number(item.qty);

                    if (voucherData.vendorId) {
                        const vendorIndex = product.vendors.findIndex(
                            v => v.vendorId.toString() === voucherData.vendorId.toString()
                        );
                        
                        if (vendorIndex > -1) {
                            product.vendors[vendorIndex].stock += stockIncrease;
                            vendorUpdated = true;
                        } else {
                            // If vendor not in product vendor list, maybe add it
                            product.vendors.push({
                                vendorId: voucherData.vendorId,
                                price: item.price,
                                stock: stockIncrease,
                                isPrimary: product.vendors.length === 0
                            });
                            vendorUpdated = true;
                        }
                    }

                    if (!vendorUpdated && product.vendors.length > 0) {
                        // Fallback: increase stock of the primary or first vendor
                        let primaryIndex = product.vendors.findIndex(v => v.isPrimary);
                        if(primaryIndex === -1) primaryIndex = 0;
                        product.vendors[primaryIndex].stock += stockIncrease;
                    }
                    
                    await product.save();
                }
            }
        }

        res.status(201).json({ message: 'Voucher saved successfully', voucher: newVoucher });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Voucher Number already exists' });
        }
        res.status(500).json({ message: 'Error saving voucher', error: error.message });
    }
};

// Update voucher (optional, not specifically requested to update inventory on edit yet)
exports.updateVoucher = async (req, res) => {
    try {
        const voucherData = req.body;
        if (voucherData.vendorId === '') delete voucherData.vendorId;
        if (voucherData.items && Array.isArray(voucherData.items)) {
            voucherData.items.forEach(item => {
                if (item.productId === '') delete item.productId;
            });
        }

        const voucher = await Voucher.findByIdAndUpdate(req.params.id, voucherData, { new: true });
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }
        res.status(200).json({ message: 'Voucher updated', voucher });
    } catch (error) {
        res.status(500).json({ message: 'Error updating voucher', error: error.message });
    }
};

// Delete voucher
exports.deleteVoucher = async (req, res) => {
    try {
        const voucher = await Voucher.findByIdAndDelete(req.params.id);
        if (!voucher) {
            return res.status(404).json({ message: 'Voucher not found' });
        }
        res.status(200).json({ message: 'Voucher deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting voucher', error: error.message });
    }
};
