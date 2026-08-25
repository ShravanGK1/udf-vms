import React, { useState, useEffect } from 'react';
import logo from "../../assets/logo.png";
import Navbar from "../../components/Navbar/Navbar";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Users, Clock, CheckCircle, Calendar, Bell,
  MoreVertical, LogOut, ShieldAlert, Plus, X
} from 'lucide-react';

import './HostDashboard.css';
import VisitorPassForm from '../../components/forms/forms/VisitorPassForm';
import BulkUploadModal from '../../components/modals/BulkUploadModal';
import API from "../../app/apiClient";
import StatCard from '../../components/StatCard/StatCard';
import TransferModal from '../../components/modals/TransferModal';

const trafficDataSets = {
  Daily: [
    { name: '09:00', visitors: 2 }, { name: '11:00', visitors: 8 },
    { name: '13:00', visitors: 4 }, { name: '15:00', visitors: 9 },
    { name: '17:00', visitors: 3 }
  ],
  Weekly: [
    { name: 'Mon', visitors: 12 }, { name: 'Tue', visitors: 19 },
    { name: 'Wed', visitors: 15 }, { name: 'Thu', visitors: 22 },
    { name: 'Fri', visitors: 28 }, { name: 'Sat', visitors: 5 },
  ],
  Monthly: [
    { name: 'Week 1', visitors: 45 }, { name: 'Week 2', visitors: 52 },
    { name: 'Week 3', visitors: 48 }, { name: 'Week 4', visitors: 60 },
  ],
  Quarterly: [
    { name: 'Jan', visitors: 150 }, { name: 'Feb', visitors: 180 },
    { name: 'Mar', visitors: 145 }
  ],
  Yearly: [
    { name: 'Jan', visitors: 150 }, { name: 'Feb', visitors: 180 },
    { name: 'Mar', visitors: 145 }, { name: 'Apr', visitors: 165 },
    { name: 'May', visitors: 190 }, { name: 'Jun', visitors: 165 },
    { name: 'Jul', visitors: 175 }, { name: 'Aug', visitors: 155 },
    { name: 'Sep', visitors: 160 }, { name: 'Oct', visitors: 210 },
    { name: 'Nov', visitors: 185 }, { name: 'Dec', visitors: 185 }
  ]
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <p style={{ fontWeight: 'bold', margin: '0 0 5px' }}>{label}</p>
        <p style={{ color: '#2563eb', margin: 0 }}>Visitors: {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function HostDashboard() {
  const [requests, setRequests] = useState([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [timeFilter, setTimeFilter] = useState('Daily');
  const [purposeData, setPurposeData] = useState([]);
  const [chartData, setChartData] = useState([]);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [upcomingVisits, setUpcomingVisits] = useState([]);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [recentActivity, setRecentActivity] = useState([]);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const [stats, setStats] = useState({
    totalVisitors: 0,
    onPremises: 0,
    avgDuration: 0
  });

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransferVisit, setSelectedTransferVisit] = useState(null);

  const handleOpenTransferModal = (visit) => {
    setSelectedTransferVisit(visit);
    setShowTransferModal(true);
  };

  const getVisitorStatus = (visit) => {
    if (visit.check_out_time) {
      return "Checked Out";
    }
    if (visit.check_in_time) {
      if (visit.is_temp_out === 1 || visit.is_temp_out === true) {
        return "Temp Out";
      }
      try {
        const checkInDate = new Date(visit.check_in_time);
        const now = new Date();
        if (now - checkInDate > 2 * 60 * 60 * 1000) {
          return "Overstay";
        }
      } catch (e) {
        console.error(e);
      }
      return "Inside";
    }
    return visit.status || "APPROVED";
  };

  const getVisitorStatusClass = (visit) => {
    const statusText = getVisitorStatus(visit);
    return statusText.toLowerCase().replace(" ", "-");
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [timeFilter]);

  const fetchAnalytics = async () => {
    try {
      const res = await API.get(`/reports?period=${timeFilter.toLowerCase()}`);
      if (res.data && res.data.trend) {
        setChartData(res.data.trend);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await API.get("/visitor-requests");

      const all = res.data;

      const loggedInUser = JSON.parse(sessionStorage.getItem("user") || "{}");
      const todayStr = new Date().toISOString().split('T')[0];

      // Display approval requests ONLY on scheduled date (scheduled_date <= todayStr)
      const pending = all.filter(r => {
        const isPending = r.status === "PENDING" || (r.status === "PENDING_TRANSFER" && parseInt(r.host_id) === parseInt(loggedInUser.user_id));
        if (!isPending) return false;
        const reqDate = r.scheduled_date ? r.scheduled_date : todayStr;
        return reqDate <= todayStr;
      });

      const approved = all.filter(r => r.status === "APPROVED" || r.status === "EXPIRED" || r.check_in_time);

      setRequests(pending);
      setUpcomingVisits(approved);

      const onPremises = all.filter(
        r => r.check_in_time && !r.check_out_time
      ).length;

      setStats({
        totalVisitors: all.length,
        onPremises: onPremises,
        avgDuration: 42
      });
      const purposeCount = {};

      all.forEach(item => {
        const purpose = item.purpose || "Other";

        if (!purposeCount[purpose]) {
          purposeCount[purpose] = 0;
        }

        purposeCount[purpose]++;
      });

      // convert to chart format
      const formattedPurpose = Object.keys(purposeCount).map((key, index) => {
        const colors = ['#2563EB', '#10B981', '#F59E0B', '#6366F1'];

        return {
          name: key,
          value: purposeCount[key],
          color: colors[index % colors.length]
        };
      });

      setPurposeData(formattedPurpose);

      // Fetch Host Recent Activity
      if (loggedInUser.user_id) {
        const activityRes = await API.get(`/host/recent-activity?host_id=${loggedInUser.user_id}`);
        setRecentActivity(activityRes.data || []);
      }

    } catch (err) {
      console.error("Error fetching:", err);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "{}");
      if (action === "APPROVED") {
        await API.put(`/visitor-requests/${id}/approve`, {
          approved_by: user.user_id || 1
        });
      } else {
        await API.put(`/visitor-requests/${id}/reject`, {
          approved_by: user.user_id || 1
        });
      }

      fetchRequests();

    } catch (err) {
      console.error(err);
    }
  };

  const getTotalVisitors = () => {
    return purposeDataSets[timeFilter].reduce((total, item) => total + item.value, 0);
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  const loggedInUser = JSON.parse(sessionStorage.getItem("user") || "{}");
  return (
    <>
      <Navbar role={loggedInUser.role || "host"} userName={loggedInUser.name || "Host"} />
      <div className="dashboard-container">

        <main className="main-content">

          {/* Header */}
          <div className="page-header">
            <div className="header-title">
              <h1>Dashboard Overview</h1>
              <p className="subtitle">Manage visitor approvals and tracking.</p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}
                onClick={() => setShowBulkModal(true)}
              >
                <Plus size={18} /> Bulk Invite
              </button>
              <button
                className="btn-primary"
                onClick={() => setShowInviteForm(true)}
              >
                <Plus size={18} /> New Invite
              </button>
            </div>
          </div>

          {/* Statistics Grid */}
          {/* <div className="stats-grid">
            <StatCard title="Total Visitors" value={stats.totalVisitors} icon={Users} colorClass="#2563EB" subText="+12% vs last week" />
            <StatCard title="On Premises" value={stats.onPremises} icon={CheckCircle} colorClass="#10B981" subText="Currently active" />
            <StatCard title="Pending" value={requests.length} icon={Clock} colorClass="#F59E0B" subText="Requires action" />
            <StatCard title="Avg Duration" value="42m" icon={Calendar} colorClass="#6366F1" subText="Per visit" />
          </div> */}

          {/* Main Grid */}
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>

            {/* Left Column - Pending Approvals */}
            <div className="left-column">
              {/* Pending Requests */}
              {requests.length > 0 ? (
                <div className="card">
                  <div className="card-header" style={{ backgroundColor: '#fff7ed' }}>
                    <h3 className="card-title" style={{ color: '#9a3412' }}>
                      <ShieldAlert size={18} /> Pending Approvals
                    </h3>
                    <span className="tag" style={{ backgroundColor: '#ffedd5', color: '#9a3412', fontWeight: 'bold' }}>
                      {requests.length} New
                    </span>
                  </div>
                  <div>
                    {requests.map((req) => (
                      <div 
                        key={req.request_id} 
                        className="request-item"
                        style={req.status === "PENDING_TRANSFER" ? { borderLeft: '4px solid #3b82f6', backgroundColor: '#f0f7ff' } : {}}
                      >
                        <div className="visitor-info">
                          <div className="visitor-avatar">{req.visitor_name?.charAt(0)}</div>
                          <div className="visitor-details">
                            <h4>{req.visitor_name}</h4>
                            <div className="meta-tags">
                              <span>{req.company_name}</span>
                              <span>•</span>
                              <span className="tag">{req.purpose}</span>
                              {req.scheduled_date && (
                                <>
                                  <span>•</span>
                                  <span className="tag" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
                                    📅 {req.scheduled_date} {req.scheduled_time ? `at ${req.scheduled_time}` : ''}
                                  </span>
                                </>
                              )}
                              {req.status === "PENDING_TRANSFER" && (
                                <>
                                  <span>•</span>
                                  <span className="tag" style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontWeight: 'bold', border: '1px solid #bfdbfe' }}>
                                    Transfer from {req.transfer_from_host_name || "Host"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="action-buttons">
                          <button
                            className="btn-reject"
                            onClick={() => handleAction(req.request_id, 'REJECTED')}
                          >
                            Reject
                          </button>
                          <button
                            className="btn-approve"
                            onClick={() => handleAction(req.request_id, 'APPROVED')}
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <CheckCircle size={48} style={{ margin: '0 auto 1rem', color: '#10b981', opacity: 0.7 }} />
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>No Pending Approvals</h3>
                  <p className="subtitle" style={{ margin: 0 }}>All visitor requests have been processed.</p>
                </div>
              )}

              {/* Recent Activity Feed */}
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header" style={{ backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title" style={{ color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Recent Activity
                  </h3>
                  <button className="text-link" onClick={() => setShowAllActivity(!showAllActivity)}>
                    {showAllActivity ? "Show Today" : "View All"}
                  </button>
                </div>
                <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {(() => {
                    const isToday = (timeStr) => {
                      if (!timeStr) return false;
                      const datePart = timeStr.split(',')[0].trim();
                      const today = new Date();
                      const day = String(today.getDate()).padStart(2, '0');
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const month = months[today.getMonth()];
                      const year = today.getFullYear();
                      const todayStr = `${day} ${month} ${year}`;
                      const todayStrSingleDigit = `${today.getDate()} ${month} ${year}`;
                      return datePart === todayStr || datePart === todayStrSingleDigit;
                    };
                    const displayed = showAllActivity ? recentActivity : recentActivity.filter(act => isToday(act.time));
                    return displayed.length > 0 ? (
                      <div className="security-activity-list">
                        {displayed.map((act, i) => (
                          <div key={i} className="security-activity-item" style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9' }}>
                            <div className="security-activity-content" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                              <div className="security-activity-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '6px', flexShrink: 0 }} />
                              <div>
                                <span className="security-activity-action" style={{ fontWeight: 'bold', color: '#1e293b' }}>{act.action}</span>
                                <span className="security-activity-name" style={{ color: '#475569', fontSize: '0.9rem' }}> — {act.name}</span>
                                <p className="security-activity-detail" style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>{act.detail}</p>
                                <span className="security-activity-time" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{act.time}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ textAlign: 'center', color: '#94a3b8', margin: '2rem 0' }}>No recent activities found.</p>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Right Column - Upcoming Visits */}
            <div className="right-column">
              {/* Upcoming List */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Upcoming Visits</h3>
                  <button className="text-link" onClick={() => setShowAllUpcoming(!showAllUpcoming)}>
                    {showAllUpcoming ? "Show Today" : "View All"}
                  </button>
                </div>
                <div className="table-container">
                  <table className="visits-table">
                    <thead>
                      <tr>
                        <th>Visitor</th>
                        <th>Purpose</th>
                        <th>Schedule</th>
                        <th>Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllUpcoming ? upcomingVisits : upcomingVisits.filter(visit => {
                        if (!visit.scheduled_date) return false;
                        const d = new Date(visit.scheduled_date);
                        const today = new Date();
                        return d.getDate() === today.getDate() &&
                          d.getMonth() === today.getMonth() &&
                          d.getFullYear() === today.getFullYear();
                      })).map((visit) => (
                        <tr key={visit.request_id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{visit.visitor_name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {visit.company_name}
                            </div>
                          </td>
                          <td><span className="tag">{visit.purpose}</span></td>
                          <td>
                            <div>{visit.scheduled_date}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {visit.scheduled_time}
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge ${getVisitorStatusClass(visit)}`}>
                              <span className="dot"></span> {getVisitorStatus(visit)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {getVisitorStatus(visit) !== "Checked Out" && 
                              parseInt(visit.host_id) === parseInt(loggedInUser.user_id) && (
                              <button 
                                className="btn-transfer"
                                onClick={() => handleOpenTransferModal(visit)}
                              >
                                Transfer
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Commented Out Section (Visitor Analytics, Pie Chart, Host Actions) */}
            {/* 
            
            {/* Traffic Chart }
            <div className="card">
              <div className="card-header" style={{ alignItems: 'center' }}>
                <h3 className="card-title">Visitor Analytics</h3>

                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                    color: '#0f172a',
                    backgroundColor: '#f8fafc',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
              <div style={{ padding: '1.5rem', minWidth: 0 }}>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    {['Daily', 'Weekly'].includes(timeFilter) ? (
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="visitors" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} animationDuration={500} />
                      </BarChart>
                    ) : (
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="visitors" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: 'white', stroke: '#2563eb', strokeWidth: 2 }} animationDuration={500} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Pie Chart }
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Visit Purpose</h3>
                <span className="tag" style={{ fontSize: '0.7rem' }}>{timeFilter}</span>
              </div>
              <div style={{ padding: '1.5rem' }}>
                <div className="pie-chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={purposeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        animationDuration={500}
                      >
                        {purposeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pie-chart-total">
                    <span className="total-number">{purposeData.reduce((sum, item) => sum + item.value, 0)}</span>
                    <span className="total-label">Total</span>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {purposeData.map((item) => (
                    <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: item.color }}></span>
                        <span style={{ color: '#475569' }}>{item.name}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Host Actions Widget }
            <div className="host-actions-card">
              <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} /> Host Actions
              </h3>
              <p style={{ fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.5 }}>
                Compliance Check: Ensure all vendors have submitted insurance documents.
              </p>

              <div className="action-btn-group">
                <button className="glass-btn">
                  <Calendar size={20} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Sync Calendar</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Import meetings</div>
                  </div>
                </button>
                <button className="glass-btn">
                  <LogOut size={20} />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Evacuation Log</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Emergency protocols</div>
                  </div>
                </button>
              </div>
            </div>

            */}

          </div>
        </main>

        {/* --- Modal Render Logic --- */}
        {showInviteForm && (
          <div className="modal-overlay">
            <div className="modal-content-wrapper">
              <VisitorPassForm
                onClose={() => {
                  setShowInviteForm(false);
                  fetchRequests();
                }}
              />
            </div>
          </div>
        )}

        {showBulkModal && (
          <BulkUploadModal
            isOpen={showBulkModal}
            onClose={() => setShowBulkModal(false)}
            onSuccess={() => {
              setShowBulkModal(false);
              fetchRequests();
            }}
          />
        )}

        {showTransferModal && (
          <TransferModal
            isOpen={showTransferModal}
            onClose={() => {
              setShowTransferModal(false);
              setSelectedTransferVisit(null);
            }}
            visit={selectedTransferVisit}
            onSuccess={fetchRequests}
          />
        )}

      </div>
    </>
  );
}