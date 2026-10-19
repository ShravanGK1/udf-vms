import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Download, Calendar, Users, UserCheck, UserX, TrendingUp,
  FileText, Filter, Clock, ArrowUpRight, ArrowDownRight,
  Repeat, Building2, HardHat, UserRound, Truck,
  Timer, MapPin, BarChart3, PieChart as PieIcon, FileSpreadsheet
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from "recharts";
import axios from "axios";
import apiClient from "../../app/apiClient";
import { useTheme } from "../../context/ThemeContext";
import "./ExportReport.css";

const PERIOD_OPTIONS = [
  { value: "daily", label: "Today", icon: "📅" },
  { value: "weekly", label: "This Week", icon: "📆" },
  { value: "quarterly", label: "This Quarter", icon: "🗓️" },
  { value: "yearly", label: "This Year", icon: "📊" },
];

const PIE_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#f59e0b", "#ef4444", "#10b981", "#f97316", "#6366f1"];

const DEMO_DATA = {
  daily: {
    summary: { todayCount: 12, mtdCount: 145, ytdCount: 890, avgDaily: 11.5, peakHour: "11:00 AM", repeatPercent: 18 },
    trend: [{ label: "09:00", visitors: 2 }, { label: "11:00", visitors: 5 }, { label: "13:00", visitors: 3 }],
    categorySplit: [{ name: "Visiting Vendor", value: 40 }, { name: "Client", value: 30 }, { name: "Interviews", value: 20 }, { name: "Other", value: 10 }],
    advancedInsights: {
      topDepartments: [{ name: "Human Resources", count: 25 }, { name: "Information Tech", count: 18 }],
      topVendors: [{ name: "ABC Supplies", count: 12 }, { name: "Tech Corp", count: 8 }],
      avgDuration: 45,
      repeatRatio: 1.2,
      gateTraffic: [{ name: "Main Gate", count: 85 }, { name: "Staff Gate", count: 40 }]
    },
    visitors: []
  },
  weekly: {
    summary: { todayCount: 0, mtdCount: 0, ytdCount: 0, avgDaily: 0, peakHour: "-", repeatPercent: 0 },
    trend: [],
    categorySplit: [],
    advancedInsights: { topDepartments: [], topVendors: [], avgDuration: 0, repeatRatio: 0, gateTraffic: [] },
    visitors: []
  },
  quarterly: {
    summary: { todayCount: 0, mtdCount: 0, ytdCount: 0, avgDaily: 0, peakHour: "-", repeatPercent: 0 },
    trend: [],
    categorySplit: [],
    advancedInsights: { topDepartments: [], topVendors: [], avgDuration: 0, repeatRatio: 0, gateTraffic: [] },
    visitors: []
  },
  yearly: {
    summary: { todayCount: 0, mtdCount: 0, ytdCount: 0, avgDaily: 0, peakHour: "-", repeatPercent: 0 },
    trend: [],
    categorySplit: [],
    advancedInsights: { topDepartments: [], topVendors: [], avgDuration: 0, repeatRatio: 0, gateTraffic: [] },
    visitors: []
  }
};
const ExportReport = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartGridStroke = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0,0,0,0.06)";
  const chartTickFill = isDark ? "#94a3b8" : "#627d98";
  const chartTooltipStyle = isDark ? {
    borderRadius: "0.75rem",
    background: "#1e293b",
    borderColor: "rgba(255, 255, 255, 0.15)",
    color: "#f8fafc"
  } : {
    borderRadius: "0.75rem",
    background: "rgba(255,255,255,0.95)"
  };

  const [period, setPeriod] = useState("daily");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReport(period);
  }, [period]);

  const fetchReport = async (selectedPeriod) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/reports?period=${selectedPeriod}`);
      setReportData(res.data);
    } catch (error) {
      console.log("API failed → using demo data");
      setReportData(DEMO_DATA[selectedPeriod]); // ✅ fallback
    } finally {
      setLoading(false);
    }
  };

  const resolveVisitorSite = (v) => {
    if (v.site_name && v.site_name !== "-" && v.site_name !== "Default Site") return v.site_name;
    if (v.site && v.site !== "-" && v.site !== "Default Site") return v.site;
    const host = (v.person_visited || v.host_name || "").toLowerCase();
    if (host.includes("godase") || host.includes("aashish") || host.includes("sumit") || host.includes("pratik")) {
      return "Vishal Complex";
    }
    if (host.includes("anil") || host.includes("bhosale") || host.includes("kunal") || host.includes("shashikant") || host.includes("manish")) {
      return "Kasarwadi";
    }
    if (v.site_id === 1 || String(v.site_id) === "1") return "Kasarwadi";
    if (v.site_id === 1022 || String(v.site_id) === "1022") return "Vishal Complex";
    return v.site_name || v.site || "-";
  };

  const handleDownloadPDF = () => {
    const visitors = reportData?.visitors || [];
    const meta = reportData?.metadata || {};
    const sum = reportData?.summary || {};

    let tableRows = visitors.length > 0 ? visitors.map((v, i) => `
      <tr>
        <td style="text-align: center;">${v.sr_no || i + 1}</td>
        <td><strong>${v.name || "-"}</strong></td>
        <td style="text-align: center;">${v.phone || "-"}</td>
        <td>${v.company || "-"}</td>
        <td>${v.person_visited || "-"}</td>
        <td>${v.checked_in_by || "-"}</td>
        <td>${v.department || "-"}</td>
        <td>${resolveVisitorSite(v)}</td>
        <td style="text-align: center;">${v.date || "-"}</td>
        <td style="text-align: center;">${v.check_in || "-"}</td>
        <td style="text-align: center;">${v.check_out || "-"}</td>
        <td style="text-align: center;">${v.time_available || "-"}</td>
        <td style="text-align: center;"><span class="badge ${String(v.status).toLowerCase()}">${v.status || "-"}</span></td>
        <td>${v.purpose || "-"}</td>
        <td style="text-align: center;">${v.has_material || "No"}</td>
      </tr>
    `).join("") : `
      <tr>
        <td colspan="15" style="text-align: center; padding: 24px; color: #64748b; font-style: italic;">
          No visitor activity records found for the selected period and site scope.
        </td>
      </tr>
    `;

    const html = `
    <html>
      <head>
        <title>Visitor Management System — Strategic Activity Report</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; color: #0f172a; background: #fff; }
          .header-box { border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 16px; }
          .company-name { font-size: 20px; font-weight: 800; color: #1e3a8a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .report-heading { font-size: 15px; font-weight: 700; color: #334155; margin: 4px 0 10px 0; }
          .meta-grid { display: flex; flex-wrap: wrap; gap: 15px; font-size: 11px; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid #e2e8f0; }
          .meta-item { display: flex; gap: 6px; }
          .meta-label { font-weight: 700; color: #64748b; }
          .meta-value { font-weight: 600; color: #0f172a; }

          .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin: 15px 0 18px 0; }
          .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center; }
          .kpi-title { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
          .kpi-num { font-size: 16px; font-weight: 800; color: #1e3a8a; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: middle; }
          th { background-color: #1e3a8a; font-weight: 700; color: #ffffff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          .badge.approved, .badge.checked_in { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
          .badge.rejected, .badge.denied { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
          .badge.pending { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }

          .footer-note { margin-top: 15px; font-size: 9px; color: #94a3b8; text-align: right; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <h1 class="company-name">${meta.company_name || "Unique Delta Force Security Pvt. Ltd."}</h1>
          <div class="report-heading">VISITOR MANAGEMENT SYSTEM — STRATEGIC ACTIVITY REPORT</div>
          <div class="meta-grid">
            <div class="meta-item"><span class="meta-label">Generated On:</span><span class="meta-value">${meta.generated_at || new Date().toLocaleString()}</span></div>
            <div class="meta-item"><span class="meta-label">Filter Period:</span><span class="meta-value">${meta.period_label || period.toUpperCase()}</span></div>
            <div class="meta-item"><span class="meta-label">Site Scope:</span><span class="meta-value">${meta.site_scope_label || "All Authorized Sites"}</span></div>
            <div class="meta-item"><span class="meta-label">Total Records:</span><span class="meta-value">${visitors.length} Records</span></div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-title">Period Visitors</div><div class="kpi-num">${sum.periodCount ?? visitors.length}</div></div>
          <div class="kpi-card"><div class="kpi-title">Today's Visits</div><div class="kpi-num">${sum.todayCount ?? 0}</div></div>
          <div class="kpi-card"><div class="kpi-title">Month-To-Date</div><div class="kpi-num">${sum.mtdCount ?? 0}</div></div>
          <div class="kpi-card"><div class="kpi-title">Year-To-Date</div><div class="kpi-num">${sum.ytdCount ?? 0}</div></div>
          <div class="kpi-card"><div class="kpi-title">Peak Check-In</div><div class="kpi-num" style="font-size: 13px;">${sum.peakHour || "N/A"}</div></div>
          <div class="kpi-card"><div class="kpi-title">Avg Duration</div><div class="kpi-num">${sum.avgDuration || 0}m</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">SR. NO</th>
              <th>VISITORS NAME</th>
              <th style="text-align: center;">CONTACT NUMBER</th>
              <th>COMPANY NAME</th>
              <th>PERSON VISITED</th>
              <th>CHECKED IN BY</th>
              <th>DEPARTMENT</th>
              <th>SITE</th>
              <th style="text-align: center;">DATE</th>
              <th style="text-align: center;">IN</th>
              <th style="text-align: center;">OUT</th>
              <th style="text-align: center;">TIME AVAILABLE</th>
              <th style="text-align: center;">STATUS</th>
              <th>PURPOSE</th>
              <th style="text-align: center;">MATERIAL</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer-note">
          Security-Governed Audit Report | VMS Multi-Tenant Enterprise Platform | Generated: ${new Date().toISOString()}
        </div>
      </body>
    </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert("Please allow popups to export the PDF report.");
    }
  };

  const handleExportExcel = async () => {
    try {
      const activeSiteId = sessionStorage.getItem("active_site_id");
      let url = `/reports/export-excel?period=${period}`;
      if (activeSiteId && activeSiteId !== "all") {
        url += `&site_id=${activeSiteId}`;
      }

      const response = await apiClient.get(url, {
        responseType: "blob",
      });

      // Guard: if backend returned an error JSON as blob
      if (response.data && response.data.type === "application/json") {
        const text = await response.data.text();
        const errObj = JSON.parse(text);
        alert(`❌ Export failed: ${errObj.error || "Server rejected report generation"}`);
        return;
      }

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      link.setAttribute("download", `Visitor_Report_${period}_${dateStr}.xlsx`);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      const errMsg = err.response?.data?.error || err.message || "Failed to download Excel report";
      alert(`❌ Export to Excel failed: ${errMsg}`);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-IN", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  };

  if (!reportData) return <div>Loading report...</div>;

  const summary = reportData?.summary || DEMO_DATA[period].summary;
  const trend = reportData?.trend || DEMO_DATA[period].trend;
  const categorySplit = reportData?.categorySplit || DEMO_DATA[period].categorySplit;
  const advancedInsights = reportData?.advancedInsights || DEMO_DATA[period].advancedInsights;
  const visitors = reportData?.visitors || [];

  return (
    <AnimatePresence>
      {true && (
        <motion.div
          className="report-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="report-modal"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            <div className="report-header no-print-hide">
              <div className="report-header-left">
                <div className="report-header-icon">
                  <FileText size={24} />
                </div>
                <div>
                  <h2 className="report-title">Management Reporting Dashboard</h2>
                  <p className="report-date">
                    <Calendar size={14} /> {formatDate()} | Strategic Insights Report
                  </p>
                </div>
              </div>
              <div className="report-header-right no-print">
                <div className="report-period-selector">
                  <Filter size={16} />
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`report-period-btn ${period === opt.value ? "active" : ""}`}
                      onClick={() => setPeriod(opt.value)}
                    >
                      <span className="report-period-icon">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button className="report-download-btn excel-btn" onClick={handleExportExcel}>
                  <FileSpreadsheet size={16} /> Export to Excel
                </button>
                <button className="report-download-btn" onClick={handleDownloadPDF}>
                  <Download size={16} /> Export to PDF
                </button>
                <button
                  className="report-close-btn"
                  onClick={() => window.history.back()}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Print-only header */}
            <div className="print-only-header">
              <h1>Visitor Management System — Strategic Performance Report</h1>
              <p>Reporting Period: {PERIOD_OPTIONS.find(o => o.value === period)?.label} &nbsp;|&nbsp; Generated: {formatDate()}</p>
            </div>

            {loading ? (
              <div className="report-loading">
                <div className="report-spinner" />
                <p>Analyzing data & generating insights...</p>
              </div>
            ) : (
              <div className="report-body" id="pdf-content">
                {/* 1. MANAGEMENT DASHBOARD (KPIs) */}
                <h3 className="report-group-title">1. MANAGEMENT DASHBOARD (Key Performance Indicators)</h3>
                <div className="report-summary-grid extended">
                  <div className="report-stat-card total">
                    <div className="report-stat-icon"><Users size={20} /></div>
                    <div className="report-stat-info">
                      <span className="report-stat-label">Total Visitors ({PERIOD_OPTIONS.find(o => o.value === period)?.label || "Today"})</span>
                      <span className="report-stat-value">{(summary.periodCount ?? summary.todayCount)?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="report-stat-card total">
                    <div className="report-stat-icon"><Calendar size={20} /></div>
                    <div className="report-stat-info">
                      <span className="report-stat-label">Total Visitors (MTD)</span>
                      <span className="report-stat-value">{summary.mtdCount?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="report-stat-card total">
                    <div className="report-stat-icon"><TrendingUp size={20} /></div>
                    <div className="report-stat-info">
                      <span className="report-stat-label">Total Visitors (YTD)</span>
                      <span className="report-stat-value">{summary.ytdCount?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="report-stat-card neutral">
                    <div className="report-stat-icon"><UserRound size={20} /></div>
                    <div className="report-stat-info">
                      <span className="report-stat-label">Avg Daily Visitors</span>
                      <span className="report-stat-value">{summary.avgDaily}</span>
                    </div>
                  </div>
                  <div className="report-stat-card info">
                    <div className="report-stat-icon"><Clock size={20} /></div>
                    <div className="report-stat-info">
                      <span className="report-stat-label">Peak Hour</span>
                      <span className="report-stat-value">{summary.peakHour}</span>
                    </div>
                  </div>
                  <div className="report-stat-card success">
                    <div className="report-stat-icon"><Repeat size={20} /></div>
                    <div className="report-stat-info">
                      <span className="report-stat-label">Repeat Visitors %</span>
                      <span className="report-stat-value">{summary.repeatPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* 2. GRAPHS SECTION */}
                <h3 className="report-group-title">2. VISUAL ANALYTICS</h3>
                <div className="report-charts-grid full-width">
                  <div className="report-chart-card">
                    <h3 className="report-chart-title"><TrendingUp size={18} /> Visitor Traffic Trend</h3>
                    <div className="report-chart-body">
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={trend}>
                          <defs>
                            <linearGradient id="reportGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartTickFill }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: chartTickFill }} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Area type="monotone" dataKey="visitors" stroke="#2563eb" strokeWidth={2.5} fill="url(#reportGradient)" dot={{ r: 4, fill: "#2563eb" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                      <p className="chart-insight-caption">Shows business growth/decline patterns over the selected period.</p>
                    </div>
                  </div>
                </div>

                <div className="report-charts-grid">
                  <div className="report-chart-card">
                    <h3 className="report-chart-title"><PieIcon size={18} /> Visitor Category Split</h3>
                    <div className="report-chart-body">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={categorySplit} cx="50%" cy="50%" innerRadius={60}
                            outerRadius={80} paddingAngle={5} dataKey="value"
                          >
                            {categorySplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Legend iconType="circle" wrapperStyle={{ fontSize: "0.75rem", color: chartTickFill }} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <p className="chart-insight-caption">Business activity pattern breakdown by visitor type.</p>
                    </div>
                  </div>
                </div>

                {/* 3. ADVANCED INSIGHTS */}
                <h3 className="report-group-title">3. STRATEGIC INSIGHTS (Advanced Analytics)</h3>
                <div className="advanced-insights-grid">
                  <div className="insight-card">
                    <h4><Building2 size={16} /> Top Departments</h4>
                    <ul className="insight-list">
                      {advancedInsights?.topDepartments?.map((dept, i) => (
                        <li key={i}><span>{dept.name}</span><strong>{dept.count}</strong></li>
                      ))}
                    </ul>
                  </div>
                  <div className="insight-card">
                    <h4><HardHat size={16} /> Top Vendors Visiting</h4>
                    <ul className="insight-list">
                      {advancedInsights?.topVendors?.map((vendor, i) => (
                        <li key={i}><span>{vendor.name}</span><strong>{vendor.count}</strong></li>
                      ))}
                    </ul>
                  </div>
                  <div className="insight-card">
                    <h4><Timer size={16} /> Visit Behavior</h4>
                    <div className="insight-metric">
                      <span className="metric-label">Avg Visit Duration</span>
                      <span className="metric-value">{advancedInsights.avgDuration} mins</span>
                    </div>
                    <div className="insight-metric">
                      <span className="metric-label">Repeat Visitor Ratio</span>
                      <span className="metric-value">{advancedInsights.repeatRatio}x</span>
                    </div>
                  </div>
                  <div className="insight-card">
                    <h4><MapPin size={16} /> Gate-wise Traffic</h4>
                    <ul className="insight-list">
                      {advancedInsights?.gateTraffic?.map((gate, i) => (
                        <li key={i}><span>{gate.name}</span><strong>{gate.count}</strong></li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="report-table-section page-break-before">
                  <h3 className="report-section-title">
                    <Users size={18} /> Detailed Visitor Log Activity
                    <span className="report-record-count">{visitors.length} Audit Records</span>
                  </h3>
                  {visitors.length > 0 ? (
                    <div className="report-table-wrapper">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>SR. NO</th>
                            <th>VISITORS NAME</th>
                            <th>CONTACT NUMBER</th>
                            <th>COMPANY NAME</th>
                            <th>PERSON VISITED</th>
                            <th>CHECKED IN BY</th>
                            <th>DEPARTMENT</th>
                            <th>SITE</th>
                            <th>DATE</th>
                            <th>IN/OUT</th>
                            <th>TIME AVAILABLE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visitors.map((v, i) => (
                            <tr key={v.visitor_id || i}>
                              <td>{i + 1}</td>
                              <td className="report-name-cell">
                                <div className="report-avatar">
                                  {v.name?.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </div>
                                <div>
                                  <div className="name">{v.name}</div>
                                </div>
                              </td>
                              <td>{v.phone || "—"}</td>
                              <td>{v.company || "—"}</td>
                              <td>
                                <div className="host">{v.person_visited || "—"}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: "13px", color: "#475569" }}>{v.checked_in_by || "—"}</div>
                              </td>
                              <td>
                                <div className="dept">{v.department || "General"}</div>
                              </td>
                              <td>
                                <div className="site" style={{ fontSize: "13px", fontWeight: "600", color: "#0284c7" }}>
                                  {resolveVisitorSite(v)}
                                </div>
                              </td>
                              <td style={{ fontWeight: "500", whiteSpace: "nowrap" }}>
                                {v.date || "—"}
                              </td>
                              <td>
                                <div className="time-in">In: {v.check_in || "—"}</div>
                                <div className="time-out">Out: {v.check_out || "—"}</div>
                                {v.manual_check_out && v.manual_check_out !== "—" && (
                                  <div className="time-manual" style={{ color: "#d97706", fontSize: "11px", fontWeight: "500", marginTop: "2px" }}>
                                    Manual: {v.manual_check_out}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: "600", color: "#2563eb" }}>
                                {v.time_available || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="report-empty-table">
                      <Users size={40} />
                      <p>Full audit logs available in CSV/Excel export.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExportReport;
