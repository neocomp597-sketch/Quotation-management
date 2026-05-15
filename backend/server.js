const express = require("express");
// Force restart 1
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis");
require("dotenv").config();

const app = express();

// Connect to Database
connectDB();
connectRedis().catch(() => {
  console.warn("Redis unavailable at startup; Redis-backed features will retry per request.");
});

// Middleware
app.use(
  cors({
    origin: [
      "https://quotation-management-2znu.onrender.com",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://arcrm.co.in",
    ],
    credentials: true,
  }),
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const slowThresholdMs = Number(process.env.SLOW_API_THRESHOLD_MS || 500);
    if (duration >= slowThresholdMs) {
      console.warn(`[Slow API] ${req.method} ${req.originalUrl} ${duration}ms ${res.statusCode}`);
    } else if (process.env.LOG_API_TIMINGS === "true") {
      console.log(`[API] ${req.method} ${req.originalUrl} ${duration}ms ${res.statusCode}`);
    }
  });
  next();
});
app.use((req, res, next) => {
  const timeoutMs = Number(process.env.API_REQUEST_TIMEOUT_MS || 30000);
  req.setTimeout(timeoutMs);
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(503).json({ message: "Request timed out" });
    }
  });
  next();
});

// Route Imports
const quotationRoutes = require("./routes/quotationRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productRoutes = require("./routes/productRoutes");
const termsRoutes = require("./routes/termsRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const salespersonRoutes = require("./routes/salespersonRoutes");
const siteRoutes = require("./routes/siteRoutes");
const path = require("path");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const importRoutes = require("./routes/importRoutes");
const companySettingsRoutes = require("./routes/companySettingsRoutes");
const mgrRoutes = require("./routes/mgrRoutes");
const attributeRoutes = require("./routes/attributeRoutes");
const productAttributeRoutes = require("./routes/productAttributeRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const voucherRoutes = require("./routes/voucherRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const planningRoutes = require("./routes/planningRoutes");
const authorizationRoutes = require("./routes/authorizationRoutes");
const statusRoutes = require("./routes/statusRoutes");
const scheduler = require("./utils/scheduler");

// API Routes
app.use("/api/quotations", quotationRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/products", productRoutes);
app.use("/api/terms", termsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/salespersons", salespersonRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/import", importRoutes);
app.use("/api/company-settings", companySettingsRoutes);
app.use("/api/mgrs", mgrRoutes);
app.use("/api/attributes", attributeRoutes);
app.use("/api/product-attributes", productAttributeRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/authorization", authorizationRoutes);
app.use("/api/statuses", statusRoutes);

app.get('/api/trigger-seed', async (req, res) => {
    try {
        const seedData = require('./seed_data_direct');
        await seedData();
        res.send('Seeded successfully');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/seed-statuses', async (req, res) => {
    try {
        const Status = require('./models/Status');
        const DEFAULT_STATUSES = [
            { name: 'Budget', color: '#6366f1', isActive: true }, 
            { name: 'Firm', color: '#10b981', isActive: true }, 
            { name: 'MFC', color: '#f59e0b', isActive: true }, 
            { name: 'B & B', color: '#3b82f6', isActive: true }, 
            { name: 'Others', color: '#64748b', isActive: true }, 
            { name: 'Order Received', color: '#8b5cf6', isActive: true }, 
            { name: 'Invoice', color: '#ec4899', isActive: true }, 
            { name: 'Lost', color: '#ef4444', isActive: true }, 
            { name: 'Parked', color: '#84cc16', isActive: true }
        ];

        let added = 0;
        for (const statusData of DEFAULT_STATUSES) {
            const existing = await Status.findOne({ name: { $regex: new RegExp(`^${statusData.name}$`, 'i') } }).select('_id').lean();
            if (!existing) {
                await Status.create(statusData);
                added++;
            }
        }
        res.json({ message: `Statuses seeded successfully! Added ${added} new statuses.` });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/check-db', async (req, res) => {
    try {
        const Planning = require('./models/Planning');
        const counts = await Planning.aggregate([
            { $group: { _id: "$financialYear", count: { $sum: 1 } } }
        ]);
        const sample = await Planning.findOne().lean();
        res.json({ counts, sample });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/cleanup-data', async (req, res) => {
    try {
        const Planning = require('./models/Planning');
        const result = await Planning.deleteMany({});
        res.json({ message: 'Deleted all planning entries', result });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/check-excel', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const filePath = 'D:/tally/Quotations/SALES REGISTER FROM 01-04-25 TO 31-03-26.xlsx';
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const rowLabels = [];
        for (let i = 0; i < Math.min(100, rows.length); i++) {
            if (rows[i] && rows[i][0]) {
                rowLabels.push(rows[i][0]);
            }
        }
        res.json({ rowLabels });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/read-revenue-plan', async (req, res) => {
    try {
        const XLSX = require('xlsx');
        const filePath = 'D:/tally/Quotations/Ularia_1+3M FY27 Revenue Plan_09_04_26R.xlsx';
        const workbook = XLSX.readFile(filePath);
        const result = { sheetNames: workbook.SheetNames, sheets: {} };
        workbook.SheetNames.forEach(name => {
            const ws = workbook.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            result.sheets[name] = rows.slice(0, 80);
        });
        res.json(result);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Start Scheduler
scheduler.startScheduler();

// Serve Static Files
// Serve Static Files with logging
app.use(
  "/uploads",
  (req, res, next) => {
    console.log(`[Static] Serving file: ${req.path}`);
    next();
  },
  express.static(path.join(__dirname, "uploads")),
);

// Serve Static Files - Frontend (Production & Deployment)
const rootDir = path.resolve();
app.use(express.static(path.join(rootDir, "dist")));

// SPA fallback — Only in production or if dist exists
app.get(/.*/, (req, res, next) => {
  // If it's an API route that reached here, it's a 404 for API
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ message: `API route ${req.path} not found` });
  }

  const indexPath = path.join(rootDir, "dist", "index.html");
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // In development, if we reach here, it's a 404
    res.status(404).send("Not Found");
  }
});

const PORT = process.env.PORT || 4003;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  server.timeout = Number(process.env.API_REQUEST_TIMEOUT_MS || 30000);
}

module.exports = app;
