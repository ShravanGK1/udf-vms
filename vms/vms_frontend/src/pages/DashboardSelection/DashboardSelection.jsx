import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Users, ShieldCheck, UserCheck } from "lucide-react";
import "./DashboardSelection.css";

const dashboards = [
    {
        title: "Super Admin Dashboard",
        path: "/superadmin/dashboard",
        icon: <Users size={48} />,
        description: "Manage global settings, all roles, and high-level analytics.",
        color: "#4f46e5"
    },
    {
        title: "Admin Dashboard",
        path: "/admin/dashboard",
        icon: <ShieldCheck size={48} />,
        description: "Manage regional staff, visitor logs, and daily operations.",
        color: "#0ea5e9"
    },
    {
        title: "Security Dashboard",
        path: "/security/dashboard",
        icon: <ShieldAlert size={48} />,
        description: "Handle live check-ins, watchlists, and frontline security.",
        color: "#f59e0b"
    },
    {
        title: "Host Dashboard",
        path: "/host/dashboard",
        icon: <UserCheck size={48} />,
        description: "Pre-register visitors and receive arrival notifications.",
        color: "#10b981"
    }
];

export default function DashboardSelection() {
    const navigate = useNavigate();

    return (
        <div className="dashboard-selection-container">
            <div className="dashboard-selection-content">
                <h1 className="ds-title">Select Dashboard</h1>
                <p className="ds-subtitle">Choose the dashboard you want to access.</p>

                <div className="ds-grid">
                    {dashboards.map((card, idx) => (
                        <div
                            key={idx}
                            className="ds-card"
                            onClick={() => navigate(card.path)}
                            style={{ '--hover-color': card.color }}
                        >
                            <div className="ds-icon-wrapper" style={{ color: card.color }}>
                                {card.icon}
                            </div>
                            <h2 className="ds-card-title">{card.title}</h2>
                            <p className="ds-card-desc">{card.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
