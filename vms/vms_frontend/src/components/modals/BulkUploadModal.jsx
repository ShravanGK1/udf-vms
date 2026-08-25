import React, { useState, useEffect, useRef } from "react";
import API from "../../app/apiClient";
import { 
  X, UploadCloud, AlertCircle, Trash2, Calendar, Clock, 
  Save, Download, CheckCircle2, Building, Users, AlertTriangle 
} from "lucide-react";
import "./BulkUploadModal.css";

const HEADER_MAPPING = {
  "visitor name": "name",
  "name": "name",
  "mobile number": "phone",
  "mobile": "phone",
  "phone number": "phone",
  "phone": "phone",
  "email id": "email",
  "email": "email",
  "company name": "companyName",
  "company": "companyName",
  "person to visit": "personToVisit",
  "host": "personToVisit",
  "unit": "unit",
  "department": "department",
  "location": "location",
  "reason of visit": "reasonOfVisit",
  "reason": "reasonOfVisit",
  "purpose": "reasonOfVisit",
  "has device": "hasDevice",
  "carrying device": "hasDevice",
  "device type": "deviceType",
  "device make": "deviceMake",
  "device serial": "deviceSerialNumber",
  "serial": "deviceSerialNumber",
  "vehicle type": "vehicleType",
  "vehicle number": "vehicleNumber"
};

