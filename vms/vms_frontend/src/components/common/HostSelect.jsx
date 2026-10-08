import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check, User, Building, AlertCircle } from "lucide-react";
import API from "../../app/apiClient";
import "./HostSelect.css";

const HostSelect = ({
  selectedHostId,
  onChange,
  error = "",
  required = true,
  placeholder = "Search or select host...",
  disabled = false,
  label = "Person to Visit"
}) => {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchError, setFetchError] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchHosts();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchHosts = async () => {
    setLoading(true);
    try {
      const res = await API.get("/hosts");
      if (Array.isArray(res.data)) {
        setHosts(res.data);
      } else {
        setHosts([]);
      }
      setFetchError("");
    } catch (err) {
      console.error("Failed to fetch hosts:", err);
      setFetchError("Unable to load host list");
    } finally {
      setLoading(false);
    }
  };

  const selectedHost = hosts.find(
    (h) => String(h.id) === String(selectedHostId) || String(h.user_id) === String(selectedHostId)
  );

  const filteredHosts = hosts.filter((h) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = h.name ? h.name.toLowerCase().includes(query) : false;
    const deptMatch = h.department ? h.department.toLowerCase().includes(query) : false;
    const codeMatch = h.employee_code ? h.employee_code.toLowerCase().includes(query) : false;
    return nameMatch || deptMatch || codeMatch;
  });

  const handleSelect = (host) => {
    onChange(host);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="host-select-container" ref={dropdownRef}>
      {label && (
        <label className="host-select-label">
          {label} {required && <span className="required-star">*</span>}
        </label>
      )}

      <div
        className={`host-select-trigger ${isOpen ? "open" : ""} ${error ? "has-error" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            !disabled && setIsOpen(!isOpen);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
      >
        <div className="host-select-trigger-content">
          <User size={18} className="host-select-icon" />
          {selectedHost ? (
            <div className="selected-host-info">
              <span className="selected-host-name">{selectedHost.name}</span>
              {selectedHost.department && (
                <span className="selected-host-badge">{selectedHost.department}</span>
              )}
            </div>
          ) : (
            <span className="host-select-placeholder">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={18} className={`chevron-icon ${isOpen ? "rotate" : ""}`} />
      </div>

      {isOpen && (
        <div className="host-select-dropdown">
          <div className="host-select-search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="host-select-search-input"
              placeholder="Search host by name or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="host-select-options">
            {loading ? (
              <div className="host-select-state-message">Loading hosts...</div>
            ) : fetchError ? (
              <div className="host-select-state-message error">{fetchError}</div>
            ) : filteredHosts.length === 0 ? (
              <div className="host-select-state-message">No matching hosts found</div>
            ) : (
              filteredHosts.map((host) => {
                const isSelected =
                  selectedHost &&
                  (String(selectedHost.id) === String(host.id) ||
                    String(selectedHost.user_id) === String(host.user_id));

                return (
                  <div
                    key={host.id || host.user_id}
                    className={`host-select-option ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelect(host)}
                  >
                    <div className="host-option-avatar">
                      {host.name ? host.name.charAt(0).toUpperCase() : "H"}
                    </div>
                    <div className="host-option-details">
                      <div className="host-option-main">
                        <span className="host-option-name">{host.name}</span>
                        {host.employee_code && (
                          <span className="host-option-code">{host.employee_code}</span>
                        )}
                      </div>
                      {host.department && (
                        <div className="host-option-sub">
                          <Building size={12} style={{ marginRight: 4 }} />
                          <span>{host.department}</span>
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={16} className="check-icon" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="host-select-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default HostSelect;
