const mongoose = require('mongoose');
const { register } = require('./controllers/authController');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/quotations');
    
    const req = {
        body: {
            name: "Test User",
            email: "test_register@test.com",
            password: "password123",
            companyName: "Test Company"
        },
        headers: {},
        header: () => null
    };
    
    const res = {
        status: (code) => {
            console.log("Status:", code);
            return res;
        },
        json: (data) => {
            console.log("JSON:", data);
            return res;
        },
        cookie: () => {}
    };
    
    try {
        await register(req, res);
    } catch(err) {
        console.error("Caught error:", err);
    }
    process.exit(0);
}
test();
