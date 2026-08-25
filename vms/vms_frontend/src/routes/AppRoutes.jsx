import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "../auth/Auth";
import ExportPage from "../pages/ExportPage/ExportReport";
import AdminLayout from "../layouts/AdminLayout";
import HostLayout from "../layouts/HostLayout";
import SecurityLayout from "../layouts/SecurityLayout";

import AdminDashboard from "../pages/admin/AdminDashboard";
import HostDashboard from "../pages/host/HostDashboard";
import SecurityDashboard from "../pages/SecurtiyDashboard/SecurityDashboard";
import SuperAdminDashboard from "../pages/SuperAdmin/SuperAdminDashboard";

import VisitorManagementLanding from "../pages/LandingPage/LandingPage";
import VisitorRegistration from "../pages/VisitorRegistration/VisitorRegistration";
import DashboardSelection from "../pages/DashboardSelection/DashboardSelection";
import ProtectedRoute from "../routes/ProtectedRoute";
import LicenseActivationPage from "../pages/LicenseRestricted/LicenseActivationPage";
import apiClient from "../app/apiClient";

const PublicRoute = ({ children }) => {
  const token = sessionStorage.getItem("token");
  const role = sessionStorage.getItem("role")?.toLowerCase();

  if (token) {
    const dashboardRoutes = {
      admin: "/admin/dashboard",
      superadmin: "/superadmin/dashboard",
      host: "/host/dashboard",
      security: "/security/dashboard"
    };
    const targetRoute = dashboardRoutes[role] || "/";
    return <Navigate to={targetRoute} replace />;
  }

  return children;
};

export default function AppRoutes() {
  const [licenseStatus, setLicenseStatus] = useState({
    loading: true,
    active: false,
    errorType: null,
    errorMessage: ""
  });

  const checkLicense = async () => {
    try {
      const res = await apiClient.get("/license-status");
      if (res.data.status === "ACTIVE") {
        setLicenseStatus({ loading: false, active: true, errorType: null, errorMessage: "" });
      } else {
        setLicenseStatus({
          loading: false,
          active: false,
          errorType: res.data.status,
          errorMessage: res.data.error || "Subscription verification failed."
        });
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.error === "LICENSE_RESTRICTION") {
        setLicenseStatus({
          loading: false,
          active: false,
          errorType: "RESTRICTED",
          errorMessage: errorData.message
        });
      } else {
        setLicenseStatus({
          loading: false,
          active: false,
          errorType: "CONNECTION_ERROR",
          errorMessage: "Failed to connect to license verification server."
        });
      }
    }
  };

  useEffect(() => {
    checkLicense();
  }, []);

  if (licenseStatus.loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", justifyContent: "center", alignItems: "center", color: "#f1f5f9", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h2>Loading VMS System...</h2>
          <p style={{ color: "#64748b" }}>Verifying subscription signature security bounds</p>
        </div>
      </div>
    );
  }

  if (!licenseStatus.active) {
    return (
      <LicenseActivationPage
        errorType={licenseStatus.errorType}
        errorMessage={licenseStatus.errorMessage}
        onActivated={() => checkLicense()}
      />
    );
  }

  return (
    <Routes>

      <Route path="/" element={
        <PublicRoute>
          <AuthPage />
        </PublicRoute>
      } />
      <Route path="/home/landingpage" element={<VisitorManagementLanding />} />
      <Route path="/visitor/register" element={<VisitorRegistration />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        {/* Only admins and superadmins should select dashboards or export */}
        <Route element={<ProtectedRoute allowedRoles={["admin", "superadmin"]} />}>
          <Route path="/dashboards" element={<DashboardSelection />} />
          <Route path="/export" element={<ExportPage />} />
        </Route>

        {/* Role-Specific Layout Routes */}
        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["host", "admin"]} />}>
          <Route element={<HostLayout />}>
            <Route path="/host/dashboard" element={<HostDashboard />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["security", "admin"]} />}>
          <Route element={<SecurityLayout />}>
            <Route path="/security/dashboard" element={<SecurityDashboard />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["superadmin"]} />}>
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        </Route>
      </Route>

      {/* Catch-all - redirect to login if not found */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
