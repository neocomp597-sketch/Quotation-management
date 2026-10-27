/**
 * Customer Postal Code for Invoice Bulk Upload records (Asset).
 *
 * The Customer Master is the source of truth for a customer's pincode. An asset
 * keeps a copy of the pincode its customer had when the entry was uploaded, but
 * every read prefers the linked customer's current billing pincode, so adding or
 * changing the pincode in the Customer Master shows on entries uploaded before
 * it, whichever screen or import made the change. The stored copy is used only
 * when the customer has no pincode or could not be resolved.
 */

const mongoose = require('mongoose');

const isPopulatedCustomer = (customer) =>
    Boolean(customer) && typeof customer === 'object' && !(customer instanceof mongoose.Types.ObjectId);

// Same normalisation as when an entry is created: 6 digits when the value has them.
const normalisePincode = (raw) => {
    const value = String(raw || '').trim();
    const digits = value.replace(/\D/g, '');
    return digits.length === 6 ? digits : value;
};

/** The postal code to show for an asset whose `customerId` is populated. */
const customerPostalCodeOf = (doc) => {
    if (!doc) return '';
    const customer = doc.customerId;
    const livePincode = isPopulatedCustomer(customer)
        ? normalisePincode(customer.billingAddress?.pincode || customer.pincode)
        : '';
    return livePincode || String(doc.customerPostalCode || '').trim();
};

/** Overwrite a read asset's customerPostalCode with the Customer Master value. */
const applyCustomerPostalCode = (doc) => {
    if (!doc || typeof doc !== 'object') return doc;
    doc.customerPostalCode = customerPostalCodeOf(doc);
    return doc;
};

module.exports = {
    normalisePincode,
    customerPostalCodeOf,
    applyCustomerPostalCode
};
