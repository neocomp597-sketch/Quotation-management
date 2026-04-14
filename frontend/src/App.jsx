import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
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
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/salespersons" element={<Layout><Salespersons /></Layout>} />
            <Route path="/customers" element={<Layout><Customers /></Layout>} />
            <Route path="/vendors" element={<Layout><Vendors /></Layout>} />
            <Route path="/enquiries" element={<Layout><Enquiries /></Layout>} />
            <Route path="/enquiries/analytics" element={<Layout><EnquiryAnalytics /></Layout>} />
            <Route path="/enquiries/create" element={<Layout><CreateEnquiry /></Layout>} />
            <Route path="/enquiries/edit/:id" element={<Layout><CreateEnquiry /></Layout>} />
            <Route path="/products" element={<Layout><Products /></Layout>} />
            <Route path="/vouchers" element={<Layout><Vouchers /></Layout>} />
            <Route path="/vouchers/new" element={<Layout><CreateVoucher /></Layout>} />
            <Route path="/vouchers/:id" element={<Layout><CreateVoucher /></Layout>} />
            <Route path="/mgrs" element={<Layout><MGRMaster /></Layout>} />
            <Route path="/attributes" element={<Layout><Attributes /></Layout>} />
            <Route path="/planning" element={<Layout><PlanningScreen /></Layout>} />
            <Route path="/simulations" element={<Layout><Simulations /></Layout>} />
            <Route path="/reports" element={<Layout><Reports /></Layout>} />
            <Route path="/quotations" element={<Layout><Quotations /></Layout>} />
            <Route path="/quotations/new" element={<Layout><CreateQuotation /></Layout>} />
            <Route path="/quotations/:id" element={<Layout><CreateQuotation /></Layout>} />
            <Route path="/terms" element={<Layout><Terms /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
