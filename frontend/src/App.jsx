import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Quotations from './pages/Quotations';
import CreateQuotation from './pages/CreateQuotation';
import Terms from './pages/Terms';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Salespersons from './pages/Salespersons';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes directly wrapped in Layout */}
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/salespersons" element={<Layout><Salespersons /></Layout>} />
        <Route path="/customers" element={<Layout><Customers /></Layout>} />
        <Route path="/products" element={<Layout><Products /></Layout>} />
        <Route path="/quotations" element={<Layout><Quotations /></Layout>} />
        <Route path="/quotations/new" element={<Layout><CreateQuotation /></Layout>} />
        <Route path="/quotations/:id" element={<Layout><CreateQuotation /></Layout>} />
        <Route path="/terms" element={<Layout><Terms /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />

        {/* Fallback route */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
