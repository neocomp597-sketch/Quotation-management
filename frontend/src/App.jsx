import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import PermissionRoute from './components/PermissionRoute';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Products from './pages/Products';
import MGRMaster from './pages/MGRMaster';
import Quotations from './pages/Quotations';
import CreateQuotation from './pages/CreateQuotation';
import QuoteConversionReport from './pages/QuoteConversionReport';
import Terms from './pages/Terms';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Enquiries from './pages/Enquiries';
import CreateEnquiry from './pages/CreateEnquiry';
import EnquiryAnalytics from './pages/EnquiryAnalytics';
import Meetings from './pages/Meetings';
import CreateMeeting from './pages/CreateMeeting';
import Salespersons from './pages/Salespersons';
import Settings from './pages/Settings';
import Attributes from './pages/Attributes';
import Simulations from './pages/Simulations';
import PlanningScreen from './pages/PlanningScreen';
import Reports from './pages/Reports';
import Vendors from './pages/Vendors';
import Vendor360Workspace from './pages/Vendor360Workspace';
import Vouchers from './pages/Vouchers';
import CreateVoucher from './pages/CreateVoucher';
import Authorization from './pages/Authorization';
import StatusMaster from './pages/StatusMaster';
import TerritoryMaster from './pages/TerritoryMaster';
import BranchMaster from './pages/BranchMaster';
import StateMaster from './pages/StateMaster';
import CityMaster from './pages/CityMaster';
import SerialNoMaster from './pages/SerialNoMaster';
import Contacts from './pages/Contacts';
import Contact360Workspace from './pages/Contact360Workspace';
import SuperAdmin from './pages/SuperAdmin';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import FooterPageView from './pages/FooterPageView';
import SystemUpdates from './pages/SystemUpdates';

import PayrollDashboard from './pages/PayrollDashboard';
import PayrollEmployees from './pages/PayrollEmployees';
import PayrollRuns from './pages/PayrollRuns';
import PayrollPayments from './pages/PayrollPayments';
import PayrollPayslips from './pages/PayrollPayslips';
import PayrollLetters from './pages/PayrollLetters';
import PayrollReports from './pages/PayrollReports';
import PayrollSettingsPage from './pages/PayrollSettingsPage';
import PayrollMasters from './pages/PayrollMasters';
import OrgChart from './pages/OrgChart';
import Flowcharts from './pages/Flowcharts';

import CSMDashboard from './pages/CSMDashboard';
import CSMTickets from './pages/CSMTickets';
import TicketDetail from './pages/TicketDetail';
import ServiceVisits from './pages/ServiceVisits';
import WarrantyAMC from './pages/WarrantyAMC';
import KnowledgeBase from './pages/KnowledgeBase';
import CSMMasters from './pages/CSMMasters';
import CSMReports from './pages/CSMReports';

import SalesDashboard from './pages/SalesDashboard';
import DealBoard from './pages/DealBoard';
import DealDetail from './pages/DealDetail';
import SalesPipelines from './pages/SalesPipelines';
import SalesForecasting from './pages/SalesForecasting';
import SalesActivities from './pages/SalesActivities';
import SalesTargets from './pages/SalesTargets';
import SalesReports from './pages/SalesReports';
import SalesAnalytics from './pages/SalesAnalytics';

// Tender Pages
import TenderDashboard from './pages/TenderDashboard';
import TenderRegister from './pages/TenderRegister';
import TenderReports from './pages/TenderReports';

// CPQ Pages
import CatalogSubmodule from './pages/CatalogSubmodule';
import PriceManagement from './pages/PriceManagement';
import GuidedSelling from './pages/GuidedSelling';
import CPQConfigurator from './pages/CPQConfigurator';
import QuoteSimulator from './pages/QuoteSimulator';
import Approvals from './pages/Approvals';
import Contracts from './pages/Contracts';
import Orders from './pages/Orders';
import RevenueAnalytics from './pages/RevenueAnalytics';
import CompetitorIntel from './pages/CompetitorIntel';
import AIPricingInsights from './pages/AIPricingInsights';
import CustomerPricingDashboard from './pages/CustomerPricingDashboard';
import CustomerAnalytics from './pages/CustomerAnalytics';
import Customer360Workspace from './pages/Customer360Workspace';

function App() {
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
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
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
            <Route path="/super-admin" element={<PermissionRoute superAdminOnly={true}><Layout><SuperAdmin /></Layout></PermissionRoute>} />
            <Route path="/system-updates" element={<PermissionRoute><Layout><SystemUpdates /></Layout></PermissionRoute>} />

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
            <Route path="/csm/warranties-amc" element={<PermissionRoute permissionKey="csm_warranties_amc"><Layout><WarrantyAMC /></Layout></PermissionRoute>} />
            <Route path="/csm/kb" element={<PermissionRoute permissionKey="csm_kb"><Layout><KnowledgeBase /></Layout></PermissionRoute>} />
            <Route path="/csm/masters" element={<PermissionRoute permissionKey="csm_masters"><Layout><CSMMasters /></Layout></PermissionRoute>} />
            <Route path="/csm/masters/new" element={<PermissionRoute permissionKey="csm_masters"><Layout><CSMMasters isCreatePage={true} /></Layout></PermissionRoute>} />
            <Route path="/csm/reports" element={<PermissionRoute permissionKey="csm_dashboard"><Layout><CSMReports /></Layout></PermissionRoute>} />
            
            {/* Tender Routes */}
            <Route path="/tender/dashboard" element={<PermissionRoute permissionKey="tender_dashboard"><Layout><TenderDashboard /></Layout></PermissionRoute>} />
            <Route path="/tender/register" element={<PermissionRoute permissionKey="tender_register"><Layout><TenderRegister /></Layout></PermissionRoute>} />
            <Route path="/tender/reports" element={<PermissionRoute permissionKey="tender_reports"><Layout><TenderReports /></Layout></PermissionRoute>} />

            <Route path="/info/:slug" element={<Layout><FooterPageView /></Layout>} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
