const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../models');
const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js') && f !== 'Company.js' && f !== 'User.js' && f !== 'index.js');

for (const file of files) {
    let content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    
    // Remove existing companyId declarations pointing to CompanySettings or Company
    content = content.replace(/companyId:\s*\{\s*type:\s*mongoose\.Schema\.Types\.ObjectId,\s*ref:\s*['"]CompanySettings['"]\s*\},?\n?/g, '');
    content = content.replace(/companyId:\s*\{\s*type:\s*mongoose\.Schema\.Types\.ObjectId,\s*ref:\s*['"]Company['"]\s*\},?\n?/g, '');

    // Add plugin import if not there
    if (!content.includes("require('./plugins/tenantPlugin')")) {
        const lines = content.split('\n');
        
        // Find schema export or end
        const exportIndex = lines.findIndex(l => l.startsWith('module.exports = mongoose.model('));
        if (exportIndex !== -1) {
            const schemaNameMatch = lines[exportIndex].match(/mongoose\.model\(['"][^'"]+['"],\s*([a-zA-Z0-9_]+)\)/);
            if (schemaNameMatch) {
                const schemaName = schemaNameMatch[1];
                lines.splice(exportIndex, 0, `const tenantPlugin = require('./plugins/tenantPlugin');`);
                lines.splice(exportIndex + 1, 0, `${schemaName}.plugin(tenantPlugin);`);
                content = lines.join('\n');
            }
        }
    }
    
    fs.writeFileSync(path.join(modelsDir, file), content, 'utf8');
    console.log(`Updated ${file}`);
}
console.log('Finished applying tenantPlugin to all models.');
