const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
require("dotenv").config();

const app = express();

// Connect to Database
connectDB();

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

// SPA fallback — THIS FIXES YOUR ISSUE
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(rootDir, "dist", "index.html"));
});

const PORT = process.env.PORT || 4003;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
