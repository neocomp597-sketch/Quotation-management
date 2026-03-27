const cloneVendors = (vendors = []) => {
    return vendors.map(v => {
        const plain = v?.toObject ? v.toObject() : { ...v };
        return {
            ...plain,
            price: Number(plain.price || 0),
            stock: Number(plain.stock || 0),
            isPrimary: Boolean(plain.isPrimary)
        };
    });
};

const isVendorActive = (vendorEntry) => {
    if (!vendorEntry || !vendorEntry.vendorId) return true;
    if (typeof vendorEntry.vendorId === 'object' && vendorEntry.vendorId !== null) {
        if (typeof vendorEntry.vendorId.isActive === 'boolean') {
            return vendorEntry.vendorId.isActive;
        }
    }
    return true;
};

const sortVendorsByPriority = (vendors = []) => {
    const normalized = cloneVendors(vendors);
    return normalized.sort((a, b) => {
        const aHasStock = a.stock > 0;
        const bHasStock = b.stock > 0;
        if (aHasStock && !bHasStock) return -1;
        if (!aHasStock && bHasStock) return 1;

        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;

        return a.price - b.price;
    });
};

const getBestVendorForProduct = (product) => {
    const vendors = (product?.vendors || []).filter(isVendorActive);
    if (!vendors.length) return null;

    const primary = vendors.find(v => v.isPrimary && Number(v.stock) > 0);
    if (primary) return primary;

    const available = vendors
        .filter(v => Number(v.stock) > 0)
        .sort((a, b) => Number(a.price) - Number(b.price));
    if (available.length) return available[0];

    const sorted = sortVendorsByPriority(vendors);
    return sorted[0] || null;
};

const deriveBasePriceFromVendors = (product) => {
    const bestVendor = getBestVendorForProduct(product);
    if (!bestVendor) return Number(product?.basePrice || 0);
    return Number(bestVendor.price || 0);
};

module.exports = {
    sortVendorsByPriority,
    getBestVendorForProduct,
    deriveBasePriceFromVendors,
    isVendorActive
};
