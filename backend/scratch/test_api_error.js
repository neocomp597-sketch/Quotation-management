const axios = require('axios');

async function test() {
    try {
        console.log("Calling GET http://localhost:4003/api/debug-updates...");
        const res = await axios.get('http://localhost:4003/api/debug-updates');
        console.log("API Response Status:", res.status);
        console.log("API Response Data:", JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error("API Call Failed!");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", err.response.data);
        } else {
            console.error("Error Message:", err.message);
        }
    }
}

test();
