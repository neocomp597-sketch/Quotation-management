const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const User = require('../models/User');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const user = await User.findOne({ role: 'admin' }).lean();
        if (!user) {
            console.log("No admin user found.");
            process.exit(1);
        }

        const token = jwt.sign(
            { id: user._id.toString(), tokenVersion: user.tokenVersion ?? 0 },
            process.env.JWT_SECRET || 'secret123',
            { expiresIn: '1d' }
        );

        console.log("Generated JWT Token for:", user.email);

        const baseUrl = 'http://localhost:4003/api';

        // Test POST /csm/masters/sources
        try {
            console.log("Sending POST /csm/masters/sources request...");
            const res = await fetch(`${baseUrl}/csm/masters/sources`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: 'API Source ' + Date.now()
                })
            });
            const text = await res.text();
            console.log("POST /csm/masters/sources status:", res.status);
            console.log("POST /csm/masters/sources raw response:", text);
            try {
                const data = JSON.parse(text);
                console.log("POST /csm/masters/sources parsed response:", data);
            } catch (err) {
                console.log("Response was not JSON");
            }
        } catch (err) {
            console.error("POST /csm/masters/sources failed:", err.message);
        }

        // Test GET /csm/masters/sources
        try {
            console.log("Sending GET /csm/masters/sources request...");
            const res = await fetch(`${baseUrl}/csm/masters/sources`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log("GET /csm/masters/sources status:", res.status);
            const text = await res.text();
            console.log("GET /csm/masters/sources response snippet:", text.substring(0, 200));
        } catch (err) {
            console.error("GET /csm/masters/sources failed:", err.message);
        }

        // Test GET /csm/tickets
        try {
            console.log("Sending GET /csm/tickets request...");
            const res = await fetch(`${baseUrl}/csm/tickets`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log("GET /csm/tickets status:", res.status);
            const text = await res.text();
            console.log("GET /csm/tickets response snippet:", text.substring(0, 200));
        } catch (err) {
            console.error("GET /csm/tickets failed:", err.message);
        }

        // Test GET /csm/masters/categories
        try {
            console.log("Sending GET /csm/masters/categories request...");
            const res = await fetch(`${baseUrl}/csm/masters/categories`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            console.log("GET /csm/masters/categories status:", res.status);
            const text = await res.text();
            console.log("GET /csm/masters/categories response snippet:", text.substring(0, 200));
        } catch (err) {
            console.error("GET /csm/masters/categories failed:", err.message);
        }

        // Check if there was any last server error
        try {
            const res = await fetch(`${baseUrl}/debug-last-error`);
            const data = await res.json();
            console.log("Last server error:", data);
        } catch (err) {
            console.error("Failed to query debug-last-error:", err.message);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}
run();
