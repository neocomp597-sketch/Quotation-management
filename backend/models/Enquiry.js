const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
    enquiryNo: { type: String, required: true, unique: true },
    enquiryDate: { type: Date, required: true, default: Date.now },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    refReceivedFrom: { type: String }, // OUR Ref. received from
    followUpDate: { type: Date },      // To handle Followup date time action
    
    // Line items captured in the table
    items: [{
        productName: { type: String, required: true },
        quantity: { type: Number, required: true },
        uom: { type: String, enum: ['Pcs', 'Set', 'Ltr', 'Pack', 'Doz'], default: 'Pcs' },
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
    }],

    status: { type: String, enum: ['Open', 'Won', 'Lost'], default: 'Open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Enquiry', EnquirySchema);
