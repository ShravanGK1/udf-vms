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
    let currentRole = "";
    try {
      const userStr = sessionStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        currentRole = (user.role || "").toLowerCase();
        setUserRole(currentRole);
        if (user.sites && Array.isArray(user.sites)) {
          const normalized = user.sites.map((s) => ({
            ...s,
            site_id: s.site_id || s.id,
          }));
          setSites(normalized);
          const currentActive = sessionStorage.getItem("active_site_id");
          if (!currentActive || (currentRole !== "superadmin" && currentActive === "all")) {
            const defaultId = currentRole === "superadmin" ? "all" : (normalized[0]?.site_id?.toString() || "1");
            sessionStorage.setItem("active_site_id", defaultId);
            setActiveSiteId(defaultId);
          }
        }
      }
    } catch (e) {
      console.error("Error reading user sites from sessionStorage:", e);
    }

    // Fetch live authorized sites list to ensure freshness
    apiClient
      .get("/admin/sites-list")
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const liveSites = res.data.map((s) => ({
            ...s,
            site_id: s.site_id || s.id,
          }));
          setSites(liveSites);

          const currentActive = sessionStorage.getItem("active_site_id");
          if (currentRole !== "superadmin") {
            const isAuthorized = liveSites.some(
              (s) => s.site_id?.toString() === currentActive
            );
            if (!isAuthorized || currentActive === "all") {
              const fallback = liveSites[0]?.site_id?.toString() || "1";
              if (currentActive !== fallback) {
                sessionStorage.setItem("active_site_id", fallback);
                setActiveSiteId(fallback);
                window.dispatchEvent(new Event("siteChanged"));
              }
            }
          }
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
          <Building2 size={16} className="site-icon" />
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
