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
import Terms from './pages/Terms';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Enquiries from './pages/Enquiries';
import CreateEnquiry from './pages/CreateEnquiry';
import EnquiryAnalytics from './pages/EnquiryAnalytics';
import Salespersons from './pages/Salespersons';
import Settings from './pages/Settings';
import Attributes from './pages/Attributes';
import Simulations from './pages/Simulations';
import PlanningScreen from './pages/PlanningScreen';
import Reports from './pages/Reports';
import Vendors from './pages/Vendors';
import Vouchers from './pages/Vouchers';
import CreateVoucher from './pages/CreateVoucher';
import Authorization from './pages/Authorization';
import StatusMaster from './pages/StatusMaster';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

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
            <Route path="/customers" element={<PermissionRoute permissionKey="master_customers"><Layout><Customers /></Layout></PermissionRoute>} />
            <Route path="/vendors" element={<PermissionRoute permissionKey="master_vendors"><Layout><Vendors /></Layout></PermissionRoute>} />
            <Route path="/enquiries" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><Enquiries /></Layout></PermissionRoute>} />
            <Route path="/enquiries/analytics" element={<PermissionRoute permissionKey="enquiry_analytics"><Layout><EnquiryAnalytics /></Layout></PermissionRoute>} />
            <Route path="/enquiries/create" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><CreateEnquiry /></Layout></PermissionRoute>} />
            <Route path="/enquiries/edit/:id" element={<PermissionRoute permissionKey="enquiry_leads"><Layout><CreateEnquiry /></Layout></PermissionRoute>} />
            <Route path="/products" element={<PermissionRoute permissionKey="master_products"><Layout><Products /></Layout></PermissionRoute>} />
            <Route path="/vouchers" element={<PermissionRoute permissionKey="sale_invoices"><Layout><Vouchers /></Layout></PermissionRoute>} />
            <Route path="/vouchers/new" element={<PermissionRoute permissionKey="sale_invoices"><Layout><CreateVoucher /></Layout></PermissionRoute>} />
            <Route path="/vouchers/:id" element={<PermissionRoute permissionKey="sale_invoices"><Layout><CreateVoucher /></Layout></PermissionRoute>} />
            <Route path="/mgrs" element={<PermissionRoute permissionKey="master_mgrs"><Layout><MGRMaster /></Layout></PermissionRoute>} />
            <Route path="/attributes" element={<PermissionRoute permissionKey="master_attributes"><Layout><Attributes /></Layout></PermissionRoute>} />
            <Route path="/planning" element={<PermissionRoute permissionKey="planning_screen"><Layout><ErrorBoundary><PlanningScreen /></ErrorBoundary></Layout></PermissionRoute>} />
            <Route path="/simulations" element={<PermissionRoute permissionKey="planning_simulations"><Layout><Simulations /></Layout></PermissionRoute>} />
            <Route path="/reports" element={<PermissionRoute permissionKey="reports_main"><Layout><Reports /></Layout></PermissionRoute>} />
            <Route path="/quotations" element={<PermissionRoute permissionKey="quotation_list"><Layout><Quotations /></Layout></PermissionRoute>} />
            <Route path="/quotations/new" element={<PermissionRoute permissionKey="quotation_list"><Layout><CreateQuotation /></Layout></PermissionRoute>} />
            <Route path="/quotations/:id" element={<PermissionRoute permissionKey="quotation_list"><Layout><CreateQuotation /></Layout></PermissionRoute>} />
            <Route path="/terms" element={<PermissionRoute permissionKey="master_terms"><Layout><Terms /></Layout></PermissionRoute>} />
            <Route path="/settings" element={<PermissionRoute permissionKey="settings_profile"><Layout><Settings /></Layout></PermissionRoute>} />
            <Route path="/status-master" element={<PermissionRoute adminOnly={true}><Layout><StatusMaster /></Layout></PermissionRoute>} />
            <Route path="/admin/authorization" element={<PermissionRoute permissionKey="admin_authorization"><Layout><Authorization /></Layout></PermissionRoute>} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
