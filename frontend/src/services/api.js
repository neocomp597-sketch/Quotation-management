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
};

export const productService = {
    getAll: () => api.get('/products'),
    getById: (id) => api.get(`/products/${id}`),
    create: (data) => api.post('/products', data),
    update: (id, data) => api.put(`/products/${id}`, data),
    delete: (id) => api.delete(`/products/${id}`),
};

export const quotationService = {
    getAll: () => api.get('/quotations'),
    getById: (id) => api.get(`/quotations/${id}`),
    create: (data) => api.post('/quotations', data),
    update: (id, data) => api.put(`/quotations/${id}`, data),
    delete: (id) => api.delete(`/quotations/${id}`),
    finalize: (id) => api.patch(`/quotations/${id}/finalize`),
    downloadPdf: (id) => api.get(`/quotations/${id}/pdf`, { responseType: 'blob' }),
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

export default api;
