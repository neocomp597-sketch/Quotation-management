const Product = require('../models/Product');
const { COMPONENT_TYPES, APPROVAL_STAGES } = require('../models/BOM');

const cleanText = (value) => String(value ?? '').trim();
const toKey = (value) => cleanText(value).toUpperCase();
const round = (value, places = 4) => Math.round((Number(value) || 0) * 10 ** places) / 10 ** places;
const toNumber = (value, fallback = 0) => {
    if (value === '' || value === null || value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
};

// Statuses in which the BOM content can still be edited by the preparer.
const EDITABLE_STATUSES = ['Draft', 'Revision Required'];
// Statuses that mean a revision is still being worked on, so no second revision may be opened.
const OPEN_STATUSES = ['Draft', 'Submitted', 'Under Review', 'Revision Required', 'Approved'];

// Permission key per approval stage. Release and obsolete belong to management.
const STAGE_PERMISSIONS = {
    Checked: 'eng_bom_check',
    Engineering: 'eng_bom_approve_engineering',
    Finance: 'eng_bom_approve_finance',
    Management: 'eng_bom_approve_management'
};

const PRODUCT_STATUS_BLOCKING = ['Inactive', 'Discontinued'];

const buildFamilyKey = ({ fgItemCode, plantId, alternativeBom }) => (
    [toKey(fgItemCode), String(plantId || ''), toKey(alternativeBom)].join('|')
);

const MATERIAL_FIELDS = 'productCode productName description uom catalogType status basePrice specifications categoryId mgr1';

const describeProduct = (product) => {
    if (!product) return null;
    const specs = product.specifications && typeof product.specifications === 'object'
        ? Object.entries(product.specifications)
            .filter(([, value]) => value !== '' && value !== null && typeof value !== 'object')
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
        : '';
    const catalogType = product.catalogType;
    return {
        productId: product._id,
        code: product.productCode,
        description: cleanText(product.productName) || cleanText(product.description),
        uom: product.uom || '',
        status: product.status || 'Active',
        rate: Number(product.basePrice) || 0,
        materialGroup: product.categoryId?.name || product.mgr1?.description || '',
        specification: specs,
        // Only map catalogue types that correspond 1:1 to a component type; the rest stay the user's choice.
        suggestedType: catalogType === 'Consumable' ? 'Consumable' : catalogType === 'Service' ? 'Service' : ''
    };
};

const findProductsByCode = async (codes) => {
    const variants = new Set();
    codes.filter(Boolean).forEach((code) => {
        variants.add(code);
        variants.add(code.toUpperCase());
        variants.add(code.toLowerCase());
    });
    if (!variants.size) return new Map();

    const products = await Product.find({ productCode: { $in: [...variants] } })
        .select(MATERIAL_FIELDS)
        .populate('categoryId', 'name')
        .populate('mgr1', 'description')
        .lean();

    const byKey = new Map();
    products.forEach((product) => {
        const key = toKey(product.productCode);
        if (!byKey.has(key)) byKey.set(key, describeProduct(product));
    });
    return byKey;
};

const searchMaterials = async (term, limit = 20) => {
    const q = cleanText(term);
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = q
        ? { $or: [{ productCode: new RegExp(`^${escaped}`, 'i') }, { productName: new RegExp(escaped, 'i') }] }
        : {};
    const products = await Product.find(query)
        .select(MATERIAL_FIELDS)
        .populate('categoryId', 'name')
        .populate('mgr1', 'description')
        .sort({ productCode: 1 })
        .limit(limit)
        .lean();
    return products.map(describeProduct);
};

/**
 * A row "has children" when the next row sits one level deeper. Such rows are assemblies whose
 * cost is the sum of their children, so they are not costed themselves (that would double count).
 */
const markParents = (components) => components.map((component, index) => ({
    ...component,
    hasChildren: index + 1 < components.length && components[index + 1].level > component.level
}));

const computeCost = (components) => {
    const cost = { material: 0, scrap: 0, packing: 0, total: 0 };
    markParents(components).forEach((component) => {
        if (component.hasChildren) return;
        const amount = (Number(component.qty) || 0) * (Number(component.rate) || 0);
        const scrap = amount * (Number(component.scrapPercent) || 0) / 100;
        if (component.componentType === 'Packing Material') cost.packing += amount;
        else cost.material += amount;
        cost.scrap += scrap;
    });
    cost.total = cost.material + cost.scrap + cost.packing;
    Object.keys(cost).forEach((key) => { cost[key] = round(cost[key], 2); });
    return cost;
};

/**
 * Normalises the editable part of a BOM coming from the form. Product Master fills description,
 * UOM and material group when the user left them blank, and supplies the default rate.
 */
const normalizeContent = (input, productsByCode) => {
    const isBlankRow = (raw) => !cleanText(raw.componentCode) && !cleanText(raw.description)
        && (raw.qty === '' || raw.qty === null || raw.qty === undefined);
    const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

    const components = (Array.isArray(input.components) ? input.components : []).filter((raw) => !isBlankRow(raw)).map((raw) => {
        const componentCode = cleanText(raw.componentCode);
        const product = productsByCode.get(toKey(componentCode));
        const qty = toNumber(raw.qty, NaN);
        const scrapPercent = toNumber(raw.scrapPercent, 0);
        const rateInput = toNumber(raw.rate, NaN);
        const rate = Number.isFinite(rateInput) ? rateInput : (product?.rate || 0);
        const component = {
            level: finiteOrNull(Math.trunc(toNumber(raw.level, 1))),
            componentCode: product ? product.code : componentCode,
            productId: product?.productId || null,
            description: cleanText(raw.description) || product?.description || '',
            componentType: COMPONENT_TYPES.includes(raw.componentType) ? raw.componentType : (product?.suggestedType || 'Raw Material'),
            materialGroup: cleanText(raw.materialGroup) || product?.materialGroup || '',
            qty: finiteOrNull(qty),
            uom: cleanText(raw.uom) || product?.uom || '',
            scrapPercent: finiteOrNull(scrapPercent),
            totalQty: Number.isFinite(qty) && Number.isFinite(scrapPercent) ? round(qty * (1 + scrapPercent / 100)) : 0,
            operationNo: cleanText(raw.operationNo),
            mandatory: raw.mandatory !== false && raw.mandatory !== 'No',
            rate: finiteOrNull(rate),
            remarks: cleanText(raw.remarks)
        };
        component.amount = round((Number.isFinite(qty) ? qty : 0) * (Number.isFinite(rate) ? rate : 0), 2);
        if (raw._id) component._id = raw._id;
        return component;
    });

    const operations = (Array.isArray(input.operations) ? input.operations : []).map((raw) => ({
        ...(raw._id ? { _id: raw._id } : {}),
        operationNo: cleanText(raw.operationNo),
        description: cleanText(raw.description),
        workCenter: cleanText(raw.workCenter),
        backflush: Boolean(raw.backflush),
        manualIssue: Boolean(raw.manualIssue),
        remarks: cleanText(raw.remarks)
    }));

    return { components, operations, cost: computeCost(components) };
};

/**
 * Checks a BOM before it can be submitted. Returns human-readable errors (blocking) and
 * warnings (shown, not blocking).
 */
const validateBOM = (bom, productsByCode) => {
    const errors = [];
    const warnings = [];

    if (!cleanText(bom.fgItemCode)) errors.push('FG Material Code is required.');
    if (!cleanText(bom.fgDescription)) errors.push('FG Material Description is required.');
    if (!bom.plantId) errors.push('Plant has not been selected.');
    if (!(Number(bom.baseQty) > 0)) errors.push('Base Quantity must be greater than 0.');
    if (!cleanText(bom.baseUom)) errors.push('Base UOM has not been selected.');
    if (!bom.effectiveFrom) errors.push('Effective From date is required.');
    if (bom.effectiveFrom && bom.effectiveTo && new Date(bom.effectiveTo) < new Date(bom.effectiveFrom)) {
        errors.push('Effective To cannot be earlier than Effective From.');
    }

    const components = bom.components || [];
    const operations = bom.operations || [];
    if (!components.length) errors.push('At least one component must be added.');

    const opNumbers = new Set();
    operations.forEach((operation, index) => {
        const label = `Operation row ${index + 1}`;
        if (!operation.operationNo) errors.push(`${label}: operation number is required.`);
        else if (opNumbers.has(toKey(operation.operationNo))) errors.push(`${label}: operation ${operation.operationNo} is listed twice.`);
        opNumbers.add(toKey(operation.operationNo));
        if (!operation.workCenter) warnings.push(`${label}: work center is blank.`);
    });

    // Parent path per row, to detect duplicates under the same parent.
    const parentStack = [];
    const seenUnderParent = new Map();
    const withParents = markParents(components);

    withParents.forEach((component, index) => {
        const row = `Row ${index + 1}${component.componentCode ? ` (${component.componentCode})` : ''}`;
        const product = productsByCode.get(toKey(component.componentCode));

        if (!Number.isInteger(component.level ?? NaN) || component.level < 1 || component.level > 9) {
            errors.push(`${row}: level must be a whole number from 1 to 9.`);
        } else if (index === 0 && component.level !== 1) {
            errors.push(`${row}: the first component must be at level 1.`);
        } else if (index > 0 && component.level > components[index - 1].level + 1) {
            errors.push(`${row}: level ${component.level} cannot follow level ${components[index - 1].level}; levels can only go one deeper at a time.`);
        }

        if (!component.componentCode) {
            errors.push(`${row}: component code is required.`);
        } else if (!product) {
            errors.push(`${row}: component code is not in Product Master.`);
        } else if (PRODUCT_STATUS_BLOCKING.includes(product.status)) {
            errors.push(`Component ${component.componentCode} is ${product.status.toLowerCase()} in Product Master.`);
        }
        if (component.componentCode && toKey(component.componentCode) === toKey(bom.fgItemCode)) {
            errors.push(`${row}: the FG itself cannot be one of its own components.`);
        }

        if (!Number.isFinite(component.qty ?? NaN)) errors.push(`${row}: quantity is missing.`);
        else if (component.qty <= 0) errors.push(`${row}: quantity must be greater than 0.`);
        if (!Number.isFinite(component.scrapPercent ?? NaN) || component.scrapPercent < 0 || component.scrapPercent >= 100) {
            errors.push(`${row}: scrap % must be between 0 and 99.99.`);
        }
        if (!Number.isFinite(component.rate ?? NaN) || component.rate < 0) errors.push(`${row}: rate must be 0 or more.`);
        if (!component.uom) errors.push(`${row}: UOM is required.`);

        if (component.operationNo && operations.length && !opNumbers.has(toKey(component.operationNo))) {
            errors.push(`${row}: operation ${component.operationNo} is not in the routing.`);
        }
        if (component.componentType === 'Sub-Assembly' && !component.hasChildren) {
            warnings.push(`${row}: marked as Sub-Assembly but has no lower-level components.`);
        }
        if (component.hasChildren && component.componentType !== 'Sub-Assembly' && component.componentType !== 'Semi-Finished') {
            warnings.push(`${row}: has lower-level components but its type is ${component.componentType}.`);
        }
        if (product && component.uom && product.uom && toKey(component.uom) !== toKey(product.uom)) {
            warnings.push(`${row}: UOM ${component.uom} differs from Product Master UOM ${product.uom}.`);
        }
        if (product && !(component.rate > 0)) {
            warnings.push(`${row}: no rate, so it is not included in the cost.`);
        }

        // Duplicate check: the same code may appear in different sub-assemblies, but not twice under one parent.
        if (Number.isInteger(component.level) && component.level >= 1) {
            parentStack.length = component.level - 1;
            const parentPath = parentStack.join('>');
            const dupKey = `${parentPath}#${toKey(component.componentCode)}`;
            if (component.componentCode) {
                if (seenUnderParent.has(dupKey)) {
                    errors.push(`${row}: duplicate of row ${seenUnderParent.get(dupKey)} under the same parent.`);
                } else {
                    seenUnderParent.set(dupKey, index + 1);
                }
            }
            parentStack[component.level - 1] = `${index}`;
        }
    });

    return { errors, warnings };
};

const nextStage = (stage) => {
    const index = APPROVAL_STAGES.indexOf(stage);
    return index >= 0 && index < APPROVAL_STAGES.length - 1 ? APPROVAL_STAGES[index + 1] : '';
};

module.exports = {
    EDITABLE_STATUSES,
    OPEN_STATUSES,
    STAGE_PERMISSIONS,
    buildFamilyKey,
    computeCost,
    findProductsByCode,
    searchMaterials,
    normalizeContent,
    validateBOM,
    nextStage,
    toKey,
    cleanText
};
