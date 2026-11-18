const Customer = require('../models/Customer');
const EmployeeProfile = require('../models/EmployeeProfile');
const Product = require('../models/Product');

/**
 * Searching serial numbers by customer or product. The screens show these from their masters, while
 * a serial only keeps a copy of the names: blank on serials saved by invoices and the warranty and
 * ticket imports, and old after a rename. So the masters are searched as well, in the whole company
 * as the screens' own lookups are, because a serial's customer can be of another branch. The rest of
 * each list's filter still limits the rows to the user's branch and MGR access.
 */

// What was typed, as a pattern: regex characters are plain text, and a space matches any run of
// spaces because the screen shows double and non-breaking spaces as one.
const searchPattern = (text) => new RegExp(
    String(text ?? '').trim()
        .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
        .replace(/\s+/g, '[\\s\\xA0]+'),
    'i'
);

/**
 * The customers and products whose name or code matches `pattern`. An employee's customer also
 * matches on the External Employee ID and email, which Serial No Transfer shows for them.
 */
const matchingMasterIds = async (companyId, pattern) => {
    const employeeIds = await EmployeeProfile.find({ companyId, $or: [{ externalEmployeeCode: pattern }, { email: pattern }] }).distinct('_id');
    const [customerIds, productIds] = await Promise.all([
        Customer.find({
            companyId,
            $or: [{ companyName: pattern }, { customerName: pattern }, { externalCode: pattern }, { employeeProfileId: { $in: employeeIds } }]
        }).distinct('_id'),
        Product.find({ companyId, $or: [{ productName: pattern }, { productCode: pattern }] }).distinct('_id')
    ]);
    return { customerIds, productIds };
};

/** Conditions for searching serials on every column of Invoice Bulk Upload. */
const assetSearchConditions = async (companyId, text) => {
    const pattern = searchPattern(text);
    const { customerIds, productIds } = await matchingMasterIds(companyId, pattern);
    return [
        { serialNumber: pattern },
        { productCode: pattern },
        { productName: pattern },
        { invoiceNumber: pattern },
        { customerNameStr: pattern },
        { customerCode: pattern },
        { customerId: { $in: customerIds } },
        { productId: { $in: productIds } }
    ];
};

module.exports = { searchPattern, matchingMasterIds, assetSearchConditions };
