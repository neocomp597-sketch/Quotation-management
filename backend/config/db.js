const mongoose = require('mongoose');
require('dotenv').config();

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 500);

const logSlowOperation = (label, start, details = {}) => {
    const duration = Date.now() - start;
    if (duration < SLOW_QUERY_MS) return;

    console.warn('[Mongo Slow Query]', {
        durationMs: duration,
        operation: label,
        ...details,
    });
};

mongoose.plugin((schema) => {
    const queryOps = [
        'count',
        'countDocuments',
        'deleteMany',
        'deleteOne',
        'find',
        'findOne',
        'findOneAndDelete',
        'findOneAndUpdate',
        'updateMany',
        'updateOne',
    ];

    schema.pre(queryOps, function () {
        this._queryStartedAt = Date.now();
    });

    schema.post(queryOps, function () {
        logSlowOperation(`${this.model.modelName}.${this.op}`, this._queryStartedAt, {
            filter: this.getFilter(),
            options: this.getOptions(),
        });
    });

    schema.pre('aggregate', function () {
        this._aggregateStartedAt = Date.now();
    });

    schema.post('aggregate', function () {
        logSlowOperation(`${this.model().modelName}.aggregate`, this._aggregateStartedAt, {
            pipelineLength: this.pipeline().length,
        });
    });
});

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
            minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 5),
            serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
        });
        console.log("MongoDB connected");
        // Run seeder
        // require('../seed_data_direct')();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

module.exports = connectDB;
