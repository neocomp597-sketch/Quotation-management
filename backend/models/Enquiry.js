const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
    enquiryNo: { type: String, required: true },
    enquiryDate: { type: Date, required: true, default: Date.now },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    companyName: { type: String },
    contactPerson: { type: String },
    refReceivedFrom: { type: String }, // OUR Ref. received from
    followUpDate: { type: Date },      // To handle Followup date time action
    contactDesignation: { type: String },
    contactMobile: { type: String },
    contactEmail: { type: String },
    partners: [{
        name: { type: String },
        contactPerson: { type: String },
        mobile: { type: String },
        email: { type: String },
        notes: { type: String }
    }],
    siteAddress: { type: String },
    projectName: { type: String },
    requiredDeliveryDate: { type: Date },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    budget: { type: String },
    technicalSpecifications: { type: String },
    attachmentName: { type: String },
    
    // Line items captured in the table
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productCode: { type: String },
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        uom: { type: String, enum: ['Pcs', 'Nos', 'Kg', 'Meter', 'Set', 'Ltr', 'Pack', 'Doz', 'Mtr'], default: 'Pcs' },
        rate: { type: Number, default: 0 },
        price: { type: Number, default: 0 },
        discountPercent: { type: Number, default: 0 },
        value: { type: Number, default: 0 },
        actionStatus: { 
            type: String, 
            enum: [
                'VISIT CUSTOMER', 
                'Quotation given', 
                'Followup date time', 
                'quotation revise', 
                'quotation finalise', 
                'po received', 
                'enquiry won'
            ],
            default: 'VISIT CUSTOMER'
        },
        salespersonName: { type: String }, // Who handles customer
        agentName: { type: String },      // any agent or middle man
        
        // Vendor info per product
        vendors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],
        vendorQuotes: [{
            vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
            price: { type: Number },
            deliveryTime: { type: String },
            availability: { type: String },
            remarks: { type: String },
            probability: { type: Number, min: 0, max: 100 }
        }],
        finalVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }
    }],

    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    freight: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    status: { 
        type: String, 
        enum: ['New', 'Contacted', 'Quotation Pending', 'Quotation Received', 'Negotiation', 'Finalized', 'PO Received', 'Lost'], 
        default: 'New' 
    },
    closureReason: { type: String }, // captured when status changes to Lost or Finalized
    probability: { type: Number, min: 0, max: 100, default: 0 },
    remarks: { type: String },
    
    followUpHistory: [{
        date: { type: Date, default: Date.now },
        note: { type: String },
        actionType: { type: String, enum: ['Call', 'Email', 'Visit', 'Meeting', 'Other'], default: 'Call' },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    lastActivityDate: { type: Date, default: Date.now },
    lossReason: {
        type: String,
        enum: ['High Price', 'Slow Delivery', 'No Stock', 'Delayed Follow-up', 'Customer Dropped', 'Other']
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

// Auto-update lastActivityDate on any save/update
EnquirySchema.pre('save', function() {
    this.lastActivityDate = new Date();
});

// Auto-update lastActivityDate on findByIdAndUpdate
EnquirySchema.pre('findByIdAndUpdate', function() {
    this.set({ lastActivityDate: new Date() });
});

// Auto-update lastActivityDate on updateOne/updateMany
EnquirySchema.pre(['updateOne', 'updateMany'], function() {
    this.set({ lastActivityDate: new Date() });
});

const tenantPlugin = require('./plugins/tenantPlugin');
EnquirySchema.plugin(tenantPlugin);
EnquirySchema.index({ companyId: 1, enquiryNo: 1 }, { unique: true });
module.exports = mongoose.model('Enquiry', EnquirySchema);
