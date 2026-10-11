/**
 * BOM line numbering: the one place where component lines get their sibling numbers and
 * where lines are written, so the BOM screens, Excel and PDF all show the same numbers.
 *
 * How the hierarchy is stored
 *   - A BOM (BOMMaster) is the parent; its components are BOMItem lines (bomMasterId).
 *   - A line whose item code has a BOM of its own is a sub-assembly; that BOM's lines are its
 *     children. One sub-assembly BOM can be used under several parents, which is why the
 *     displayed number depends on the path it is reached by (1.3.1 and 2.4.1 can be the same line).
 *   - Each line stores only its sibling number (lineNo). The displayed number is the parent's
 *     number plus the line's lineNo: 1 -> 1.3 -> 1.3.2. See childSeq().
 *
 * Numbering rules
 *   - A new line gets the next number after the highest one the BOM has ever given out
 *     (BOMMaster.lastLineNo), so deleting 1.3.2 never turns 1.3.3 into 1.3.2 and a freed
 *     number is not handed to a different component.
 *   - An edited line keeps its number. Only an explicit renumber, or replacing the whole
 *     component list from a file, numbers the lines afresh.
 *   - Every write runs in a transaction that first writes BOMMaster.linesUpdatedAt, so two
 *     requests changing the same BOM are serialised (the later one is retried), and the unique
 *     index { bomMasterId, lineNo } rejects a duplicate whatever happens.
 */
const mongoose = require('mongoose');
const BOMMaster = require('../models/BOMMaster');
const BOMItem = require('../models/BOMItem');
const { toKey, cleanText } = require('./bomService');

const MAX_TREE_DEPTH = 32;

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

// ---------------------------------------------------------------------------------------------
// Numbering primitives (shared by the screens, the PDF and the Excel export)
// ---------------------------------------------------------------------------------------------

/** Displayed number of a line: parent number + its sibling number ("1.3" + 2 -> "1.3.2"). */
const childSeq = (parentSeq, lineNo) => {
    const parent = cleanText(parentSeq);
    return parent ? `${parent}.${lineNo}` : String(lineNo);
};

/**
 * Orders hierarchical numbers part by part as numbers: 1.9 < 1.10 < 1.100, and 1.3.1 < 1.30.1.
 * A parent sorts before its children (1.3 < 1.3.1).
 */
const compareSeq = (a, b) => {
    const left = String(a ?? '').split('.').map(Number);
    const right = String(b ?? '').split('.').map(Number);
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
        if (left[i] !== right[i]) return left[i] - right[i];
    }
    return left.length - right.length;
};

// ---------------------------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------------------------

/**
 * Runs work(session) in a transaction. withTransaction retries the whole function on a write
 * conflict, which is what happens when two requests change the same BOM at once.
 */
