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

const connectDB = async (retries = 5, delayMs = 3000) => {
    while (retries > 0) {
        try {
            await mongoose.connect(process.env.MONGO_URI, {
                maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
                minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 5),
                serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
            });
            console.log("MongoDB connected successfully");
            return;
        } catch (error) {
            retries--;
            console.error(`[Mongo Connection Warning] ${error.message}. Retries remaining: ${retries}`);
            if (retries === 0) {
                console.error("[Mongo Fatal Error] Exhausted all MongoDB connection retries. Exiting process.");
                process.exit(1);
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};

module.exports = connectDB;
