import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import PermissionRoute from './components/PermissionRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PageSkeleton from './components/Skeletons';

// Route components are loaded on demand so the first page load only ships
// the shell (router, layout, auth) instead of every screen in the app.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const Products = lazy(() => import('./pages/Products'));
const MGRMaster = lazy(() => import('./pages/MGRMaster'));
const Quotations = lazy(() => import('./pages/Quotations'));
const CreateQuotation = lazy(() => import('./pages/CreateQuotation'));
const QuoteConversionReport = lazy(() => import('./pages/QuoteConversionReport'));
const Terms = lazy(() => import('./pages/Terms'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Enquiries = lazy(() => import('./pages/Enquiries'));
const EnquiryDetail = lazy(() => import('./pages/EnquiryDetail'));
const ScheduleEnquiryVisit = lazy(() => import('./pages/ScheduleEnquiryVisit'));
const CreateEnquiry = lazy(() => import('./pages/CreateEnquiry'));
const EnquiryAnalytics = lazy(() => import('./pages/EnquiryAnalytics'));
const Meetings = lazy(() => import('./pages/Meetings'));
const CreateMeeting = lazy(() => import('./pages/CreateMeeting'));
const Salespersons = lazy(() => import('./pages/Salespersons'));
const Settings = lazy(() => import('./pages/Settings'));
const Attributes = lazy(() => import('./pages/Attributes'));
const Simulations = lazy(() => import('./pages/Simulations'));
const PlanningScreen = lazy(() => import('./pages/PlanningScreen'));
const Reports = lazy(() => import('./pages/Reports'));
const Vendors = lazy(() => import('./pages/Vendors'));
const Vendor360Workspace = lazy(() => import('./pages/Vendor360Workspace'));
const Vouchers = lazy(() => import('./pages/Vouchers'));
const CreateVoucher = lazy(() => import('./pages/CreateVoucher'));
const Authorization = lazy(() => import('./pages/Authorization'));
const StatusMaster = lazy(() => import('./pages/StatusMaster'));
const TerritoryMaster = lazy(() => import('./pages/TerritoryMaster'));
const BranchMaster = lazy(() => import('./pages/BranchMaster'));
const StateMaster = lazy(() => import('./pages/StateMaster'));
const CityMaster = lazy(() => import('./pages/CityMaster'));
const SerialNoMaster = lazy(() => import('./pages/SerialNoMaster'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Contact360Workspace = lazy(() => import('./pages/Contact360Workspace'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin'));
const FooterPageView = lazy(() => import('./pages/FooterPageView'));
const SystemUpdates = lazy(() => import('./pages/SystemUpdates'));
const LandingPlanManager = lazy(() => import('./pages/LandingPlanManager'));
const DeveloperLayout = lazy(() => import('./pages/Developer/DeveloperLayout'));
const DeveloperOverview = lazy(() => import('./pages/Developer/pages/Overview'));
const DeveloperQuickStart = lazy(() => import('./pages/Developer/pages/QuickStart'));
const DeveloperAuthentication = lazy(() => import('./pages/Developer/pages/Authentication'));
const DeveloperApiKeys = lazy(() => import('./pages/Developer/pages/ApiKeys'));
const DeveloperApiReference = lazy(() => import('./pages/Developer/pages/ApiReference'));
const DeveloperWebhooks = lazy(() => import('./pages/Developer/pages/Webhooks'));
const DeveloperErrors = lazy(() => import('./pages/Developer/pages/Errors'));
const DeveloperRateLimits = lazy(() => import('./pages/Developer/pages/RateLimits'));
const DeveloperLogs = lazy(() => import('./pages/Developer/pages/Logs'));
const PayrollDashboard = lazy(() => import('./pages/PayrollDashboard'));
const PayrollEmployees = lazy(() => import('./pages/PayrollEmployees'));
const PayrollRuns = lazy(() => import('./pages/PayrollRuns'));
const PayrollPayments = lazy(() => import('./pages/PayrollPayments'));
const PayrollPayslips = lazy(() => import('./pages/PayrollPayslips'));
const PayrollLetters = lazy(() => import('./pages/PayrollLetters'));
const PayrollReports = lazy(() => import('./pages/PayrollReports'));
const PayrollSettingsPage = lazy(() => import('./pages/PayrollSettingsPage'));
const PayrollMasters = lazy(() => import('./pages/PayrollMasters'));
const OrgChart = lazy(() => import('./pages/OrgChart'));
const Flowcharts = lazy(() => import('./pages/Flowcharts'));
const CSMDashboard = lazy(() => import('./pages/CSMDashboard'));
const CSMTickets = lazy(() => import('./pages/CSMTickets'));
const TicketDetail = lazy(() => import('./pages/TicketDetail'));
const ServiceVisits = lazy(() => import('./pages/ServiceVisits'));
const FieldAttendance = lazy(() => import('./pages/FieldAttendance'));
const CSMVisitPlanner = lazy(() => import('./pages/CSMVisitPlanner'));
const WarrantyAMC = lazy(() => import('./pages/WarrantyAMC'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const CSMMasters = lazy(() => import('./pages/CSMMasters'));
const CSMReports = lazy(() => import('./pages/CSMReports'));
const CSMRcaReport = lazy(() => import('./pages/CSMRcaReport'));
const SalesDashboard = lazy(() => import('./pages/SalesDashboard'));
const DealBoard = lazy(() => import('./pages/DealBoard'));
const DealDetail = lazy(() => import('./pages/DealDetail'));
const SalesPipelines = lazy(() => import('./pages/SalesPipelines'));
const SalesForecasting = lazy(() => import('./pages/SalesForecasting'));
const SalesActivities = lazy(() => import('./pages/SalesActivities'));
const SalesTargets = lazy(() => import('./pages/SalesTargets'));
const SalesReports = lazy(() => import('./pages/SalesReports'));
const SalesAnalytics = lazy(() => import('./pages/SalesAnalytics'));
const TenderDashboard = lazy(() => import('./pages/TenderDashboard'));
const TenderRegister = lazy(() => import('./pages/TenderRegister'));
const TenderReports = lazy(() => import('./pages/TenderReports'));
const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard'));
const StockMatrix = lazy(() => import('./pages/inventory/StockMatrix'));
const ProductStockDetail = lazy(() => import('./pages/inventory/ProductStockDetail'));
const WarehouseMaster = lazy(() => import('./pages/inventory/WarehouseMaster'));
const WarehouseForm = lazy(() => import('./pages/inventory/WarehouseForm'));
const StockTransfers = lazy(() => import('./pages/inventory/StockTransfers'));
const CreateTransfer = lazy(() => import('./pages/inventory/CreateTransfer'));
const StockAdjustments = lazy(() => import('./pages/inventory/StockAdjustments'));
const CreateAdjustment = lazy(() => import('./pages/inventory/CreateAdjustment'));
const StockAudits = lazy(() => import('./pages/inventory/StockAudits'));
const CreateAudit = lazy(() => import('./pages/inventory/CreateAudit'));
const RecordAuditCount = lazy(() => import('./pages/inventory/RecordAuditCount'));
const StockAlertsPage = lazy(() => import('./pages/inventory/StockAlertsPage'));
const InventoryReports = lazy(() => import('./pages/inventory/InventoryReports'));
const CatalogSubmodule = lazy(() => import('./pages/CatalogSubmodule'));
const PriceManagement = lazy(() => import('./pages/PriceManagement'));
const GuidedSelling = lazy(() => import('./pages/GuidedSelling'));
const CPQConfigurator = lazy(() => import('./pages/CPQConfigurator'));
const QuoteSimulator = lazy(() => import('./pages/QuoteSimulator'));
const Approvals = lazy(() => import('./pages/Approvals'));
const Contracts = lazy(() => import('./pages/Contracts'));
const Orders = lazy(() => import('./pages/Orders'));
const RevenueAnalytics = lazy(() => import('./pages/RevenueAnalytics'));
const CompetitorIntel = lazy(() => import('./pages/CompetitorIntel'));
const AIPricingInsights = lazy(() => import('./pages/AIPricingInsights'));
const CustomerPricingDashboard = lazy(() => import('./pages/CustomerPricingDashboard'));
const CustomerAnalytics = lazy(() => import('./pages/CustomerAnalytics'));
const Customer360Workspace = lazy(() => import('./pages/Customer360Workspace'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const SelectBranch = lazy(() => import('./pages/SelectBranch'));






// Tender Pages

// Inventory Pages

// CPQ Pages


// Warm up the screens people open most, once the browser is idle after first paint.
// Their chunks are then already in memory when the menu is clicked, so the route
// spinner does not appear at all.
const prefetchCommonRoutes = () => {
  // Never spend someone else's bandwidth: skip on Data Saver or a slow connection.
  const connection = typeof navigator !== 'undefined'
    ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection)
    : null;
  if (connection) {
    if (connection.saveData) return;
    if (/(^|-)(2g|slow-2g)$/.test(connection.effectiveType || '')) return;
  }

  const load = () => Promise.allSettled([
    import('./pages/Dashboard'),
    import('./pages/CSMTickets'),
    import('./pages/CSMDashboard'),
    import('./pages/Customers'),
    import('./pages/PayrollEmployees'),
    import('./pages/ServiceVisits'),
  ]);
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 4000 });
  } else {
    setTimeout(load, 2000);
  }
};

function App() {
  React.useEffect(() => {
    prefetchCommonRoutes();
  }, []);

  return (
    <AuthProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        style={{ zIndex: 100000 }}
        toastStyle={{
          borderRadius: '1rem',
          fontWeight: '600',
        }}
      />
      <Router>
        <Suspense fallback={<PageSkeleton />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/select-branch" element={<SelectBranch />} />
            <Route path="/dashboard" element={<PermissionRoute permissionKey="dashboard_overview"><Layout><Dashboard /></Layout></PermissionRoute>} />
            <Route path="/salespersons" element={<PermissionRoute permissionKey="admin_salespersons"><Layout><Salespersons /></Layout></PermissionRoute>} />
            <Route path="/salespersons/new" element={<PermissionRoute permissionKey="admin_salespersons"><Layout><Salespersons isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/salespersons/edit/:id" element={<PermissionRoute permissionKey="admin_salespersons"><Layout><Salespersons isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/customers" element={<PermissionRoute permissionKey="master_customers"><Layout><Customers /></Layout></PermissionRoute>} />
            <Route path="/customers/new" element={<PermissionRoute permissionKey="master_customers"><Layout><Customers isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/customers/edit/:id" element={<PermissionRoute permissionKey="master_customers"><Layout><Customers isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/customers/analytics" element={<PermissionRoute permissionKey="master_customers"><Layout><CustomerAnalytics /></Layout></PermissionRoute>} />
            <Route path="/customers/:id/360" element={<PermissionRoute permissionKey="master_customers"><Layout><Customer360Workspace /></Layout></PermissionRoute>} />
            <Route path="/vendors" element={<PermissionRoute permissionKey="master_vendors"><Layout><Vendors /></Layout></PermissionRoute>} />
            <Route path="/vendors/new" element={<PermissionRoute permissionKey="master_vendors"><Layout><Vendors isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/vendors/edit/:id" element={<PermissionRoute permissionKey="master_vendors"><Layout><Vendors isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/vendors/:id/360" element={<PermissionRoute permissionKey="master_vendors"><Layout><Vendor360Workspace /></Layout></PermissionRoute>} />
            <Route path="/contacts" element={<PermissionRoute permissionKey="master_contacts"><Layout><Contacts /></Layout></PermissionRoute>} />
            <Route path="/contacts/new" element={<PermissionRoute permissionKey="master_contacts"><Layout><Contacts isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/contacts/edit/:id" element={<PermissionRoute permissionKey="master_contacts"><Layout><Contacts isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/contacts/:id/360" element={<PermissionRoute permissionKey="master_contacts"><Layout><Contact360Workspace /></Layout></PermissionRoute>} />
            <Route path="/enquiries" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><Enquiries /></Layout></PermissionRoute>} />
            <Route path="/enquiries/analytics" element={<PermissionRoute permissionKey="enquiry_analytics"><Layout><EnquiryAnalytics /></Layout></PermissionRoute>} />
            <Route path="/enquiries/create" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><CreateEnquiry /></Layout></PermissionRoute>} />
            <Route path="/enquiries/edit/:id" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><CreateEnquiry /></Layout></PermissionRoute>} />
            <Route path="/enquiries/view/:id" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><EnquiryDetail /></Layout></PermissionRoute>} />
            <Route path="/enquiries/view/:id/visit/new" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><ScheduleEnquiryVisit /></Layout></PermissionRoute>} />
            <Route path="/enquiries/view/:id/visit/edit/:visitIndex" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><ScheduleEnquiryVisit /></Layout></PermissionRoute>} />
            <Route path="/enquiries/details/:id" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><EnquiryDetail /></Layout></PermissionRoute>} />
            <Route path="/enquiries/:id/visit/new" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><ScheduleEnquiryVisit /></Layout></PermissionRoute>} />
            <Route path="/enquiries/:id/visit/edit/:visitIndex" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><ScheduleEnquiryVisit /></Layout></PermissionRoute>} />
            <Route path="/enquiries/:id" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><EnquiryDetail /></Layout></PermissionRoute>} />
            <Route path="/meetings" element={<PermissionRoute permissionKey="meetings_list"><Layout><Meetings /></Layout></PermissionRoute>} />
            <Route path="/meetings/new" element={<PermissionRoute permissionKey="meetings_list"><Layout><CreateMeeting /></Layout></PermissionRoute>} />
            <Route path="/meetings/:id" element={<PermissionRoute permissionKey="meetings_list"><Layout><CreateMeeting /></Layout></PermissionRoute>} />
            <Route path="/products" element={<PermissionRoute permissionKey="master_products"><Layout><Products initialTab="products" /></Layout></PermissionRoute>} />
            <Route path="/products/new" element={<PermissionRoute permissionKey="master_products"><Layout><Products initialTab="products" isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/products/edit/:id" element={<PermissionRoute permissionKey="master_products"><Layout><Products initialTab="products" isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/invoices" element={<PermissionRoute permissionKey="sale_invoices"><Layout><CreateVoucher mode="invoice" /></Layout></PermissionRoute>} />
            <Route path="/invoices/new" element={<PermissionRoute permissionKey="sale_invoices"><Layout><CreateVoucher mode="invoice" /></Layout></PermissionRoute>} />
            <Route path="/invoices/view/:id" element={<PermissionRoute permissionKey="sale_invoices"><Layout><CreateVoucher mode="invoice" isViewOnly={true} /></Layout></PermissionRoute>} />
            <Route path="/invoices/:id" element={<PermissionRoute permissionKey="sale_invoices"><Layout><CreateVoucher mode="invoice" /></Layout></PermissionRoute>} />
            <Route path="/vouchers" element={<Navigate to="/grn" replace />} />
            <Route path="/vouchers/new" element={<Navigate to="/grn/new" replace />} />
            <Route path="/vouchers/:id" element={<Navigate to="/grn" replace />} />
            <Route path="/grn" element={<PermissionRoute permissionKey="purchase_grn"><Layout><Vouchers mode="grn" /></Layout></PermissionRoute>} />
            <Route path="/grn/new" element={<PermissionRoute permissionKey="purchase_grn"><Layout><CreateVoucher mode="grn" /></Layout></PermissionRoute>} />
            <Route path="/grn/view/:id" element={<PermissionRoute permissionKey="purchase_grn"><Layout><CreateVoucher mode="grn" isViewOnly={true} /></Layout></PermissionRoute>} />
            <Route path="/grn/:id" element={<PermissionRoute permissionKey="purchase_grn"><Layout><CreateVoucher mode="grn" /></Layout></PermissionRoute>} />
            <Route path="/mgrs" element={<PermissionRoute permissionKey="master_mgrs"><Layout><MGRMaster /></Layout></PermissionRoute>} />
            <Route path="/mgrs/new" element={<PermissionRoute permissionKey="master_mgrs"><Layout><MGRMaster isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/mgrs/edit/:id" element={<PermissionRoute permissionKey="master_mgrs"><Layout><MGRMaster isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/attributes" element={<PermissionRoute permissionKey="master_attributes"><Layout><Attributes /></Layout></PermissionRoute>} />
            <Route path="/attributes/new" element={<PermissionRoute permissionKey="master_attributes"><Layout><Attributes isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/attributes/edit/:id" element={<PermissionRoute permissionKey="master_attributes"><Layout><Attributes isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/planning" element={<PermissionRoute permissionKey="planning_screen"><Layout><ErrorBoundary><PlanningScreen /></ErrorBoundary></Layout></PermissionRoute>} />
            <Route path="/simulations" element={<PermissionRoute permissionKey="planning_simulations"><Layout><Simulations /></Layout></PermissionRoute>} />
            <Route path="/reports" element={<PermissionRoute permissionKey="reports_main"><Layout><Reports /></Layout></PermissionRoute>} />
            <Route path="/quotations" element={<PermissionRoute permissionKey="quotation_list"><Layout><Quotations /></Layout></PermissionRoute>} />
            <Route path="/quotations/conversion-report" element={<PermissionRoute permissionKey="reports_main"><Layout><QuoteConversionReport /></Layout></PermissionRoute>} />
            <Route path="/quotations/new" element={<PermissionRoute permissionKey="quotation_list"><Layout><CreateQuotation /></Layout></PermissionRoute>} />
            <Route path="/quotations/:id" element={<PermissionRoute permissionKey="quotation_list"><Layout><CreateQuotation /></Layout></PermissionRoute>} />
            <Route path="/terms" element={<PermissionRoute permissionKey="master_terms"><Layout><Terms /></Layout></PermissionRoute>} />
            <Route path="/terms/new" element={<PermissionRoute permissionKey="master_terms"><Layout><Terms isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/terms/edit/:id" element={<PermissionRoute permissionKey="master_terms"><Layout><Terms isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/territory-master" element={<PermissionRoute permissionKey="master_territories"><Layout><TerritoryMaster /></Layout></PermissionRoute>} />
            <Route path="/territory-master/new" element={<PermissionRoute permissionKey="master_territories"><Layout><TerritoryMaster isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/territory-master/edit/:id" element={<PermissionRoute permissionKey="master_territories"><Layout><TerritoryMaster isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/branches" element={<PermissionRoute permissionKey="master_branches"><Layout><BranchMaster /></Layout></PermissionRoute>} />
            <Route path="/branches/new" element={<PermissionRoute permissionKey="master_branches"><Layout><BranchMaster isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/branches/edit/:id" element={<PermissionRoute permissionKey="master_branches"><Layout><BranchMaster isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/state-master" element={<PermissionRoute permissionKey="master_branches"><Layout><StateMaster /></Layout></PermissionRoute>} />
            <Route path="/state-master/new" element={<PermissionRoute permissionKey="master_branches"><Layout><StateMaster isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/state-master/edit/:id" element={<PermissionRoute permissionKey="master_branches"><Layout><StateMaster isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/city-master" element={<PermissionRoute permissionKey="master_branches"><Layout><CityMaster /></Layout></PermissionRoute>} />
            <Route path="/city-master/new" element={<PermissionRoute permissionKey="master_branches"><Layout><CityMaster isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/city-master/edit/:id" element={<PermissionRoute permissionKey="master_branches"><Layout><CityMaster isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/masters/city" element={<PermissionRoute permissionKey="master_branches"><Layout><CityMaster /></Layout></PermissionRoute>} />
            <Route path="/serial-no-master" element={<PermissionRoute permissionKey="master_serials"><Layout><SerialNoMaster /></Layout></PermissionRoute>} />
            <Route path="/flowcharts" element={<PermissionRoute permissionKey="flowchart_view"><Layout><Flowcharts /></Layout></PermissionRoute>} />
            <Route path="/settings" element={<PermissionRoute permissionKey="settings_profile"><Layout><Settings /></Layout></PermissionRoute>} />
            <Route path="/status-master" element={<PermissionRoute adminOnly={true}><Layout><StatusMaster /></Layout></PermissionRoute>} />
            <Route path="/status-master/new" element={<PermissionRoute adminOnly={true}><Layout><StatusMaster isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/status-master/edit/:id" element={<PermissionRoute adminOnly={true}><Layout><StatusMaster isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/admin/authorization" element={<PermissionRoute permissionKey="admin_authorization"><Layout><Authorization /></Layout></PermissionRoute>} />
            <Route path="/admin/landing-plans" element={<PermissionRoute adminOnly={true}><Layout><LandingPlanManager /></Layout></PermissionRoute>} />
            <Route path="/super-admin" element={<PermissionRoute superAdminOnly={true}><Layout><SuperAdmin /></Layout></PermissionRoute>} />
            <Route path="/system-updates" element={<PermissionRoute><Layout><SystemUpdates /></Layout></PermissionRoute>} />

            {/* Developer Portal Routes */}
            <Route path="/developer" element={<DeveloperLayout />}>
              <Route index element={<Navigate to="/developer/overview" replace />} />
              <Route path="overview" element={<DeveloperOverview />} />
              <Route path="quick-start" element={<DeveloperQuickStart />} />
              <Route path="authentication" element={<DeveloperAuthentication />} />
              <Route path="api-keys" element={<DeveloperApiKeys />} />
              <Route path="api-reference" element={<DeveloperApiReference />} />
              <Route path="webhooks" element={<DeveloperWebhooks />} />
              <Route path="errors" element={<DeveloperErrors />} />
              <Route path="rate-limits" element={<DeveloperRateLimits />} />
              <Route path="logs" element={<DeveloperLogs />} />
            </Route>

            {/* Sales Pipeline Routes */}
            <Route path="/sales/dashboard" element={<PermissionRoute permissionKey="sales_dashboard"><Layout><SalesDashboard /></Layout></PermissionRoute>} />
            <Route path="/sales/deals" element={<PermissionRoute permissionKey="sales_deals"><Layout><DealBoard /></Layout></PermissionRoute>} />
            <Route path="/sales/deals/new" element={<PermissionRoute permissionKey="sales_deals"><Layout><DealDetail /></Layout></PermissionRoute>} />
            <Route path="/sales/deals/:id" element={<PermissionRoute permissionKey="sales_deals"><Layout><DealDetail /></Layout></PermissionRoute>} />
            <Route path="/sales/pipelines" element={<PermissionRoute permissionKey="sales_pipelines"><Layout><SalesPipelines /></Layout></PermissionRoute>} />
            <Route path="/sales/forecasting" element={<PermissionRoute permissionKey="sales_forecasting"><Layout><SalesForecasting /></Layout></PermissionRoute>} />
            <Route path="/sales/activities" element={<PermissionRoute permissionKey="sales_activities"><Layout><SalesActivities /></Layout></PermissionRoute>} />
            <Route path="/sales/targets" element={<PermissionRoute permissionKey="sales_targets"><Layout><SalesTargets /></Layout></PermissionRoute>} />
            <Route path="/sales/reports" element={<PermissionRoute permissionKey="sales_reports"><Layout><SalesReports /></Layout></PermissionRoute>} />
            <Route path="/sales/analytics" element={<PermissionRoute permissionKey="sales_analytics"><Layout><SalesAnalytics /></Layout></PermissionRoute>} />

            {/* Sales & CPQ Routes */}
            <Route path="/sales/catalog/products" element={<PermissionRoute permissionKey="sales_catalog"><Layout><Products initialTab="products" /></Layout></PermissionRoute>} />
            <Route path="/sales/catalog/services" element={<PermissionRoute permissionKey="sales_catalog"><Layout><Products initialTab="services" /></Layout></PermissionRoute>} />
            <Route path="/sales/catalog/bundles" element={<PermissionRoute permissionKey="sales_catalog"><Layout><Products initialTab="bundles" /></Layout></PermissionRoute>} />
            <Route path="/sales/catalog/subscriptions" element={<PermissionRoute permissionKey="sales_catalog"><Layout><Products initialTab="subscriptions" /></Layout></PermissionRoute>} />
            
            <Route path="/sales/price-management/price-books" element={<PermissionRoute permissionKey="sales_price_management"><Layout><PriceManagement mode="price-books" /></Layout></PermissionRoute>} />
            <Route path="/sales/price-management/pricing-rules" element={<PermissionRoute permissionKey="sales_price_management"><Layout><PriceManagement mode="pricing-rules" /></Layout></PermissionRoute>} />
            <Route path="/sales/price-management/discounts" element={<PermissionRoute permissionKey="sales_price_management"><Layout><PriceManagement mode="discounts" /></Layout></PermissionRoute>} />
            <Route path="/sales/price-management/promotions" element={<PermissionRoute permissionKey="sales_price_management"><Layout><PriceManagement mode="promotions" /></Layout></PermissionRoute>} />
            <Route path="/sales/price-management/currencies" element={<PermissionRoute permissionKey="sales_price_management"><Layout><PriceManagement mode="currencies" /></Layout></PermissionRoute>} />
            
            <Route path="/sales/cpq/guided-selling" element={<PermissionRoute permissionKey="sales_cpq"><Layout><GuidedSelling /></Layout></PermissionRoute>} />
            <Route path="/sales/cpq/configurator" element={<PermissionRoute permissionKey="sales_cpq"><Layout><CPQConfigurator /></Layout></PermissionRoute>} />
            <Route path="/sales/cpq/simulator" element={<PermissionRoute permissionKey="sales_cpq"><Layout><QuoteSimulator /></Layout></PermissionRoute>} />
            
            <Route path="/sales/approvals" element={<PermissionRoute permissionKey="sales_approvals"><Layout><Approvals /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="dashboard" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/dashboard" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="dashboard" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/list" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="contracts" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/templates" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="templates" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/clauses" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="clauses" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/approvals" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="approvals" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/renewals" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="renewals" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/reports" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="reports" /></Layout></PermissionRoute>} />
            <Route path="/sales/contracts/settings" element={<PermissionRoute permissionKey="sales_contracts"><Layout><Contracts mode="settings" /></Layout></PermissionRoute>} />
            <Route path="/sales/orders" element={<PermissionRoute permissionKey="sales_orders"><Layout><Orders /></Layout></PermissionRoute>} />
            <Route path="/sales/revenue-analytics" element={<PermissionRoute permissionKey="sales_revenue_analytics"><Layout><RevenueAnalytics /></Layout></PermissionRoute>} />
            <Route path="/sales/competitors" element={<PermissionRoute permissionKey="sales_competitors"><Layout><CompetitorIntel /></Layout></PermissionRoute>} />
            <Route path="/sales/ai-pricing" element={<PermissionRoute permissionKey="sales_ai_pricing"><Layout><AIPricingInsights /></Layout></PermissionRoute>} />
            <Route path="/sales/customer-pricing" element={<PermissionRoute permissionKey="master_customers"><Layout><CustomerPricingDashboard /></Layout></PermissionRoute>} />

            {/* Payroll Routes */}
            <Route path="/payroll/dashboard" element={<PermissionRoute permissionKey="payroll_runs"><Layout><PayrollDashboard /></Layout></PermissionRoute>} />
            <Route path="/payroll/employees" element={<PermissionRoute permissionKey="payroll_employees"><Layout><PayrollEmployees /></Layout></PermissionRoute>} />
            <Route path="/payroll/employees/new" element={<PermissionRoute permissionKey="payroll_employees"><Layout><PayrollEmployees isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/payroll/employees/edit/:id" element={<PermissionRoute permissionKey="payroll_employees"><Layout><PayrollEmployees isEditPage={true} /></Layout></PermissionRoute>} />
            <Route path="/payroll/org-chart" element={<PermissionRoute permissionKey="payroll_org_chart"><Layout><OrgChart /></Layout></PermissionRoute>} />
            <Route path="/org-chart" element={<PermissionRoute permissionKey="payroll_org_chart"><Layout><OrgChart /></Layout></PermissionRoute>} />
            <Route path="/payroll/runs" element={<PermissionRoute permissionKey="payroll_runs"><Layout><PayrollRuns /></Layout></PermissionRoute>} />
            <Route path="/payroll/payments" element={<PermissionRoute permissionKey="payroll_payments"><Layout><PayrollPayments /></Layout></PermissionRoute>} />
            <Route path="/payroll/payslips" element={<PermissionRoute permissionKey="payroll_runs"><Layout><PayrollPayslips /></Layout></PermissionRoute>} />
            <Route path="/payroll/letters" element={<PermissionRoute permissionKey="payroll_letters"><Layout><PayrollLetters /></Layout></PermissionRoute>} />
            <Route path="/payroll/reports" element={<PermissionRoute permissionKey="payroll_reports"><Layout><PayrollReports /></Layout></PermissionRoute>} />
            <Route path="/payroll/settings" element={<PermissionRoute permissionKey="payroll_settings"><Layout><PayrollSettingsPage /></Layout></PermissionRoute>} />
            <Route path="/payroll/masters" element={<PermissionRoute permissionKey="payroll_employees"><Layout><PayrollMasters /></Layout></PermissionRoute>} />
            <Route path="/payroll/masters/new" element={<PermissionRoute permissionKey="payroll_employees"><Layout><PayrollMasters isCreatePage={true} /></Layout></PermissionRoute>} />

            {/* CSM Routes */}
            <Route path="/csm/dashboard" element={<PermissionRoute permissionKey="csm_dashboard"><Layout><CSMDashboard /></Layout></PermissionRoute>} />
            <Route path="/csm/tickets" element={<PermissionRoute permissionKey="csm_tickets"><Layout><CSMTickets /></Layout></PermissionRoute>} />
            <Route path="/csm/tickets/:id" element={<PermissionRoute permissionKey="csm_tickets"><Layout><TicketDetail /></Layout></PermissionRoute>} />
            <Route path="/csm/visits" element={<PermissionRoute permissionKey="csm_visits"><Layout><ServiceVisits /></Layout></PermissionRoute>} />
            <Route path="/csm/field-attendance" element={<PermissionRoute permissionKey="csm_attendance"><Layout><FieldAttendance /></Layout></PermissionRoute>} />
            <Route path="/csm/attendance" element={<PermissionRoute permissionKey="csm_attendance"><Layout><FieldAttendance /></Layout></PermissionRoute>} />
            <Route path="/csm/visit-planner" element={<PermissionRoute permissionKey="csm_visits"><Layout><CSMVisitPlanner /></Layout></PermissionRoute>} />
            <Route path="/csm/warranties-amc" element={<PermissionRoute permissionKey="csm_warranties_amc"><Layout><WarrantyAMC /></Layout></PermissionRoute>} />
            <Route path="/csm/kb" element={<PermissionRoute permissionKey="csm_kb"><Layout><KnowledgeBase /></Layout></PermissionRoute>} />
            <Route path="/csm/masters" element={<PermissionRoute permissionKey="csm_masters"><Layout><CSMMasters /></Layout></PermissionRoute>} />
            <Route path="/csm/masters/new" element={<PermissionRoute permissionKey="csm_masters"><Layout><CSMMasters isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/csm/reports" element={<PermissionRoute permissionKey="csm_reports"><Layout><CSMReports /></Layout></PermissionRoute>} />
            <Route path="/csm/rca" element={<PermissionRoute permissionKey="csm_rca"><Layout><CSMRcaReport /></Layout></PermissionRoute>} />
            
            {/* Tender Routes */}
            <Route path="/tender/dashboard" element={<PermissionRoute permissionKey="tender_dashboard"><Layout><TenderDashboard /></Layout></PermissionRoute>} />
            <Route path="/tender/register" element={<PermissionRoute permissionKey="tender_register"><Layout><TenderRegister /></Layout></PermissionRoute>} />
            <Route path="/tender/reports" element={<PermissionRoute permissionKey="tender_reports"><Layout><TenderReports /></Layout></PermissionRoute>} />

            {/* Inventory Routes */}
            <Route path="/inventory/dashboard" element={<PermissionRoute permissionKey="inventory_dashboard"><Layout><InventoryDashboard /></Layout></PermissionRoute>} />
            <Route path="/inventory/stock" element={<PermissionRoute permissionKey="inventory_items"><Layout><StockMatrix /></Layout></PermissionRoute>} />
            <Route path="/inventory/stock/:id" element={<PermissionRoute permissionKey="inventory_items"><Layout><ProductStockDetail /></Layout></PermissionRoute>} />
            <Route path="/inventory/warehouses" element={<PermissionRoute permissionKey="inventory_warehouses"><Layout><WarehouseMaster /></Layout></PermissionRoute>} />
            <Route path="/inventory/warehouses/new" element={<PermissionRoute permissionKey="inventory_warehouses"><Layout><WarehouseForm /></Layout></PermissionRoute>} />
            <Route path="/inventory/warehouses/edit/:id" element={<PermissionRoute permissionKey="inventory_warehouses"><Layout><WarehouseForm /></Layout></PermissionRoute>} />
            <Route path="/inventory/transfers" element={<PermissionRoute permissionKey="inventory_transfers"><Layout><StockTransfers /></Layout></PermissionRoute>} />
            <Route path="/inventory/transfers/new" element={<PermissionRoute permissionKey="inventory_transfers"><Layout><CreateTransfer /></Layout></PermissionRoute>} />
            <Route path="/inventory/adjustments" element={<PermissionRoute permissionKey="inventory_adjustments"><Layout><StockAdjustments /></Layout></PermissionRoute>} />
            <Route path="/inventory/adjustments/new" element={<PermissionRoute permissionKey="inventory_adjustments"><Layout><CreateAdjustment /></Layout></PermissionRoute>} />
            <Route path="/inventory/counts" element={<PermissionRoute permissionKey="inventory_stock_counts"><Layout><StockAudits /></Layout></PermissionRoute>} />
            <Route path="/inventory/counts/new" element={<PermissionRoute permissionKey="inventory_stock_counts"><Layout><CreateAudit /></Layout></PermissionRoute>} />
            <Route path="/inventory/counts/record/:id" element={<PermissionRoute permissionKey="inventory_stock_counts"><Layout><RecordAuditCount /></Layout></PermissionRoute>} />
            <Route path="/inventory/alerts" element={<PermissionRoute permissionKey="inventory_alerts"><Layout><StockAlertsPage /></Layout></PermissionRoute>} />
            <Route path="/inventory/reports" element={<PermissionRoute permissionKey="inventory_reports"><Layout><InventoryReports /></Layout></PermissionRoute>} />

            <Route path="/info/:slug" element={<Layout><FooterPageView /></Layout>} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
