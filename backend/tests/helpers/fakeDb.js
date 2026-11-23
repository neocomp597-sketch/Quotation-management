// Test helper: replaces the database round trip of Mongoose queries and aggregations (exec). Each query the
// code runs is recorded with everything it was built with, and `resolve(query)` decides what the
// database answers; an Error it returns is thrown, as a failing query would.
const mongoose = require('mongoose');

const install = (resolve) => {
    const executed = [];
    const realExec = mongoose.Query.prototype.exec;
    const realAggregateExec = mongoose.Aggregate.prototype.exec;
    const answer = async (query) => {
        executed.push(query);
        const result = await resolve(query);
        if (result instanceof Error) throw result;
        return result;
    };
    mongoose.Query.prototype.exec = function fakeExec() { return answer(this); };
    // Aggregations are recorded as { model, op: 'aggregate', pipeline, options }.
    mongoose.Aggregate.prototype.exec = function fakeAggregateExec() {
        return answer({ model: this._model, op: 'aggregate', pipeline: this.pipeline(), options: this.options });
    };
    return {
        executed,
        /** The recorded queries of one model, optionally of one operation (find, updateMany, ...). */
        queries: (modelName, op) => executed.filter((q) => q.model.modelName === modelName && (!op || q.op === op)),
        reset: () => { executed.length = 0; },
        restore: () => {
            mongoose.Query.prototype.exec = realExec;
            mongoose.Aggregate.prototype.exec = realAggregateExec;
        }
    };
};

const makeRes = () => ({
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
});

/** Runs `fn` with console.error / console.warn silenced (expected failure logs). */
const quietly = async (fn) => {
    const { error, warn } = console;
    console.error = () => {};
    console.warn = () => {};
    try { return await fn(); } finally { console.error = error; console.warn = warn; }
};

module.exports = { install, makeRes, quietly };
