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
  MdKeyboardArrowRight,
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
  const cleaned = String(sbuName || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  if (cleaned === "SBU1") return "SBU1";
  if (cleaned === "SBU2") return "SBU2";
  if (cleaned === "SBU3") return "SBU3";
  if (cleaned === "EPC") return "EPC";

  return cleaned;
};

const formatReportValue = (value, decimals = 3) =>
  Number(value || 0) === 0 ? "-" : formatToLakhs(value, decimals);

const formatReportPercentage = (value, decimals = 2) =>
  Number(value || 0) === 0
    ? "-"
    : `${Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}%`;

const dedupeMgrOptions = (items = []) => {
  const seen = new Set();
  return items.filter((mgr) => {
    const key = normalizeMgrCode(mgr.code);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getCanonicalMgrCode = (value, mgrItems = []) => {
  const normalized = normalizeMgrCode(value);
  if (!normalized) return "";
  const match = mgrItems.find((mgr) => normalizeMgrCode(mgr.code) === normalized);
  return match?.code || String(value || "").trim().replace(/\s+/g, " ");
};

const getEntityId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || "");
  return String(value);
};

const getFallbackCode = (prefix, value) => {
  const entityId = getEntityId(value);
  return entityId ? `${prefix}-${entityId.slice(-8).toUpperCase()}` : "";
};

const compareSortValues = (left, right) => {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left || "").localeCompare(String(right || ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

const PlanningScreen = () => {
  const [financialYear, setFinancialYear] = useState(getFinancialYears()[1]);
  const [entries, setEntries] = useState([]);
  const [combinedReportData, setCombinedReportData] = useState(null);
  const [reportData2, setReportData2] = useState(null);
  const [statusReportData, setStatusReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totalEntries, setTotalEntries] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [isReportExpanded, setIsReportExpanded] = useState(false);
  const [isReportExpanded2, setIsReportExpanded2] = useState(false);
<<<<<<< HEAD
  const [isStatusBreakdownExpanded, setIsStatusBreakdownExpanded] =
    useState(true);
  const [expandedSegmentMonths, setExpandedSegmentMonths] = useState({});
  const [expandedStatusBreakdownMonths, setExpandedStatusBreakdownMonths] =
    useState({});
  const [expandedStatusBreakdownSbus, setExpandedStatusBreakdownSbus] =
    useState({});
  const [expandedStatusBreakdownSegments, setExpandedStatusBreakdownSegments] =
    useState({});
=======
  const [isStatusBreakdownExpanded, setIsStatusBreakdownExpanded] = useState(true);
  
>>>>>>> babc1b5dca85e501b0e668d71fb9690cae2a04f5
  const [expandedSbuWiseMonths, setExpandedSbuWiseMonths] = useState({});
  const [expandedSegmentMonths, setExpandedSegmentMonths] = useState({});
  const [expandedStatusBreakdownMonths, setExpandedStatusBreakdownMonths] = useState({});
  const [expandedStatusBreakdownSbus, setExpandedStatusBreakdownSbus] = useState({});

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [mgrList, setMgrList] = useState([]);
  const [mgrList2, setMgrList2] = useState([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [filters, setFilters] = useState({
    month: "",
    mgrCode: "",
    mgrCode2: "",
    status: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "monthYear",
    direction: "asc",
  });

  const monthLabels = useMemo(() => getMonthLabels(financialYear), [financialYear]);
  const monthOrder = useMemo(() => new Map(monthLabels.map((label, index) => [label, index])), [monthLabels]);

  const fetchData = useCallback(async () => {
    const isLoadMore = offset > 0;
    if (isLoadMore) setIsLoadingMore(true);
    else setLoading(true);

    try {
      const reportQuery = {};
      if (filters.month) {
        const [mName] = filters.month.split("-");
        const startYear = parseInt(financialYear.split("-")[0], 10);
        const mIdx = FY_MONTHS.indexOf(mName);
        reportQuery.month = mName;
        reportQuery.year = String(mIdx <= 8 ? startYear : startYear + 1);
      }

      const params = {
        financialYear,
        month: filters.month,
        mgr1: filters.mgrCode,
        mgr2: filters.mgrCode2,
        status: filters.status,
        limit,
        offset,
      };

      if (isLoadMore) {
        const entriesRes = await planningService.getAll(params);
        setEntries((prev) => [...prev, ...entriesRes.data.data]);
        setTotalEntries(entriesRes.data.total);
      } else {
        const [entriesRes, sbuReportRes, segmentReportRes, statusReportRes] = await Promise.all([
          planningService.getAll(params),
          planningService.getMGRReport(financialYear, "SBU", reportQuery),
          planningService.getMGRReport(financialYear, "SEGMENT", reportQuery),
          planningService.getMGRReport(financialYear, "STATUS", reportQuery),
        ]);
        setEntries(entriesRes.data.data || []);
        setTotalEntries(entriesRes.data.total || 0);
        setCombinedReportData(sbuReportRes.data);
        setReportData2(segmentReportRes.data);
        setStatusReportData(statusReportRes.data);
      }
    } catch (err) {
      console.error("Failed to load planning data:", err);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [financialYear, filters, offset, limit]);

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
        setMgrList(dedupeMgrOptions(mgrRes.data.filter((mgr) => mgr.status === "Active")));
        setMgrList2(dedupeMgrOptions(mgr2Res.data.filter((mgr) => mgr.status === "Active")));
      } catch (err) {
        console.error("Failed to load master data:", err);
      }
    };
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, month: "" }));
    setOffset(0);
  }, [financialYear]);

<<<<<<< HEAD
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
    // The entries are already filtered by the backend
    return entries;
  }, [entries]);

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

  const toggleStatusBreakdownMonth = (month) => {
    setExpandedStatusBreakdownMonths((prev) => ({
      ...prev,
      [month]: !prev[month],
    }));
  };

  const toggleStatusBreakdownSbu = (month, sbu) => {
    const key = `${month}-${sbu}`;
    setExpandedStatusBreakdownSbus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const statusBreakdownColumns = STATUS_REPORT_COLUMNS;
  const _unused_statusBreakdownColumns = useMemo(() => {
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
    const visibleMonths = combinedReportData?.monthYear ? [combinedReportData.monthYear] : monthLabels;
    const sbuWise = combinedReportData?.sbuWise || [];

    return visibleMonths.map(month => {
      const monthRows = sbuWise.filter(r => r.month === month);
      
      const sbus = Array.from(new Set(monthRows.map(r => normalizeSbuValue(r.sbu)))).filter(Boolean);
      
      const sbuGroups = sbus.map(sbu => {
        const sbuRows = monthRows.filter(r => normalizeSbuValue(r.sbu) === sbu);
        const sbuLabel = sbuRows[0]?.sbu || sbu;
        
        const segments = Array.from(new Set(sbuRows.map(r => r.segment || "Unassigned"))).filter(Boolean);
        
        const segmentGroups = segments.map(seg => {
          const segRows = sbuRows.filter(r => (r.segment || "Unassigned") === seg);
          const statuses = {};
          STATUS_REPORT_COLUMNS.forEach(col => {
            statuses[col] = segRows.filter(r => r.status === col).reduce((sum, r) => sum + Number(r.value || 0), 0);
          });
          const total = Object.values(statuses).reduce((sum, v) => sum + v, 0);
          return { segment: seg, statuses, total };
        });
        
        const sbuTotalStatuses = {};
        STATUS_REPORT_COLUMNS.forEach(col => {
          sbuTotalStatuses[col] = segmentGroups.reduce((sum, seg) => sum + seg.statuses[col], 0);
        });
        const sbuGrandTotal = Object.values(sbuTotalStatuses).reduce((sum, v) => sum + v, 0);
        
        return { sbu: sbuLabel, segmentGroups, sbuTotalStatuses, sbuGrandTotal };
      });
      
      return { month, sbuGroups };
    });
  }, [combinedReportData, monthLabels]);

  const statusBreakdownSummaryRows = useMemo(() => {
    if (!computedStatusBreakdownData || computedStatusBreakdownData.length === 0) return [];

    const grandTotals = {};
    STATUS_REPORT_COLUMNS.forEach(col => {
      grandTotals[col] = computedStatusBreakdownData.reduce((sum, month) => {
        return sum + month.sbuGroups.reduce((sSum, sbu) => sSum + sbu.sbuTotalStatuses[col], 0);
      }, 0);
    });
    const grandTotalValue = Object.values(grandTotals).reduce((sum, v) => sum + v, 0);

    const percentageRow = {};
    STATUS_REPORT_COLUMNS.forEach(col => {
      percentageRow[col] = grandTotalValue > 0
        ? Number(((grandTotals[col] / grandTotalValue) * 100).toFixed(2))
        : 0;
    });
    percentageRow.total = grandTotalValue > 0 ? 100 : 0;

    const prevYearRow = (combinedReportData?.rows || []).find(r => r.isPreviousYearValue);

    return [
      {
        key: "total",
        label: "Total",
        isTotal: true,
        values: grandTotals,
        rowTotal: grandTotalValue,
      },
      {
        key: "percentage",
        label: "Percentage CY",
        isPercentage: true,
        values: percentageRow,
        rowTotal: percentageRow.total,
      },
      ...(prevYearRow ? [
        {
          key: "prev-year",
          label: "Value (Previous Year)",
          isPreviousYearValue: true,
          values: prevYearRow,
          rowTotal: prevYearRow.total || 0,
        },
        {
          key: "prev-percentage",
          label: "Percentage PY",
          isTotalPercentage: true,
          values: (() => {
            const pValues = {};
            const pTotal = Number(prevYearRow?.total || 0);
            STATUS_REPORT_COLUMNS.forEach(col => {
              pValues[col] = pTotal > 0
                ? Number(((Number(prevYearRow[col] || 0) / pTotal) * 100).toFixed(2))
                : 0;
            });
            return pValues;
          })(),
          rowTotal: Number(prevYearRow?.total || 0) > 0 ? 100 : 0,
        }
      ] : [])
    ];
  }, [computedStatusBreakdownData, combinedReportData]);

  useEffect(() => {
    if (computedStatusBreakdownData) {
      setExpandedStatusBreakdownSegments((prev) => {
        const next = { ...prev };
        computedStatusBreakdownData.forEach((monthEntry) => {
          STATUS_BREAKDOWN_ORDERED_ROWS.forEach((segmentEntry) => {
            const key = `${monthEntry.month}-${segmentEntry.key}`;
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
    // Validate entry month selection
    if (!newRow.monthYear) {
      toast.error("⚠️ Please select a Month for the entry");
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
        "Please fill all mandatory fields (MGR 2 is optional)",
      );
      return;
    }

    const monthToUse = newRow.monthYear;
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

    const rows = [["Month", "Status", ...statusBreakdownColumns]];

    computedStatusBreakdownData.forEach((monthEntry) => {
      STATUS_BREAKDOWN_ORDERED_ROWS.forEach(({ key, label }) => {
        const row = monthEntry.statuses[key] || {};
        rows.push([
          monthEntry.month,
          label,
          ...statusBreakdownColumns.map((column) =>
            formatReportValue(row[column] || 0, 0),
          ),
        ]);
      });

      // Add totals row for this month
      const monthTotals = calculateMonthTotals(monthEntry);
      rows.push([
        monthEntry.month,
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
      "GRAND TOTAL",
      ...statusBreakdownColumns.map((column) =>
        formatReportValue(grandTotals[column] || 0, 0),
      ),
    ]);

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 16 },
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
=======
  const computedStatusBreakdownData = useMemo(() => {
    const visibleMonths = statusReportData?.monthYear ? [statusReportData.monthYear] : monthLabels;
    const rows = statusReportData?.rows || [];
    
    return visibleMonths.map(month => {
      const monthRows = rows.filter(r => r.parentMonth === month || r.month === month);
      
      const sbus = Array.from(new Set(monthRows.filter(r => r.isSbu).map(r => r.month)));
      const sbuGroups = sbus.map(sbu => {
        const sbuEntries = monthRows.filter(r => r.parentSbu === sbu);
        const segments = sbuEntries.filter(r => r.isSegment);
        const totalRow = sbuEntries.find(r => r.isTotal);
        return { sbu, segments, totalRow };
      });

      return { month, sbuGroups };
    });
  }, [statusReportData, monthLabels]);

  const formatValue = (val) => (val === 0 || val === undefined || val === null ? "-" : val.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
>>>>>>> babc1b5dca85e501b0e668d71fb9690cae2a04f5

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <MdCalendarMonth className="text-blue-600" />
          Planning Screen
        </h1>
        <div className="flex items-center gap-4">
          <select
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            className="bg-slate-50 border-0 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            {getFinancialYears().map((fy) => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 active:scale-95"
          >
            <MdFileUpload /> IMPORT
          </button>
        </div>
      </div>

      {/* Status Breakdown Summary */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div 
          className="p-5 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setIsStatusBreakdownExpanded(!isStatusBreakdownExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <MdRefresh className="text-xl" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">Status Breakdown Summary</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detailed SBU & Segment Analysis</p>
            </div>
          </div>
          <MdKeyboardArrowDown className={`text-2xl text-slate-400 transition-transform duration-300 ${isStatusBreakdownExpanded ? "" : "-rotate-90"}`} />
        </div>

        {isStatusBreakdownExpanded && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 p-2 text-left bg-slate-50 font-black text-slate-700 min-w-[100px]">Month</th>
                  <th className="border border-slate-200 p-2 text-left bg-slate-50 font-black text-slate-700 min-w-[100px]">SBU/EPC</th>
                  <th className="border border-slate-200 p-2 text-left bg-slate-50 font-black text-slate-700 min-w-[120px]">Segment</th>
                  {STATUS_REPORT_COLUMNS.map(col => (
                    <th key={col} className="border border-slate-200 p-2 text-right bg-slate-50 font-black text-slate-700 min-w-[90px]">{col}</th>
                  ))}
                  <th className="border border-slate-200 p-2 text-right bg-slate-50 font-black text-slate-700 min-w-[100px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {computedStatusBreakdownData.map((monthData, mIdx) => (
                  <React.Fragment key={monthData.month}>
                    <tr 
                      className="cursor-pointer hover:bg-slate-50 border-t-2 border-slate-200"
                      onClick={() => setExpandedStatusBreakdownMonths(prev => ({ ...prev, [monthData.month]: !prev[monthData.month] }))}
                    >
                      <td className="border border-slate-200 p-2 font-black text-slate-800 flex items-center gap-2">
                        {expandedStatusBreakdownMonths[monthData.month] ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                        {monthData.month}
                      </td>
                      <td className="border border-slate-200 p-2" colSpan={STATUS_REPORT_COLUMNS.length + 3}></td>
                    </tr>
                    {expandedStatusBreakdownMonths[monthData.month] && monthData.sbuGroups.map((sbuGroup, sIdx) => (
                      <React.Fragment key={sbuGroup.sbu}>
                        <tr 
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => setExpandedStatusBreakdownSbus(prev => ({ ...prev, [`${monthData.month}-${sbuGroup.sbu}`]: !prev[`${monthData.month}-${sbuGroup.sbu}`] }))}
                        >
                          <td className="border border-slate-200 p-2"></td>
                          <td className="border border-slate-200 p-2 font-black text-slate-700 flex items-center gap-2 pl-4">
                            {expandedStatusBreakdownSbus[`${monthData.month}-${sbuGroup.sbu}`] ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                            {sbuGroup.sbu}
                          </td>
                          <td className="border border-slate-200 p-2" colSpan={STATUS_REPORT_COLUMNS.length + 2}></td>
                        </tr>
                        {expandedStatusBreakdownSbus[`${monthData.month}-${sbuGroup.sbu}`] && sbuGroup.segments.map((seg, segIdx) => (
                          <tr key={segIdx} className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-200 p-2"></td>
                            <td className="border border-slate-200 p-2"></td>
                            <td className="border border-slate-200 p-2 pl-8 font-bold text-slate-600">{seg.month}</td>
                            {STATUS_REPORT_COLUMNS.map(col => (
                              <td key={col} className="border border-slate-200 p-2 text-right text-slate-600">{formatValue(seg[col])}</td>
                            ))}
                            <td className="border border-slate-200 p-2 text-right font-black text-slate-800 bg-slate-50/30">{formatValue(seg.total)}</td>
                          </tr>
                        ))}
                        {expandedStatusBreakdownSbus[`${monthData.month}-${sbuGroup.sbu}`] && sbuGroup.totalRow && (
                          <tr className="bg-yellow-50/50 font-black border-b border-slate-200">
                            <td className="border border-slate-200 p-2"></td>
                            <td className="border border-slate-200 p-2"></td>
                            <td className="border border-slate-200 p-2 pl-8 text-slate-900">SBU TOTAL</td>
                            {STATUS_REPORT_COLUMNS.map(col => (
                              <td key={col} className="border border-slate-200 p-2 text-right text-slate-900">{formatValue(sbuGroup.totalRow[col])}</td>
                            ))}
                            <td className="border border-slate-200 p-2 text-right text-slate-900">{formatValue(sbuGroup.totalRow.total)}</td>
                          </tr>
<<<<<<< HEAD
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
                            {isPercentage ? "Percentage CY" : row.month}
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
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-2.5 px-3 text-left font-black text-slate-900 text-[11px] min-w-[90px] border-r border-slate-200">Month</th>
                    <th className="py-2.5 px-3 text-left font-black text-slate-900 text-[11px] min-w-[110px] border-r border-slate-200">SBU/EPC</th>
                    <th className="py-2.5 px-3 text-left font-black text-slate-900 text-[11px] min-w-[110px] border-r border-slate-200">Segment</th>
                    {STATUS_REPORT_COLUMNS.map((column) => (
                      <th
                        key={`status-breakdown-header-${column}`}
                        className="py-2.5 px-3 text-right font-black text-slate-900 text-[11px] min-w-[80px] border-r border-slate-200"
                      >
                        {column}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right font-black text-slate-900 text-[11px] min-w-[90px] bg-slate-200/50 border-r border-slate-200">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {computedStatusBreakdownData.map((monthData, mIdx) => {
                    const isMonthExpanded = expandedStatusBreakdownMonths[monthData.month];
                    return (
                      <React.Fragment key={monthData.month}>
                        {/* Month Header Row */}
                        <tr 
                          className="bg-slate-50 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => toggleStatusBreakdownMonth(monthData.month)}
                        >
                          <td className="py-2.5 px-3 text-slate-900 font-black uppercase tracking-wider text-[11px] flex items-center gap-2 border-r border-slate-200">
                            <MdKeyboardArrowDown 
                              className={`text-slate-500 transition-transform duration-200 ${!isMonthExpanded ? "-rotate-90" : ""}`} 
                              size={18} 
                            />
                            {monthData.month}
                          </td>
                          <td colSpan={STATUS_REPORT_COLUMNS.length + 3} className="bg-white/50"></td>
                        </tr>

                        {isMonthExpanded && monthData.sbuGroups.map((sbuGroup, sIdx) => {
                          const sbuKey = `${monthData.month}-${sbuGroup.sbu}`;
                          const isSbuExpanded = expandedStatusBreakdownSbus[sbuKey];
                          const fixedSegments = ["Export", "Industry", "UC", "Utility"];
                          
                          return (
                            <React.Fragment key={sbuGroup.sbu}>
                              {/* SBU Header Row */}
                              <tr 
                                className="bg-white border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => toggleStatusBreakdownSbu(monthData.month, sbuGroup.sbu)}
                              >
                                <td className="py-2 px-3 border-r border-slate-200"></td>
                                <td className="py-2 px-3 text-slate-800 font-bold flex items-center gap-2 border-r border-slate-200">
                                  <MdKeyboardArrowDown 
                                    className={`text-slate-400 transition-transform duration-200 ${!isSbuExpanded ? "-rotate-90" : ""}`} 
                                    size={16} 
                                  />
                                  {sbuGroup.sbu}
                                </td>
                                <td colSpan={STATUS_REPORT_COLUMNS.length + 2} className="bg-white/50"></td>
                              </tr>

                              {isSbuExpanded && (
                                <>
                                  {fixedSegments.map((segmentName) => {
                                    const seg = sbuGroup.segmentGroups.find(g => g.segment === segmentName) || {
                                      segment: segmentName,
                                      statuses: {},
                                      total: 0
                                    };
                                    return (
                                      <tr key={`${monthData.month}-${sbuGroup.sbu}-${segmentName}`} className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
                                        <td className="py-1.5 px-3 border-r border-slate-200"></td>
                                        <td className="py-1.5 px-3 border-r border-slate-200"></td>
                                        <td className="py-1.5 px-6 text-slate-800 font-black border-r border-slate-200 bg-white">
                                          {segmentName}
                                        </td>
                                        {STATUS_REPORT_COLUMNS.map(col => (
                                          <td key={col} className="py-1.5 px-3 text-right text-slate-600 border-r border-slate-200 text-[13px]">
                                            {formatReportValue(seg.statuses[col], 3)}
                                          </td>
                                        ))}
                                        <td className="py-1.5 px-3 text-right font-black text-slate-900 bg-slate-50/30">
                                          {formatReportValue(seg.total, 3)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {/* SBU TOTAL Row */}
                                  <tr className="bg-yellow-50 font-bold border-b border-slate-200">
                                    <td className="py-2 px-3 border-r border-slate-200"></td>
                                    <td className="py-2 px-3 border-r border-slate-200"></td>
                                    <td className="py-2 px-6 text-slate-900 border-r border-slate-200 uppercase tracking-tight text-[12px] font-black">SBU TOTAL</td>
                                    {STATUS_REPORT_COLUMNS.map(col => (
                                      <td key={col} className="py-2 px-3 text-right text-slate-900 border-r border-slate-200 font-black">
                                        {formatReportValue(sbuGroup.sbuTotalStatuses[col], 3)}
                                      </td>
                                    ))}
                                    <td className="py-2 px-3 text-right font-black text-slate-900 bg-yellow-100/20">
                                      {formatReportValue(sbuGroup.sbuGrandTotal, 3)}
                                    </td>
                                  </tr>
                                </>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  {statusBreakdownSummaryRows.map((summaryRow) => {
                    const isYellowLabel = summaryRow.isTotal || summaryRow.isPreviousYearValue;
                    
                    return (
                      <tr
                        key={`status-breakdown-${summaryRow.key}`}
                        className={`border-b-2 border-slate-200 ${isYellowLabel ? "bg-amber-50" : "bg-slate-50"}`}
                      >
                        <td
                          colSpan={3}
                          className={`py-3 px-3 font-black text-slate-900 uppercase tracking-wider text-[11px] border-r border-slate-200 ${
                            isYellowLabel ? "bg-amber-100/40" : "bg-slate-100/40"
                          }`}
                        >
                          {summaryRow.label}
                        </td>
                        {STATUS_REPORT_COLUMNS.map((column) => {
                          const cellValue = Number(summaryRow.values[column] || 0);
                          const hasValue = cellValue > 0;
                          return (
                            <td
                              key={`${summaryRow.key}-${column}`}
                              className={`py-3 px-3 text-right font-black text-slate-900 border-r border-slate-200 ${
                                hasValue ? "bg-blue-100/60" : ""
                              }`}
                            >
                              {summaryRow.isPercentage || summaryRow.isTotalPercentage
                                ? formatReportPercentage(cellValue)
                                : formatReportValue(cellValue, 3)}
                            </td>
                          );
                        })}
                        <td
                          className={`py-3 px-3 text-right font-black text-slate-900 ${
                            Number(summaryRow.rowTotal || 0) > 0 ? "bg-blue-100/60" : (isYellowLabel ? "bg-amber-100/50" : "bg-slate-100/50")
                          }`}
                        >
                          {summaryRow.isPercentage || summaryRow.isTotalPercentage
                            ? formatReportPercentageTotal(summaryRow.rowTotal)
                            : formatReportValue(summaryRow.rowTotal, 3)}
                        </td>
                      </tr>
                    );
                  })}
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
=======
                        )}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
>>>>>>> babc1b5dca85e501b0e668d71fb9690cae2a04f5
      </div>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={`Import Planning - FY ${financialYear}`}
        type="planning"
        onImport={async (file, onUploadProgress) => {
          const result = await importService.importPlanning(file, financialYear, onUploadProgress);
          await fetchData();
          return result;
        }}
        onDownloadTemplate={() => importService.getPlanningTemplate(financialYear)}
      />
    </div>
  );
};

export default PlanningScreen;
