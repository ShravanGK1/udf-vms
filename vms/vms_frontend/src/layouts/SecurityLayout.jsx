import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar/Navbar";

export default function SecurityLayout() {
  const user = JSON.parse(sessionStorage.getItem("user") || "{}");

  return (
    <div>
      <Navbar role={user.role || "security"} userName={user.name || "Security Guard"} />
      <Outlet />
    </div>
  );
}