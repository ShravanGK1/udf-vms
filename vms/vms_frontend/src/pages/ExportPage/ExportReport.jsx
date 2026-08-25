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
  const handleDownloadPDF = () => {
    const visitors = reportData?.visitors || [];

    let tableRows = visitors.map((v, i) => `
      <td>${i + 1}</td>
      <td>${v.name || "-"}</td>
      <td>${v.phone || "-"}</td>
      <td>${v.company || "-"}</td>
      <td>${v.person_visited || "-"}</td>
      <td>${v.department || "-"}</td>
      <td>${v.date || "-"}</td>
      <td>${v.check_in || "-"}</td>
      <td>${v.check_out || "-"}</td>
      <td>${v.time_available || "-"}</td>
    </tr>
  `).join("");

    const html = `
    <html>
      <head>
        <title>Visitor Report</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h2>Visitor Report</h2>
        <table>
          <thead>
            <tr>
              <th>SR. NO</th>
              <th>VISITORS NAME</th>
              <th>CONTACT NUMBER</th>
              <th>COMPANY NAME</th>
              <th>PERSON VISITED</th>
              <th>DEPARTMENT</th>
              <th>DATE</th>
              <th>IN</th>
              <th>OUT</th>
              <th>TIME AVAILABLE</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

    const newWindow = window.open("", "_blank");
    newWindow.document.write(html);
    newWindow.document.close();
    newWindow.print();
  };


  const handleExportExcel = async () => {
    const response = await apiClient.get(`/reports/export-excel?period=${period}`, {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Visitor_Report.xlsx");

    document.body.appendChild(link);
    link.click();
    link.remove();
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
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#627d98" }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#627d98" }} />
                          <Tooltip contentStyle={{ borderRadius: "0.75rem", background: "rgba(255,255,255,0.95)" }} />
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
                          <Legend iconType="circle" wrapperStyle={{ fontSize: "0.75rem" }} />
                          <Tooltip />
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
                            <th>DEPARTMENT</th>
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
                                <div className="dept">{v.department || "General"}</div>
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
