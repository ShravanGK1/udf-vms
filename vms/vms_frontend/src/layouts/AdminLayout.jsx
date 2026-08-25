import { Outlet } from "react-router-dom";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar / Header here */}
      <main className="p-4">{children}</main>
      <Outlet />
    </div>
  );
}
