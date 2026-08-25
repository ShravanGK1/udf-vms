import React, { useState, useEffect } from "react";
import API from "../../../app/apiClient";

import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Briefcase,
  Hash,
  Save,
  ClipboardList,
  X,
  ShieldCheck,
  Laptop,
  Camera,
  Printer,
  Calendar,
  Clock
} from "lucide-react";
import "./VisitorPassForm.css";
import CameraModal from "../../modals/CameraModal";
const countries = [
  { name: "India", code: "+91", placeholder: "9876543210", length: 10, regex: /^[6-9]\d{9}$/ },
  { name: "United States", code: "+1", placeholder: "2025550143", length: 10, regex: /^\d{10}$/ },
  { name: "United Kingdom", code: "+44", placeholder: "7911123456", length: 10, regex: /^\d{10}$/ },
  { name: "Singapore", code: "+65", placeholder: "81234567", length: 8, regex: /^\d{8}$/ },
  { name: "Australia", code: "+61", placeholder: "412345678", length: 9, regex: /^\d{9}$/ },
  { name: "Germany", code: "+49", placeholder: "1701234567", regex: /^\d{10,11}$/ },
  { name: "UAE", code: "+971", placeholder: "501234567", length: 9, regex: /^\d{9}$/ },
  { name: "Other", code: "", placeholder: "Enter phone number", regex: /^\d{7,15}$/ }
];

const parsePhoneNumber = (phone) => {
  if (!phone) return { countryCode: "+91", localNumber: "" };
  const sortedCountries = [...countries]
    .filter(c => c.code !== "")
    .sort((a, b) => b.code.length - a.code.length);
  for (const c of sortedCountries) {
    if (phone.startsWith(c.code)) {
      return { countryCode: c.code, localNumber: phone.slice(c.code.length) };
    }
  }
  if (phone.startsWith("+")) {
    return { countryCode: "", localNumber: phone };
  }
  if (phone.length === 10 && /^[6-9]/.test(phone)) {
    return { countryCode: "+91", localNumber: phone };
  }
  return { countryCode: "", localNumber: phone };
};

