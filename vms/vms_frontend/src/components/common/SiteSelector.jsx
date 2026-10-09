import React, { useState, useEffect } from "react";
import { Building2, ChevronDown } from "lucide-react";
import apiClient from "../../app/apiClient";
import "./SiteSelector.css";

export default function SiteSelector() {
  const [sites, setSites] = useState([]);
  const [activeSiteId, setActiveSiteId] = useState(() => {
    return sessionStorage.getItem("active_site_id") || "all";
  });
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    try {
      const userStr = sessionStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role || "");
        if (user.sites && Array.isArray(user.sites)) {
          setSites(user.sites);
          if (!sessionStorage.getItem("active_site_id")) {
            const defaultId = user.role === "superadmin" ? "all" : (user.sites[0]?.site_id?.toString() || "1");
            sessionStorage.setItem("active_site_id", defaultId);
            setActiveSiteId(defaultId);
          }
        }
      }
    } catch (e) {
      console.error("Error reading user sites from sessionStorage:", e);
    }

    // Fetch live sites list as well to ensure freshness
    apiClient.get("/admin/sites-list")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSites(res.data);
        }
      })
      .catch(() => {
        // Ignore fallback if user only has scoped access
      });
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setActiveSiteId(val);
    sessionStorage.setItem("active_site_id", val);
    window.dispatchEvent(new Event("siteChanged"));
    window.location.reload();
  };

  if (sites.length <= 1 && userRole !== "superadmin") {
    if (sites.length === 1) {
      return (
        <div className="site-selector-pill single-site" title={`Assigned Site: ${sites[0].name}`}>
          <Building2 size={15} />
          <span className="site-name-single">{sites[0].name}</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="site-selector-pill" title="Select Active Site">
      <Building2 size={16} className="site-icon" />
      <select
        value={activeSiteId}
        onChange={handleChange}
        className="site-select-dropdown"
      >
        {userRole === "superadmin" && <option value="all">🌐 All Sites (Global)</option>}
        {sites.map((site) => (
          <option key={site.site_id} value={site.site_id}>
            📍 {site.name} {site.address ? `(${site.address})` : ""}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="site-chevron" />
    </div>
  );
}
