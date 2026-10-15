import { Outlet } from "react-router-dom";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen">
      {/* Sidebar / Header here */}
      {children && <main className="p-4">{children}</main>}
      <Outlet />
    </div>
  );
}
