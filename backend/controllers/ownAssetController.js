const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const AuditLog = require('../models/AuditLog');
const Customer = require('../models/Customer');
const EmployeeProfile = require('../models/EmployeeProfile');
const SerialTransfer = require('../models/SerialTransfer');
const User = require('../models/User');
const { OWN_ASSET_VIEWS } = require('../config/ownAssetViews');
const serialTransfers = require('./serialTransferController');

const {
    ASSET_NO_MAX_LENGTH,
    customerPopulate,
    productPopulate,
    branchPopulate,
    cleanText,
    httpError,
    sendError,
    transferMoment,
    startOfDay,
    loadProductsByCode,
    employeeAssetRow,
    assignAssetsToEmployee,
    transferAssetBetweenEmployees,
    employeeAssetLogOf,
    recordReturnToStock
} = serialTransfers.employeeAssetTools;

/*
 * Own Assets: company items (Invoice Bulk Upload serial numbers such as laptops) held by the
 * signed-in user (My Assets), by their reporting manager (Manager Assets) and by everyone who
 * reports to them, directly or further down (My Team Assets), as Employee Master > Reporting To
 * says. An employee holds items through their customer in Customer Master
 * (services/employeeCustomerService.js); Employee Master's Assign Asset gives them, and so does
 * Add asset here.
 *
 * Each list is its own screen in Authorization (config/apiPermissions.js): View lists the items
 * and opens their Asset Log, Create adds items, Modify changes the Asset No or hands an item to
 * another person of the user's circle (themselves, their manager, their team), Delete takes an
 * item back to stock. Every change goes into the item's history, as in Serial No Transfer.
 *
 * The circle is the access rule: MGR access (Authorization > MGR Access) does not hide items people
 * hold. Add asset still offers only the working branch's free items within MGR access, as
 * Employee Master does.
 */

const ANY_BRANCH = { bypassBranch: true };
const PERSON_SELECT = 'name employeeId designation status isVacant reportingTo email';

const isPerson = (employee) => Boolean(employee) && !employee.isVacant && employee.status !== 'Vacant';
const personOf = (employee) => ({
    _id: employee._id,
    name: employee.name,
    employeeId: employee.employeeId || '',
    designation: employee.designation || '',
    status: employee.status || 'Active'
});
const sameId = (a, b) => Boolean(a && b) && String(a) === String(b);

/** router.param: the list named in the URL, as req.ownView. */
exports.loadView = (req, res, next, value) => {
    const view = OWN_ASSET_VIEWS[String(value || '').toLowerCase()];
    if (!view) return res.status(404).json({ message: 'Unknown Own Assets list.' });
    req.ownView = view;
    return next();
};

// The employee the signed-in user is: the one their login is linked to, else the one with their email.
const findMe = async (req, employees) => {
    const user = await User.findById(req.user.id).select('employeeProfileId email').lean();
    const linked = employees.find((employee) => sameId(employee._id, user?.employeeProfileId));
    if (isPerson(linked)) return linked;
    const email = cleanText(user?.email || req.user.email).toLowerCase();
    if (!email) return null;
    const matches = employees.filter((employee) => isPerson(employee) && cleanText(employee.email).toLowerCase() === email);
    return matches.find((employee) => employee.status === 'Active') || matches[0] || null;
};

/**
 * The user's circle in Employee Master: `me`, `manager` (the nearest person above; a vacant
 * position in between is passed over) and `team` (every person below, also under vacant
 * positions; resigned people stay listed while they hold items). `me` is null when the login is
 * not an employee.
 */
const loadCircle = async (req) => {
    const employees = await EmployeeProfile.find({ companyId: req.user.companyId }).select(PERSON_SELECT).setOptions(ANY_BRANCH).lean();
    const me = await findMe(req, employees);
    if (!me) return { me: null, manager: null, team: [] };

    const byId = new Map(employees.map((employee) => [String(employee._id), employee]));
    let manager = null;
    const passed = new Set([String(me._id)]);
    for (let above = byId.get(String(me.reportingTo || '')); above && !passed.has(String(above._id)); above = byId.get(String(above.reportingTo || ''))) {
        passed.add(String(above._id));
        if (isPerson(above)) { manager = above; break; }
    }

    const reportsOf = new Map();
    employees.forEach((employee) => {
        if (!employee.reportingTo) return;
        const key = String(employee.reportingTo);
        if (!reportsOf.has(key)) reportsOf.set(key, []);
        reportsOf.get(key).push(employee);
    });
    const team = [];
    const seen = new Set([String(me._id)]);
    const queue = [String(me._id)];
    while (queue.length) {
        (reportsOf.get(queue.shift()) || []).forEach((employee) => {
            const key = String(employee._id);
            if (seen.has(key)) return;
            seen.add(key);
            queue.push(key);
            if (isPerson(employee)) team.push(employee);
        });
    }
    team.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' }));
    return { me, manager, team };
};

