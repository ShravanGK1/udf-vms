import { Navigate, Outlet } from "react-router-dom";


/**
 * ProtectedRoute Component
 */
const ProtectedRoute = ({ allowedRoles }) => {
  const token = sessionStorage.getItem("token");
  const role = sessionStorage.getItem("role")?.toLowerCase();

  // 1. If not logged in, go to login (No page visible without login)
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // 2. If logged in but role not allowed, redirect to THEIR allowed dashboard
  if (allowedRoles && !allowedRoles.includes(role)) {
    const dashboardRoutes = {
      admin: "/admin/dashboard",
      superadmin: "/superadmin/dashboard",
      host: "/host/dashboard",
      security: "/security/dashboard"
    };

    console.log(`[ProtectedRoute DEBUG] Role: "${role}", Required: ${allowedRoles}, Current: ${window.location.pathname}`);
    const targetRoute = dashboardRoutes[role] || "/";
    console.warn(`[ProtectedRoute] Role mismatch: User is '${role}', but route requires ${allowedRoles}. Redirecting to ${targetRoute}`);
    return <Navigate to={targetRoute} replace />;
  }

  // 3. Otherwise, show the content
  return <Outlet />;
};

export default ProtectedRoute;
