import axios from "axios";

let accessToken = null;
let refreshPromise = null;
let refreshTimer = null;

const ACCESS_TOKEN_REFRESH_SKEW_MS = 60 * 1000;

try {
  accessToken = localStorage.getItem("accessToken") || null;
} catch {
  accessToken = null;
}

const decodeJwtPayload = (token) => {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const scheduleProactiveRefresh = (token) => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  const payload = decodeJwtPayload(token);
  const expiresAt = payload?.exp ? payload.exp * 1000 : null;
  if (!expiresAt) {
    return;
  }

  const refreshAt = Math.max(Date.now() + 5000, expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS);
  const delay = Math.max(5000, refreshAt - Date.now());

  refreshTimer = setTimeout(() => {
    refreshAccessToken().catch(() => {
      // The normal response interceptor will handle a real refresh failure.
    });
  }, delay);
};

export const setAccessToken = (token) => {
  accessToken = token || null;
  try {
    if (accessToken) {
      localStorage.setItem("accessToken", accessToken);
    } else {
      localStorage.removeItem("accessToken");
    }
  } catch {
    // Ignore storage failures and keep the in-memory token working.
  }
  scheduleProactiveRefresh(accessToken);
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
  if (/\/auth\/(refresh|logout|login|register)$/.test(config.url || "")) {
    return config;
  }

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
      .catch((err) => {
        // Clear immediately on failure so the next attempt can retry
        refreshPromise = null;
        throw err;
      })
      .then((data) => {
        // Keep the resolved promise cached briefly so React StrictMode
        // double-invocations (and other rapid callers) reuse it instead
        // of firing a second HTTP request.
        setTimeout(() => {
          refreshPromise = null;
        }, 2000);
        return data;
      });
  }

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const message = error.response?.data?.message || "";
    const isExpiredAuthError =
      error.response?.status === 401 &&
      /token expired|jwt expired|token failed|token invalid|no token|refresh token missing|refresh token invalid/i.test(message);

    if (
      error.response?.status === 403 &&
      /account deactivated|company account is suspended/i.test(message)
    ) {
      setAccessToken(null);
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    if (
      (isExpiredAuthError || error.response?.status === 401) &&
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
        localStorage.removeItem("user");
        if (window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
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
  updateStatus: (id, status) => api.patch(`/quotations/${id}/status`, { status }),
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
  getAll: (params) => api.get("/users", { params }),
  create: (data) => api.post("/users", data),
  updateProfile: (data) => api.put("/users/profile", data),
  updateRole: (id, role, params) => api.patch(`/users/${id}/role`, { role }, { params }),
  update: (id, data, params) => api.put(`/users/${id}`, data, { params }),
  delete: (id, params) => api.delete(`/users/${id}`, { params }),
};

export const authorizationService = {
  getAll: (params) => api.get("/authorization", { params }),
  getMy: () => api.get("/authorization/me"),
  update: (role, permissions, params) =>
    api.put(`/authorization/${role}`, { permissions }, { params }),
  initialize: (params) => api.post("/authorization/initialize", {}, { params }),
  createRole: (label, description, params) =>
    api.post("/authorization/roles", { label, description }, { params }),
  updateRoleMeta: (role, label, description, params) =>
    api.patch(`/authorization/roles/${role}`, { label, description }, { params }),
  deleteRole: (role, params) => api.delete(`/authorization/roles/${role}`, { params }),
};

export const superAdminService = {
  getCompanyStats: () => api.get("/super-admin/company-stats"),
  getCompanies: () => api.get("/super-admin/companies"),
  getUsers: (params) => api.get("/super-admin/users", { params }),
  getAuditLogs: (params) => api.get("/super-admin/audit-logs", { params }),
  updateCompanyStatus: (id, data) => api.patch(`/super-admin/companies/${id}/status`, data),
  updateUserStatus: (id, data) => api.patch(`/super-admin/users/${id}/status`, data),
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
  getAll: (params = {}) => api.get("/vouchers", { params }),
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

export const systemUpdateService = {
  getAll: () => api.get("/system-updates"),
  getLatest: () => api.get("/system-updates/latest"),
  create: (data) => api.post("/system-updates", data),
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

export const footerPageService = {
  getAll: () => api.get("/footer-pages"),
  getBySlug: (slug) => api.get(`/footer-pages/${slug}`),
  update: (slug, data) => api.put(`/footer-pages/${slug}`, data),
};

export const payrollService = {
  // Employee Profiles
  getEmployees: (params) => api.get("/payroll/employees", { params }),
  getEmployee: (id) => api.get(`/payroll/employees/${id}`),
  createEmployee: (data) => api.post("/payroll/employees", data),
  updateEmployee: (id, data) => api.put(`/payroll/employees/${id}`, data),
  updateEmployeeStructure: (id, data) => api.put(`/payroll/employees/${id}/structure`, data),
  deleteEmployee: (id) => api.delete(`/payroll/employees/${id}`),

  // Settings
  getSettings: () => api.get("/payroll/settings"),
  updateSettings: (data) => api.put("/payroll/settings", data),

  // Runs
  getRuns: () => api.get("/payroll/runs"),
  createRun: (data) => api.post("/payroll/runs", data),
  getRunDetails: (id) => api.get(`/payroll/runs/${id}`),
  calculateRun: (id) => api.post(`/payroll/runs/${id}/calculate`),
  approveRun: (id) => api.post(`/payroll/runs/${id}/approve`),
  lockRun: (id) => api.post(`/payroll/runs/${id}/lock`),
  updateEmployeeSummary: (runId, summaryId, data) => api.put(`/payroll/runs/${runId}/employee/${summaryId}`, data),
  updatePaymentDetails: (runId, summaryId, data) => api.put(`/payroll/runs/${runId}/employee/${summaryId}/payment`, data),
  getEmployeeSummary: (runId, summaryId) => api.get(`/payroll/runs/${runId}/employee/${summaryId}`),

  // Letters
  getLetters: () => api.get("/payroll/letters"),
  getLetter: (id) => api.get(`/payroll/letters/${id}`),
  createLetter: (data) => api.post("/payroll/letters", data),
  deleteLetter: (id) => api.delete(`/payroll/letters/${id}`),

  // Reports
  getReports: (params) => api.get("/payroll/reports", { params }),

  // Audit Logs
  getAuditLogs: () => api.get("/payroll/audit-logs"),
};

export const meetingService = {
  getAll: (params) => api.get("/meetings", { params }),
  getById: (id) => api.get(`/meetings/${id}`),
  create: (data) => api.post("/meetings", data),
  update: (id, data) => api.put(`/meetings/${id}`, data),
  delete: (id) => api.delete(`/meetings/${id}`),
  getStats: () => api.get("/meetings/stats"),
  getUserSummary: () => api.get("/meetings/user-summary"),
  getMonthlySummary: () => api.get("/meetings/monthly-summary"),
  getClientHistory: (relatedRecordId) => api.get("/meetings/client-history", { params: { relatedRecordId } }),
};

export const contactService = {
  getAll: (params = {}) => api.get("/contacts", { params }),
  getById: (id) => api.get(`/contacts/${id}`),
  create: (data) => api.post("/contacts", data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
};

export default api;
