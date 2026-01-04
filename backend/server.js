const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors({
    origin: [
        'https://quotation-management-2znu.onrender.com',
        'http://localhost:5173',
        'http://localhost:3000'
    ],
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Route Imports
const quotationRoutes = require('./routes/quotationRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const termsRoutes = require('./routes/termsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const salespersonRoutes = require('./routes/salespersonRoutes');
const siteRoutes = require('./routes/siteRoutes');
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');

// API Routes
app.use('/api/quotations', quotationRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/salespersons', salespersonRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Serve Static Files
// Serve Static Files with logging
app.use('/uploads', (req, res, next) => {
    console.log(`[Static] Serving file: ${req.path}`);
    next();
}, express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.send('ERP Quotation API is running...');
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
