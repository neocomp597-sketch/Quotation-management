import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add interceptors for auth if needed later
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const customerService = {
    getAll: () => api.get('/customers'),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`),
    bulkDelete: (ids) => api.post('/customers/bulk-delete', { ids }),
    bulkUpdate: (ids, updateData) => api.patch('/customers/bulk-update', { ids, updateData }),
};

export const productService = {
    getAll: () => api.get('/products'),
    getById: (id) => api.get(`/products/${id}`),
    getVendors: (id, availableOnly = false) => api.get(`/products/${id}/vendors${availableOnly ? '?available=true' : ''}`),
    updateVendor: (productId, vendorId, data) => api.patch(`/products/${productId}/vendor/${vendorId}`, data),
    create: (data) => api.post('/products', data),
    update: (id, data) => api.put(`/products/${id}`, data),
    delete: (id) => api.delete(`/products/${id}`),
    bulkDelete: (ids) => api.post('/products/bulk-delete', { ids }),
    bulkUpdate: (ids, updateData) => api.patch('/products/bulk-update', { ids, updateData }),
};

export const vendorService = {
    getAll: (activeOnly = false) => api.get(`/vendors${activeOnly ? '?active=true' : ''}`),
    getById: (id) => api.get(`/vendors/${id}`),
    create: (data) => api.post('/vendors', data),
    update: (id, data) => api.patch(`/vendors/${id}`, data),
    delete: (id) => api.delete(`/vendors/${id}`),
};

export const quotationService = {
    getAll: () => api.get('/quotations'),
    getById: (id) => api.get(`/quotations/${id}`),
    create: (data) => api.post('/quotations', data),
    update: (id, data) => api.put(`/quotations/${id}`, data),
    delete: (id) => api.delete(`/quotations/${id}`),
    finalize: (id) => api.patch(`/quotations/${id}/finalize`),
    downloadPdf: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
    getReports: () => api.get('/quotations/reports'),
};

export const termsService = {
    getAll: () => api.get('/terms'),
    create: (data) => api.post('/terms', data),
    update: (id, data) => api.put(`/terms/${id}`, data),
    delete: (id) => api.delete(`/terms/${id}`),
};

export const salespersonService = {
    getAll: () => api.get('/salespersons'),
    create: (data) => api.post('/salespersons', data),
    delete: (id) => api.delete(`/salespersons/${id}`),
};

export const userService = {
    updateProfile: (data) => api.put('/users/profile', data),
};

export const mgrService = {
    getAll: (type) => api.get(`/mgrs${type ? `?type=${type}` : ''}`),
    getById: (id) => api.get(`/mgrs/${id}`),
    create: (data) => api.post('/mgrs', data),
    update: (id, data) => api.put(`/mgrs/${id}`, data),
    delete: (id) => api.delete(`/mgrs/${id}`),
};

export const companySettingsService = {
    get: () => api.get('/company-settings'),
    update: (data) => api.put('/company-settings', data),
};

export const siteService = {
    getAll: (customerId) => api.get(`/sites${customerId ? `?customerId=${customerId}` : ''}`),
    create: (data) => api.post('/sites', data),
};

export const uploadService = {
    uploadImage: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return api.post('/upload/image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }
};

export const importService = {
    importProducts: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/import/products', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },
    importCustomers: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/import/customers', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },
    importAttributes: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post('/import/attributes', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },
    importAttributeMaster: (file, mgr3Id) => {
        const formData = new FormData();
        formData.append('file', file);
        if (mgr3Id) formData.append('mgr3Id', mgr3Id);
        return api.post('/import/attribute-master', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },
    getProductTemplate: () => api.get('/import/template/products', { responseType: 'blob' }),
    getAttributeTemplate: () => api.get('/import/template/attributes', { responseType: 'blob' }),
    getAttributeMasterTemplate: () => api.get('/import/template/attribute-master', { responseType: 'blob' }),
    getCustomerTemplate: () => api.get('/import/template/customers', { responseType: 'blob' }),

};

export const attributeService = {
    getByMGR3: (mgr3Id) => api.get(`/attributes/mgr3/${mgr3Id}`),
    create: (data) => api.post('/attributes', data),
    update: (id, data) => api.put(`/attributes/${id}`, data),
    delete: (id) => api.delete(`/attributes/${id}`),
};

export const productAttributeService = {
    getAll: () => api.get('/product-attributes'),
    getByProductCode: (code) => api.get(`/product-attributes/${code}`),
    save: (data) => api.post('/product-attributes', data),
    delete: (id) => api.delete(`/product-attributes/${id}`),
};

export const voucherService = {
    getAll: () => api.get('/vouchers'),
    getById: (id) => api.get(`/vouchers/${id}`),
    create: (data) => api.post('/vouchers', data),
    update: (id, data) => api.put(`/vouchers/${id}`, data),
    delete: (id) => api.delete(`/vouchers/${id}`),
};

export const enquiryService = {
    getAll: () => api.get('/enquiries'),
    getById: (id) => api.get(`/enquiries/${id}`),
    create: (data) => api.post('/enquiries', data),
    update: (id, data) => api.put(`/enquiries/${id}`, data),
    delete: (id) => api.delete(`/enquiries/${id}`),
};

export const analyticsService = {
    getSummary: (params) => api.get('/analytics/summary', { params }),
    getStages: (params) => api.get('/analytics/stages', { params }),
    getTrends: (period, params) => api.get('/analytics/trends', { params: { period, ...params } }),
    getFollowUps: (params) => api.get('/analytics/followups', { params }),
    getVendors: (params) => api.get('/analytics/vendors', { params }),
    getProducts: (params) => api.get('/analytics/products', { params }),
    getUsers: (params) => api.get('/analytics/users', { params }),
    getProbability: (params) => api.get('/analytics/probability', { params }),
    getHealth: (params) => api.get('/analytics/health', { params }),
    exportReport: (type, params) => api.get('/analytics/export', { params: { type, ...params } }),
};

export const planningService = {
    getAll: (financialYear) => api.get(`/planning${financialYear ? `?financialYear=${financialYear}` : ''}`),
    create: (data) => api.post('/planning', data),
    update: (id, data) => api.put(`/planning/${id}`, data),
    delete: (id) => api.delete(`/planning/${id}`),
    getMGRReport: (financialYear, type) => api.get(`/planning/mgr-report?financialYear=${financialYear}${type ? `&type=${type}` : ''}`),
};

export const notificationService = {
    getUnread: () => api.get('/notifications/unread'),
    getAll: () => api.get('/notifications'),
    markAsRead: (id) => api.patch(`/notifications/${id}/read`),
    dismiss: (id) => api.patch(`/notifications/${id}/dismiss`),
};

export default api;
