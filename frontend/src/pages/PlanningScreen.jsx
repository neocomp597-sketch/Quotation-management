import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  MdDelete,
  MdCalendarMonth,
  MdSave,
  MdDownload,
  MdRefresh,
  MdEdit,
  MdClose,
  MdKeyboardArrowDown,
  MdFileUpload,
} from "react-icons/md";
import { toast } from "react-toastify";
import {
  planningService,
  customerService,
  productService,
  mgrService,
  importService,
} from "../services/api";
import * as XLSX from "xlsx";
import ImportModal from "../components/ImportModal";
import PortalDropdown from "../components/PortalDropdown";
import { formatToLakhs, formatToIndian } from "../utils/formatters";

// Financial year months (Apr-Mar)
const FY_MONTHS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
];

const STATUS_OPTIONS = [
  "Firm",
  "MFC",
  "B & B",
  "Others",
  "Order Received",
  "Invoice",
  "Lost",
  "Parked",
];
const STATUS_REPORT_COLUMNS = [
  "Firm",
  "MFC",
  "B&B",
  "Other",
  "Invoice",
  "Lost",
  "Parked",
  "Order Received",
];
const STATUS_REPORT_ROWS = [
  { key: "Firm", label: "Firm", aliases: ["Firm"] },
  { key: "Invoice", label: "Invoice", aliases: ["Invoice"] },
  {
    key: "B&B",
    label: "Book & Bill",
    aliases: ["B&B", "B & B", "Book & Bill"],
  },
  { key: "MFC", label: "MFC", aliases: ["MFC"] },
  { key: "Other", label: "Others", aliases: ["Other", "Others"] },
  { key: "Lost", label: "Lost", aliases: ["Lost"] },
  { key: "Parked", label: "Parked", aliases: ["Parked"] },
  {
    key: "Order Received",
    label: "Order Received",
    aliases: ["Order Received"],
  },
];
// Generate financial year options (current + next 2)
const getFinancialYears = () => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const fyStart = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const years = [];
  for (let i = -1; i < 3; i++) {
    const start = fyStart + i;
    const end = (start + 1).toString().slice(-2);
    years.push(`${start}-${end}`);
  }

  return years;
};

// Generate month-year labels for a financial year
const getMonthLabels = (fy) => {
  const startYear = parseInt(fy.split("-")[0], 10);
  return FY_MONTHS.map((month, idx) => {
    const year = idx < 9 ? startYear : startYear + 1;
    return `${month}-${year.toString().slice(-2)}`;
  });
};

const normalizeMgrCode = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const normalizeCodeKey = (value = "") => normalizeMgrCode(value);