const inTransaction = async (work) => {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

/**
 * First write of every line change: claims the BOM for this transaction. A concurrent
 * transaction on the same BOM hits a write conflict here and is retried after this one.
 */
const lockBOM = async (bomId, session) => {
    const master = await BOMMaster.findOneAndUpdate(
        { _id: bomId },
        { $set: { linesUpdatedAt: new Date() } },
        { new: true, session }
    ).lean();
    if (!master) throw httpError(404, 'BOM not found');
    return master;
};

// ---------------------------------------------------------------------------------------------
// Hierarchy checks
// ---------------------------------------------------------------------------------------------

const codeVariants = (codes) => [...new Set(codes.flatMap((code) => [cleanText(code), toKey(code)]).filter(Boolean))];

// BOMs that a component code opens: its item-level BOM, or a BOM saved for that parent code.
const bomsForCodes = async (codes, session = null) => {
    if (!codes.length) return [];
    const keys = [...new Set(codes.map(toKey).filter(Boolean))];
    const query = BOMMaster.find({
        $or: [
            { fgSerialKey: { $in: keys } },
            { fgItemCode: { $in: codeVariants(codes) } }
        ]
    }).select('_id fgItemCode fgSerialKey');
    if (session) query.session(session);
    return query.lean();
};

/**
 * Item codes from `codes` that would make `parentCode` its own ancestor if added under it:
 * the parent's own code, or a code whose sub-assembly tree already contains the parent.
 */
const findCircularCodes = async (parentCode, codes, { session = null } = {}) => {
    const parentKey = toKey(parentCode);
    const unique = [...new Set(codes.map(toKey).filter(Boolean))];
    const circular = new Set(unique.filter((key) => key === parentKey));

    // Only codes that are assemblies themselves can lead back up to the parent.
    const startBoms = await bomsForCodes(unique.filter((key) => key !== parentKey), session);
    for (const start of startBoms) {
        const startKey = toKey(start.fgItemCode);
        if (circular.has(startKey)) continue;
        const visited = new Set([String(start._id)]);
        let frontier = [start._id];
        for (let depth = 0; depth < MAX_TREE_DEPTH && frontier.length; depth++) {
            const lineQuery = BOMItem.find({ bomMasterId: { $in: frontier } }).select('itemCode');
            if (session) lineQuery.session(session);
            const childCodes = [...new Set((await lineQuery.lean()).map((line) => line.itemCode))];
            if (childCodes.some((code) => toKey(code) === parentKey)) {
                circular.add(startKey);
                break;
            }
            frontier = (await bomsForCodes(childCodes, session))
                .filter((bom) => !visited.has(String(bom._id)))
                .map((bom) => { visited.add(String(bom._id)); return bom._id; });
        }
    }
    return [...circular];
};

const circularMessage = (parentCode, codes) => (
    `${codes.join(', ')} cannot be a component of ${parentCode}: ${codes.length > 1 ? 'they contain' : 'it contains'} ${parentCode} (directly or through its sub-assemblies), which would make a circular BOM.`
);

/** Refuses the save when any component would make the BOM its own ancestor. */
const assertNoCircularCodes = async (parentCode, codes, options = {}) => {
    const circular = await findCircularCodes(parentCode, codes, options);
    if (circular.length) throw httpError(400, circularMessage(parentCode, circular), { errors: [circularMessage(parentCode, circular)] });
};

// ---------------------------------------------------------------------------------------------
// Writing lines
// ---------------------------------------------------------------------------------------------

// Fields a line carries, without the bookkeeping that prepareBOM adds.
const lineFields = (item) => {
    const { lineId, requestedLineNo, lineNo, _id, ...fields } = item;
    return fields;
};

/**
 * Writes the component list of one BOM inside `session`. `items` come from prepareBOM.
 *
 * mode 'sync'    (form edit): a row naming a saved line of this BOM (lineId) updates that line
 *                and keeps its number; other rows are new lines and get the next numbers; saved
 *                lines left out are deleted. No remaining line is renumbered.
 * mode 'append'  (add component, import "Add to components"): saved lines are untouched and the
 *                items are added after them.
 * mode 'replace' (import "Replace components", bulk upload): the items become the whole list and
 *                are numbered afresh: by the file's own "#" column where it has one, otherwise
 *                1, 2, 3 in file order. A file line with the number and item code of a saved line
 *                updates that line, keeping its id.
 *
 * In 'append' and 'replace' a number asked for by an imported file (requestedLineNo) is used
 * when no other line has it; otherwise the line gets the next free number.
 *
 * Returns { master, lines } where lines are the written lines in number order.
 */
const writeLines = async (bomId, items, { session, mode = 'sync', masterSet = {} }) => {
    const master = await lockBOM(bomId, session);
    const existing = await BOMItem.find({ bomMasterId: master._id }).session(session).lean();
    const existingById = new Map(existing.map((line) => [String(line._id), line]));

    const keep = new Map();      // lineId -> fields to update (sync)
    const fresh = [];            // items that become new lines
    if (mode === 'sync') {
        items.forEach((item) => {
            const id = item.lineId && existingById.has(item.lineId) && !keep.has(item.lineId) ? item.lineId : null;
            if (id) keep.set(id, item);
            else fresh.push(item);
        });
    } else if (mode === 'replace') {
        // A file line giving the number a saved line already has, for the same item, is that line:
        // it is updated in place and keeps its id, so re-uploading an export changes no identities.
        const byNumber = new Map(existing.map((line) => [line.lineNo, line]));
        items.forEach((item) => {
            const match = Number.isInteger(item.requestedLineNo) ? byNumber.get(item.requestedLineNo) : null;
            if (match && toKey(match.itemCode) === toKey(item.itemCode) && !keep.has(String(match._id))) {
                keep.set(String(match._id), item);
            } else {
                fresh.push(item);
            }
        });
    } else {
        fresh.push(...items);
    }

    const kept = mode === 'append' ? existing : existing.filter((line) => keep.has(String(line._id)));
    const removed = mode === 'append' ? [] : existing.filter((line) => !keep.has(String(line._id)));

    // Numbers in use after the write: those of the lines that stay.
    const used = new Set(kept.map((line) => line.lineNo));
    // New numbers continue after the highest ever given out; a replace starts the BOM again.
    let next = mode === 'replace'
        ? 0
        : Math.max(master.lastLineNo || 0, ...existing.map((line) => line.lineNo || 0), 0);

    // Requested numbers first, so a later file line asking for 3 is not beaten to it by an
    // earlier line without a number.
    const numbers = new Array(fresh.length).fill(null);
    if (mode !== 'sync') {
        fresh.forEach((item, index) => {
            const wanted = item.requestedLineNo;
            if (Number.isInteger(wanted) && wanted > 0 && !used.has(wanted)) {
                numbers[index] = wanted;
                used.add(wanted);
            }
        });
        if (mode === 'replace') next = Math.max(0, ...used);
    }
    fresh.forEach((item, index) => {
        if (numbers[index]) return;
        do { next += 1; } while (used.has(next));
        numbers[index] = next;
        used.add(next);
    });

    // Removals first so their numbers are free; kept lines keep theirs; new lines take new ones.
    if (removed.length) {
        await BOMItem.deleteMany({ bomMasterId: master._id, _id: { $in: removed.map((line) => line._id) } }, { session });
    }
    if (keep.size) {
        await BOMItem.bulkWrite(
            [...keep.entries()].map(([id, item]) => ({
                updateOne: { filter: { _id: id, bomMasterId: master._id }, update: { $set: lineFields(item) } }
            })),
            { session }
        );
    }
    if (fresh.length) {
        await BOMItem.insertMany(
            fresh.map((item, index) => ({ ...lineFields(item), lineNo: numbers[index], bomMasterId: master._id })),
            { session }
        );
    }

    const highest = Math.max(0, ...used);
    const componentCount = kept.length + fresh.length;
    const updated = await BOMMaster.findOneAndUpdate(
        { _id: master._id },
        {
            $set: {
                ...masterSet,
                componentCount,
                lastLineNo: mode === 'replace' ? highest : Math.max(master.lastLineNo || 0, highest)
            }
        },
        { new: true, session }
    ).lean();

    const lines = await BOMItem.find({ bomMasterId: master._id }).sort({ lineNo: 1 }).session(session).lean();
    return { master: updated, lines, added: fresh.length, removed: removed.length };
};

/**
 * Creates a BOM and its lines in one transaction, so a failure leaves neither behind. Lines are
 * numbered 1, 2, 3... or, for an imported file, by the file's own numbers.
 */
const createBOMWithLines = async (masterDoc, items) => inTransaction(async (session) => {
    const [created] = await BOMMaster.create([{ ...masterDoc, componentCount: 0, lastLineNo: 0 }], { session });
    return writeLines(created._id, items, { session, mode: 'replace' });
});

/** Saves lines of an existing BOM in its own transaction. See writeLines for the modes. */
const saveLines = async (bomId, items, { mode = 'sync', masterSet = {} } = {}) => inTransaction(
    (session) => writeLines(bomId, items, { session, mode, masterSet })
);

/**
 * Moves one line (and with it everything below it) to another parent BOM. The line keeps its
 * id and fields and takes the next number under the new parent; its sub-assembly's lines follow
 * it, because their numbers are built from the path. Nothing else in either BOM is renumbered.
 */
const moveLine = async (sourceBomId, lineId, targetBomId) => {
    if (String(sourceBomId) === String(targetBomId)) {
        throw httpError(400, 'The component is already under this parent.');
    }
    const [source, target, line] = await Promise.all([
        BOMMaster.findById(sourceBomId).select('_id fgItemCode').lean(),
        BOMMaster.findById(targetBomId).select('_id fgItemCode').lean(),
        BOMItem.findOne({ _id: lineId, bomMasterId: sourceBomId }).lean()
    ]);
    if (!source) throw httpError(404, 'BOM not found');
    if (!target) throw httpError(404, 'The BOM to move the component to was not found.');
    if (!line) throw httpError(404, 'That component is not a line of this BOM.');
    await assertNoCircularCodes(target.fgItemCode, [line.itemCode]);

    return inTransaction(async (session) => {
        // Lock both BOMs in a fixed order so two opposite moves cannot block each other.
        const [first, second] = [source._id, target._id].sort((a, b) => String(a).localeCompare(String(b)));
        const locked = new Map();
        locked.set(String(first), await lockBOM(first, session));
        locked.set(String(second), await lockBOM(second, session));
        const lockedTarget = locked.get(String(target._id));

        // Checked again inside the transaction: the line may have changed since.
        const current = await BOMItem.findOne({ _id: line._id, bomMasterId: source._id }).session(session).lean();
        if (!current) throw httpError(409, 'The component was changed by someone else. Reload the BOM and try again.');
        const circular = await findCircularCodes(target.fgItemCode, [current.itemCode], { session });
        if (circular.length) throw httpError(400, circularMessage(target.fgItemCode, circular));

        const top = await BOMItem.findOne({ bomMasterId: target._id }).sort({ lineNo: -1 }).select('lineNo').session(session).lean();
        const lineNo = Math.max(lockedTarget.lastLineNo || 0, top?.lineNo || 0) + 1;

        await BOMItem.updateOne({ _id: current._id }, { $set: { bomMasterId: target._id, lineNo } }, { session });
        const [sourceCount, targetCount] = await Promise.all([
            BOMItem.countDocuments({ bomMasterId: source._id }).session(session),
            BOMItem.countDocuments({ bomMasterId: target._id }).session(session)
        ]);
        await BOMMaster.updateOne({ _id: source._id }, { $set: { componentCount: sourceCount } }, { session });
        await BOMMaster.updateOne({ _id: target._id }, { $set: { componentCount: targetCount, lastLineNo: lineNo } }, { session });
        return { lineId: current._id, lineNo, targetId: target._id };
    });
};

/**
 * Explicit renumber (asked for by the user): the BOM's lines become 1, 2, 3... in their
 * current order, closing the gaps left by deleted lines. Only this BOM's own lines change;
 * the numbers of its sub-assemblies' lines follow from them.
 */
const renumberLines = async (bomId) => inTransaction(async (session) => {
    const master = await lockBOM(bomId, session);
    const lines = await BOMItem.find({ bomMasterId: master._id }).sort({ lineNo: 1 }).select('_id lineNo').session(session).lean();
    const changes = lines
        .map((line, index) => ({ id: line._id, from: line.lineNo, to: index + 1 }))
        .filter((change) => change.from !== change.to);
    if (changes.length) {
        // Two steps so no intermediate state breaks the unique { bomMasterId, lineNo } index.
        await BOMItem.bulkWrite(changes.map((change) => ({
            updateOne: { filter: { _id: change.id }, update: { $set: { lineNo: -change.to } } }
        })), { session });
        await BOMItem.bulkWrite(changes.map((change) => ({
            updateOne: { filter: { _id: change.id }, update: { $set: { lineNo: change.to } } }
        })), { session });
    }
    await BOMMaster.updateOne({ _id: master._id }, { $set: { lastLineNo: lines.length, componentCount: lines.length } }, { session });
    return { renumbered: changes.length, components: lines.length };
});

module.exports = {
    childSeq,
    compareSeq,
    inTransaction,
    writeLines,
    saveLines,
    createBOMWithLines,
    moveLine,
    renumberLines,
    findCircularCodes,
    assertNoCircularCodes,
    circularMessage,
    httpError
};