export default function BulkUploadModal({ isOpen, onClose, onSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [selectedHostId, setSelectedHostId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [errors, setErrors] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  const loggedInUser = JSON.parse(sessionStorage.getItem("user") || "{}");
  const isHost = loggedInUser.role === "host";

  // Set default date to today
  useEffect(() => {
    const today = new Date();
    setScheduledDate(today.toISOString().split("T")[0]);
  }, []);

  // Fetch hosts for security/admin selectors
  useEffect(() => {
    if (isOpen && !isHost) {
      const fetchHosts = async () => {
        try {
          const res = await API.get("/admin/users");
          // filter for active host/admin/superadmin role
          const hostUsers = res.data.filter(u => 
            u.status.toLowerCase() === "active" && 
            ["host", "admin", "superadmin"].includes(u.role.toLowerCase())
          );
          setHosts(hostUsers);
          // Auto-select logged-in user if they are in the list
          const current = hostUsers.find(u => u.id === loggedInUser.user_id);
          if (current) {
            setSelectedHostId(current.id);
          } else if (hostUsers.length > 0) {
            setSelectedHostId(hostUsers[0].id);
          }
        } catch (err) {
          console.error("Failed to load host users:", err);
        }
      };
      fetchHosts();
    } else if (isHost) {
      setSelectedHostId(loggedInUser.user_id || "");
    }
  }, [isOpen, isHost, loggedInUser.user_id]);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    try {
      const response = await API.get("/visitor-requests/bulk-template", {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "vms_bulk_visitor_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download template:", err);
      alert("Failed to download Excel template. Please try again.");
    }
  };

  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row.map(cell => cell.trim()));
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row.map(cell => cell.trim()));
    }
    return lines;
  };

  const validateRow = (visitor, idx) => {
    const rowErrors = {};
    
    // Visitor name validation
    if (!visitor.name || !visitor.name.trim()) {
      rowErrors.name = "Name is required";
    }

    // Phone validation (Universal format: 7 to 15 digits, optionally starting with +)
    const phone = String(visitor.phone || "").trim();
    if (!phone) {
      rowErrors.phone = "Phone is required";
    } else if (!/^\+?\d{7,15}$/.test(phone)) {
      rowErrors.phone = "Invalid phone number (7 to 15 digits, optionally starting with +)";
    }

    // Email validation
    const email = String(visitor.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.email = "Invalid email format";
    }

    // Unit validation
    if (!visitor.unit || !visitor.unit.trim()) {
      rowErrors.unit = "Unit is required";
    }

    // Location validation
    if (!visitor.location || !visitor.location.trim()) {
      rowErrors.location = "Location is required";
    }

    // Purpose validation
    if (!visitor.reasonOfVisit || !visitor.reasonOfVisit.trim()) {
      rowErrors.reasonOfVisit = "Reason is required";
    }

    // ID proof number validation (conditional)
    const idType = visitor.typeOfIDProof;
    const idNum = String(visitor.idProofNumber || "").trim();
    if (idType === "Aadhar Card" && idNum.length !== 12) {
      rowErrors.idProofNumber = "Aadhar Card must be 12 digits";
    } else if (idType === "PAN Card" && idNum.length !== 10) {
      rowErrors.idProofNumber = "PAN Card must be 10 characters";
    }

    // Vehicle number validation
    const vehicleNum = String(visitor.vehicleNumber || "").trim();
    if (vehicleNum) {
      const cleanNum = vehicleNum.replace(/[^A-Za-z0-9]/g, "");
      if (!/^[A-Za-z]{2}\d{2}[A-Za-z]{1,2}\d{4}$/.test(cleanNum)) {
        rowErrors.vehicleNumber = "Invalid format (e.g. MH12AB1234)";
      }
    }

    return rowErrors;
  };

  const processFile = async (file) => {
    setIsUploading(true);
    setErrors([]);
    setUploadResult(null);
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await API.post("/visitor-requests/parse-excel", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      
      const visitors = response.data.visitors || [];
      if (visitors.length === 0) {
        alert("No data found or empty file uploaded.");
        setIsUploading(false);
        return;
      }
      
      const visitorsWithErrors = visitors.map((visitor, idx) => {
        if (!visitor.personToVisit && isHost) {
          visitor.personToVisit = loggedInUser.name;
        }
        return {
          ...visitor,
          _errors: validateRow(visitor, idx + 1)
        };
      });
      
      setParsedData(visitorsWithErrors);
    } catch (err) {
      console.error("Failed to parse file:", err);
      const errMsg = err.response?.data?.error || "Failed to parse the uploaded file. Please verify the file format.";
      alert(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if ([".csv", ".xls", ".xlsx"].includes(ext)) {
        processFile(file);
      } else {
        alert("Please drop a valid Excel (.xlsx/.xls) or CSV file.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleCellChange = (rowIndex, field, value) => {
    const updated = [...parsedData];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    updated[rowIndex]._errors = validateRow(updated[rowIndex], rowIndex);
    setParsedData(updated);
  };

  const handleDeleteRow = (rowIndex) => {
    const updated = parsedData.filter((_, idx) => idx !== rowIndex);
    setParsedData(updated);
  };

  const handleSubmit = async () => {
    // Check if any row has validation errors
    const allErrors = [];
    parsedData.forEach((visitor, idx) => {
      const errorKeys = Object.keys(visitor._errors || {});
      if (errorKeys.length > 0) {
        allErrors.push(`Row ${idx + 1} has invalid inputs: ${errorKeys.join(", ")}`);
      }
    });

    if (allErrors.length > 0) {
      setErrors(allErrors.slice(0, 5)); // show top 5 errors
      alert("Please fix the validation errors marked in red in the preview table before uploading.");
      return;
    }

    if (parsedData.length === 0) {
      alert("No visitors to upload.");
      return;
    }

    setIsUploading(true);
    setErrors([]);

    try {
      const payload = {
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        default_host_id: selectedHostId,
        visitors: parsedData
      };

      const res = await API.post("/visitor-requests/bulk", payload);
      setUploadResult({
        success: true,
        message: res.data.message || `Successfully registered ${parsedData.length} visitors.`
      });
      setParsedData([]);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Bulk upload failed:", err);
      const serverErrors = err.response?.data?.errors || err.response?.data?.error || "Bulk upload failed due to a server error.";
      if (Array.isArray(serverErrors)) {
        setErrors(serverErrors);
      } else {
        setErrors([serverErrors]);
      }
      setUploadResult({
        success: false,
        message: "Failed to upload batch. Please correct the highlighted errors."
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bulk-modal-overlay">
      <div className="bulk-modal-container glassmorphic">
        {/* HEADER */}
        <div className="bulk-modal-header">
          <div className="bulk-modal-title">
            <UploadCloud size={24} className="title-icon" />
            <div>
              <h3>Bulk Visitor Pre-Registration</h3>
              <p>Schedule multiple arrivals simultaneously via CSV file</p>
            </div>
          </div>
          <button className="bulk-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="bulk-modal-body">
          {/* UPLOAD ZONE */}
          {parsedData.length === 0 && !uploadResult && (
            <>
              <div 
                className={`bulk-drag-zone ${dragActive ? "active" : ""}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud size={48} className="upload-cloud-icon" />
                <h4>Drag & Drop your Excel or CSV file here</h4>
                <p>or click to browse from local computer</p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".xlsx,.xls,.csv"
                  className="hidden-file-input"
                  onChange={handleFileChange}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
                <button type="button" className="btn-secondary-glow" onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadTemplate();
                }}>
                  <Download size={16} /> Download Excel Template
                </button>
              </div>
            </>
          )}

          {/* PARAMETERS SETTING */}
          {parsedData.length > 0 && (
            <div className="bulk-params-grid">
              <div className="param-group">
                <label><Calendar size={14} /> Scheduled Visit Date</label>
                <input 
                  type="date" 
                  value={scheduledDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>
              <div className="param-group">
                <label><Clock size={14} /> Scheduled Expected Time</label>
                <input 
                  type="time" 
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
              {!isHost && (
                <div className="param-group">
                  <label><Users size={14} /> Default Host / Sponsor</label>
                  <select 
                    value={selectedHostId}
                    onChange={(e) => setSelectedHostId(e.target.value)}
                    required
                  >
                    <option value="">Select Default Host</option>
                    {hosts.map(h => (
                      <option key={h.id} value={h.id}>{h.name} ({h.department})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* TABLE PREVIEW */}
          {parsedData.length > 0 && (
            <div className="bulk-preview-wrapper">
              <div className="preview-table-header">
                <h4>Spreadsheet Preview & Correction ({parsedData.length} records parsed)</h4>
                <p>Double-click or focus cells to edit directly. Red outline indicates validation errors.</p>
              </div>
              <div className="bulk-table-container">
                <table className="bulk-preview-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Visitor Name *</th>
                      <th>Mobile Number *</th>
                      <th>Email ID</th>
                      <th>Company Name</th>
                      <th>Unit *</th>
                      <th>Location *</th>
                      <th>Reason of Visit *</th>
                      <th>Person to Visit</th>
                      <th>Vehicle Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((visitor, rIdx) => (
                      <tr key={rIdx}>
                        <td className="action-cell">
                          <button className="btn-row-delete" onClick={() => handleDeleteRow(rIdx)} title="Delete Row">
                            <Trash2 size={14} />
                          </button>
                        </td>
                        <td className={visitor._errors?.name ? "invalid-cell" : ""}>
                          <input 
                            type="text" 
                            value={visitor.name || ""} 
                            onChange={(e) => handleCellChange(rIdx, "name", e.target.value)} 
                            title={visitor._errors?.name}
                          />
                        </td>
                        <td className={visitor._errors?.phone ? "invalid-cell" : ""}>
                          <input 
                            type="text" 
                            value={visitor.phone || ""} 
                            onChange={(e) => handleCellChange(rIdx, "phone", e.target.value)}
                            title={visitor._errors?.phone}
                          />
                        </td>
                        <td className={visitor._errors?.email ? "invalid-cell" : ""}>
                          <input 
                            type="text" 
                            value={visitor.email || ""} 
                            onChange={(e) => handleCellChange(rIdx, "email", e.target.value)}
                            title={visitor._errors?.email}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            value={visitor.companyName || ""} 
                            onChange={(e) => handleCellChange(rIdx, "companyName", e.target.value)}
                          />
                        </td>
                        <td className={visitor._errors?.unit ? "invalid-cell" : ""}>
                          <input 
                            type="text" 
                            value={visitor.unit || ""} 
                            onChange={(e) => handleCellChange(rIdx, "unit", e.target.value)}
                            title={visitor._errors?.unit}
                          />
                        </td>
                        <td className={visitor._errors?.location ? "invalid-cell" : ""}>
                          <input 
                            type="text" 
                            value={visitor.location || ""} 
                            onChange={(e) => handleCellChange(rIdx, "location", e.target.value)}
                            title={visitor._errors?.location}
                          />
                        </td>
                        <td className={visitor._errors?.reasonOfVisit ? "invalid-cell" : ""}>
                          <input 
                            type="text" 
                            value={visitor.reasonOfVisit || ""} 
                            onChange={(e) => handleCellChange(rIdx, "reasonOfVisit", e.target.value)}
                            title={visitor._errors?.reasonOfVisit}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            value={visitor.personToVisit || ""} 
                            onChange={(e) => handleCellChange(rIdx, "personToVisit", e.target.value)}
                            disabled={isHost}
                          />
                        </td>
                        <td className={visitor._errors?.vehicleNumber ? "invalid-cell" : ""}>
                          <input 
                            type="text" 
                            value={visitor.vehicleNumber || ""} 
                            onChange={(e) => handleCellChange(rIdx, "vehicleNumber", e.target.value)}
                            title={visitor._errors?.vehicleNumber}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SERVER ERRORS LIST */}
          {errors.length > 0 && (
            <div className="bulk-error-container">
              <div className="error-title">
                <AlertTriangle size={16} />
                <span>Validation Errors / Failed Rows:</span>
              </div>
              <ul>
                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
              </ul>
            </div>
          )}

          {/* SUCCESS STATUS */}
          {uploadResult && uploadResult.success && (
            <div className="bulk-success-container">
              <CheckCircle2 size={56} className="success-check-icon" />
              <h3>Upload Successful!</h3>
              <p>{uploadResult.message}</p>
              <button className="btn-primary-glow" onClick={() => {
                setUploadResult(null);
                onClose();
              }}>Done</button>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {parsedData.length > 0 && (
          <div className="bulk-modal-footer">
            <button className="btn-cancel" onClick={() => {
              setParsedData([]);
              setUploadResult(null);
            }} disabled={isUploading}>
              Clear Batch
            </button>
            <div className="footer-right-actions">
              <button className="btn-secondary" onClick={onClose} disabled={isUploading}>
                Close
              </button>
              <button 
                className="btn-primary-glow" 
                onClick={handleSubmit} 
                disabled={isUploading}
              >
                {isUploading ? "Importing Visitors..." : `Import ${parsedData.length} Visitors`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
