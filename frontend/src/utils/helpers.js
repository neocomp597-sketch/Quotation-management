/**
 * Calculate tax and total for a line item
 */
export const calculateLineItem = (
  quantity,
  rate,
  discountPercent,
  gstPercentage,
) => {
  const amount = quantity * rate;
  const discountAmount = (amount * discountPercent) / 100;
  const taxableAmount = amount - discountAmount;
  const gstAmount = (taxableAmount * gstPercentage) / 100;
  const lineTotal = taxableAmount + gstAmount;

  return {
    discountAmount,
    taxableAmount,
    gstAmount,
    lineTotal,
  };
};

/**
 * Format currency to INR
 */
export const formatCurrency = (amount, decimals = 2) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(amount);
};

/**
 * Generate Quotation Number
 */
export const generateQuotationNo = (sequence) => {
  const year = new Date().getFullYear();
  const seqStr = sequence.toString().padStart(4, "0");
  return `ARM/QTN/${year}/${seqStr}`;
};

/**
 * Format Date
 */
export const formatDate = (date) => {
  if (!date) return "-";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const formatDateTime = (date) => {
  if (!date) return "-";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

/**
 * Resolve Backend Image URLs
 */
export const resolveImageUrl = (url) => {
  if (!url) return null;
  const trimmedUrl = String(url).trim();
  if (!trimmedUrl) return null;
  if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://") || trimmedUrl.startsWith("data:")) {
    return trimmedUrl;
  }

  // 1. Determine Backend Base URL
  let base = import.meta.env.VITE_BACKEND_URL || "";
  
  if (!base && import.meta.env.VITE_API_URL) {
    // Strip trailing /api or /api/ if present
    base = import.meta.env.VITE_API_URL.replace(/\/api\/?$/i, "");
  }

  if (!base) {
    if (typeof window !== "undefined" && window.location) {
      base = import.meta.env.PROD ? window.location.origin : "http://localhost:4003";
    } else {
      base = "http://localhost:4003";
    }
  }

  base = base.replace(/\/+$/, "");

  // 2. Clean up Windows backslashes and directory prefixes
  let cleanUrl = trimmedUrl.replace(/\\/g, "/");

  if (/\/uploads\//i.test(cleanUrl)) {
    cleanUrl = cleanUrl.replace(/^.*\/uploads\//i, "/uploads/");
  } else if (!cleanUrl.includes("/")) {
    cleanUrl = `/uploads/${cleanUrl}`;
  }

  if (!cleanUrl.startsWith("/")) {
    cleanUrl = `/${cleanUrl}`;
  }

  // In production, route /uploads/ via /api/uploads/ to bypass Nginx SPA routing rules
  if (import.meta.env.PROD && cleanUrl.startsWith("/uploads/")) {
    if (!import.meta.env.VITE_BACKEND_URL || (typeof window !== "undefined" && window.location && base === window.location.origin)) {
      cleanUrl = `/api${cleanUrl}`;
    }
  }

  return `${base}${cleanUrl}`;
};

const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');

export const getPublicUrl = (destination, filename) => {
    if (!destination) return filename ? `/uploads/${filename}` : '';
    const normalizedDest = String(destination).replace(/\\/g, '/');
    const parts = normalizedDest.split('/uploads/');
    const subPath = parts.length > 1 ? parts[1] : '';
    return subPath ? `/uploads/${subPath}/${filename}` : `/uploads/${filename}`;
};

export const getPublicAssetBaseUrl = () => {
    const candidates = [
        import.meta.env.PUBLIC_API_URL,
        import.meta.env.VITE_API_URL,
        import.meta.env.VITE_BACKEND_URL,
        typeof window !== 'undefined' && window.location ? window.location.origin : ''
    ];

    for (const candidate of candidates) {
        const trimmed = trimTrailingSlash(candidate || '');
        if (!trimmed) continue;

        try {
            const parsed = new URL(trimmed);
            return trimTrailingSlash(parsed.toString());
        } catch {
            if (trimmed.startsWith('http')) return trimmed;
        }
    }

    return typeof window !== 'undefined' && window.location ? window.location.origin : '';
};

export const toAbsolutePublicUrl = (pathOrUrl = '') => {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(pathOrUrl) || String(pathOrUrl).startsWith('data:')) return pathOrUrl;

    const normalizedPath = String(pathOrUrl).replace(/\\/g, '/');
    let cleanPath = normalizedPath;
    if (/\/uploads\//i.test(cleanPath)) {
        cleanPath = cleanPath.replace(/^.*\/uploads\//i, '/uploads/');
    }
    const finalPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    return resolveImageUrl(finalPath);
};

export const fetchPdfImageBase64 = async (url) => {
  // Transparent 1x1 pixel to prevent crashes
  const FALLBACK_IMAGE =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  if (!url) return FALLBACK_IMAGE;

  try {
    // If it's already a data URL, return it
    if (url.startsWith("data:")) return url;

    // If it's a local path (starts with /), prepend the backend URL
    let fetchUrl = url.trim();
    if (fetchUrl.startsWith("/")) {
      const base = import.meta.env.VITE_BACKEND_URL || (import.meta.env.PROD ? "" : "http://localhost:4003");
      fetchUrl = `${base}${fetchUrl}`;
    }

    // Ensure we handle Supabase/external URLs with CORS mode
    const response = await fetch(fetchUrl, { mode: "cors" });

    if (!response.ok)
      throw new Error(`Failed to fetch image: ${response.statusText}`);

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(FALLBACK_IMAGE); // Fallback on read error
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Failed to load PDF image, using fallback", e);
    return FALLBACK_IMAGE;
  }
};

/**
 * Generate a placeholder image URL based on product/customer name
 * Uses DiceBear API for consistent, attractive placeholders
 */
export const getPlaceholderImage = (seed, type = "shapes") => {
  const encodedSeed = encodeURIComponent(seed || "default");
  // Using DiceBear shapes style for products, initials for customers
  if (type === "initials") {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodedSeed}&backgroundColor=6366f1,8b5cf6,3b82f6,06b6d4,10b981&backgroundType=gradientLinear`;
  }
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodedSeed}&backgroundColor=f1f5f9`;
};

/**
 * Format GST Prefix / Single digit State Code with leading zero (e.g., 4 -> 04, 1 -> 01, 27 -> 27)
 */
export const formatGstPrefix = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const str = String(val).trim();
  if (!str) return '';
  if (/^\d{1,2}$/.test(str)) {
    return str.padStart(2, '0');
  }
  return str;
};

/**
 * Filter users/salespersons/employees strictly to active Sales Executives only.
 * Excludes vendors, admins, super admins, managers, and non-sales roles/designations.
 */
export const buildSalesExecutiveList = ({ fetchedSalespersons = [], fetchedUsers = [], fetchedEmployees = [] }) => {
  const empDesignationMap = new Map();
  (fetchedEmployees || []).forEach(emp => {
    if (!emp) return;
    const desig = String(emp.designation || '').trim();
    if (emp.email) {
      empDesignationMap.set(String(emp.email).toLowerCase().trim(), desig);
    }
    if (emp.userId) {
      const uId = typeof emp.userId === 'object' ? emp.userId._id : emp.userId;
      if (uId) empDesignationMap.set(String(uId), desig);
    }
  });

  const isVendor = (item) => {
    if (!item) return false;
    if (item.vendorId) return true;
    const nameLower = String(item.name || '').toLowerCase().trim();
    const emailLower = String(item.email || '').toLowerCase().trim();
    const roleLower = String(item.role || '').toLowerCase().trim();
    const typeLower = String(item.type || '').toLowerCase().trim();

    if (nameLower.includes('vendor') || nameLower.startsWith('venda') || nameLower.includes('venda ') || nameLower.includes('guest')) return true;
    if (emailLower.includes('vendor') || emailLower.includes('guest')) return true;
    if (roleLower.includes('vendor') || typeLower.includes('vendor')) return true;
    return false;
  };

  const isStrictSalesExecutive = (desigStr, roleStr, nameStr, emailStr, vendorId) => {
    if (vendorId) return false;

    const nameLower = String(nameStr || '').toLowerCase().trim();
    const emailLower = String(emailStr || '').toLowerCase().trim();
    if (nameLower.includes('vendor') || nameLower.startsWith('venda') || nameLower.includes('venda ') || emailLower.includes('vendor')) {
      return false;
    }

    const roleLower = String(roleStr || '').toLowerCase().trim().replace(/_/g, ' ');
    const desigLower = String(desigStr || '').toLowerCase().trim();

    // 1. Exclude Admin, Super Admin, Manager, Vendor, Guest
    const forbiddenRoles = ['admin', 'super admin', 'manager', 'mgr', 'vendor', 'customer', 'accountant', 'hr', 'director', 'head', 'lead', 'superadmin', 'guest'];
    if (forbiddenRoles.includes(roleLower)) {
      return false;
    }

    // Exclude if designation contains manager or admin or director or vendor
    if (desigLower.includes('manager') || desigLower.includes('mgr') || desigLower.includes('admin') || desigLower.includes('vendor') || desigLower.includes('director') || desigLower.includes('head')) {
      return false;
    }

    // 2. Strict Check for Sales Executive Designation or Role
    const validDesignations = ['sales executive', 'sales executive role', 'salesperson', 'sales representative', 'sales rep', 'executive - sales', 'sales exec'];
    const validRoles = ['sales executive', 'sales_executive', 'sales executive role', 'salesperson', 'sales rep', 'sales representative', 'sales'];

    const hasValidDesig = validDesignations.includes(desigLower);
    const hasValidRole = validRoles.includes(roleLower);

    // Must match either a valid designation or valid role (and not be excluded)
    return hasValidDesig || hasValidRole;
  };

  const mergedMap = new Map();
  const getKey = (item) => {
    if (item.email && String(item.email).trim()) {
      return String(item.email).toLowerCase().trim();
    }
    return String(item.name || '').toLowerCase().trim();
  };

  // 1. Process Employees first (designation is source of truth for employees)
  (fetchedEmployees || []).forEach(emp => {
    if (!emp || !emp.name) return;
    if (isVendor(emp)) return;
    const desig = String(emp.designation || '').trim();
    const targetId = emp.userId ? (typeof emp.userId === 'object' ? emp.userId._id : emp.userId) : emp._id;
    const idStr = String(targetId);

    if (isStrictSalesExecutive(desig, '', emp.name, emp.email, emp.vendorId)) {
      const key = getKey(emp);
      if (key && !mergedMap.has(key)) {
        mergedMap.set(key, {
          _id: idStr,
          name: emp.name,
          email: emp.email || '',
          role: 'Sales Executive'
        });
      }
    }
  });

  // 2. Process Users (users with sales executive role or mapped sales executive employee designation)
  (fetchedUsers || []).forEach(item => {
    if (!item || !item._id) return;
    if (isVendor(item)) return;
    const key = getKey(item);
    if (key && !mergedMap.has(key)) {
      const emailStr = String(item.email || '').toLowerCase().trim();
      const empDesig = empDesignationMap.get(item._id.toString()) || empDesignationMap.get(emailStr) || '';
      if (isStrictSalesExecutive(empDesig, item.role, item.name, item.email, item.vendorId)) {
        mergedMap.set(key, {
          _id: item._id.toString(),
          name: item.name,
          email: item.email,
          role: 'Sales Executive'
        });
      }
    }
  });

  // 3. Process Salespersons from Salesperson master
  (fetchedSalespersons || []).forEach(item => {
    if (!item || !item._id) return;
    if (isVendor(item)) return;
    const key = getKey(item);
    if (key && !mergedMap.has(key)) {
      const emailStr = String(item.email || '').toLowerCase().trim();
      const empDesig = empDesignationMap.get(item._id.toString()) || empDesignationMap.get(emailStr) || '';
      if (isStrictSalesExecutive(empDesig, item.role || 'sales', item.name, item.email, item.vendorId)) {
        mergedMap.set(key, {
          _id: item._id.toString(),
          name: item.name,
          email: item.email,
          role: 'Sales Executive'
        });
      }
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