// The people whose items a list shows.
const holdersOf = (view, circle) => {
    if (view.key === 'mine') return circle.me ? [circle.me] : [];
    if (view.key === 'manager') return circle.manager ? [circle.manager] : [];
    return circle.team;
};

// Everyone an item may be handed to: the user, their manager and their team.
const circlePeople = (circle) => [
    ...(circle.me ? [{ ...personOf(circle.me), relation: 'me' }] : []),
    ...(circle.manager ? [{ ...personOf(circle.manager), relation: 'manager' }] : []),
    ...circle.team.filter((person) => !sameId(person._id, circle.manager?._id)).map((person) => ({ ...personOf(person), relation: 'team' }))
];

// Why a list has nobody: the login is not an employee, there is no manager, nobody reports to them.
const nobodyMessage = (view, circle) => {
    if (!circle.me) return 'Your login is not linked to an employee in Employee Master, so there are no assets to show. Ask an administrator to link it.';
    if (view.key === 'manager') return `No reporting manager is set for ${circle.me.name} in Employee Master.`;
    if (view.key === 'team') return `Nobody reports to ${circle.me.name} in Employee Master.`;
    return '';
};

/** The items these people hold now, in every branch, each with its holder and since when. */
const itemsHeldBy = async (req, people) => {
    if (!people.length) return [];
    const customers = await Customer.find({ companyId: req.user.companyId, employeeProfileId: { $in: people.map((person) => person._id) } })
        .select('employeeProfileId')
        .setOptions(ANY_BRANCH)
        .lean();
    if (!customers.length) return [];
    const personById = new Map(people.map((person) => [String(person._id), person]));
    const holderOf = new Map(customers.map((customer) => [String(customer._id), personById.get(String(customer.employeeProfileId))]));

    const assets = await Asset.find({ companyId: req.user.companyId, customerId: { $in: customers.map((customer) => customer._id) } })
        .setOptions(ANY_BRANCH)
        .populate(productPopulate)
        .populate(branchPopulate)
        .lean();
    if (!assets.length) return [];
    const [fallbackProducts, current] = await Promise.all([
        loadProductsByCode(assets, req.user.companyId),
        SerialTransfer.find({ companyId: req.user.companyId, assetId: { $in: assets.map((asset) => asset._id) }, isActive: true })
            .select('assetId transferDate')
            .setOptions(ANY_BRANCH)
            .lean()
    ]);
    const sinceOf = new Map(current.map((record) => [String(record.assetId), record.transferDate]));

    return assets
        .map((asset) => {
            const holder = holderOf.get(String(asset.customerId));
            return {
                ...employeeAssetRow(asset, fallbackProducts),
                holder: holder ? personOf(holder) : null,
                // When it reached the holder; an item never moved since its invoice row has the invoice date.
                since: sinceOf.get(String(asset._id)) || asset.saleDate || asset.invoiceDate || null
            };
        })
        .sort((a, b) => String(a.holder?.name || '').localeCompare(String(b.holder?.name || ''), 'en', { sensitivity: 'base' })
            || String(a.serialNumber).localeCompare(String(b.serialNumber), 'en', { numeric: true }));
};

/** One item of the list, with the person of the list who holds it; 404 when it is not in the list. */
const itemInList = async (req, holders, assetId) => {
    if (!mongoose.Types.ObjectId.isValid(assetId)) throw httpError(400, 'Invalid asset.');
    const asset = await Asset.findOne({ _id: assetId, companyId: req.user.companyId })
        .setOptions(ANY_BRANCH)
        .populate(customerPopulate)
        .populate(productPopulate)
        .lean();
    const holder = asset && holders.find((person) => sameId(person._id, asset.customerId?.employeeProfileId));
    if (!holder) throw httpError(404, `This asset is not in ${req.ownView.label} any more. Reload the list.`);
    return { asset, holder };
};

/**
 * GET /:view: the items of the list, and the people involved: `holders` (whose items it shows),
 * `circle` (everyone an item may be handed to) and `message` when the list has nobody.
 */
exports.list = async (req, res) => {
    try {
        const circle = await loadCircle(req);
        const holders = holdersOf(req.ownView, circle);
        return res.json({
            view: req.ownView.key,
            me: circle.me ? personOf(circle.me) : null,
            manager: circle.manager ? personOf(circle.manager) : null,
            holders: holders.map(personOf),
            circle: circlePeople(circle),
            message: holders.length ? '' : nobodyMessage(req.ownView, circle),
            data: await itemsHeldBy(req, holders)
        });
    } catch (error) {
        return sendError(res, error, 'Failed to load the assets');
    }
};

/** GET /:view/assignable?search=: free items to add (Employee Master's search: working branch, in stock or allocated to nobody). */
exports.searchAssignable = (req, res) => serialTransfers.searchAssignableAssets(req, res);

/**
 * POST /:view/assign { employeeId (My Team Assets), assetIds, assignDate?, remarks? }: gives the
 * items to the list's person: the user, their manager, or the chosen person of their team.
 */