export default function VisitorPassForm({ onClose, requestId, readOnly }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [visitHistory, setVisitHistory] = useState([]);

  // Vehicle photos upload states
  const [vehiclePhotoFrontFile, setVehiclePhotoFrontFile] = useState(null);
  const [vehiclePhotoSideFile, setVehiclePhotoSideFile] = useState(null);
  const [vehiclePhotoFrontPreview, setVehiclePhotoFrontPreview] = useState("");
  const [vehiclePhotoSidePreview, setVehiclePhotoSidePreview] = useState("");

  // Camera modal states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState("");

  const openCameraModal = (target) => {
    setCameraTarget(target);
    setIsCameraOpen(true);
  };

  const handleCameraCapture = (file) => {
    const previewUrl = URL.createObjectURL(file);
    if (cameraTarget === "front") {
      setVehiclePhotoFrontFile(file);
      setVehiclePhotoFrontPreview(previewUrl);
    } else if (cameraTarget === "side") {
      setVehiclePhotoSideFile(file);
      setVehiclePhotoSidePreview(previewUrl);
    }
  };

  const sites = [
    { name: "Pune Eduction Foundation-Kasarwadi" },
    { name: "Sason-Kasarwadi" },
    { name: "Humankind-Kasarwadi" },
    { name: "UDF-Kasarwadi" },
    { name: "Eagle-Kasarwadi" }
  ];

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("visitor_history") || "[]");
    setVisitHistory(history);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const nowTimeStr = new Date().toTimeString().slice(0, 5);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    pabx: "",
    companyName: "",
    unit: "",
    department: "",
    location: "",
    personToVisit: "",
    accessLevel: "",
    typeOfIDProof: "",
    idProofNumber: "",
    reasonOfVisit: "",
    scheduled_date: todayStr,
    scheduled_time: nowTimeStr,
    hasDevice: "No",
    deviceType: "",
    deviceMake: "",
    deviceSerialNumber: "",
    vehicleType: "",
    vehicleNumber: "",
    vehiclePhotoFront: "",
    vehiclePhotoSide: ""
  });

  // 🔄 Load existing data if in Edit Mode
  useEffect(() => {
    const fetchExistingRequest = async () => {
      if (requestId) {
        try {
          const res = await API.get(`/security/requests/${requestId}`);
          if (res.data) {
            console.log("Fetched Request Data:", res.data);
            setFormData(prev => ({
              ...prev,
              ...res.data
            }));
          }
        } catch (err) {
          console.error("Failed to fetch request details:", err);
        }
      }
    };
    fetchExistingRequest();
  }, [requestId]);

  const handlePrintPass = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the visitor pass.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>Visitor Pass - ${formData.name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #1e293b; line-height: 1.5; background: #f8fafc; }
            .pass-container { max-width: 450px; margin: 0 auto; border: 2px solid #cbd5e1; border-radius: 12px; padding: 24px; background: #fff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
            .pass-header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 16px; margin-bottom: 16px; }
            .pass-header h1 { font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .pass-header p { margin: 0; color: #64748b; font-size: 12px; font-weight: 600; letter-spacing: 0.025em; }
            .badge-id { font-size: 15px; font-weight: 800; color: #1e3a8a; background: #dbeafe; padding: 6px 16px; border-radius: 9999px; display: inline-block; margin-top: 10px; border: 1px solid #bfdbfe; }
            .pass-photo-and-qr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 20px; }
            .pass-photo { width: 110px; height: 110px; border-radius: 8px; border: 1px solid #cbd5e1; object-fit: cover; background: #f8fafc; }
            .pass-qr { width: 110px; height: 110px; }
            .pass-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; font-size: 12px; }
            .pass-field { display: flex; flex-direction: column; }
            .field-label { font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
            .field-value { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 2px; }
            .pass-field.full-width { grid-column: span 2; }
            .pass-divider { border-top: 1px solid #e2e8f0; grid-column: span 2; margin: 8px 0; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center; margin-top: 28px; font-size: 11px; }
            .sig-box { border-top: 1px solid #94a3b8; padding-top: 6px; color: #475569; font-weight: 600; }
            .pass-footer { text-align: center; font-size: 10px; color: #64748b; margin-top: 24px; font-weight: 600; border-top: 1px solid #e2e8f0; padding-top: 12px; }
            @media print {
              body { padding: 0; background: none; }
              .pass-container { border: none; box-shadow: none; max-width: 100%; padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="pass-container">
            <div class="pass-header">
              <h1>Sumeet Group</h1>
              <p>VISITOR ACCESS PASS</p>
              <div class="badge-id">Badge: V-${requestId || 'TEMP'}</div>
            </div>
            <div class="pass-photo-and-qr">
              <img src="${formData.photo ? '/' + formData.photo : 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(formData.name)}" class="pass-photo" alt="Photo" />
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=VisitorPass-V-${requestId || 'TEMP'}" class="pass-qr" alt="QR" />
            </div>
            <div class="pass-grid">
              <div class="pass-field full-width">
                <span class="field-label">Visitor Name</span>
                <span class="field-value">${formData.name}</span>
              </div>
              <div class="pass-field">
                <span class="field-label">Mobile Number</span>
                <span class="field-value">${formData.phone || formData.mobile_number || '-'}</span>
              </div>
              <div class="pass-field">
                <span class="field-label">Company Name</span>
                <span class="field-value">${formData.companyName || formData.company_name || 'Guest'}</span>
              </div>
              <div class="pass-divider"></div>
              <div class="pass-field">
                <span class="field-label">Host (Person to Visit)</span>
                <span class="field-value">${formData.personToVisit || formData.person_to_visit || '-'}</span>
              </div>
              <div class="pass-field">
                <span class="field-label">Reason of Visit</span>
                <span class="field-value">${formData.reasonOfVisit || formData.purpose || '-'}</span>
              </div>
              <div class="pass-field">
                <span class="field-label">Unit</span>
                <span class="field-value">${formData.unit || '-'}</span>
              </div>
              <div class="pass-field">
                <span class="field-label">Location</span>
                <span class="field-value">${formData.location || '-'}</span>
              </div>
              <div class="pass-field">
                <span class="field-label">Department</span>
                <span class="field-value">${formData.department || '-'}</span>
              </div>
              <div class="pass-field">
                <span class="field-label">Access Level</span>
                <span class="field-value">${formData.accessLevel ? 'Level ' + formData.accessLevel : 'Visitor (Level 1)'}</span>
              </div>
              ${formData.hasDevice === 'Yes' ? `
                <div class="pass-divider"></div>
                <div class="pass-field">
                  <span class="field-label">Carrying Device</span>
                  <span class="field-value">${formData.deviceType} (${formData.deviceMake})</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">Device Serial</span>
                  <span class="field-value">${formData.deviceSerialNumber}</span>
                </div>
              ` : ''}
              ${formData.vehicleNumber ? `
                <div class="pass-divider"></div>
                <div class="pass-field">
                  <span class="field-label">Vehicle Type</span>
                  <span class="field-value" style="text-transform: capitalize;">${formData.vehicleType || '-'}</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">Vehicle Number</span>
                  <span class="field-value">${formData.vehicleNumber}</span>
                </div>
              ` : ''}
            </div>
            <div class="signatures">
              <div class="sig-box">Visitor Signature</div>
              <div class="sig-box">Authorized Signature</div>
            </div>
            <div class="pass-footer">
              * Please wear this pass visibly at all times *<br/>
              * Return pass to reception upon exit *
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCountryChange = (e) => {
    const newCode = e.target.value;
    const { localNumber } = parsePhoneNumber(formData.phone);
    setFormData((prev) => ({ ...prev, phone: newCode + localNumber }));
  };

  const handleLocalPhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, "");
    const { countryCode } = parsePhoneNumber(formData.phone);
    const targetCountry = countries.find(c => c.code === countryCode) || countries[countries.length - 1];
    if (targetCountry.length && val.length > targetCountry.length) return;
    if (targetCountry.maxLength && val.length > targetCountry.maxLength) return;
    if (!targetCountry.length && !targetCountry.maxLength && val.length > 15) return;
    setFormData((prev) => ({ ...prev, phone: countryCode + val }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // 🛑 Real-time Restrictions

    if (name === "pabx") {
      const numericValue = value.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
      return;
    }

    if (name === "email") {
      // Prevent spaces and validate standard format
      const cleanEmail = value.replace(/\s/g, "");
      setFormData((prev) => ({ ...prev, [name]: cleanEmail }));

      // Standard Email Regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (cleanEmail && !emailRegex.test(cleanEmail)) {
        setFieldErrors((prev) => ({ ...prev, email: "Please enter a valid email address" }));
      } else {
        setFieldErrors((prev) => ({ ...prev, email: null }));
      }
      return;
    }

    if (name === "idProofNumber") {
      let finalValue = value;

      if (formData.typeOfIDProof === "Aadhar Card") {
        // Only allow digits for Aadhar
        finalValue = value.replace(/\D/g, "");
        if (finalValue.length > 12) return;
      } else if (formData.typeOfIDProof === "PAN Card") {
        // Alphanumeric, max 10 chars
        finalValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        if (finalValue.length > 10) return;
      } else {
        finalValue = value.toUpperCase();
      }

      setFormData((prev) => ({ ...prev, [name]: finalValue }));

      // Clear previous error if any while typing
      if (fieldErrors.idProofNumber) {
        setFieldErrors((prev) => ({ ...prev, idProofNumber: null }));
      }
      return;
    }

    if (name === "typeOfIDProof") {
      // Clear ID number if type changes to avoid mismatch, or just clear error
      setFieldErrors((prev) => ({ ...prev, idProofNumber: null }));
      setFormData((prev) => ({ ...prev, [name]: value, idProofNumber: "" }));
      return;
    }

    if (name === "vehicleNumber") {
      let finalValue = value.replace(/[^a-zA-Z0-9 -]/g, "").toUpperCase();
      if (finalValue.length > 15) return;
      setFormData((prev) => ({ ...prev, [name]: finalValue }));
      if (fieldErrors.vehicleNumber) {
        setFieldErrors((prev) => ({ ...prev, vehicleNumber: null }));
      }
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    if (name === "vehiclePhotoFront") {
      setVehiclePhotoFrontFile(file);
      setVehiclePhotoFrontPreview(previewUrl);
    } else if (name === "vehiclePhotoSide") {
      setVehiclePhotoSideFile(file);
      setVehiclePhotoSidePreview(previewUrl);
    }
  };

  // 🔍 Auto-fill Visitor details using mobile number
  useEffect(() => {
    const fetchVisitorDetails = async () => {
      if (formData.phone.length >= 7 && formData.phone.length <= 15) {
        try {
          const res = await API.get(`/visitors/lookup/${formData.phone}`);
          if (res.data) {
            const v = res.data;
            setFormData((prev) => ({
              ...prev,
              name: v.visitor_name || prev.name,
              email: v.email || prev.email,
              companyName: v.company_name || prev.companyName,
              pabx: v.pabx_number || prev.pabx,
              unit: v.unit || prev.unit,
              department: v.department || prev.department,
              location: v.location || prev.location,
              typeOfIDProof: v.id_proof_type || prev.typeOfIDProof,
              idProofNumber: v.id_proof_number || prev.idProofNumber,
              vehicleType: v.vehicle_type || prev.vehicleType,
              vehicleNumber: v.vehicle_number || prev.vehicleNumber,
              vehiclePhotoFront: v.vehicle_photo_front || prev.vehiclePhotoFront,
              vehiclePhotoSide: v.vehicle_photo_side || prev.vehiclePhotoSide
            }));
            setVehiclePhotoFrontPreview("");
            setVehiclePhotoSidePreview("");
          }
        } catch (error) {
          // If not found (404), it's a new visitor, no error needed
          console.log("Visitor lookup complete (new or returning)");
        }
      }
    };
    fetchVisitorDetails();
  }, [formData.phone]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = JSON.parse(sessionStorage.getItem("user"));

    // Parse country code and validate local number specifically
    const { countryCode, localNumber } = parsePhoneNumber(formData.phone);
    const selectedCountry = countries.find(c => c.code === countryCode) || countries[countries.length - 1];
    
    if (!selectedCountry.regex.test(localNumber)) {
      alert(`⚠️ Please enter a valid phone number for ${selectedCountry.name} (e.g. ${selectedCountry.placeholder}).`);
      return;
    }

    // 🚦 ID Proof Validation
    if (formData.typeOfIDProof === "Aadhar Card" && formData.idProofNumber.length !== 12) {
      setFieldErrors(prev => ({ ...prev, idProofNumber: "Aadhar Card must be exactly 12 digits" }));
      alert("⚠️ Aadhar Card must be exactly 12 digits");
      return;
    }
    if (formData.typeOfIDProof === "PAN Card" && formData.idProofNumber.length !== 10) {
      setFieldErrors(prev => ({ ...prev, idProofNumber: "PAN Card must be exactly 10 alphanumeric characters" }));
      alert("⚠️ PAN Card must be exactly 10 characters");
      return;
    }

    // 🚦 Vehicle Validation when Vehicle Type is selected
    if (formData.vehicleType) {
      if (!formData.vehicleNumber || formData.vehicleNumber.trim() === "") {
        alert("⚠️ Vehicle Number is required when Vehicle Type is selected.");
        return;
      }
      const cleanVehicleNum = formData.vehicleNumber.replace(/[^A-Za-z0-9]/g, "");
      const vehicleNumberRegex = /^[A-Za-z]{2}[0-9]{2}[A-Za-z]{1,2}[0-9]{4}$/;
      if (!vehicleNumberRegex.test(cleanVehicleNum)) {
        alert("⚠️ Please enter a valid Indian vehicle registration number (e.g., MH12AB1234).");
        return;
      }
      if (!vehiclePhotoFrontFile && !formData.vehiclePhotoFront) {
        alert("⚠️ Vehicle Photo (Front View) is required when Vehicle Type is selected.");
        return;
      }
      if (!vehiclePhotoSideFile && !formData.vehiclePhotoSide) {
        alert("⚠️ Vehicle Photo (Side View) is required when Vehicle Type is selected.");
        return;
      }
    }

    const data = new FormData();
    // 1. Create (POST) Naming Convention
    data.append("visitor_name", formData.name);
    data.append("full_name", formData.name);
    data.append("email", formData.email);
    data.append("mobile_number", formData.phone);
    data.append("pabx", formData.pabx);
    data.append("company_name", formData.companyName);
    data.append("unit", formData.unit);
    data.append("department", formData.department);
    data.append("location", formData.location);
    data.append("person_to_visit", formData.personToVisit);
    data.append("id_proof_type", formData.typeOfIDProof);
    data.append("id_proof_number", formData.idProofNumber);
    data.append("purpose", formData.reasonOfVisit);
    data.append("scheduled_date", formData.scheduled_date || todayStr);
    data.append("scheduled_time", formData.scheduled_time || nowTimeStr);
    data.append("access_level", formData.accessLevel);
    data.append("host_id", user.user_id);

    data.append("hasDevice", formData.hasDevice);
    data.append("deviceType", formData.deviceType);
    data.append("deviceMake", formData.deviceMake);
    data.append("deviceSerialNumber", formData.deviceSerialNumber);
    data.append("vehicleType", formData.vehicleType);
    data.append("vehicleNumber", formData.vehicleNumber);

    // 2. Update (PUT) Naming Convention
    data.append("name", formData.name);
    data.append("phone", formData.phone);
    data.append("companyName", formData.companyName);
    data.append("personToVisit", formData.personToVisit);
    data.append("typeOfIDProof", formData.typeOfIDProof);
    data.append("idProofNumber", formData.idProofNumber);
    data.append("reasonOfVisit", formData.reasonOfVisit);
    data.append("accessLevel", formData.accessLevel);

    if (formData.photo) {
      data.append("photo", formData.photo);
    }

    if (vehiclePhotoFrontFile) {
      data.append("vehicle_photo_front", vehiclePhotoFrontFile);
    }
    if (vehiclePhotoSideFile) {
      data.append("vehicle_photo_side", vehiclePhotoSideFile);
    }

    try {
      console.log("Submitting form with data:");
      for (let [key, value] of data.entries()) {
        console.log(key, value);
      }

      if (requestId) {
        // UPDATE Existing Request
        await API.put(`/security/requests/${requestId}`, data, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        alert("✅ Request Updated!");
      } else {
        // CREATE New Request
        const res = await API.post("/visitor-requests", data, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        console.log("Success:", res.data);
        alert("✅ Visitor Invite Sent!");
      }

      // 💾 Save to history
      if (formData.personToVisit.trim()) {
        const updatedHistory = Array.from(new Set([...visitHistory, formData.personToVisit.trim()]));
        localStorage.setItem("visitor_history", JSON.stringify(updatedHistory));
        setVisitHistory(updatedHistory);
      }

      setSuccess(true);
      if (onClose) onClose();
    } catch (error) {
      console.error("ERROR:", error);
      alert(requestId ? "❌ Failed to update request" : "❌ Failed to send invite");
    }
  };

  // Department options
  const departmentOptions = [
    "IT",
    "HR",
    "Operations",
    "Sales & Marketing",
    "Accounts",
    "Legal",
    "Store"
  ];

  return (
    <div className="form-container">
      {/* HEADER */}
      <div className="form-header">
        <h2>
          {requestId ? (readOnly ? <ClipboardList /> : <ClipboardList />) : <User />}
          {requestId ? (readOnly ? " View Details" : " Edit Request") : " New Invite"}
        </h2>

        <button
          type="button"
          className="form-close-btn"
          onClick={() => {
            if (onClose) onClose();
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* FORM */}
      <div className="form-content"><form onSubmit={handleSubmit}>
        <div className="form-grid">

          {/* Full Name - Mandatory */}
          <div className="form-group">
            <label>Full Name <span>*</span></label>
            <div style={{ position: "relative" }}>
              <User size={18} style={iconStyle} />
              <input
                type="text"
                name="name"
                required
                placeholder="Enter full name"
                style={inputStyle}
                value={formData.name}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>
          {/* Person to Visit */}
          <div className="form-group">
            <label>Person to Visit<span>*</span></label>
            <div style={{ position: "relative" }}>
              <User size={18} style={iconStyle} />
              <input
                type="text"
                name="personToVisit"
                list="visitor-history"
                placeholder="Enter person name"
                style={inputStyle}
                value={formData.personToVisit}
                onChange={handleChange}
                required
                disabled={readOnly}
              />
              <datalist id="visitor-history">
                {visitHistory.map((name, idx) => (
                  <option key={idx} value={name} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Visit Date */}
          <div className="form-group">
            <label>Visit Date <span>*</span></label>
            <div style={{ position: "relative" }}>
              <Calendar size={18} style={iconStyle} />
              <input
                type="date"
                name="scheduled_date"
                min={todayStr}
                required
                style={inputStyle}
                value={formData.scheduled_date || todayStr}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Visit Time */}
          <div className="form-group">
            <label>Visit Time <span>*</span></label>
            <div style={{ position: "relative" }}>
              <Clock size={18} style={iconStyle} />
              <input
                type="time"
                name="scheduled_time"
                required
                style={inputStyle}
                value={formData.scheduled_time || nowTimeStr}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label>Email ID</label>
            <div style={{ position: "relative" }}>
              <Mail size={18} style={iconStyle} />
              <input
                type="email"
                name="email"
                placeholder="employee@company.com"
                className={fieldErrors.email ? "invalid-input" : ""}
                style={inputStyle}
                value={formData.email}
                onChange={handleChange}
                disabled={readOnly}
              />
              {fieldErrors.email && <span className="error-text">{fieldErrors.email}</span>}
            </div>
          </div>

          {/* Phone - Mandatory */}
          <div className="form-group">
            <label>Phone Number <span>*</span></label>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <div style={{ position: "relative", width: "85px", height: "42px", flexShrink: 0 }}>
                <div style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 8px 0 12px",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  color: "#334155"
                }}>
                  <span>{parsePhoneNumber(formData.phone).countryCode || "Other"}</span>
                  <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>▼</span>
                </div>
                <select
                  value={parsePhoneNumber(formData.phone).countryCode}
                  onChange={handleCountryChange}
                  disabled={readOnly}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                    zIndex: 2
                  }}
                >
                  {countries.map((c, i) => (
                    <option key={i} value={c.code}>
                      {c.code ? `${c.code} (${c.name})` : `Other (${c.name})`}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ position: "relative", flex: 1 }}>
                <Phone size={18} style={iconStyle} />
                <input
                  type="tel"
                  name="localPhone"
                  required
                  placeholder={
                    (countries.find(c => c.code === parsePhoneNumber(formData.phone).countryCode) || countries[countries.length - 1]).placeholder
                  }
                  style={{ ...inputStyle, paddingLeft: "2.5rem" }}
                  value={parsePhoneNumber(formData.phone).localNumber}
                  onChange={handleLocalPhoneChange}
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>

          {/* PABX */}
          <div className="form-group">
            <label>PABX Phone Number</label>
            <div style={{ position: "relative" }}>
              <Phone size={18} style={iconStyle} />
              <input
                type="text"
                name="pabx"
                placeholder="Extension (e.g. 405)"
                style={inputStyle}
                value={formData.pabx}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Visitor Company Name</label>
            <div style={{ position: "relative" }}>
              <Building size={18} style={iconStyle} />
              <input
                type="text"
                name="companyName"
                placeholder="Enter Your Company Name"
                style={inputStyle}
                value={formData.companyName}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Unit - Editable Dropdown */}
          <div className="form-group">
            <label>Unit<span>*</span></label>
            <div style={{ position: "relative" }}>
              <Building size={18} style={iconStyle} />
              <select
                name="unit"
                style={inputStyle}
                value={formData.unit}
                onChange={handleChange}
                required
                disabled={readOnly}
              >
                <option value="">Select Unit</option>
                {sites.map((site, idx) => (
                  <option key={idx} value={site.name}>{site.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Department */}
          <div className="form-group">
            <label>Department</label>
            <div style={{ position: "relative" }}>
              <Briefcase size={18} style={iconStyle} />
              <select
                name="department"
                style={inputStyle}
                value={formData.department}
                onChange={handleChange}
                disabled={readOnly}
              >
                <option value="">Select Department</option>
                {departmentOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Location <span>*</span></label>
            <div style={{ position: "relative" }}>
              <MapPin size={18} style={iconStyle} />
              <input
                type="text"
                name="location"
                placeholder="Enter location"
                style={inputStyle}
                value={formData.location}
                onChange={handleChange}
                required
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Access Level */}
          <div className="form-group">
            <label>Access Level</label>
            <div style={{ position: "relative" }}>
              <ShieldCheck size={18} style={iconStyle} />
              <select
                name="accessLevel"
                style={inputStyle}
                value={formData.accessLevel}
                onChange={handleChange}
                disabled={readOnly}
              >
                <option value="">Select Access Level</option>
                <option value="1">Visitor(level 1)</option>
                <option value="2">Vendor(level 2)</option>
                <option value="3">Security(level 3)</option>
                <option value="4">Host(level 4)</option>
                <option value="5">Admin(level 5)</option>
                {/* Fallback for unknown values */}
                {formData.accessLevel && !["1", "2", "3", "4", "5"].includes(formData.accessLevel) && (
                  <option value={formData.accessLevel}>{formData.accessLevel}</option>
                )}
              </select>
            </div>
          </div>

          {/* Type of ID proof */}
          <div className="form-group">
            <label>Type Of ID Proof</label>
            <div style={{ position: "relative" }}>
              <ClipboardList size={18} style={iconStyle} />
              <select
                name="typeOfIDProof"
                style={inputStyle}
                value={formData.typeOfIDProof}
                onChange={handleChange}
                disabled={readOnly}
              >
                <option value="">Select ID Proof</option>
                <option value="Aadhar Card">Aadhar Card</option>
                <option value="PAN Card">PAN Card</option>
                <option value="Driving License">Driving License</option>
                <option value="Voting Card">Voting Card</option>
                <option value="Passport">Passport</option>
                <option value="Company ID">Company ID</option>
              </select>
            </div>
          </div>

          {/* ID proof number */}
          <div className="form-group">
            <label>ID Proof Number</label>
            <div style={{ position: "relative" }}>
              <Hash size={18} style={iconStyle} />
              <input
                type="text"
                name="idProofNumber"
                placeholder="Enter ID proof number"
                className={fieldErrors.idProofNumber ? "invalid-input" : ""}
                style={inputStyle}
                value={formData.idProofNumber}
                onChange={handleChange}
                disabled={readOnly || !formData.typeOfIDProof}
              />
              {fieldErrors.idProofNumber && <span className="error-text">{fieldErrors.idProofNumber}</span>}
            </div>
          </div>

          {/* Vehicle Type */}
          <div className="form-group">
            <label>Vehicle Type</label>
            <div style={{ position: "relative" }}>
              <Building size={18} style={iconStyle} />
              <select
                name="vehicleType"
                style={inputStyle}
                value={formData.vehicleType}
                onChange={handleChange}
                disabled={readOnly}
              >
                <option value="">Select Vehicle Type</option>
                <option value="four wheeler">Four wheeler</option>
                <option value="two wheeler">Two wheeler</option>
                <option value="three wheeler">Three wheeler</option>
              </select>
            </div>
          </div>

          {/* Vehicle Number */}
          <div className="form-group">
            <label>Vehicle Number {formData.vehicleType && <span>*</span>}</label>
            <div style={{ position: "relative" }}>
              <Hash size={18} style={iconStyle} />
              <input
                type="text"
                name="vehicleNumber"
                placeholder="Enter vehicle number"
                className={fieldErrors.vehicleNumber ? "invalid-input" : ""}
                style={inputStyle}
                value={formData.vehicleNumber}
                onChange={handleChange}
                disabled={readOnly || !formData.vehicleType}
                required={!!formData.vehicleType}
              />
              {fieldErrors.vehicleNumber && <span className="error-text">{fieldErrors.vehicleNumber}</span>}
            </div>
          </div>
 
          {formData.vehicleType && (
            <>
              {/* Vehicle Photo (Front View) */}
              <div className="form-group">
                <label>Vehicle Photo (Front View) <span>*</span></label>
                <div style={{ position: "relative" }}>
                  {!readOnly && (
                    <div className="photo-input-container">
                      <button
                        type="button"
                        className="btn-open-camera"
                        onClick={() => openCameraModal("front")}
                      >
                        <Camera size={16} />
                        <span>Take Photo</span>
                      </button>
                    </div>
                  )}
                  {(vehiclePhotoFrontPreview || (formData.vehiclePhotoFront && typeof formData.vehiclePhotoFront === 'string')) ? (
                    <div className="vehicle-photo-preview-container">
                      <img 
                        src={vehiclePhotoFrontPreview || `/${formData.vehiclePhotoFront}`} 
                        alt="Front View Preview" 
                        className="vehicle-photo-preview"
                        onClick={() => window.open(vehiclePhotoFrontPreview || `/${formData.vehiclePhotoFront}`, "_blank")}
                      />
                    </div>
                  ) : readOnly ? (
                    <div className="no-image-placeholder">
                      <span className="no-image-text">No front view uploaded</span>
                    </div>
                  ) : null}
                </div>
              </div>
 
              {/* Vehicle Photo (Side View) */}
              <div className="form-group">
                <label>Vehicle Photo (Side View) <span>*</span></label>
                <div style={{ position: "relative" }}>
                  {!readOnly && (
                    <div className="photo-input-container">
                      <button
                        type="button"
                        className="btn-open-camera"
                        onClick={() => openCameraModal("side")}
                      >
                        <Camera size={16} />
                        <span>Take Photo</span>
                      </button>
                    </div>
                  )}
                  {(vehiclePhotoSidePreview || (formData.vehiclePhotoSide && typeof formData.vehiclePhotoSide === 'string')) ? (
                    <div className="vehicle-photo-preview-container">
                      <img 
                        src={vehiclePhotoSidePreview || `/${formData.vehiclePhotoSide}`} 
                        alt="Side View Preview" 
                        className="vehicle-photo-preview"
                        onClick={() => window.open(vehiclePhotoSidePreview || `/${formData.vehiclePhotoSide}`, "_blank")}
                      />
                    </div>
                  ) : readOnly ? (
                    <div className="no-image-placeholder">
                      <span className="no-image-text">No side view uploaded</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {/* Reason of Visit - Mandatory - Full Width */}
          <div className="form-group full-width">
            <label>Reason of Visit <span>*</span></label>
            <div style={{ position: "relative" }}>
              <ClipboardList size={18} style={iconStyle} />
              <select
                name="reasonOfVisit"
                required
                style={inputStyle}
                value={formData.reasonOfVisit}
                onChange={handleChange}
                disabled={readOnly}
              >
                <option value="">Select Reason</option>
                <option value="Police Verification">Police Verification</option>
                <option value="Meeting">Meeting</option>
                <option value="IT">IT</option>
                <option value="Interview">Interview</option>
                <option value="ID(New)">ID(New)</option>
                <option value="ID(Renew)">ID(Renew)</option>
                <option value="Recruitment">Recruitment</option>
                <option value="Payment">Payment</option>
                <option value="P.F.">P.F.</option>
                <option value="E.C.S.I.">E.C.S.I.</option>
                <option value="Personal">Personal</option>
                <option value="Logistics(Departure)">Logistics(Departure)</option>
                <option value="Logistics(Receving)">Logistics(Receving)</option>
                <option value="Field Related">Field Related</option>
                <option value="Billings">Billings</option>
                <option value="Vendor">Vendor</option>
                <option value="Tie-ups">Tie-ups</option>
                <option value="Leave Payment">Leave Payment</option>
                <option value="Bonus Payment">Bonus Payment</option>
                <option value="Cheque">Cheque</option>
                <option value="Cheque Bearer">Cheque Bearer</option>
                <option value="Plant Visit">Plant Visit</option>
                <option value="Medical">Medical</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Has Device? */}
          <div className="form-group full-width">
            <label>Carrying any Device/Laptop? <span>*</span></label>
            <div style={{ position: "relative" }}>
              <Laptop size={18} style={iconStyle} />
              <select
                name="hasDevice"
                required
                style={inputStyle}
                value={formData.hasDevice}
                onChange={handleChange}
                disabled={readOnly}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          {formData.hasDevice === "Yes" && (
            <>
              {/* Device Type */}
              <div className="form-group">
                <label>Device Type <span>*</span></label>
                <div style={{ position: "relative" }}>
                  <Laptop size={18} style={iconStyle} />
                  <input
                    type="text"
                    name="deviceType"
                    required
                    placeholder="e.g. Laptop, Tablet"
                    style={inputStyle}
                    value={formData.deviceType}
                    onChange={handleChange}
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* Device Make */}
              <div className="form-group">
                <label>Device Make <span>*</span></label>
                <div style={{ position: "relative" }}>
                  <Laptop size={18} style={iconStyle} />
                  <input
                    type="text"
                    name="deviceMake"
                    required
                    placeholder="e.g. Dell, Apple"
                    style={inputStyle}
                    value={formData.deviceMake}
                    onChange={handleChange}
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* Device Serial Number */}
              <div className="form-group full-width">
                <label>Device Serial Number <span>*</span></label>
                <div style={{ position: "relative" }}>
                  <Hash size={18} style={iconStyle} />
                  <input
                    type="text"
                    name="deviceSerialNumber"
                    required
                    placeholder="Enter Serial Number"
                    style={inputStyle}
                    value={formData.deviceSerialNumber}
                    onChange={handleChange}
                    disabled={readOnly}
                  />
                </div>
              </div>
            </>
          )}

        </div>

        <div className="form-actions-footer">
          {!readOnly && (
            <button type="submit" className="btn-submit">
              <Save size={18} style={{ marginRight: 8 }} />
              {requestId ? "Update Request" : "Send Invite"}
            </button>
          )}
        </div>
      </form>
      </div>

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraTarget === "front" ? "Capture Vehicle Front View" : "Capture Vehicle Side View"}
      />

    </div >
  );
}

/* Shared inline styles */
const iconStyle = {
  position: "absolute",
  left: "10px",
  top: "12px",
  color: "#94a3b8",
};

const inputStyle = {
  paddingLeft: "2.5rem",
  width: "100%",
  boxSizing: "border-box",
};