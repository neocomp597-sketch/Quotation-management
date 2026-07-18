const mongoose = require('mongoose');

const schema = new mongoose.Schema({
    name: String
});

schema.index({ companyId: 1 });

console.log('Indexes before plugin:', schema.indexes());

schema.add({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        index: true
    }
});

console.log('Indexes after schema.add with index:true:', schema.indexes());
