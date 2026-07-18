const csmRoutes = require('../routes/csmRoutes');

console.log("Listing all routes registered in csmRoutes:");
csmRoutes.stack.forEach(layer => {
    if (layer.route) {
        console.log(`- Path: ${layer.route.path}, Methods: ${Object.keys(layer.route.methods).join(', ')}`);
    }
});