const normalizeSbuValue = (sbuName = "") => {
  // Normalize "Sbu 1" → "SBU1", "Sbu 2" → "SBU2", etc.
  const cleaned = String(sbuName || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  // Map variations to canonical form
  if (cleaned === "SBU1") return "SBU1";
  if (cleaned === "SBU2") return "SBU2";
  if (cleaned === "SBU3") return "SBU3";
  if (cleaned === "EPC") return "EPC";

  return cleaned;
};

const formatReportValue = (value, decimals = 3) =>
  formatToLakhs(value || 0, decimals);

const formatReportPercentage = (value, decimals = 2) =>
  `${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;

const formatReportPercentageTotal = (value) =>
  `${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

const STATUS_BREAKDOWN_ROWS = ["Export", "Industry", "UC", "Utility", "Total"];

const dedupeMgrOptions = (items = []) => {
  const seen = new Set();

  return items.filter((mgr) => {
    const key = normalizeMgrCode(mgr.code);
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getCanonicalMgrCode = (value, mgrItems = []) => {
  const normalized = normalizeMgrCode(value);
  if (!normalized) {
    return "";
  }

  const match = mgrItems.find(
    (mgr) => normalizeMgrCode(mgr.code) === normalized,
  );
  return (
    match?.code ||
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
  );
};

const getEntityId = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    return String(value._id || "");
  }

  return String(value);
};

const getFallbackCode = (prefix, value) => {
  const entityId = getEntityId(value);
  return entityId ? `${prefix}-${entityId.slice(-8).toUpperCase()}` : "";
};

const compareSortValues = (left, right) => {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left || "").localeCompare(String(right || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const getReportYearOptions = (financialYear) => {
  const startYear = parseInt(financialYear.split("-")[0], 10);
  return [String(startYear), String(startYear + 1)];
};

const PlanningScreen = () => {
  const [financialYear, setFinancialYear] = useState(getFinancialYears()[1]);
  const [entries, setEntries] = useState([]);
  const [combinedReportData, setCombinedReportData] = useState(null);
  const [reportData2, setReportData2] = useState(null);
  console.log({ reportData2 });
  const [loading, setLoading] = useState(false);

  const [isGridExpanded, setIsGridExpanded] = useState(true);
  const [isReportExpanded, setIsReportExpanded] = useState(false);
  const [isReportExpanded2, setIsReportExpanded2] = useState(false);
  const [isStatusBreakdownExpanded, setIsStatusBreakdownExpanded] =
    useState(true);
  const [expandedSegmentMonths, setExpandedSegmentMonths] = useState({});
  const [expandedStatusBreakdownMonths, setExpandedStatusBreakdownMonths] =
    useState({});
  const [expandedStatusBreakdownSegments, setExpandedStatusBreakdownSegments] =
    useState({});
  const [expandedSbuWiseMonths, setExpandedSbuWiseMonths] = useState({});
  const [isExportExpanded, setIsExportExpanded] = useState(true);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [mgrList, setMgrList] = useState([]);
  const [mgrList2, setMgrList2] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const emptyRow = {
    monthYear: "",
    customerId: "",
    customerName: "",
    productId: "",
    productName: "",
    qty: "",
    value: "",
    mgrCode: "",
    mgrCode2: "",
    status: "",
  };
  const [newRow, setNewRow] = useState({ ...emptyRow });

  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const customerAnchorRef = useRef(null);
  const productAnchorRef = useRef(null);

  // Initialize filters with month as primary filter
  const initializeFilters = () => {
    return {
      month: "",
      mgrCode: "",
      mgrCode2: "",
      status: "",
    };
  };

  const [filters, setFilters] = useState(initializeFilters());
  const [sortConfig, setSortConfig] = useState({
    key: "monthYear",
    direction: "asc",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const reportQuery = {};
      if (filters.month) {
        const [mName] = filters.month.split("-");
        const startYear = parseInt(financialYear.split("-")[0], 10);
        const mIdx = FY_MONTHS.indexOf(mName);
        reportQuery.month = mName;
        reportQuery.year = String(mIdx <= 8 ? startYear : startYear + 1);
      }

      const [entriesRes, sbuReportRes, segmentReportRes] = await Promise.all([
        planningService.getAll(financialYear),
        planningService.getMGRReport(financialYear, "SBU", reportQuery),
        planningService.getMGRReport(financialYear, "SEGMENT", reportQuery),
      ]);

      setEntries(entriesRes.data);
      console.log(
        "[API Response] Status Breakdown Summary Data (sbuWise):",
        sbuReportRes.data,
      );
      setCombinedReportData(sbuReportRes.data);
      setReportData2(segmentReportRes.data);
    } catch (err) {
      console.error("Failed to load planning data:", err);
    } finally {
      setLoading(false);
    }
  }, [financialYear, filters.month]);

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [custRes, prodRes, mgrRes, mgr2Res] = await Promise.all([
          customerService.getAll(),
          productService.getAll(),
          mgrService.getAll("MGR1"),
          mgrService.getAll("MGR2"),
        ]);

        setCustomers(custRes.data);
        setProducts(prodRes.data);
        setMgrList(
          dedupeMgrOptions(
            mgrRes.data.filter((mgr) => mgr.status === "Active"),
          ),
        );
        setMgrList2(
          dedupeMgrOptions(
            mgr2Res.data.filter((mgr) => mgr.status === "Active"),
          ),
        );
      } catch (err) {
        console.error("Failed to load master data:", err);
      }
    };

    fetchMasters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep month filter empty when financial year changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      month: "",
    }));
  }, [financialYear]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) {
      return customers.slice(0, 10);
    }

    return customers
      .filter(
        (customer) =>
          (customer.externalCode || "")
            .toLowerCase()
            .includes(customerSearch.toLowerCase()) ||
          (customer.companyName || "")
            .toLowerCase()
            .includes(customerSearch.toLowerCase()) ||
          (customer.customerName || "")
            .toLowerCase()
            .includes(customerSearch.toLowerCase()),
      )
      .slice(0, 10);
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) {
      return products.slice(0, 10);
    }

    return products
      .filter(
        (product) =>
          (product.productName || "")
            .toLowerCase()
            .includes(productSearch.toLowerCase()) ||
          (product.productCode || "")
            .toLowerCase()
            .includes(productSearch.toLowerCase()),
      )
      .slice(0, 10);
  }, [products, productSearch]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // STEP 1: Filter by month (PRIMARY FILTER)
      const matchesMonth = !filters.month || entry.monthYear === filters.month;

      // STEP 2: Filter by status
      const matchesStatus = !filters.status || entry.status === filters.status;

      // STEP 3: Filter by MGR codes
      const matchesMgr1 =
        !filters.mgrCode ||
        normalizeMgrCode(entry.mgrCode) === normalizeMgrCode(filters.mgrCode);
      const matchesMgr2 =
        !filters.mgrCode2 ||
        normalizeMgrCode(entry.mgrCode2) === normalizeMgrCode(filters.mgrCode2);

      // All conditions must match
      return matchesMonth && matchesStatus && matchesMgr1 && matchesMgr2;
    });
  }, [entries, filters]);

  const hasActiveFilters = Boolean(
    filters.mgrCode || filters.mgrCode2 || filters.status,
  );
  const monthLabels = useMemo(
    () => getMonthLabels(financialYear),
    [financialYear],
  );
  const monthOrder = useMemo(
    () => new Map(monthLabels.map((label, index) => [label, index])),
    [monthLabels],
  );
  useEffect(() => {
    setExpandedStatusBreakdownMonths((prev) => {
      const next = { ...prev };
      monthLabels.forEach((month) => {
        if (typeof next[month] === "undefined") {
          next[month] = true;
        }
      });
      return next;
    });
    setExpandedSbuWiseMonths((prev) => {
      const next = { ...prev };
      monthLabels.forEach((month) => {
        if (typeof next[month] === "undefined") {
          next[month] = true;
        }
      });
      return next;
    });
  }, [monthLabels]);

  const customerMap = useMemo(
    () =>
      new Map(customers.map((customer) => [String(customer._id), customer])),
    [customers],
  );
  const productMap = useMemo(
    () => new Map(products.map((product) => [String(product._id), product])),
    [products],
  );

  const getCustomerById = useCallback(
    (customerId) => customerMap.get(getEntityId(customerId)) || null,
    [customerMap],
  );
  const getProductById = useCallback(
    (productId) => productMap.get(getEntityId(productId)) || null,
    [productMap],
  );
  const getCustomerCode = useCallback(
    (customerId) =>
      getCustomerById(customerId)?.externalCode ||
      getFallbackCode("CUST", customerId) ||
      "-",
    [getCustomerById],
  );
  const getProductCode = useCallback(
    (productId) => getProductById(productId)?.productCode || "-",
    [getProductById],
  );

  const sortedEntries = useMemo(() => {
    const rows = [...filteredEntries];

    rows.sort((left, right) => {
      let leftValue;
      let rightValue;

      switch (sortConfig.key) {
        case "monthYear":
          leftValue = monthOrder.get(left.monthYear) ?? Number.MAX_SAFE_INTEGER;
          rightValue =
            monthOrder.get(right.monthYear) ?? Number.MAX_SAFE_INTEGER;
          break;
        case "customerCode":
          leftValue = getCustomerCode(left.customerId);
          rightValue = getCustomerCode(right.customerId);
          break;
        case "customerName":
          leftValue = left.customerName;
          rightValue = right.customerName;
          break;
        case "productCode":
          leftValue = getProductCode(left.productId);
          rightValue = getProductCode(right.productId);
          break;
        case "productName":
          leftValue = left.productName;
          rightValue = right.productName;
          break;
        case "qty":
          leftValue = Number(left.qty || 0);
          rightValue = Number(right.qty || 0);
          break;
        case "value":
          leftValue = Number(left.value || 0);
          rightValue = Number(right.value || 0);
          break;
        case "totalValue":
          leftValue = Number(left.totalValue || 0);
          rightValue = Number(right.totalValue || 0);
          break;
        case "mgrCode":
          leftValue = getCanonicalMgrCode(left.mgrCode, mgrList);
          rightValue = getCanonicalMgrCode(right.mgrCode, mgrList);
          break;
        case "mgrCode2":
          leftValue = getCanonicalMgrCode(left.mgrCode2 || "", mgrList2);
          rightValue = getCanonicalMgrCode(right.mgrCode2 || "", mgrList2);
          break;
        case "status":
          leftValue = left.status;
          rightValue = right.status;
          break;
        default:
          leftValue = left[sortConfig.key];
          rightValue = right[sortConfig.key];
      }

      const comparison = compareSortValues(leftValue, rightValue);
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });

    return rows;
  }, [
    filteredEntries,
    sortConfig,
    monthOrder,
    mgrList,
    mgrList2,
    getCustomerCode,
    getProductCode,
  ]);

  const statusBreakdownColumns = useMemo(() => {
    const reportColumnSource =
      combinedReportData?.mgrColumns?.length > 0
        ? combinedReportData.mgrColumns
        : combinedReportData?.mgrCodes || [];

    const normalizedFromMgrCodes = reportColumnSource
      .map((code) => normalizeSbuValue(code))
      .filter(Boolean);

    const normalizedFromRows = (combinedReportData?.sbuWise || [])
      .map((row) => normalizeSbuValue(row.sbu))
      .filter(Boolean);

    const unique = Array.from(
      new Set([...normalizedFromMgrCodes, ...normalizedFromRows]),
    );

    const fallback = ["EPC", "SBU1", "SBU2", "SBU3"];
    const toSort = unique.length > 0 ? unique : fallback;

    const getWeight = (value) => {
      if (value === "EPC") return [0, 0, value];
      const sbuMatch = value.match(/^SBU(\d+)$/);
      if (sbuMatch) return [1, Number(sbuMatch[1]), value];
      return [2, Number.MAX_SAFE_INTEGER, value];
    };

    return [...toSort].sort((left, right) => {
      const [leftGroup, leftNumber, leftLabel] = getWeight(left);
      const [rightGroup, rightNumber, rightLabel] = getWeight(right);

      if (leftGroup !== rightGroup) return leftGroup - rightGroup;
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;

      return leftLabel.localeCompare(rightLabel, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [combinedReportData]);

  const computedStatusBreakdownData = useMemo(() => {
    const visibleMonthLabels = combinedReportData?.monthYear
      ? [combinedReportData.monthYear]
      : monthLabels;

    const grouped = {};

    visibleMonthLabels.forEach((monthLabel) => {
      grouped[monthLabel] = {};
    });

    if (combinedReportData?.sbuWise) {
      combinedReportData.sbuWise.forEach((row) => {
        const { month, segment, status, sbu, value } = row;
        const normalizedSbu = normalizeSbuValue(sbu);

        if (!grouped[month]) grouped[month] = {};
        if (!grouped[month][segment]) grouped[month][segment] = {};
        if (!grouped[month][segment][status]) {
          grouped[month][segment][status] = Object.fromEntries(
            statusBreakdownColumns.map((column) => [column, 0]),
          );
        }

        if (normalizedSbu) {
          if (grouped[month][segment][status][normalizedSbu] === undefined) {
            grouped[month][segment][status][normalizedSbu] = 0;
          }
          grouped[month][segment][status][normalizedSbu] += Number(value || 0);
        }
      });
    }

    const months = visibleMonthLabels.map((monthLabel) => {
      const segments = Object.keys(grouped[monthLabel] || {}).map(
        (segment) => ({
          segment,
          statuses: grouped[monthLabel][segment],
        }),
      );

      return {
        month: monthLabel,
        segments,
      };
    });

    console.log("[Computed] Final Status Breakdown Data Structure:", months);
    return months;
  }, [combinedReportData, monthLabels, statusBreakdownColumns]);

  useEffect(() => {
    if (computedStatusBreakdownData) {
      setExpandedStatusBreakdownSegments((prev) => {
        const next = { ...prev };
        computedStatusBreakdownData.forEach((monthEntry) => {
          monthEntry.segments.forEach((segmentEntry) => {
            const key = `${monthEntry.month}-${segmentEntry.segment}`;
            if (typeof next[key] === "undefined") {
              next[key] = false;
            }
          });
        });
        return next;
      });
    }
  }, [computedStatusBreakdownData]);

  const computedSbuWiseData = useMemo(() => {
    const visibleMonthLabels = combinedReportData?.monthYear
      ? [combinedReportData.monthYear]
      : monthLabels;

    const monthMap = new Map();

    visibleMonthLabels.forEach((monthLabel) => {
      const statusRows = {};
      STATUS_REPORT_ROWS.forEach((statusRow) => {
        statusRows[statusRow.key] = {
          status: statusRow.label,
          ...Object.fromEntries(
            combinedReportData?.mgrCodes?.map((sbu) => [sbu, 0]) || [],
          ),
          total: 0,
        };
      });
      // Add All row
      statusRows["All"] = {
        status: "All",
        ...Object.fromEntries(
          combinedReportData?.mgrCodes?.map((sbu) => [sbu, 0]) || [],
        ),
        total: 0,
      };
      monthMap.set(monthLabel, {
        month: monthLabel,
        rows: statusRows,
      });
    });

    if (combinedReportData?.sbuWise) {
      combinedReportData.sbuWise.forEach((row) => {
        const monthEntry = monthMap.get(row.month);
        const normalizedStatus = STATUS_REPORT_ROWS.find((statusRow) =>
          statusRow.aliases.includes(row.status),
        )?.key;
        const allRow = monthEntry?.rows?.All;

        if (!monthEntry || !normalizedStatus) {
          return;
        }

        const statusRow = monthEntry.rows[normalizedStatus];
        const value = Number(row.value || 0);

        if (statusRow && row.sbu) {
          statusRow[row.sbu] = (statusRow[row.sbu] || 0) + value;
          statusRow.total += value;
          if (allRow) {
            allRow[row.sbu] = (allRow[row.sbu] || 0) + value;
            allRow.total += value;
          }
        }
      });
    }

    const months = visibleMonthLabels.map((monthLabel) => {
      const monthEntry = monthMap.get(monthLabel);
      const monthRows = STATUS_REPORT_ROWS.map(
        (statusRow) => monthEntry.rows[statusRow.key],
      ).concat(monthEntry.rows.All);

      return {
        month: monthLabel,
        rows: monthRows,
        total: Number(monthEntry.rows.All?.total || 0),
      };
    });

    return months;
  }, [combinedReportData, monthLabels]);

  const handleNewRowChange = (field, value) => {
    setNewRow((prev) => ({ ...prev, [field]: value }));
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      month: "",
      mgrCode: "",
      mgrCode2: "",
      status: "",
    });
  };

  const getStatusClasses = (status) => {
    switch (status) {
      case "Firm":
        return "bg-emerald-50 text-emerald-700";
      case "MFC":
        return "bg-amber-50 text-amber-700";
      case "B & B":
        return "bg-purple-50 text-purple-700";
      case "Invoice":
        return "bg-orange-50 text-orange-700";
      case "Order Received":
        return "bg-sky-50 text-sky-700";
      case "Lost":
        return "bg-rose-50 text-rose-700";
      case "Parked":
        return "bg-slate-200 text-slate-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const selectCustomer = (customer) => {
    const name = customer.companyName || customer.customerName;
    setNewRow((prev) => ({
      ...prev,
      customerId: customer._id,
      customerName: name,
    }));
    setCustomerSearch(name);
    setShowCustomerDropdown(false);
  };

  const selectProduct = (product) => {
    setNewRow((prev) => ({
      ...prev,
      productId: product._id,
      productName: product.productName,
    }));
    setProductSearch(product.productName);
    setShowProductDropdown(false);
  };

  const handleSaveEntry = async () => {
    // CRITICAL: Enforce month selection first
    if (!filters.month) {
      toast.error("⚠️ Please select a Month first in the filters above");
      return;
    }

    if (
      !newRow.customerId ||
      !newRow.productId ||
      newRow.qty === "" ||
      newRow.value === "" ||
      !newRow.mgrCode ||
      !newRow.status
    ) {
      toast.error(
        "Please fill all mandatory fields (MGR 2 is optional, Month auto-set)",
      );
      return;
    }

    // Auto-set inline entry month to selected filter month
    const monthToUse = newRow.monthYear || filters.month;
    if (!monthToUse) {
      toast.error("Please select a Month");
      return;
    }

    try {
      const dataToSave = {
        ...newRow,
        monthYear: monthToUse,
        financialYear,
        qty: Number(newRow.qty),
        value: Number(newRow.value),
        mgrCode: getCanonicalMgrCode(newRow.mgrCode, mgrList),
        mgrCode2: getCanonicalMgrCode(newRow.mgrCode2, mgrList2),
        month: FY_MONTHS.indexOf(monthToUse.split("-")[0]) + 1,
      };

      if (editingId) {
        await planningService.update(editingId, dataToSave);
        toast.success("Entry updated");
        setEditingId(null);
      } else {
        await planningService.create(dataToSave);
        toast.success("Entry added");
      }

      setNewRow({ ...emptyRow });
      setCustomerSearch("");
      setProductSearch("");
      setShowCustomerDropdown(false);
      setShowProductDropdown(false);
      await fetchData();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          (editingId ? "Failed to update entry" : "Failed to add entry"),
      );
    }
  };

  const handleEditEntry = (entry) => {
    setEditingId(entry._id);
    // Set filter month to the entry's month when editing
    setFilters((prev) => ({
      ...prev,
      month: entry.monthYear,
    }));
    setNewRow({
      monthYear: entry.monthYear,
      customerId: entry.customerId?._id || entry.customerId || "",
      customerName:
        entry.customerName ||
        entry.customerId?.companyName ||
        entry.customerId?.customerName ||
        "",
      productId: entry.productId?._id || entry.productId || "",
      productName: entry.productName || entry.productId?.productName || "",
      qty: entry.qty,
      value: entry.value,
      mgrCode: getCanonicalMgrCode(entry.mgrCode, mgrList),
      mgrCode2: getCanonicalMgrCode(entry.mgrCode2 || "", mgrList2),
      status: entry.status,
    });
    setCustomerSearch(
      entry.customerName ||
        entry.customerId?.companyName ||
        entry.customerId?.customerName ||
        "",
    );
    setProductSearch(entry.productName || entry.productId?.productName || "");
    setShowCustomerDropdown(false);
    setShowProductDropdown(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsGridExpanded(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewRow({ ...emptyRow });
    setCustomerSearch("");
    setProductSearch("");
    setShowCustomerDropdown(false);
    setShowProductDropdown(false);
  };

  const handleDeleteEntry = async (id) => {
    try {
      await planningService.delete(id);
      toast.success("Entry removed");
      await fetchData();
    } catch {
      toast.error("Failed to delete entry");
    }
  };

  const buildReportExportRows = (data, getExportCellValue) => {
    const reportRows = [["", ...data.mgrCodes, "Total"]];

    data.rows.forEach((row) => {
      const firstCell =
        data.reportType === "SBU"
          ? row.isSegment
            ? `   ${row.month}`
            : row.isMonth
              ? `v ${row.month}`
              : row.month
          : row.parentMonth
            ? `   ${row.month}`
            : row.isMonth
              ? `▼ ${row.month}`
              : row.month;

      reportRows.push([
        firstCell,
        ...data.mgrCodes.map((mgr) => getExportCellValue(row, row[mgr] || 0)),
        getExportCellValue(row, row.total || 0, true),
      ]);
    });

    return reportRows;
  };

  const getReportSheetColumns = (data) => [
    { wch: 26 },
    ...data.mgrCodes.map(() => ({ wch: 16 })),
    { wch: 16 },
  ];

  const exportToExcel = () => {
    if (!sortedEntries.length && !combinedReportData && !reportData2) {
      toast.error("No planning data available to export");
      return;
    }

    const workbook = XLSX.utils.book_new();
    const getExportCellValue = (row, value, isTotalColumn = false) => {
      if (row.isPercentage || row.isTotalPercentage) {
        return isTotalColumn
          ? formatReportPercentageTotal(value)
          : formatReportPercentage(value);
      }

      return formatReportValue(value, 3);
    };

    const buildReportSheet = (data) => {
      const sheet = XLSX.utils.aoa_to_sheet(
        buildReportExportRows(data, getExportCellValue),
      );
      sheet["!cols"] = getReportSheetColumns(data);
      return sheet;
    };

    const entriesData = sortedEntries.map((entry) => ({
      Month: entry.monthYear,
      "Customer Code": getCustomerCode(entry.customerId),
      "Customer Name": entry.customerName,
      "Product Code": getProductCode(entry.productId),
      "Product Name": entry.productName,
      Qty: entry.qty,
      Value: entry.value,
      Total: entry.totalValue,
      "MGR 1": getCanonicalMgrCode(entry.mgrCode, mgrList),
      "MGR 2": getCanonicalMgrCode(entry.mgrCode2 || "", mgrList2),
      Status: entry.status,
    }));
    const entriesSheet = XLSX.utils.json_to_sheet(entriesData);
    entriesSheet["!cols"] = [
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(workbook, entriesSheet, "Planning Entries");

    if (combinedReportData) {
      const reportSheet = buildReportSheet(combinedReportData);
      XLSX.utils.book_append_sheet(workbook, reportSheet, "SBU Wise Report");
    }

    if (reportData2) {
      const reportSheet2 = buildReportSheet(reportData2);
      XLSX.utils.book_append_sheet(
        workbook,
        reportSheet2,
        "Segment Wise Report",
      );
    }

    XLSX.writeFile(workbook, `Planning-${financialYear}.xlsx`);
    toast.success("Excel downloaded with customer and product code details");
  };

  const exportReportToExcel = (data, reportLabel) => {
    if (!data || !data.mgrCodes?.length) {
      toast.error(`No data available for ${reportLabel}`);
      return;
    }

    const workbook = XLSX.utils.book_new();
    let reportRows = [];

    // Handle SBU Wise Report (Status x SBU matrix)
    if (reportLabel.includes("SBU")) {
      reportRows = [["Status", ...data.mgrCodes, "Total"]];

      (data.statusColumns || []).forEach((status) => {
        let rowTotal = 0;
        const rowData = [status];

        data.mgrCodes.forEach((sbu) => {
          const value = (data.sbuWise || [])
            .filter(
              (entry) =>
                normalizeCodeKey(entry.sbu) === normalizeCodeKey(sbu) &&
                entry.status === status,
            )
            .reduce((sum, entry) => sum + Number(entry.value || 0), 0);
          rowData.push(formatReportValue(value, 0));
          rowTotal += value;
        });

        rowData.push(formatReportValue(rowTotal, 0));
        reportRows.push(rowData);
      });

      // Add total row
      const totalRow = ["Total"];
      let grandTotal = 0;
      data.mgrCodes.forEach((sbu) => {
        const total = (data.sbuWise || [])
          .filter(
            (entry) => normalizeCodeKey(entry.sbu) === normalizeCodeKey(sbu),
          )
          .reduce((sum, entry) => sum + Number(entry.value || 0), 0);
        totalRow.push(formatReportValue(total, 0));
        grandTotal += total;
      });
      totalRow.push(formatReportValue(grandTotal, 0));
      reportRows.push(totalRow);
    } else {
      // Handle other report types (original logic)
      const getExportCellValue = (row, value, isTotalColumn = false) => {
        if (row.isPercentage || row.isTotalPercentage) {
          return isTotalColumn
            ? formatReportPercentageTotal(value)
            : formatReportPercentage(value);
        }
        return formatReportValue(value, 3);
      };

      reportRows = buildReportExportRows(data, getExportCellValue);
    }

    const sheet = XLSX.utils.aoa_to_sheet(reportRows);
    sheet["!cols"] = [
      { wch: 16 },
      ...data.mgrCodes.map(() => ({ wch: 14 })),
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, reportLabel);

    const safeReportLabel = reportLabel.replace(/\s+/g, "-");
    XLSX.writeFile(workbook, `${safeReportLabel}-${financialYear}.xlsx`);
    toast.success(`${reportLabel} exported`);
  };

  const exportStatusBreakdownToExcel = () => {
    if (
      !computedStatusBreakdownData ||
      computedStatusBreakdownData.length === 0
    ) {
      toast.error("No status breakdown data available to export");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const rows = [["Month", "Segment", "Status", ...statusBreakdownColumns]];

    computedStatusBreakdownData.forEach((monthEntry) => {
      monthEntry.segments.forEach((segmentEntry) => {
        Object.keys(segmentEntry.statuses).forEach((status) => {
          const row = segmentEntry.statuses[status];
          rows.push([
            monthEntry.month,
            segmentEntry.segment,
            status,
            ...statusBreakdownColumns.map((column) =>
              formatReportValue(row[column] || 0, 0),
            ),
          ]);
        });
      });

      // Add totals row for this month
      const monthTotals = calculateMonthTotals(monthEntry);
      rows.push([
        monthEntry.month,
        "",
        "TOTAL",
        ...statusBreakdownColumns.map((column) =>
          formatReportValue(monthTotals[column] || 0, 0),
        ),
      ]);
      rows.push([]); // blank row for spacing
    });

    // Add grand total row
    rows.push([]); // blank row before grand total
    const grandTotals = calculateGrandTotals(computedStatusBreakdownData);
    rows.push([
      "",
      "",
      "GRAND TOTAL",
      ...statusBreakdownColumns.map((column) =>
        formatReportValue(grandTotals[column] || 0, 0),
      ),
    ]);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      ...statusBreakdownColumns.map(() => ({ wch: 16 })),
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, "Status Breakdown Summary");

    XLSX.writeFile(workbook, `Status-Breakdown-Summary-${financialYear}.xlsx`);
    toast.success("Status Breakdown Summary exported");
  };

  const requestSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderSortableHeader = (label, key, className = "") => {
    const isActive = sortConfig.key === key;
    const isRightAligned = className.includes("text-right");

    return (
      <th className={`py-3 px-3 ${className}`}>
        <button
          type="button"
          onClick={() => requestSort(key)}
          className={`group inline-flex items-center gap-1.5 font-black text-slate-700 text-xs ${isRightAligned ? "w-full justify-end" : ""}`}
        >
          <span>{label}</span>
          <MdKeyboardArrowDown
            className={`transition-all duration-200 ${isActive ? "text-primary-600 opacity-100" : "text-slate-300 opacity-70 group-hover:text-slate-500"} ${isActive && sortConfig.direction === "asc" ? "rotate-180" : ""}`}
            size={16}
          />
        </button>
      </th>
    );
  };

  const toggleSegmentMonth = (monthLabel) => {
    setExpandedSegmentMonths((prev) => ({
      ...prev,
      [monthLabel]: !prev[monthLabel],
    }));
  };

  const toggleStatusBreakdownMonth = (month) => {
    setExpandedStatusBreakdownMonths((prev) => ({
      ...prev,
      [month]: !prev[month],
    }));
  };

  const toggleStatusBreakdownSegment = (month, segment) => {
    setExpandedStatusBreakdownSegments((prev) => ({
      ...prev,
      [`${month}-${segment}`]: !prev[`${month}-${segment}`],
    }));
  };

  const calculateMonthTotals = (monthEntry) => {
    const totals = Object.fromEntries(
      statusBreakdownColumns.map((column) => [column, 0]),
    );

    monthEntry.segments.forEach((segmentEntry) => {
      Object.values(segmentEntry.statuses).forEach((statusRow) => {
        statusBreakdownColumns.forEach((column) => {
          totals[column] += Number(statusRow[column] || 0);
        });
      });
    });

    return totals;
  };

  const calculateGrandTotals = (statusBreakdownData) => {
    const totals = Object.fromEntries(
      statusBreakdownColumns.map((column) => [column, 0]),
    );

    statusBreakdownData.forEach((monthEntry) => {
      const monthTotals = calculateMonthTotals(monthEntry);
      statusBreakdownColumns.forEach((column) => {
        totals[column] += Number(monthTotals[column] || 0);
      });
    });

    return totals;
  };

  const toggleSbuWiseMonth = (month) => {
    setExpandedSbuWiseMonths((prev) => ({
      ...prev,
      [month]: !prev[month],
    }));
  };

  const calculatedTotal =
    newRow.qty && newRow.value ? Number(newRow.qty) * Number(newRow.value) : 0;
  const compactFieldClass =
    "w-full px-2.5 py-2.5 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-primary-500 bg-white";
  const compactNumericFieldClass = `${compactFieldClass} text-right`;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <MdCalendarMonth className="text-primary-600" />
            Planning Screen
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Plan monthly targets by customer, product, and MGR
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
          >
            {getFinancialYears().map((fy) => (
              <option key={fy} value={fy}>
                FY {fy}
              </option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
            title="Refresh now"
          >
            <MdRefresh size={20} />
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <MdFileUpload size={18} />
            Import
          </button>
          <button
            onClick={exportToExcel}
            className="px-5 py-3 bg-primary-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-700 transition-all flex items-center gap-2"
          >
            <MdDownload size={18} />
            Export
          </button>
        </div>
      </div>



      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div
          className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
          onClick={() => setIsGridExpanded(!isGridExpanded)}
        >
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <MdKeyboardArrowDown
              className={`text-slate-500 transition-transform duration-300 ${!isGridExpanded ? "-rotate-90" : ""}`}
              size={20}
            />
            Planning Grid
          </h2>
        </div>

        {isGridExpanded && (
          <>
            <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/60 space-y-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-primary-600">
                    {editingId ? "Edit Entry" : "Inline Entry"}
                  </p>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    {editingId ? "Update Planning Entry" : "Add Planning Entry"}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">
                    The data-entry row is back inside the grid for faster
                    single-line entry.
                  </p>
                </div>
                {editingId && (
                  <button
                    onClick={handleCancelEdit}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                  >
                    <MdClose size={18} />
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 md:px-5 py-4 border-b border-slate-100 bg-white">
              <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 xl:flex-1">
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      📅 Filter Month (Primary)
                    </label>
                    <select
                      value={filters.month}
                      onChange={(e) =>
                        handleFilterChange("month", e.target.value)
                      }
                      className="w-full px-3 py-3 border border-primary-300 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-primary-50"
                    >
                      <option value="">Select month...</option>
                      {monthLabels.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      Filter MGR 1
                    </label>
                    <select
                      value={filters.mgrCode}
                      onChange={(e) =>
                        handleFilterChange("mgrCode", e.target.value)
                      }
                      className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                    >
                      <option value="">All MGR 1</option>
                      {mgrList.map((mgr) => (
                        <option key={mgr._id} value={mgr.code}>
                          {mgr.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      Filter MGR 2
                    </label>
                    <select
                      value={filters.mgrCode2}
                      onChange={(e) =>
                        handleFilterChange("mgrCode2", e.target.value)
                      }
                      className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                    >
                      <option value="">All MGR 2</option>
                      {mgrList2.map((mgr) => (
                        <option key={mgr._id} value={mgr.code}>
                          {mgr.code}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">
                      Filter Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) =>
                        handleFilterChange("status", e.target.value)
                      }
                      className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-primary-500 bg-white"
                    >
                      <option value="">All Statuses</option>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold">
                    {filteredEntries.length}{" "}
                    {filteredEntries.length === 1 ? "entry" : "entries"}
                  </span>
                  <button
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MdRefresh size={18} />
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[17%]" />
                  <col className="w-[21%]" />
                  <col className="w-[6%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr className="bg-amber-50 border-b border-amber-100">
                    {renderSortableHeader("Month", "monthYear", "px-2 py-3")}
                    {renderSortableHeader(
                      "Customer",
                      "customerName",
                      "px-2 py-3",
                    )}
                    {renderSortableHeader(
                      "Product Name",
                      "productName",
                      "px-2 py-3",
                    )}
                    {renderSortableHeader("Qty", "qty", "px-2 py-3 text-right")}
                    {renderSortableHeader(
                      "Value",
                      "value",
                      "px-2 py-3 text-right",
                    )}
                    {renderSortableHeader(
                      "Total",
                      "totalValue",
                      "px-2 py-3 text-right bg-amber-100",
                    )}
                    {renderSortableHeader("MGR 1", "mgrCode", "px-2 py-3")}
                    {renderSortableHeader("MGR 2", "mgrCode2", "px-2 py-3")}
                    {renderSortableHeader("Status", "status", "px-2 py-3")}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  <tr className="bg-primary-50/40 border-b border-primary-100 align-top">
                    <td className="py-2 px-2">
                      <div className="w-full px-2.5 py-2.5 border border-primary-400 rounded-lg text-xs font-black outline-none bg-primary-100 text-primary-700">
                        {filters.month || "⚠️ Select month"}
                      </div>
                    </td>
                    <td ref={customerAnchorRef} className="py-2 px-2">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          handleNewRowChange("customerId", "");
                          handleNewRowChange("customerName", "");
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        placeholder="Type customer name"
                        className={compactFieldClass}
                      />
                      <PortalDropdown
                        isOpen={
                          showCustomerDropdown && filteredCustomers.length > 0
                        }
                        anchorRef={customerAnchorRef}
                      >
                        <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                          {filteredCustomers.map((customer) => (
                            <button
                              key={customer._id}
                              onClick={() => selectCustomer(customer)}
                              className="w-full text-left px-3 py-2.5 text-sm font-bold hover:bg-primary-50 transition-colors border-b border-slate-50"
                            >
                              <div>
                                {customer.companyName || customer.customerName}
                              </div>
                              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                {customer.externalCode ||
                                  getFallbackCode("CUST", customer._id)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </PortalDropdown>
                    </td>
                    <td ref={productAnchorRef} className="py-2 px-2">
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          handleNewRowChange("productId", "");
                          handleNewRowChange("productName", "");
                          setShowProductDropdown(true);
                        }}
                        onFocus={() => setShowProductDropdown(true)}
                        placeholder="Type product name"
                        className={compactFieldClass}
                      />
                      <PortalDropdown
                        isOpen={
                          showProductDropdown && filteredProducts.length > 0
                        }
                        anchorRef={productAnchorRef}
                      >
                        <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                          {filteredProducts.map((product) => (
                            <button
                              key={product._id}
                              onClick={() => selectProduct(product)}
                              className="w-full text-left px-3 py-2.5 text-sm font-bold hover:bg-primary-50 transition-colors border-b border-slate-50"
                            >
                              {product.productName}
                            </button>
                          ))}
                        </div>
                      </PortalDropdown>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        value={newRow.qty}
                        onChange={(e) =>
                          handleNewRowChange("qty", e.target.value)
                        }
                        placeholder="0"
                        className={compactNumericFieldClass}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        value={newRow.value}
                        onChange={(e) =>
                          handleNewRowChange("value", e.target.value)
                        }
                        placeholder="0"
                        className={compactNumericFieldClass}
                      />
                    </td>
                    <td className="py-2 px-2 bg-amber-50/80">
                      <div className="px-2.5 py-2.5 rounded-lg bg-amber-50 border border-amber-100 text-sm font-black text-slate-900 text-right">
                        {formatToIndian(calculatedTotal, 2)}
                      </div>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={newRow.mgrCode}
                        onChange={(e) =>
                          handleNewRowChange("mgrCode", e.target.value)
                        }
                        className={compactFieldClass}
                      >
                        <option value="">Select MGR 1</option>
                        {mgrList.map((mgr) => (
                          <option key={mgr._id} value={mgr.code}>
                            {mgr.code} - {mgr.description}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={newRow.mgrCode2}
                        onChange={(e) =>
                          handleNewRowChange("mgrCode2", e.target.value)
                        }
                        className={compactFieldClass}
                      >
                        <option value="">Select MGR 2</option>
                        {mgrList2.map((mgr) => (
                          <option key={mgr._id} value={mgr.code}>
                            {mgr.code} - {mgr.description}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <div className="space-y-2">
                        <select
                          value={newRow.status}
                          onChange={(e) =>
                            handleNewRowChange("status", e.target.value)
                          }
                          className={compactFieldClass}
                        >
                          <option value="">Select status</option>
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveEntry}
                            className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white text-xs font-bold transition-colors ${editingId ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                          >
                            <MdSave size={16} />
                            {editingId ? "Update" : "Save"}
                          </button>
                          {editingId && (
                            <button
                              onClick={handleCancelEdit}
                              className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                              <MdClose size={16} />
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>

                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center">
                        <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
                      </td>
                    </tr>
                  ) : sortedEntries.length > 0 ? (
                    sortedEntries.map((entry) => (
                      <tr
                        key={entry._id}
                        className={`hover:bg-slate-50 transition-colors ${editingId === entry._id ? "bg-primary-50/60" : ""}`}
                      >
                        <td className="py-3 px-2 font-bold text-slate-700 text-xs whitespace-nowrap">
                          {entry.monthYear}
                        </td>
                        <td className="py-3 px-2 font-bold text-slate-900 text-xs">
                          <p className="truncate" title={entry.customerName}>
                            {entry.customerName}
                          </p>
                        </td>
                        <td className="py-3 px-2 text-slate-700 text-xs">
                          <p className="truncate" title={entry.productName}>
                            {entry.productName}
                          </p>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-slate-700 text-xs whitespace-nowrap">
                          {entry.qty}
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-slate-700 text-xs whitespace-nowrap">
                          {entry.value?.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-right font-black text-slate-900 text-xs bg-amber-50/50 whitespace-nowrap">
                          {entry.totalValue?.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-xs whitespace-nowrap">
                          <span
                            className="block truncate px-2 py-1 bg-blue-50 text-blue-700 rounded font-bold"
                            title={getCanonicalMgrCode(entry.mgrCode, mgrList)}
                          >
                            {getCanonicalMgrCode(entry.mgrCode, mgrList)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-xs whitespace-nowrap">
                          <span
                            className="block truncate px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-bold"
                            title={
                              getCanonicalMgrCode(
                                entry.mgrCode2 || "",
                                mgrList2,
                              ) || "-"
                            }
                          >
                            {getCanonicalMgrCode(
                              entry.mgrCode2 || "",
                              mgrList2,
                            ) || "-"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-xs">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`truncate px-2 py-1 rounded font-bold whitespace-nowrap ${getStatusClasses(entry.status)}`}
                              title={entry.status}
                            >
                              {entry.status}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className={`p-1.5 rounded-lg transition-all ${editingId === entry._id ? "text-primary-600 bg-primary-50" : "text-slate-400 hover:text-primary-600 hover:bg-primary-50"}`}
                                title="Edit Entry"
                              >
                                <MdEdit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry._id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                title="Delete Entry"
                              >
                                <MdDelete size={16} />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="9"
                        className="py-10 text-center text-slate-400 font-bold text-sm"
                      >
                        {hasActiveFilters
                          ? "No planning entries match the selected filters."
                          : `No planning entries for FY ${financialYear}. Add your first entry above.`}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div
          className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
          onClick={() => setIsReportExpanded(!isReportExpanded)}
        >
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <MdKeyboardArrowDown
              className={`text-slate-500 transition-transform duration-300 ${!isReportExpanded ? "-rotate-90" : ""}`}
              size={20}
            />
            SBU Wise - FY {financialYear}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              exportReportToExcel(combinedReportData, "SBU Wise Report");
            }}
            disabled={
              !combinedReportData || !combinedReportData.mgrCodes?.length
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdDownload size={16} />
            Export
          </button>
        </div>

        {isReportExpanded &&
          (combinedReportData && combinedReportData.mgrCodes?.length > 0 ? (
            <div className="overflow-x-auto">
              <div
                className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
                onClick={() => setIsExportExpanded(!isExportExpanded)}
              >
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <MdKeyboardArrowDown
                    className={`text-slate-500 transition-transform duration-300 ${!isExportExpanded ? "-rotate-90" : ""}`}
                    size={20}
                  />
                  Export
                </h3>
              </div>
              {isExportExpanded ? (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="py-3 px-4 font-bold text-slate-700 text-left min-w-[140px]">
                        Status
                      </th>
                      {combinedReportData.mgrCodes.map((sbu) => (
                        <th
                          key={sbu}
                          className="py-3 px-4 font-bold text-slate-700 text-right min-w-[100px] border-l border-slate-300"
                        >
                          {sbu}
                        </th>
                      ))}
                      <th className="py-3 px-4 font-bold text-slate-900 text-right bg-slate-100 min-w-[100px] border-l border-slate-300">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATUS_REPORT_ROWS.map((statusRow) => {
                      let rowTotal = 0;
                      const statusValues = {};

                      combinedReportData.mgrCodes.forEach((sbu) => {
                        const value = (combinedReportData.sbuWise || [])
                          .filter(
                            (entry) =>
                              normalizeCodeKey(entry.sbu) ===
                                normalizeCodeKey(sbu) &&
                              entry.status === statusRow.label,
                          )
                          .reduce(
                            (sum, entry) => sum + Number(entry.value || 0),
                            0,
                          );
                        statusValues[sbu] = value;
                        rowTotal += value;
                      });

                      return (
                        <tr
                          key={statusRow.key}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {statusRow.label}
                          </td>
                          {combinedReportData.mgrCodes.map((sbu) => (
                            <td
                              key={`${statusRow.key}-${sbu}`}
                              className="py-3 px-4 text-right border-l border-slate-200 font-semibold text-slate-700"
                            >
                              {formatReportValue(statusValues[sbu] || 0, 0)}
                            </td>
                          ))}
                          <td className="py-3 px-4 text-right border-l border-slate-300 bg-slate-50 font-bold text-slate-900">
                            {formatReportValue(rowTotal, 0)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-b border-slate-200 bg-amber-50 font-black">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        All
                      </td>
                      {combinedReportData.mgrCodes.map((sbu) => {
                        const total = (combinedReportData.sbuWise || [])
                          .filter(
                            (entry) =>
                              normalizeCodeKey(entry.sbu) ===
                              normalizeCodeKey(sbu),
                          )
                          .reduce(
                            (sum, entry) => sum + Number(entry.value || 0),
                            0,
                          );
                        return (
                          <td
                            key={`total-${sbu}`}
                            className="py-3 px-4 text-right border-l border-slate-300 font-black text-slate-900"
                          >
                            {formatReportValue(total, 0)}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right border-l border-slate-300 bg-amber-100 font-black text-slate-900">
                        {formatReportValue(
                          (combinedReportData.sbuWise || []).reduce(
                            (sum, entry) => sum + Number(entry.value || 0),
                            0,
                          ),
                          0,
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                computedSbuWiseData &&
                computedSbuWiseData.length > 0 &&
                computedSbuWiseData.map((monthEntry) => (
                  <div
                    key={monthEntry.month}
                    className="border-b border-slate-200 last:border-b-0"
                  >
                    <div
                      className="bg-blue-50 font-bold cursor-pointer hover:bg-blue-100/60 transition-colors border-b border-blue-200"
                      onClick={() => toggleSbuWiseMonth(monthEntry.month)}
                    >
                      <div className="flex items-center gap-2 py-3 px-4">
                        <MdKeyboardArrowDown
                          className={`text-slate-700 transition-transform duration-300 ${!expandedSbuWiseMonths[monthEntry.month] ? "-rotate-90" : ""}`}
                          size={18}
                        />
                        <span className="text-slate-900 font-black">
                          {monthEntry.month}
                        </span>
                        <span className="ml-auto text-slate-700 font-bold">
                          {formatReportValue(monthEntry.total, 0)}
                        </span>
                      </div>
                    </div>
                    {expandedSbuWiseMonths[monthEntry.month] && (
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="py-3 px-4 font-bold text-slate-700 text-left min-w-[140px]">
                              Status
                            </th>
                            {combinedReportData.mgrCodes.map((sbu) => (
                              <th
                                key={sbu}
                                className="py-3 px-4 font-bold text-slate-700 text-right min-w-[100px] border-l border-slate-300"
                              >
                                {sbu}
                              </th>
                            ))}
                            <th className="py-3 px-4 font-bold text-slate-900 text-right bg-slate-100 min-w-[100px] border-l border-slate-300">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthEntry.rows.map((row) => {
                            const isAllRow = row.status === "All";

                            return (
                              <tr
                                key={`${monthEntry.month}-${row.status}`}
                                className={`border-b border-slate-100 ${isAllRow ? "bg-amber-50 font-black" : "hover:bg-slate-50"}`}
                              >
                                <td
                                  className={`py-3 px-4 ${isAllRow ? "font-black text-slate-900" : "font-bold text-slate-900"}`}
                                >
                                  {row.status}
                                </td>
                                {combinedReportData.mgrCodes.map((sbu) => (
                                  <td
                                    key={`${monthEntry.month}-${row.status}-${sbu}`}
                                    className={`py-3 px-4 text-right border-l border-slate-200 ${isAllRow ? "font-black text-slate-900" : "font-semibold text-slate-700"}`}
                                  >
                                    {formatReportValue(row[sbu] || 0, 0)}
                                  </td>
                                ))}
                                <td
                                  className={`py-3 px-4 text-right border-l border-slate-300 ${isAllRow ? "bg-amber-100 font-black text-slate-900" : "bg-slate-50 font-bold text-slate-900"}`}
                                >
                                  {formatReportValue(row.total || 0, 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 font-bold">
              {loading ? (
                <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
              ) : (
                "No data available. Add planning entries above to generate the SBU Wise report."
              )}
            </div>
          ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div
          className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
          onClick={() => setIsReportExpanded2(!isReportExpanded2)}
        >
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <MdKeyboardArrowDown
              className={`text-slate-500 transition-transform duration-300 ${!isReportExpanded2 ? "-rotate-90" : ""}`}
              size={20}
            />
            Segment Wise - FY {financialYear}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              exportReportToExcel(reportData2, "Segment Wise Report");
            }}
            disabled={!reportData2 || !reportData2.mgrCodes?.length}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdDownload size={16} />
            Export
          </button>
        </div>

        {isReportExpanded2 &&
          (reportData2 && reportData2.mgrCodes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-amber-50 border-b border-amber-100">
                    <th className="py-3 px-4 font-black text-slate-700 min-w-[160px]">
                      Month
                    </th>
                    {reportData2.mgrCodes.map((mgr) => (
                      <th
                        key={mgr}
                        className="py-3 px-4 font-black text-slate-700 text-right min-w-[100px]"
                      >
                        {mgr}
                      </th>
                    ))}
                    <th className="py-3 px-4 font-black text-slate-900 text-right bg-amber-100 min-w-[100px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const monthRowsByLabel = new Map(
                      (reportData2.rows || [])
                        .filter((row) => row.isMonth && !row.isSegment)
                        .map((row) => [row.monthLabel || row.month, row]),
                    );
                    const segmentMonthLabels =
                      reportData2.monthLabels?.length > 0
                        ? reportData2.monthLabels
                        : Array.from(monthRowsByLabel.keys());

                    return segmentMonthLabels.map((monthLabel) => {
                      const monthRow = monthRowsByLabel.get(monthLabel) || {
                        month: monthLabel,
                        total: 0,
                      };

                      return (
                        <React.Fragment key={monthLabel}>
                          <tr
                            className="border-b-2 border-slate-200 bg-blue-50 font-bold cursor-pointer hover:bg-blue-100/60 transition-colors"
                            onClick={() => toggleSegmentMonth(monthLabel)}
                          >
                            <td className="py-3 px-4 text-slate-900">
                              <div className="flex items-center gap-2">
                                <MdKeyboardArrowDown
                                  className={`text-slate-700 transition-transform duration-300 ${!expandedSegmentMonths[monthLabel] ? "-rotate-90" : ""}`}
                                  size={18}
                                />
                                {monthRow.month}
                              </div>
                            </td>
                            {reportData2.mgrCodes.map((mgr) => {
                              const cellValue = Number(monthRow[mgr] || 0);
                              return (
                                <td
                                  key={mgr}
                                  className={`py-3 px-4 text-right text-slate-900 font-bold ${cellValue > 0 ? "bg-blue-100/60" : ""}`}
                                >
                                  {formatReportValue(cellValue, 3)}
                                </td>
                              );
                            })}
                            <td
                              className={`py-3 px-4 text-right text-slate-900 font-black ${Number(monthRow.total || 0) > 0 ? "bg-blue-100/60" : "bg-slate-50"}`}
                            >
                              {formatReportValue(monthRow.total || 0, 3)}
                            </td>
                          </tr>
                          {expandedSegmentMonths[monthLabel] &&
                            (() => {
                              // Build SBU-level rows from sbuWise for this month
                              const sbuMap = new Map();
                              const resolveSbuLabel = (value) => {
                                const normalized = normalizeSbuValue(value);
                                const match = (
                                  combinedReportData?.mgrCodes || []
                                ).find(
                                  (code) =>
                                    normalizeSbuValue(code) === normalized,
                                );
                                return match || value || "Unassigned";
                              };

                              (combinedReportData?.sbuWise || [])
                                .filter((r) => r.month === monthLabel)
                                .forEach((r) => {
                                  const canonicalSbu = resolveSbuLabel(r.sbu);
                                  const normalizedSbu =
                                    normalizeSbuValue(canonicalSbu);
                                  const key = normalizedSbu || canonicalSbu;
                                  if (!sbuMap.has(key)) {
                                    sbuMap.set(key, {
                                      normalizedSbu,
                                      sbu: canonicalSbu,
                                      values: {},
                                      total: 0,
                                    });
                                  }
                                  const entry = sbuMap.get(key);
                                  const segKey = r.segment || "Unassigned";
                                  entry.values[segKey] =
                                    (entry.values[segKey] || 0) +
                                    Number(r.value || 0);
                                  entry.total += Number(r.value || 0);
                                });
                              const sbuRows = Array.from(sbuMap.values());
                              return sbuRows.map((row) => (
                                <tr
                                  key={`${monthLabel}-${row.normalizedSbu}`}
                                  className="border-b border-slate-100 hover:bg-slate-50"
                                >
                                  <td className="py-3 px-4 text-slate-900 font-bold pl-12">
                                    <span>{row.sbu}</span>
                                  </td>
                                  {reportData2.mgrCodes.map((mgr) => {
                                    const val = Number(row.values[mgr] || 0);
                                    return (
                                      <td
                                        key={mgr}
                                        className={`py-3 px-4 text-right text-slate-700 ${val > 0 ? "bg-blue-100/60" : ""}`}
                                      >
                                        {formatReportValue(val, 3)}
                                      </td>
                                    );
                                  })}
                                  <td
                                    className={`py-3 px-4 text-right text-slate-900 font-bold ${Number(row.total || 0) > 0 ? "bg-blue-100/60" : "bg-amber-50/50"}`}
                                  >
                                    {formatReportValue(row.total, 3)}
                                  </td>
                                </tr>
                              ));
                            })()}
                        </React.Fragment>
                      );
                    });
                  })()}
                  {(() => {
                    const summaryRowsInOrder = [
                      (reportData2.rows || []).find((row) => row.isTotal),
                      (reportData2.rows || []).find((row) => row.isPercentage),
                      (reportData2.rows || []).find(
                        (row) => row.isPreviousYearValue,
                      ),
                      (reportData2.rows || []).find(
                        (row) => row.isTotalPercentage,
                      ),
                    ].filter(Boolean);

                    return summaryRowsInOrder.map((row) => {
                      const isTotal = row.isTotal;
                      const isPercentage = row.isPercentage;
                      const isPreviousYearValue = row.isPreviousYearValue;
                      const isTotalPercentage = row.isTotalPercentage;

                      return (
                        <tr
                          key={row.month}
                          className={`border-b transition-colors ${
                            isTotal
                              ? "bg-amber-50 border-amber-200 font-black"
                              : isPreviousYearValue
                                ? "bg-amber-100/70 border-amber-200 font-bold"
                                : isPercentage || isTotalPercentage
                                  ? "bg-slate-50 border-slate-200"
                                  : "border-slate-50 hover:bg-slate-50"
                          }`}
                        >
                          <td
                            className={`py-3 px-4 ${isTotal || isPercentage || isPreviousYearValue || isTotalPercentage ? "font-black text-slate-900" : "font-semibold text-slate-600"}`}
                          >
                            {row.month}
                          </td>
                          {reportData2.mgrCodes.map((mgr) => {
                            const cellValue = Number(row[mgr] || 0);
                            return (
                              <td
                                key={mgr}
                                className={`py-3 px-4 text-right ${isTotal || isPercentage || isPreviousYearValue || isTotalPercentage ? "font-bold text-slate-900" : "text-slate-700"} ${cellValue > 0 ? "bg-blue-100/60" : ""}`}
                              >
                                {isPercentage || isTotalPercentage
                                  ? formatReportPercentage(cellValue)
                                  : formatReportValue(cellValue, 3)}
                              </td>
                            );
                          })}
                          <td
                            className={`py-3 px-4 text-right ${
                              Number(row.total || 0) > 0
                                ? "bg-blue-100/60"
                                : isTotal
                                  ? "bg-amber-100"
                                  : isPreviousYearValue
                                    ? "bg-amber-200/80"
                                    : isPercentage || isTotalPercentage
                                      ? "bg-slate-100"
                                      : "bg-amber-50/50"
                            } ${isTotal ? "font-black" : "font-bold"} text-slate-900`}
                          >
                            {isPercentage || isTotalPercentage
                              ? formatReportPercentageTotal(row.total)
                              : formatReportValue(row.total || 0, 3)}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 font-bold">
              {loading ? (
                <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
              ) : (
                "No data available for Segment Wise. Add entries with MGR 2 codes to generate this report."
              )}
            </div>
          ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div
          className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-colors"
          onClick={() =>
            setIsStatusBreakdownExpanded(!isStatusBreakdownExpanded)
          }
        >
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <MdKeyboardArrowDown
              className={`text-slate-500 transition-transform duration-300 ${!isStatusBreakdownExpanded ? "-rotate-90" : ""}`}
              size={20}
            />
            Status Breakdown Summary - FY {financialYear}
          </h2>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              exportStatusBreakdownToExcel();
            }}
            disabled={
              !computedStatusBreakdownData ||
              !computedStatusBreakdownData.length
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdDownload size={16} />
            Export
          </button>
        </div>

        {isStatusBreakdownExpanded &&
          (computedStatusBreakdownData &&
          computedStatusBreakdownData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 border-b border-amber-100">
                    <th className="py-3 px-4 text-left font-black text-slate-900 min-w-[200px]">
                      Month / Segment / Status
                    </th>
                    {statusBreakdownColumns.map((column) => (
                      <th
                        key={`status-breakdown-header-${column}`}
                        className="py-3 px-4 text-right font-black text-slate-900 min-w-[100px]"
                      >
                        {column}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right font-black text-slate-900 min-w-[100px] bg-amber-50 border-l-2 border-amber-200">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    console.log(
                      "[Table Render] Status Breakdown Data with computed totals:",
                      computedStatusBreakdownData,
                    );
                    return computedStatusBreakdownData.map((monthEntry) => (
                      <React.Fragment key={monthEntry.month}>
                        {/* MONTH */}
                        {(() => {
                          const monthTotals = calculateMonthTotals(monthEntry);
                          return (
                            <tr
                              className="border-b-2 border-slate-200 bg-blue-50 font-bold cursor-pointer hover:bg-blue-100/60 transition-colors"
                              onClick={() =>
                                toggleStatusBreakdownMonth(monthEntry.month)
                              }
                            >
                              <td className="py-3 px-4 text-slate-900">
                                <div className="flex items-center gap-2">
                                  <MdKeyboardArrowDown
                                    className={`text-slate-700 transition-transform duration-300 ${!expandedStatusBreakdownMonths[monthEntry.month] ? "-rotate-90" : ""}`}
                                    size={18}
                                  />
                                  {monthEntry.month}
                                </div>
                              </td>
                              {statusBreakdownColumns.map((column) => {
                                const totalValue = Number(
                                  monthTotals[column] || 0,
                                );
                                return (
                                  <td
                                    key={`${monthEntry.month}-header-total-${column}`}
                                    className={`py-3 px-4 text-right text-slate-900 ${totalValue > 0 ? "bg-blue-100" : ""}`}
                                  >
                                    {formatReportValue(totalValue, 0)}
                                  </td>
                                );
                              })}
                              <td className="py-3 px-4 text-right text-slate-900 font-black bg-amber-100 border-l-2 border-amber-200">
                                {formatReportValue(
                                  statusBreakdownColumns.reduce(
                                    (sum, col) =>
                                      sum + Number(monthTotals[col] || 0),
                                    0,
                                  ),
                                  0,
                                )}
                              </td>
                            </tr>
                          );
                        })()}

                        {expandedStatusBreakdownMonths[monthEntry.month] &&
                          monthEntry.segments.map((segmentEntry) => (
                            <React.Fragment
                              key={`${monthEntry.month}-${segmentEntry.segment}`}
                            >
                              {/* SEGMENT */}
                              <tr
                                className="border-b border-slate-100 bg-slate-50 font-bold cursor-pointer hover:bg-slate-100/60 transition-colors"
                                onClick={() =>
                                  toggleStatusBreakdownSegment(
                                    monthEntry.month,
                                    segmentEntry.segment,
                                  )
                                }
                              >
                                <td className="py-3 px-4 text-slate-900 pl-8">
                                  <div className="flex items-center gap-2">
                                    <MdKeyboardArrowDown
                                      className={`text-slate-600 transition-transform duration-300 ${!expandedStatusBreakdownSegments[`${monthEntry.month}-${segmentEntry.segment}`] ? "-rotate-90" : ""}`}
                                      size={16}
                                    />
                                    {segmentEntry.segment.toUpperCase()}
                                  </div>
                                </td>
                                <td
                                  colSpan={statusBreakdownColumns.length + 1}
                                ></td>
                              </tr>

                              {expandedStatusBreakdownSegments[
                                `${monthEntry.month}-${segmentEntry.segment}`
                              ] &&
                                Object.keys(segmentEntry.statuses).map(
                                  (status) => {
                                    const row = segmentEntry.statuses[status];
                                    return (
                                      <tr
                                        key={`${monthEntry.month}-${segmentEntry.segment}-${status}`}
                                        className="border-b border-slate-50 hover:bg-slate-50"
                                      >
                                        <td className="py-3 px-4 text-slate-700 pl-16 font-bold">
                                          {status}
                                        </td>
                                        {statusBreakdownColumns.map(
                                          (column) => {
                                            const cellValue = Number(
                                              row[column] || 0,
                                            );
                                            return (
                                              <td
                                                key={`${monthEntry.month}-${segmentEntry.segment}-${status}-${column}`}
                                                className={`py-3 px-4 text-right text-slate-700 ${cellValue > 0 ? "bg-blue-100" : ""}`}
                                              >
                                                {formatReportValue(
                                                  cellValue,
                                                  0,
                                                )}
                                              </td>
                                            );
                                          },
                                        )}
                                        <td className="py-3 px-4 text-right text-slate-700 font-bold bg-amber-50 border-l-2 border-amber-200">
                                          {formatReportValue(
                                            statusBreakdownColumns.reduce(
                                              (sum, col) =>
                                                sum + Number(row[col] || 0),
                                              0,
                                            ),
                                            0,
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  },
                                )}
                            </React.Fragment>
                          ))}
                      </React.Fragment>
                    ));
                  })()}

                  {computedStatusBreakdownData.length > 0 &&
                    (() => {
                      const grandTotals = calculateGrandTotals(
                        computedStatusBreakdownData,
                      );
                      return (
                        <tr className="border-t-4 border-amber-400 bg-amber-200 font-black">
                          <td className="py-4 px-4 text-slate-900 font-black">
                            GRAND TOTAL
                          </td>
                          {statusBreakdownColumns.map((column) => {
                            const totalValue = Number(grandTotals[column] || 0);
                            return (
                              <td
                                key={`grand-total-${column}`}
                                className={`py-4 px-4 text-right text-slate-900 font-black ${totalValue > 0 ? "bg-blue-100" : ""}`}
                              >
                                {formatReportValue(totalValue, 0)}
                              </td>
                            );
                          })}
                          <td className="py-4 px-4 text-right text-slate-900 font-black bg-amber-300 border-l-2 border-amber-400">
                            {formatReportValue(
                              statusBreakdownColumns.reduce(
                                (sum, col) =>
                                  sum + Number(grandTotals[col] || 0),
                                0,
                              ),
                              0,
                            )}
                          </td>
                        </tr>
                      );
                    })()}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center text-slate-400 font-bold">
              {loading ? (
                <div className="animate-spin border-4 border-slate-200 border-t-primary-600 rounded-full h-8 w-8 mx-auto"></div>
              ) : (
                "No data available. Add planning entries to generate the status breakdown."
              )}
            </div>
          ))}
      </div>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={`Import Planning - FY ${financialYear}`}
        type="planning"
        onImport={async (file, onUploadProgress) => {
          const result = await importService.importPlanning(
            file,
            financialYear,
            onUploadProgress,
          );
          await fetchData();
          return result;
        }}
        onDownloadTemplate={() =>
          importService.getPlanningTemplate(financialYear)
        }
      />
    </div>
  );
};

export default PlanningScreen;