exports.assign = async (req, res) => {
    try {
        const circle = await loadCircle(req);
        const holders = holdersOf(req.ownView, circle);
        if (!holders.length) throw httpError(400, nobodyMessage(req.ownView, circle));
        const holder = req.ownView.key === 'team'
            ? holders.find((person) => sameId(person._id, req.body.employeeId))
            : holders[0];
        if (!holder) throw httpError(400, 'Select a person of your team.');

        const { assigned, alreadyHeld } = await assignAssetsToEmployee(req, holder._id, req.body);
        return res.status(201).json({ holder: personOf(holder), assigned, alreadyHeld });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'One of these assets was just changed by someone else. Reload and try again.' });
        return sendError(res, error, 'Failed to add the assets');
    }
};

/** GET /:view/:assetId/log: the item's Asset Log, as Employee Master shows it. */
exports.log = async (req, res) => {
    try {
        const circle = await loadCircle(req);
        const { asset, holder } = await itemInList(req, holdersOf(req.ownView, circle), req.params.assetId);
        return res.json(await employeeAssetLogOf(req, holder._id, asset._id, null));
    } catch (error) {
        return sendError(res, error, 'Failed to load the asset log');
    }
};

/**
 * PUT /:view/:assetId { assetNo?, toEmployeeId?, transferDate?, remarks?, requestId? }: Edit. A
 * new holder (the user, their manager or a person of their team) gets the item first, then the
 * Asset No (the client's own number, free text) is saved.
 */
exports.update = async (req, res) => {
    try {
        const circle = await loadCircle(req);
        const { asset, holder } = await itemInList(req, holdersOf(req.ownView, circle), req.params.assetId);
        const changed = [];

        const toEmployeeId = cleanText(req.body.toEmployeeId);
        let handedTo = null;
        if (toEmployeeId && !sameId(toEmployeeId, holder._id)) {
            handedTo = circlePeople(circle).find((person) => sameId(person._id, toEmployeeId));
            if (!handedTo) throw httpError(400, 'An asset can be handed to you, your manager or a person of your team.');
            const { to } = await transferAssetBetweenEmployees(req, holder._id, asset._id, {
                toEmployeeId,
                transferDate: req.body.transferDate,
                remarks: cleanText(req.body.remarks) || `Handed over from ${holder.name} to ${handedTo.name} in Own Assets`,
                requestId: req.body.requestId
            }, null);
            if (to) changed.push('holder');
        }

        if (req.body.assetNo !== undefined) {
            const assetNo = cleanText(req.body.assetNo).slice(0, ASSET_NO_MAX_LENGTH);
            if (assetNo !== (asset.assetNo || '')) {
                await Asset.updateOne({ _id: asset._id, companyId: req.user.companyId }, { $set: { assetNo } }).setOptions(ANY_BRANCH);
                changed.push('assetNo');
                try {
                    await AuditLog.create({
                        action: 'ASSET_NO_UPDATED',
                        entityType: 'Asset',
                        entityId: asset._id,
                        userId: req.user.id,
                        userName: req.user.name,
                        oldValue: { assetNo: asset.assetNo || '' },
                        newValue: { assetNo },
                        reason: `Asset No of serial ${asset.serialNumber} (Own Assets)`,
                        companyId: req.user.companyId
                    });
                } catch (auditError) {
                    console.error('Asset No audit log error:', auditError);
                }
            }
        }

        return res.json({ changed, holder: personOf(holder), handedTo: handedTo && changed.includes('holder') ? handedTo : null });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'This asset was just changed by someone else. Reload and try again.' });
        return sendError(res, error, 'Failed to save the asset');
    }
};

/**
 * POST /:view/:assetId/return { returnDate?, remarks? }: Take back. The item leaves its holder
 * and is In Stock with nobody, ready to be given again; its history records the return.
 */
exports.takeBack = async (req, res) => {
    let session;
    try {
        const circle = await loadCircle(req);
        const { asset, holder } = await itemInList(req, holdersOf(req.ownView, circle), req.params.assetId);
        const returnDate = transferMoment(req.body.returnDate);
        if (!returnDate) throw httpError(400, 'Return date is not a valid date.');
        if (startOfDay(returnDate) > startOfDay(new Date())) throw httpError(400, 'Return date cannot be in the future.');

        const user = { createdBy: req.user?.id || null, createdByName: req.user?.name || '' };
        const remarks = cleanText(req.body.remarks).slice(0, 500) || `Taken back from ${holder.name} in Own Assets`;
        session = await mongoose.startSession();
        await session.withTransaction(() => recordReturnToStock(asset, asset.customerId, { returnDate, remarks, user }, session));
        return res.json({ message: `${asset.serialNumber} taken back from ${holder.name}. It is In Stock and can be given to someone else.`, holder: personOf(holder) });
    } catch (error) {
        return sendError(res, error, 'Failed to take the asset back');
    } finally {
        if (session) await session.endSession();
    }
};
