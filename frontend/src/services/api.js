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
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:4003/api"),
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

export const categoryService = {
  getAll: () => api.get("/categories"),
  create: (data) => api.post("/categories", data),
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
  importWarranties: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/import/warranties", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  importAmcs: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/import/amcs", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  getWarrantyTemplate: () =>
    api.get("/import/template/warranties", { responseType: "blob" }),
  getAmcTemplate: () =>
    api.get("/import/template/amcs", { responseType: "blob" }),
  importTickets: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/import/tickets", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
  getTicketTemplate: () =>
    api.get("/import/template/tickets", { responseType: "blob" }),
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

  // Departments
  getDepartments: () => api.get("/payroll/departments"),
  createDepartment: (data) => api.post("/payroll/departments", data),
  updateDepartment: (id, data) => api.put(`/payroll/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/payroll/departments/${id}`),

  // Designations
  getDesignations: () => api.get("/payroll/designations"),
  createDesignation: (data) => api.post("/payroll/designations", data),
  updateDesignation: (id, data) => api.put(`/payroll/designations/${id}`, data),
  deleteDesignation: (id) => api.delete(`/payroll/designations/${id}`),

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

export const salesService = {
  // Deal Sources
  getSources: () => api.get("/sales/deals/sources"),
  createSource: (data) => api.post("/sales/deals/sources", data),
  deleteSource: (id) => api.delete(`/sales/deals/sources/${id}`),

  // Pipelines
  getPipelines: () => api.get("/sales/pipelines"),
  getPipeline: (id) => api.get(`/sales/pipelines/${id}`),
  createPipeline: (data) => api.post("/sales/pipelines", data),
  updatePipeline: (id, data) => api.put(`/sales/pipelines/${id}`, data),
  deletePipeline: (id) => api.delete(`/sales/pipelines/${id}`),
  seedPipelines: () => api.post("/sales/pipelines/seed-defaults"),

  // Deals
  getDeals: (params = {}) => api.get("/sales/deals", { params }),
  getDealBoard: (pipelineId, params = {}) => api.get(`/sales/deals/board/${pipelineId}`, { params }),
  getDeal: (id) => api.get(`/sales/deals/${id}`),
  createDeal: (data) => api.post("/sales/deals", data),
  updateDeal: (id, data) => api.put(`/sales/deals/${id}`, data),
  updateDealStage: (id, stageId) => api.patch(`/sales/deals/${id}/stage`, { stageId }),
  markDealLost: (id, lostReason) => api.patch(`/sales/deals/${id}/lost`, { lostReason }),
  reopenDeal: (id) => api.patch(`/sales/deals/${id}/reopen`),
  deleteDeal: (id) => api.delete(`/sales/deals/${id}`),
  addDealActivity: (id, data) => api.post(`/sales/deals/${id}/activity`, data),
  getDealActivities: (id) => api.get(`/sales/deals/${id}/activities`),

  // Targets
  getTargets: (params = {}) => api.get("/sales/targets", { params }),
  createTarget: (data) => api.post("/sales/targets", data),
  bulkCreateTargets: (targets) => api.post("/sales/targets/bulk", { targets }),
  updateTarget: (id, data) => api.put(`/sales/targets/${id}`, data),
  deleteTarget: (id) => api.delete(`/sales/targets/${id}`),

  // Forecast
  getForecastDashboard: () => api.get("/sales/forecast/dashboard"),
  getRevenueForecast: (params = {}) => api.get("/sales/forecast/revenue", { params }),
  getForecastAccuracy: () => api.get("/sales/forecast/accuracy"),
  getRevenueTrends: () => api.get("/sales/forecast/trends"),
  takeSnapshot: () => api.post("/sales/forecast/snapshot"),

  // Analytics
  getPipelineFunnel: (pipelineId) => api.get(`/sales/analytics/funnel/${pipelineId}`),
  getStageDropoff: () => api.get("/sales/analytics/dropoff"),
  getStuckDeals: () => api.get("/sales/analytics/stuck"),
  getSalespersonAnalytics: () => api.get("/sales/analytics/salesperson"),
  getPipelineVelocity: () => api.get("/sales/analytics/velocity"),
  getSourceAnalytics: () => api.get("/sales/analytics/source"),
  getAllActivities: (params = {}) => api.get("/sales/analytics/activities", { params }),
};

export const csmService = {
  getStats: () => api.get("/csm/dashboard"),
  getTickets: (params = {}) => api.get("/csm/tickets", { params }),
  getTicketById: (id) => api.get(`/csm/tickets/${id}`),
  createTicket: (data) => api.post("/csm/tickets", data),
  updateTicket: (id, data) => api.put(`/csm/tickets/${id}`, data),
  assignTicket: (id, data) => api.patch(`/csm/tickets/${id}/assign`, data),
  updateTicketStatus: (id, status, isFirstCallResolved) => api.patch(`/csm/tickets/${id}/status`, { status, isFirstCallResolved }),
  getReportData: (params = {}) => api.get("/csm/reports", { params }),
  addComment: (id, data) => api.post(`/csm/tickets/${id}/comments`, data),
  escalateTicket: (id) => api.patch(`/csm/tickets/${id}/escalate`),
  submitFeedback: (id, data) => api.post(`/csm/tickets/${id}/feedback`, data),

  getVisits: (params = {}) => api.get("/csm/visits", { params }),
  getVisitById: (id) => api.get(`/csm/visits/${id}`),
  createVisit: (data) => api.post("/csm/visits", data),
  checkInVisit: (id, data) => api.post(`/csm/visits/${id}/check-in`, data),
  checkOutVisit: (id, data) => api.post(`/csm/visits/${id}/check-out`, data),

  verifyEntitlements: (params = {}) => api.get("/csm/entitlements/verify", { params }),
  getWarranties: () => api.get("/csm/warranties"),
  createWarranty: (data) => api.post("/csm/warranties", data),
  getAmcs: () => api.get("/csm/amcs"),
  createAmc: (data) => api.post("/csm/amcs", data),
  getAssets: (params = {}) => api.get("/csm/assets", { params }),
  createAsset: (data) => api.post("/csm/assets", data),
  getAssetSummary: (params = {}) => api.get("/csm/assets/summary", { params }),

  getArticles: (params = {}) => api.get("/csm/kb", { params }),
  getArticleById: (id) => api.get(`/csm/kb/${id}`),
  createArticle: (data) => api.post("/csm/kb", data),
  updateArticle: (id, data) => api.put(`/csm/kb/${id}`, data),
  deleteArticle: (id) => api.delete(`/csm/kb/${id}`),

  seedMasters: () => api.post("/csm/masters/seed"),
  seedMhData: () => api.post("/csm/masters/seed-mh"),
  seedKbData: () => api.post("/csm/masters/seed-kb"),
  getCategories: () => api.get("/csm/masters/categories"),
  createCategory: (data) => api.post("/csm/masters/categories", data),
  updateCategory: (id, data) => api.put(`/csm/masters/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/csm/masters/categories/${id}`),

  getSources: () => api.get("/csm/masters/sources"),
  createSource: (data) => api.post("/csm/masters/sources", data),
  updateSource: (id, data) => api.put(`/csm/masters/sources/${id}`, data),
  deleteSource: (id) => api.delete(`/csm/masters/sources/${id}`),

  getTypes: () => api.get("/csm/masters/types"),
  createType: (data) => api.post("/csm/masters/types", data),
  updateType: (id, data) => api.put(`/csm/masters/types/${id}`, data),
  deleteType: (id) => api.delete(`/csm/masters/types/${id}`),

  getPriorities: () => api.get("/csm/masters/priorities"),
  createPriority: (data) => api.post("/csm/masters/priorities", data),
  updatePriority: (id, data) => api.put(`/csm/masters/priorities/${id}`, data),
  deletePriority: (id) => api.delete(`/csm/masters/priorities/${id}`),

  getDesignations: () => api.get("/csm/masters/designations"),
  createDesignation: (data) => api.post("/csm/masters/designations", data),
  updateDesignation: (id, data) => api.put(`/csm/masters/designations/${id}`, data),
  deleteDesignation: (id) => api.delete(`/csm/masters/designations/${id}`),

  getCustomerContacts: (params = {}) => api.get("/csm/customer-contacts", { params }),
  createCustomerContact: (data) => api.post("/csm/customer-contacts", data),
  updateCustomerContact: (id, data) => api.put(`/csm/customer-contacts/${id}`, data),
  deleteCustomerContact: (id) => api.delete(`/csm/customer-contacts/${id}`),

  getSlaPolicies: () => api.get("/csm/masters/sla-policies"),
  createSlaPolicy: (data) => api.post("/csm/masters/sla-policies", data),
  updateSlaPolicy: (id, data) => api.put(`/csm/masters/sla-policies/${id}`, data),
  deleteSlaPolicy: (id) => api.delete(`/csm/masters/sla-policies/${id}`),

   getTeams: () => api.get("/csm/masters/teams"),
  createTeam: (data) => api.post("/csm/masters/teams", data),
  updateTeam: (id, data) => api.put(`/csm/masters/teams/${id}`, data),
  deleteTeam: (id) => api.delete(`/csm/masters/teams/${id}`),
};

export const cpqService = {
  // Price Books
  getPriceBooks: () => api.get("/cpq/price-books"),
  getPriceBook: (id) => api.get(`/cpq/price-books/${id}`),
  createPriceBook: (data) => api.post("/cpq/price-books", data),
  updatePriceBook: (id, data) => api.put(`/cpq/price-books/${id}`, data),
  deletePriceBook: (id) => api.delete(`/cpq/price-books/${id}`),
  
  // Price Book Items
  addItemToPriceBook: (data) => api.post("/cpq/price-books/items", data),
  getItemsInPriceBook: (priceBookId) => api.get(`/cpq/price-books/${priceBookId}/items`),
  removeItemFromPriceBook: (itemId) => api.delete(`/cpq/price-books/items/${itemId}`),
  
  // Pricing Rules
  getPricingRules: () => api.get("/cpq/pricing-rules"),
  createPricingRule: (data) => api.post("/cpq/pricing-rules", data),
  updatePricingRule: (id, data) => api.put(`/cpq/pricing-rules/${id}`, data),
  deletePricingRule: (id) => api.delete(`/cpq/pricing-rules/${id}`),

  // Discount Policies
  getDiscountPolicies: () => api.get("/cpq/discounts"),
  createDiscountPolicy: (data) => api.post("/cpq/discounts", data),
  updateDiscountPolicy: (id, data) => api.put(`/cpq/discounts/${id}`, data),
  deleteDiscountPolicy: (id) => api.delete(`/cpq/discounts/${id}`),

  // Promotions
  getPromotions: () => api.get("/cpq/promotions"),
  createPromotion: (data) => api.post("/cpq/promotions", data),
  updatePromotion: (id, data) => api.put(`/cpq/promotions/${id}`, data),
  deletePromotion: (id) => api.delete(`/cpq/promotions/${id}`),

  // Currencies
  getCurrencies: () => api.get("/cpq/currencies"),
  createCurrency: (data) => api.post("/cpq/currencies", data),

  // Subscriptions
  getSubscriptions: () => api.get("/cpq/subscriptions"),
  createSubscription: (data) => api.post("/cpq/subscriptions", data),

  // Configurator options templates
  getConfigTemplate: (productId) => api.get(`/cpq/config-templates/${productId}`),
  saveConfigTemplate: (data) => api.post("/cpq/config-templates", data),

  // Sandbox Simulator
  simulateQuote: (data) => api.post("/cpq/simulate", data),

  // Competitor log
  getCompetitors: () => api.get("/cpq/competitors"),
  createCompetitorPrice: (data) => api.post("/cpq/competitors", data),

  // Audit Logs
  getAuditLogs: () => api.get("/cpq/audit-logs"),

  // Contracts
  getContracts: () => api.get("/cpq/contracts"),
  createContract: (data) => api.post("/cpq/contracts", data),
  updateContract: (id, data) => api.put(`/cpq/contracts/${id}`, data),
  deleteContract: (id) => api.delete(`/cpq/contracts/${id}`),
};

export const orderService = {
  create: (data) => api.post("/orders", data),
  getAll: () => api.get("/orders"),
  getById: (id) => api.get(`/orders/${id}`),
  update: (id, data) => api.put(`/orders/${id}`, data),
  delete: (id) => api.delete(`/orders/${id}`),
  convertToInvoice: (id) => api.post(`/orders/${id}/invoice`),
};

export default api;
