const path = require('path');
const fs = require('fs');

async function seedData() {
    try {
        fs.writeFileSync(path.join(__dirname, 'debug.txt'), 'HELLO FROM SEED ' + new Date().toISOString());
    } catch (err) {
        fs.writeFileSync(path.join(__dirname, 'debug.txt'), 'Error: ' + err.message);
    } finally {
        try {
            delete require.cache[require.resolve('./seed_data_direct')];
        } catch (cacheErr) {}
    }
}

module.exports = seedData;
