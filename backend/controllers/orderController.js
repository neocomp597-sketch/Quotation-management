const SalesOrder = require('../models/SalesOrder');
const Quotation = require('../models/Quotation');
const Voucher = require('../models/Voucher');
const Counter = require('../models/Counter');
const CompanySettings = require('../models/CompanySettings');

// Helper to generate unique order number
const generateOrderNumber = async (prefix, year) => {
    const counter = await Counter.findOneAndUpdate(
        { type: 'sales_order', prefix, year },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const seqStr = counter.seq.toString().padStart(4, '0');
    return `${prefix}/${year}/${seqStr}`;
};

exports.createOrder = async (req, res) => {
    try {
        const {
            quotationId,
            customerId,
            customerName,
            items,
            subtotal,
            totalDiscount,
            grandTotal,
            deliveryDate
        } = req.body;

        const year = new Date().getFullYear();
        const settings = await CompanySettings.findOne({ companyId: req.user?.companyId }).lean();
        const prefix = settings?.orderPrefix || 'ARM/SO';
        const orderNumber = await generateOrderNumber(prefix, year);

        const newOrder = new SalesOrder({
            orderNumber,
            quotationId: quotationId || undefined,
            customerId,
            customerName,
            items,
            subtotal,
            totalDiscount,
            grandTotal,
            status: 'Draft',
            deliveryDate,
            createdBy: req.user?.id
        });

        await newOrder.save();

        // If created from a quote, update quote status to 'ordered'
        if (quotationId) {
            await Quotation.findByIdAndUpdate(quotationId, { status: 'ordered' });
        }

        res.status(201).json(newOrder);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const list = await SalesOrder.find({})
            .populate('customerId', 'customerName companyName')
            .sort({ createdAt: -1 })
            .lean();
        res.json(list);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getOrderById = async (req, res) => {
    try {
        const order = await SalesOrder.findById(req.params.id)
            .populate('customerId', 'customerName companyName billingAddress shippingAddress mobile email')
            .populate('quotationId', 'quotationNo')
            .lean();
        if (!order) return res.status(404).json({ message: 'Sales Order not found' });
        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const updated = await SalesOrder.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
        if (!updated) return res.status(404).json({ message: 'Sales Order not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        await SalesOrder.findByIdAndDelete(req.params.id);
        res.json({ message: 'Sales Order deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Convert Sales Order directly to Invoice Voucher
exports.convertToInvoice = async (req, res) => {
    try {
        const order = await SalesOrder.findById(req.params.id).lean();
        if (!order) return res.status(404).json({ message: 'Sales Order not found' });

        if (order.status === 'Cancelled') {
            return res.status(400).json({ message: 'Cancelled orders cannot be invoiced' });
        }

        // Generate Invoice Number
        const settings = await CompanySettings.findOne({ companyId: req.user?.companyId }).lean();
        const prefix = settings?.invoicePrefix || 'ARM/INV';
        const year = new Date().getFullYear();
        
        const counter = await Counter.findOneAndUpdate(
            { type: 'invoice', prefix, year },
            { $inc: { seq: 1 } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        const seqStr = counter.seq.toString().padStart(4, '0');
        const voucherNumber = `${prefix}/${year}/${seqStr}`;

        // Map items to voucher items
        const invoiceItems = order.items.map((item, idx) => {
            const qty = item.quantity || 1;
            const price = item.rate || 0;
            const amount = qty * price;
            const taxPercentage = item.productSnapshot?.gstPercentage || 18;
            const taxAmount = (amount * taxPercentage) / 100;
            
            return {
                srNumber: idx + 1,
                productId: item.productId,
                productName: item.productSnapshot?.productName || 'Catalog Product',
                qty,
                uom: item.productSnapshot?.uom || 'Nos',
                price,
                amount,
                taxPercentage,
                taxAmount
            };
        });

        const totalQty = invoiceItems.reduce((acc, curr) => acc + curr.qty, 0);
        const totalAmount = invoiceItems.reduce((acc, curr) => acc + curr.amount, 0);
        const totalTax = invoiceItems.reduce((acc, curr) => acc + curr.taxAmount, 0);
        const grandTotal = totalAmount + totalTax;

        const voucher = new Voucher({
            voucherType: 'Invoice',
            voucherNumber,
            date: new Date(),
            customerName: order.customerName,
            customerId: order.customerId,
            items: invoiceItems,
            totalQty,
            totalAmount,
            totalTax,
            grandTotal,
            companyId: req.user?.companyId
        });

        await voucher.save();

        // Update Sales Order state
        await SalesOrder.findByIdAndUpdate(order._id, { status: 'Completed' });

        res.status(201).json({ message: 'Converted to Invoice successfully', invoice: voucher });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
