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
  const [isStatusBreakdownExpanded, setIsStatusBreakdownExpanded] = useState(true);
  
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
                        )}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
