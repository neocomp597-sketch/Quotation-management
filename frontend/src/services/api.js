import axios from "axios";

let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4003/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh", {}, { skipAuthRefresh: true })
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh
    ) {
      originalRequest._retry = true;
      try {
        await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(error);
  },
);

export const customerService = {
  getAll: (params) => api.get("/customers", { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post("/customers", data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  bulkDelete: (ids) => api.post("/customers/bulk-delete", { ids }),
  bulkUpdate: (ids, updateData) =>
    api.patch("/customers/bulk-update", { ids, updateData }),
  checkDuplicate: (params) => api.get("/customers/check-duplicate", { params }),
};

export const productService = {
  getAll: (params) => api.get("/products", { params }),
  getVendors: (id, availableOnly = false) =>
    api.get(`/products/${id}/vendors${availableOnly ? "?available=true" : ""}`),
  updateVendor: (productId, vendorId, data) =>
    api.patch(`/products/${productId}/vendor/${vendorId}`, data),
  create: (data) => api.post("/products", data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  bulkDelete: (ids) => api.post("/products/bulk-delete", { ids }),
  bulkUpdate: (ids, updateData) =>
    api.patch("/products/bulk-update", { ids, updateData }),
};

export const vendorService = {
  getAll: (activeOnly = false, params = {}) =>
    api.get("/vendors", { params: { ...(activeOnly ? { active: true } : {}), ...params } }),
  getById: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post("/vendors", data),
  update: (id, data) => api.patch(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};

export const quotationService = {
  getAll: (params) => api.get("/quotations", { params }),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post("/quotations", data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`),
  finalize: (id) => api.patch(`/quotations/${id}/finalize`),
  downloadPdf: (id) =>
    api.get(`/quotations/${id}/pdf`, { responseType: "blob" }),
  getReports: () => api.get("/quotations/reports"),
  getDraft: (draftKey = "new") => api.get(`/quotations/drafts/${draftKey}`),
  autosaveDraft: (draftKey = "new", payload) =>
    api.put(`/quotations/drafts/${draftKey}`, payload),
  deleteDraft: (draftKey = "new") => api.delete(`/quotations/drafts/${draftKey}`),
};

export const termsService = {
  getAll: (params) => api.get("/terms", { params }),
  create: (data) => api.post("/terms", data),
  update: (id, data) => api.put(`/terms/${id}`, data),
  delete: (id) => api.delete(`/terms/${id}`),
};

export const salespersonService = {
  getAll: (params) => api.get("/salespersons", { params }),
  create: (data) => api.post("/salespersons", data),
  delete: (id) => api.delete(`/salespersons/${id}`),
};

export const authService = {
  login: (data) => api.post("/auth/login", data),
  register: (data) => api.post("/auth/register", data),
  refresh: () => refreshAccessToken(),
  logout: () => api.post("/auth/logout", {}, { skipAuthRefresh: true }),
  logoutAll: () => api.post("/auth/logout-all"),
  getMe: () => api.get("/auth/me"),
};

export const userService = {
  getAll: () => api.get("/users"),
  updateProfile: (data) => api.put("/users/profile", data),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
};

export const authorizationService = {
  getAll: () => api.get("/authorization"),
  getMy: () => api.get("/authorization/me"),
  update: (role, permissions) =>
    api.put(`/authorization/${role}`, { permissions }),
  initialize: () => api.post("/authorization/initialize"),
  createRole: (label, description) =>
    api.post("/authorization/roles", { label, description }),
  updateRoleMeta: (role, label, description) =>
    api.patch(`/authorization/roles/${role}`, { label, description }),
  deleteRole: (role) => api.delete(`/authorization/roles/${role}`),
};


export const mgrService = {
  getAll: (type, params = {}) => api.get("/mgrs", { params: { ...(type ? { type } : {}), ...params } }),
  getById: (id) => api.get(`/mgrs/${id}`),
  create: (data) => api.post("/mgrs", data),
  update: (id, data) => api.put(`/mgrs/${id}`, data),
  delete: (id) => api.delete(`/mgrs/${id}`),
};

export const companySettingsService = {
  get: () => api.get("/company-settings"),
  update: (data) => api.put("/company-settings", data),
};

export const siteService = {
  getAll: (customerId) =>
    api.get(`/sites${customerId ? `?customerId=${customerId}` : ""}`),
  create: (data) => api.post("/sites", data),
};

export const uploadService = {
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append("image", file);
    return api.post("/upload/image", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

export const importService = {
  importProducts: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/import/products", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  importCustomers: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/import/customers", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  importAttributes: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/import/attributes", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  importAttributeMaster: (file, mgr3Id) => {
    const formData = new FormData();
    formData.append("file", file);
    if (mgr3Id) formData.append("mgr3Id", mgr3Id);
    return api.post("/import/attribute-master", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  importPlanning: (file, financialYear, onUploadProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    if (financialYear) formData.append("financialYear", financialYear);
    return api.post("/import/planning", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress,
    });
  },
  getProductTemplate: () =>
    api.get("/import/template/products", { responseType: "blob" }),
  getAttributeTemplate: () =>
    api.get("/import/template/attributes", { responseType: "blob" }),
  getAttributeMasterTemplate: () =>
    api.get("/import/template/attribute-master", { responseType: "blob" }),
  getCustomerTemplate: () =>
    api.get("/import/template/customers", { responseType: "blob" }),
  getPlanningTemplate: (financialYear) =>
    api.get("/import/template/planning", {
      responseType: "blob",
      params: financialYear ? { financialYear } : undefined,
    }),
};

export const attributeService = {
  getByMGR3: (mgr3Id) => api.get(`/attributes/mgr3/${mgr3Id}`),
  create: (data) => api.post("/attributes", data),
  update: (id, data) => api.put(`/attributes/${id}`, data),
  delete: (id) => api.delete(`/attributes/${id}`),
};

export const productAttributeService = {
  getAll: () => api.get("/product-attributes"),
  getByProductCode: (code) => api.get(`/product-attributes/${code}`),
  save: (data) => api.post("/product-attributes", data),
  delete: (id) => api.delete(`/product-attributes/${id}`),
};

export const voucherService = {
  getAll: () => api.get("/vouchers"),
  getById: (id) => api.get(`/vouchers/${id}`),
  create: (data) => api.post("/vouchers", data),
  update: (id, data) => api.put(`/vouchers/${id}`, data),
  delete: (id) => api.delete(`/vouchers/${id}`),
};

export const enquiryService = {
  getAll: () => api.get("/enquiries"),
  getById: (id) => api.get(`/enquiries/${id}`),
  create: (data) => api.post("/enquiries", data),
  update: (id, data) => api.put(`/enquiries/${id}`, data),
  delete: (id) => api.delete(`/enquiries/${id}`),
};

export const analyticsService = {
  getSummary: (params) => api.get("/analytics/summary", { params }),
  getStages: (params) => api.get("/analytics/stages", { params }),
  getTrends: (period, params) =>
    api.get("/analytics/trends", { params: { period, ...params } }),
  getFollowUps: (params) => api.get("/analytics/followups", { params }),
  getVendors: (params) => api.get("/analytics/vendors", { params }),
  getProducts: (params) => api.get("/analytics/products", { params }),
  getUsers: (params) => api.get("/analytics/users", { params }),
  getProbability: (params) => api.get("/analytics/probability", { params }),
  getHealth: (params) => api.get("/analytics/health", { params }),
  exportReport: (type, params) =>
    api.get("/analytics/export", { params: { type, ...params } }),
};

export const planningService = {
  getAll: (params = {}) => api.get("/planning", { params }),
  create: (data) => api.post("/planning", data),
  update: (id, data) => api.put(`/planning/${id}`, data),
  delete: (id) => api.delete(`/planning/${id}`),
  getMGRReport: (financialYear, type, filters = {}) =>
    api.get("/planning/mgr-report", {
      params: {
        financialYear,
        type,
        ...filters,
      },
    }),
};

export const notificationService = {
  getUnread: () => api.get("/notifications/unread"),
  getAll: () => api.get("/notifications"),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  dismiss: (id) => api.patch(`/notifications/${id}/dismiss`),
};

export const statusService = {
  getAll: (params) => api.get("/statuses", { params }),
  create: (data) => api.post("/statuses", data),
  update: (id, data) => api.put(`/statuses/${id}`, data),
  delete: (id) => api.delete(`/statuses/${id}`),
};

export const territoryService = {
  getAll: (params) => api.get("/territories", { params }),
  create: (data) => api.post("/territories", data),
  update: (id, data) => api.put(`/territories/${id}`, data),
  delete: (id) => api.delete(`/territories/${id}`),
};

export default api;
