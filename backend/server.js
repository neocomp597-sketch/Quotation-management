const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const { connectRedis, disconnectRedis } = require("./config/redis");
const { closeBullMq } = require("./config/bullmq");
const { startAuthSessionWorker } = require("./queues/authSessionQueue");
const { startCacheInvalidationWorker } = require("./queues/cacheInvalidationQueue");
require("dotenv").config();

const app = express();

// Connect to Database
const dbStartupPromise = connectDB();
const redisStartupPromise = connectRedis().then(() => {
  console.log("Redis connected");
}).catch(() => {
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
const territoryRoutes = require("./routes/territoryRoutes");
const footerPageRoutes = require("./routes/footerPageRoutes");
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
app.use("/api/territories", territoryRoutes);
app.use("/api/footer-pages", footerPageRoutes);

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
const startBackgroundServices = async () => {
  await dbStartupPromise;
  await redisStartupPromise;

  // Database Migration for 'Sept' month entries
  try {
    const Planning = require("./models/Planning");
    const FY_MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const entries = await Planning.find({
      $or: [
        { monthYear: /Sept/i },
        { month: { $lt: 1 } },
        { month: { $gt: 12 } },
        { month: null }
      ]
    });
    if (entries.length > 0) {
      console.log(`[Migration] Found ${entries.length} planning documents with invalid months. Correcting...`);
      let updatedCount = 0;
      for (const entry of entries) {
        let changed = false;
        if (entry.monthYear && entry.monthYear.toLowerCase().startsWith('sept')) {
          const parts = entry.monthYear.split('-');
          const yearSuffix = parts[1];
          entry.monthYear = `Sep-${yearSuffix}`;
          changed = true;
        }
        if (entry.monthYear) {
          const prefix = entry.monthYear.split('-')[0].substring(0, 3);
          const expectedMonth = FY_MONTH_NAMES.findIndex(
            m => m.toLowerCase() === prefix.toLowerCase()
          ) + 1;
          if (expectedMonth > 0 && entry.month !== expectedMonth) {
            entry.month = expectedMonth;
            changed = true;
          }
        }
        if (changed) {
          await entry.save();
          updatedCount++;
        }
      }
      console.log(`[Migration] Successfully updated ${updatedCount} planning documents.`);
    } else {
      console.log("[Migration] No invalid planning documents found.");
    }
  } catch (migErr) {
    console.error("[Migration] Error during startup migration:", migErr.message);
  }

  try {
      const RolePermission = require("./models/RolePermission");
      await RolePermission.collection.dropIndex('role_1');
      console.log('[Migration] Dropped old role_1 index successfully.');
  } catch (err) {
      // Ignore if index doesn't exist
  }

  await startCacheInvalidationWorker();
  await startAuthSessionWorker();
  await scheduler.startScheduler();
};

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

  startBackgroundServices().catch((error) => {
    console.error("Failed to start background services:", error.message);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Closing server...`);
    server.close(async () => {
      scheduler.stopScheduler();
      await closeBullMq();
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

module.exports = app;
