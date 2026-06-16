require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const { connectRedis, disconnectRedis } = require("./config/redis");
const { closeBullMq } = require("./config/bullmq");
const { startAuthSessionWorker } = require("./queues/authSessionQueue");
const { startCacheInvalidationWorker } = require("./queues/cacheInvalidationQueue");

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
const systemUpdateRoutes = require("./routes/systemUpdateRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const planningRoutes = require("./routes/planningRoutes");
const authorizationRoutes = require("./routes/authorizationRoutes");
const statusRoutes = require("./routes/statusRoutes");
const territoryRoutes = require("./routes/territoryRoutes");
const footerPageRoutes = require("./routes/footerPageRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const meetingRoutes = require("./routes/meetingRoutes");
const scheduler = require("./utils/scheduler");

// API Routes (Reload triggered)
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
app.use("/api/system-updates", systemUpdateRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/planning", planningRoutes);
app.use("/api/authorization", authorizationRoutes);
app.use("/api/statuses", statusRoutes);
app.use("/api/territories", territoryRoutes);
app.use("/api/footer-pages", footerPageRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/meetings", meetingRoutes);

app.get('/api/trigger-seed', async (req, res) => {
    try {
        const seedData = require('./seed_data_direct');
        await seedData();
        res.send('Seeded successfully');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/api/debug-updates', async (req, res) => {
    try {
        const SystemUpdate = require('./models/SystemUpdate');
        const updates = await SystemUpdate.find({}).lean();
        res.json({ success: true, count: updates.length, updates });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
});

app.get('/api/temp-migration-admin', async (req, res) => {
    try {
        const User = require('./models/User');
        const Company = require('./models/Company');
        const bcrypt = require('bcryptjs');

        // 1. Find a valid company (e.g. first company in DB)
        const company = await Company.findOne().lean();
        if (!company) {
            return res.status(404).send('No company found in database to assign to Admin@gmail.com');
        }
        const companyId = company._id;

        // 2. Find or update Admin@gmail.com to normal admin with companyId
        let adminUser = await User.findOne({ email: /Admin@gmail.com/i });
        if (adminUser) {
            adminUser.role = 'admin';
            adminUser.companyId = companyId;
            adminUser.isActive = true;
            adminUser.status = true;
            await adminUser.save();
        } else {
            // Create Admin@gmail.com if it doesn't exist
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash('123456', salt);
            adminUser = await User.create({
                name: 'Admin User',
                email: 'Admin@gmail.com',
                passwordHash,
                role: 'admin',
                companyId,
                isActive: true,
                status: true
            });
        }

        // 3. Find or create admin@arcrm.in with role SUPER_ADMIN and password 1235678
        const salt2 = await bcrypt.genSalt(10);
        const passwordHash2 = await bcrypt.hash('1235678', salt2);

        let superAdminUser = await User.findOne({ email: /admin@arcrm.in/i });
        if (superAdminUser) {
            superAdminUser.passwordHash = passwordHash2;
            superAdminUser.role = 'SUPER_ADMIN';
            superAdminUser.companyId = undefined; // Super Admins don't have companyId
            superAdminUser.isActive = true;
            superAdminUser.status = true;
            await superAdminUser.save();
        } else {
            superAdminUser = await User.create({
                name: 'Super Admin',
                email: 'admin@arcrm.in',
                passwordHash: passwordHash2,
                role: 'SUPER_ADMIN',
                isActive: true,
                status: true
            });
        }

        res.json({
            message: 'Migration completed successfully',
            adminUser: {
                id: adminUser._id,
                email: adminUser.email,
                role: adminUser.role,
                companyId: adminUser.companyId
            },
            superAdminUser: {
                id: superAdminUser._id,
                email: superAdminUser.email,
                role: superAdminUser.role
            }
        });
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

app.get('/api/debug-quotations', async (req, res) => {
    try {
        const Quotation = require('./models/Quotation');
        const quotations = await Quotation.find({}).lean();
        res.json(quotations);
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
app.get('/api/git-revert', (req, res) => {
    const { exec } = require('child_process');
    exec('git checkout -- d:/tally/Quotations/frontend/src/pages/Reports.jsx', (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ error: err.message, stderr });
        }
        res.json({ message: 'Git revert successful', stdout });
    });
});

// Start Scheduler
const startBackgroundServices = async () => {
  await dbStartupPromise;
  await redisStartupPromise;

  // Seed current platform release notes
  try {
    const SystemUpdate = require("./models/models/SystemUpdate" ? "./models/SystemUpdate" : "./models/SystemUpdate");
    await SystemUpdate.deleteOne({ version: "v2.8.1" });
    await SystemUpdate.findOneAndUpdate(
      { version: "v2.9.0" },
      {
        version: "v2.9.0",
        title: "Enquiry Register & Partner Workflow",
        message: "The enquiry module has been refreshed with a cleaner creation flow, partner tracking, reliable product row selection, and a proper enquiry register.",
        releaseNotes: [
          "Added Enquiry Register with view, edit, delete, filtering, and partner count visibility",
          "Removed extra enquiry reference fields from the create/edit form for faster entry",
          "Added partner details to enquiries, including company, contact, mobile, email, and notes",
          "Fixed product dropdown selection so every product row updates correctly, not only the first row",
          "Added system update release history to the notification bell",
          "Improved system updates history loading and latest release access"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date(),
        isActive: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await SystemUpdate.findOneAndUpdate(
      { version: "v3.0.0-meetings" },
      {
        version: "v3.0.0-meetings",
        title: "CRM Meetings Module Architecture Plan",
        message: "The Meetings module plan has been revised with UTC ISO scheduling, reminder tracking, soft deletes, conflict warnings, modular reports, and premium list, calendar, and agenda views.",
        releaseNotes: [
          "Store meeting startDateTime and endDateTime directly as UTC ISO Date fields",
          "Track one-day and thirty-minute reminders with remindersSent flags to prevent duplicate alerts",
          "Use soft deletes with isDeleted, deletedAt, and deletedBy instead of hard removal",
          "Add backend conflict detection for organizers and participants, with allowConflict override support",
          "Capture meeting outcomes for completed meetings and audit all status changes in statusHistory",
          "Split reporting into stats, user-summary, monthly-summary, and client-history endpoints",
          "Add notification support for meeting created, updated, cancelled, rescheduled, and reminder events",
          "Add frontend Meetings list, visual calendar, agenda, reporting dashboard, and create/edit conflict warning flow"
        ],
        deployedBy: "Super Admin",
        deployedAt: new Date("2026-06-16T21:22:39+05:30"),
        isActive: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.error("[Release Seed Error] Failed to seed system update:", err.message);
  }

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

// Temporary Debug: Inspect quotations and products in DB
(async () => {
    try {
        require('fs').writeFileSync(require('path').join(__dirname, 'test_run.txt'), 'Hello at ' + new Date().toISOString());
        await dbStartupPromise;
        const Quotation = require('./models/Quotation');
        const quotations = await Quotation.find({}).lean();
        const output = quotations.map(q => `ID: ${q._id}, quotationNo: ${q.quotationNo}, companyId: ${q.companyId}, status: ${q.status}`).join('\n');
        require('fs').writeFileSync(require('path').join(__dirname, 'debug_output.txt'), `Total quotations: ${quotations.length}\n${output}`);
        console.log("[DEBUG] Written quotations to debug_output.txt");

        const Product = require('./models/Product');
        const products = await Product.find({}).limit(50).lean();
        const prodOutput = products.map(p => `ID: ${p._id}, code: ${p.productCode}, name: ${p.productName}, price: ${p.basePrice}`).join('\n');
        require('fs').writeFileSync(require('path').join(__dirname, 'debug_products.txt'), `Total products: ${products.length}\n${prodOutput}`);
        console.log("[DEBUG] Written products to debug_products.txt");
    } catch (err) {
        require('fs').writeFileSync(require('path').join(__dirname, 'debug_error.txt'), `Error: ${err.message}\nStack: ${err.stack}`);
        console.error("[DEBUG] Error writing quotations/products:", err);
    }
})();

// Trigger nodemon reload
module.exports = app;
