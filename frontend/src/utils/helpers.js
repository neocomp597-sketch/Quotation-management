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
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith("http")) return trimmedUrl;

  // For local development, assuming backend on 4003
  const base = import.meta.env.VITE_BACKEND_URL || "http://localhost:4003";
  let cleanUrl = trimmedUrl.replace(/\\/g, "/"); // Fix windows backslashes

  // If it's just a filename (no slashes), prepend /uploads/
  if (!cleanUrl.includes("/")) {
    cleanUrl = `/uploads/${cleanUrl}`;
  }

  // Ensure it starts with / if not present
  if (!cleanUrl.startsWith("/")) {
    cleanUrl = `/${cleanUrl}`;
  }

  return `${base}${cleanUrl}`;
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
      const base = import.meta.env.VITE_BACKEND_URL || "http://localhost:4003";
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
