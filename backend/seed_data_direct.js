const path = require('path');
const fs = require('fs');

async function seedData() {
    try {
        fs.writeFileSync(path.join(__dirname, 'debug.txt'), 'HELLO FROM NEW SEED ' + new Date().toISOString());
    } catch (err) {
        fs.writeFileSync(path.join(__dirname, 'debug.txt'), 'Error: ' + err.message);
    } finally {
        try {
            delete require.cache[require.resolve('./seed_data_direct')];
            console.log('Cleared seed_data_direct cache entry.');
        } catch (cacheErr) {
            console.error('Failed to clear cache:', cacheErr.message);
        }
    }
}

module.exports = seedData;
