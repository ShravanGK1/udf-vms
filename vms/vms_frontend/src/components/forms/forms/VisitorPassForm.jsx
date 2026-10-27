import React, { useState, useEffect } from "react";
import API from "../../../app/apiClient";
import HostSelect from "../../common/HostSelect";


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
  Clock,
  Plus,
  Trash2,
  Package,
  Users
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

export default function VisitorPassForm({ onClose, requestId, readOnly: initialReadOnly }) {
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

  const [reasonOptions, setReasonOptions] = useState([
    "Police Verification", "Meeting", "IT", "Interview", "ID(New)", "ID(Renew)",
    "Document Verification", "Delivery", "Contractor Work", "Audit", "Payment", "Maintenance", "Other"
  ]);
  const [unitOptions, setUnitOptions] = useState([
    "Pune Eduction Foundation-Kasarwadi",
    "Sason-Kasarwadi",
    "Humankind-Kasarwadi",
    "UDF-Kasarwadi",
    "Eagle-Kasarwadi"
  ]);
  const [departmentOptions, setDepartmentOptions] = useState([
    "IT", "HR", "Operations", "Sales & Marketing", "Accounts", "Legal", "Store"
  ]);
  const [accessLevelOptions, setAccessLevelOptions] = useState([
    "Visitor (Level 1)", "Vendor (Level 2)", "Security (Level 3)", "Host (Level 4)", "Admin (Level 5)"
  ]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("visitor_history") || "[]");
    setVisitHistory(history);

    const fetchFormOptions = async () => {
      try {
        const res = await API.get('/api/form-options');
        if (res.data) {
          if (res.data.reasons && Array.isArray(res.data.reasons) && res.data.reasons.length > 0) {
            setReasonOptions(res.data.reasons);
          }
          if (res.data.units && Array.isArray(res.data.units) && res.data.units.length > 0) {
            setUnitOptions(res.data.units);
          }
          if (res.data.departments && Array.isArray(res.data.departments) && res.data.departments.length > 0) {
            setDepartmentOptions(res.data.departments);
          }
          if (res.data.access_levels && Array.isArray(res.data.access_levels) && res.data.access_levels.length > 0) {
            setAccessLevelOptions(res.data.access_levels);
          }
        }
      } catch (err) {
        console.error("Error fetching form options:", err);
      }
    };
    fetchFormOptions();
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
    host_id: "",
    personToVisit: "",
    accessLevel: "",
    typeOfIDProof: "",
    idProofNumber: "",
    reasonOfVisit: "",
    scheduled_date: todayStr,
    scheduled_time: nowTimeStr,
    isMultiDay: "No",
    valid_till: todayStr,
    hasDevice: "No",
    deviceType: "",
    deviceMake: "",
    deviceSerialNumber: "",
    hasMaterial: "No",
    materialName: "",
    materialQuantity: "",
    materialSerialNumber: "",
    vehicleType: "",
    vehicleNumber: "",
    vehiclePhotoFront: "",
    vehiclePhotoSide: ""
  });

  const [devices, setDevices] = useState([
    { deviceType: "", deviceMake: "", deviceSerialNumber: "" }
  ]);

  const [materials, setMaterials] = useState([
    { materialName: "", materialQuantity: "", materialSerialNumber: "" }
  ]);

  const handleDeviceChange = (index, field, value) => {
    setDevices(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addDeviceRow = () => {
    setDevices(prev => [...prev, { deviceType: "", deviceMake: "", deviceSerialNumber: "" }]);
  };

  const removeDeviceRow = (index) => {
    setDevices(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleMaterialChange = (index, field, value) => {
    setMaterials(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addMaterialRow = () => {
    setMaterials(prev => [...prev, { materialName: "", materialQuantity: "", materialSerialNumber: "" }]);
  };

  const removeMaterialRow = (index) => {
    setMaterials(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  // Group / Accompanying Visitors state
  const [isGroup, setIsGroup] = useState(false);
  const [groupVisitors, setGroupVisitors] = useState([]);

  const handleGroupVisitorChange = (index, field, value) => {
    setGroupVisitors(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addGroupVisitorRow = () => {
    setGroupVisitors(prev => [
      ...prev,
      { name: "", phone: "", email: "", typeOfIDProof: "", idProofNumber: "" }
    ]);
  };

  const removeGroupVisitorRow = (index) => {
    setGroupVisitors(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : []));
  };

  const isVisitorLive = (data) => {
    if (!data) return false;
    const statusStr = (data.status || "").toString().trim().toLowerCase();
    const liveStatuses = ["inside", "overstay", "temp out", "checked in", "live", "in"];
    if (liveStatuses.includes(statusStr)) return true;
    if (data.is_temp_out === 1 || data.is_temp_out === true) return true;
    const hasCheckIn = Boolean(data.check_in_time || data.checkIn);
    const hasCheckOut = Boolean(data.check_out_time || data.checkOut);
    if (hasCheckIn && !hasCheckOut) return true;
    return false;
  };

  const readOnly = Boolean(initialReadOnly || isVisitorLive(formData));

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
              ...res.data,
              isMultiDay: (res.data.is_multi_day || res.data.isMultiDay === "Yes" || res.data.is_multi_day === 1 || res.data.is_multi_day === true) ? "Yes" : "No",
              valid_till: res.data.valid_till || res.data.validTill || res.data.scheduled_date || todayStr
            }));

            if (res.data.hasDevice === "Yes" || res.data.has_device) {
              const fetchedType = res.data.deviceType || res.data.device_type || "";
              const fetchedMake = res.data.deviceMake || res.data.device_make || "";
              const fetchedSerial = res.data.deviceSerialNumber || res.data.device_serial_number || "";
              
              const types = fetchedType ? fetchedType.split(",").map(s => s.trim()) : [];
              const makes = fetchedMake ? fetchedMake.split(",").map(s => s.trim()) : [];
              const serials = fetchedSerial ? fetchedSerial.split(",").map(s => s.trim()) : [];
              const count = Math.max(types.length, makes.length, serials.length, 1);
              
              const loadedDevices = [];
              for (let i = 0; i < count; i++) {
                loadedDevices.push({
                  deviceType: types[i] || "",
                  deviceMake: makes[i] || "",
                  deviceSerialNumber: serials[i] || ""
                });
              }
              setDevices(loadedDevices);
            }

            if (res.data.hasMaterial === "Yes" || res.data.has_material) {
              const fetchedName = res.data.materialName || res.data.material_name || "";
              const fetchedQty = res.data.materialQuantity || res.data.material_quantity || "";
              const fetchedSerial = res.data.materialSerialNumber || res.data.material_serial_number || "";
              
              const names = fetchedName ? fetchedName.split(",").map(s => s.trim()) : [];
              const quantities = fetchedQty ? fetchedQty.split(",").map(s => s.trim()) : [];
              const serials = fetchedSerial ? fetchedSerial.split(",").map(s => s.trim()) : [];
              const count = Math.max(names.length, quantities.length, serials.length, 1);
              
              const loadedMaterials = [];
              for (let i = 0; i < count; i++) {
                loadedMaterials.push({
                  materialName: names[i] || "",
                  materialQuantity: quantities[i] || "",
                  materialSerialNumber: serials[i] || ""
                });
              }
              setMaterials(loadedMaterials);
            }

            // Load group visitors if this request is part of a group
            if (res.data.group_members && Array.isArray(res.data.group_members) && res.data.group_members.length > 0) {
              setIsGroup(true);
              setGroupVisitors(res.data.group_members.map(m => ({
                name: m.name || m.visitor_name || "",
                phone: m.phone || m.mobile_number || "",
                email: m.email || "",
                typeOfIDProof: m.typeOfIDProof || m.id_proof_type || "",
                idProofNumber: m.idProofNumber || m.id_proof_number || ""
              })));
            } else if (res.data.accompanying_visitors_list && Array.isArray(res.data.accompanying_visitors_list) && res.data.accompanying_visitors_list.length > 0) {
              setIsGroup(true);
              setGroupVisitors(res.data.accompanying_visitors_list);
            } else if (res.data.accompanying_visitors) {
              try {
                const parsed = typeof res.data.accompanying_visitors === "string" 
                  ? JSON.parse(res.data.accompanying_visitors) 
                  : res.data.accompanying_visitors;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setIsGroup(true);
                  setGroupVisitors(parsed);
                }
              } catch (e) {
                console.error("Error parsing accompanying_visitors:", e);
              }
            }
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
              ${(formData.hasMaterial === 'Yes' || formData.has_material) ? `
                <div class="pass-divider"></div>
                <div class="pass-field">
                  <span class="field-label">Carrying Material</span>
                  <span class="field-value">${formData.materialName || formData.material_name} (${formData.materialQuantity || formData.material_quantity || '1'})</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">Challan / Serial No</span>
                  <span class="field-value">${formData.materialSerialNumber || formData.material_serial_number || '-'}</span>
                </div>
              ` : ''}
              ${isGroup && groupVisitors && groupVisitors.length > 0 ? `
                <div class="pass-divider"></div>
                <div class="pass-field full-width">
                  <span class="field-label">Group Members (${groupVisitors.filter(g => g.name.trim()).length} Accompanying)</span>
                  <span class="field-value" style="font-size: 11px; margin-top: 3px;">
                    ${groupVisitors.map(g => g.name).filter(Boolean).join(", ")}
                  </span>
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

    // Instant text box validation
    if (val.length > 0) {
      if (!targetCountry.regex.test(val)) {
        setFieldErrors((prev) => ({
          ...prev,
          phone: `Please enter a valid phone number for ${targetCountry.name} (e.g. ${targetCountry.placeholder}).`
        }));
      } else {
        setFieldErrors((prev) => ({ ...prev, phone: null }));
      }
    } else {
      setFieldErrors((prev) => ({ ...prev, phone: null }));
    }
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

    // Parse country code and validate local number specifically
    const { countryCode, localNumber } = parsePhoneNumber(formData.phone);
    const selectedCountry = countries.find(c => c.code === countryCode) || countries[countries.length - 1];

    const newErrors = {};

    if (!formData.host_id) {
      newErrors.host_id = "Please select a host/person to visit.";
    }

    if (!selectedCountry.regex.test(localNumber)) {
      newErrors.phone = `Please enter a valid phone number for ${selectedCountry.name} (e.g. ${selectedCountry.placeholder}).`;
    }

    // 🚦 ID Proof Validation
    if (formData.typeOfIDProof === "Aadhar Card" && formData.idProofNumber.length !== 12) {
      newErrors.idProofNumber = "Aadhar Card must be exactly 12 digits";
    }
    if (formData.typeOfIDProof === "PAN Card" && formData.idProofNumber.length !== 10) {
      newErrors.idProofNumber = "PAN Card must be exactly 10 alphanumeric characters";
    }

    // 🚦 Vehicle Validation when Vehicle Type is selected
    if (formData.vehicleType) {
      if (!formData.vehicleNumber || formData.vehicleNumber.trim() === "") {
        newErrors.vehicleNumber = "Vehicle Number is required when Vehicle Type is selected.";
      } else {
        const cleanVehicleNum = formData.vehicleNumber.replace(/[^A-Za-z0-9]/g, "");
        const vehicleNumberRegex = /^[A-Za-z]{2}[0-9]{2}[A-Za-z]{1,2}[0-9]{4}$/;
        if (!vehicleNumberRegex.test(cleanVehicleNum)) {
          newErrors.vehicleNumber = "Please enter a valid Indian vehicle registration number (e.g., MH12AB1234).";
        }
      }
      if (!vehiclePhotoFrontFile && !formData.vehiclePhotoFront) {
        newErrors.vehiclePhotoFront = "Vehicle Photo (Front View) is required when Vehicle Type is selected.";
      }
      if (!vehiclePhotoSideFile && !formData.vehiclePhotoSide) {
        newErrors.vehiclePhotoSide = "Vehicle Photo (Side View) is required when Vehicle Type is selected.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }

    const validGroupVisitors = isGroup 
      ? groupVisitors
          .map(v => ({
            name: (v.name || "").trim(),
            phone: (v.phone || "").trim(),
            email: (v.email || "").trim(),
            typeOfIDProof: (v.typeOfIDProof || "").trim(),
            idProofNumber: (v.idProofNumber || "").trim()
          }))
          .filter(v => v.name !== "")
      : [];

    if (isGroup && groupVisitors.length > 0 && validGroupVisitors.length === 0) {
      alert("Please enter the name of at least one accompanying visitor, or uncheck Group Visit.");
      return;
    }

    const user = JSON.parse(sessionStorage.getItem("user") || "{}");
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
    const isMulti = formData.isMultiDay === "Yes" || formData.isMultiDay === true;
    data.append("is_multi_day", isMulti ? "1" : "0");
    data.append("isMultiDay", isMulti ? "Yes" : "No");
    data.append("valid_till", isMulti ? (formData.valid_till || formData.scheduled_date || todayStr) : (formData.scheduled_date || todayStr));
    data.append("access_level", formData.accessLevel);
    data.append("host_id", formData.host_id);

    if (formData.hasDevice === "Yes") {
      const combinedType = devices.map(d => d.deviceType.trim()).filter(Boolean).join(", ");
      const combinedMake = devices.map(d => d.deviceMake.trim()).filter(Boolean).join(", ");
      const combinedSerial = devices.map(d => d.deviceSerialNumber.trim()).filter(Boolean).join(", ");
      data.append("hasDevice", "Yes");
      data.append("deviceType", combinedType);
      data.append("deviceMake", combinedMake);
      data.append("deviceSerialNumber", combinedSerial);
    } else {
      data.append("hasDevice", "No");
      data.append("deviceType", "");
      data.append("deviceMake", "");
      data.append("deviceSerialNumber", "");
    }

    if (formData.hasMaterial === "Yes") {
      const combinedMatName = materials.map(m => m.materialName.trim()).filter(Boolean).join(", ");
      const combinedMatQty = materials.map(m => m.materialQuantity.trim()).filter(Boolean).join(", ");
      const combinedMatSerial = materials.map(m => m.materialSerialNumber.trim()).filter(Boolean).join(", ");
      data.append("hasMaterial", "Yes");
      data.append("materialName", combinedMatName);
      data.append("materialQuantity", combinedMatQty);
      data.append("materialSerialNumber", combinedMatSerial);
      data.append("has_material", "1");
      data.append("material_name", combinedMatName);
      data.append("material_quantity", combinedMatQty);
      data.append("material_serial_number", combinedMatSerial);
    } else {
      data.append("hasMaterial", "No");
      data.append("materialName", "");
      data.append("materialQuantity", "");
      data.append("materialSerialNumber", "");
      data.append("has_material", "0");
      data.append("material_name", "");
      data.append("material_quantity", "");
      data.append("material_serial_number", "");
    }
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
        if (validGroupVisitors.length > 0) {
          data.append("group_visitors", JSON.stringify(validGroupVisitors));
        }
        const res = await API.post("/visitor-requests", data, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        console.log("Success:", res.data);
        if (validGroupVisitors.length > 0) {
          alert(`✅ Group Registered Successfully! (${validGroupVisitors.length + 1} Total Visitors: Lead + ${validGroupVisitors.length} Accompanying)`);
        } else {
          alert("✅ Visitor Invite Sent!");
        }
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

          {/* Visitor Full Name - Mandatory */}
          <div className="form-group">
            <label>Visitor Full Name <span>*</span></label>
            <div style={{ position: "relative" }}>
              <User size={18} style={iconStyle} />
              <input
                type="text"
                name="name"
                required
                placeholder="Enter visitor full name"
                style={inputStyle}
                value={formData.name}
                onChange={handleChange}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Group Visit Button - Beside Visitor Full Name */}
          <div className="form-group">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Group Visit</span>
              {isGroup && (
                <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700 }}>
                  Active ({groupVisitors.filter(g => g.name.trim()).length + 1} Visitors)
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={() => {
                const next = !isGroup;
                setIsGroup(next);
                if (next && groupVisitors.length === 0) {
                  setGroupVisitors([{ name: "", phone: "", email: "", typeOfIDProof: "", idProofNumber: "" }]);
                }
              }}
              disabled={readOnly}
              style={{
                width: "100%",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 14px",
                background: isGroup ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.04)",
                border: isGroup ? "1.5px solid #10b981" : "1px solid var(--border-color, #334155)",
                borderRadius: "8px",
                cursor: readOnly ? "default" : "pointer",
                color: isGroup ? "#10b981" : "var(--foreground, #f8fafc)",
                fontWeight: 600,
                fontSize: "13px",
                transition: "all 0.2s ease",
                boxSizing: "border-box"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={17} style={{ color: isGroup ? "#10b981" : "#94a3b8" }} />
                <span>{isGroup ? "Group Visit (Enabled)" : "Add Group Visitors"}</span>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 9px",
                  borderRadius: "9999px",
                  background: isGroup ? "#10b981" : "rgba(148, 163, 184, 0.15)",
                  color: isGroup ? "#ffffff" : "#94a3b8"
                }}
              >
                {isGroup ? `${groupVisitors.filter(g => g.name.trim()).length + 1} People` : "+ 4–5 People"}
              </span>
            </button>
          </div>

          {/* 👥 Accompanying Visitors Section (Placed ABOVE Person to Visit) */}
          {isGroup && (
            <div 
              className="form-group full-width" 
              style={{ 
                marginTop: "4px", 
                marginBottom: "8px",
                padding: "14px 16px", 
                background: "rgba(16, 185, 129, 0.08)", 
                border: "1.5px solid #10b981", 
                borderRadius: "10px", 
                transition: "all 0.2s ease" 
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#047857", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Users size={16} /> Accompanying Visitors ({groupVisitors.length})
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-gray, #64748b)", display: "block", marginTop: "2px" }}>
                    Lead visitor is listed above. Add accompanying group members below (4–5 people) — each visitor gets their own pass & check-in.
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span 
                    style={{ 
                      fontSize: "12px", 
                      fontWeight: 700, 
                      color: "#047857", 
                      background: "#d1fae5", 
                      padding: "4px 10px", 
                      borderRadius: "9999px",
                      border: "1px solid #a7f3d0"
                    }}
                  >
                    Group Size: {groupVisitors.filter(g => g.name.trim()).length + 1}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={addGroupVisitorRow}
                      style={{
                        background: "#ecfdf5",
                        color: "#059669",
                        border: "1px solid #a7f3d0",
                        borderRadius: "6px",
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Plus size={14} /> Add Another Visitor
                    </button>
                  )}
                </div>
              </div>

              {groupVisitors.map((member, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--card, #ffffff)",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    borderRadius: "8px",
                    padding: "14px",
                    marginBottom: "10px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#047857", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                      <User size={13} /> Accompanying Visitor #{idx + 2}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeGroupVisitorRow(idx)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          borderRadius: "4px",
                          color: "#dc2626",
                          cursor: "pointer",
                          padding: "3px 8px",
                          fontSize: "11px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Remove this visitor"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="form-grid" style={{ gap: "10px" }}>
                    {/* Visitor Full Name */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Visitor Full Name <span>*</span></label>
                      <div style={{ position: "relative" }}>
                        <User size={16} style={iconStyle} />
                        <input
                          type="text"
                          required
                          placeholder="Enter visitor full name"
                          style={inputStyle}
                          value={member.name}
                          onChange={(e) => handleGroupVisitorChange(idx, "name", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Mobile Number <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span></label>
                      <div style={{ position: "relative" }}>
                        <Phone size={16} style={iconStyle} />
                        <input
                          type="tel"
                          placeholder="Defaults to Lead Visitor's mobile"
                          style={inputStyle}
                          value={member.phone}
                          onChange={(e) => handleGroupVisitorChange(idx, "phone", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Email <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span></label>
                      <div style={{ position: "relative" }}>
                        <Mail size={16} style={iconStyle} />
                        <input
                          type="email"
                          placeholder="visitor@example.com"
                          style={inputStyle}
                          value={member.email}
                          onChange={(e) => handleGroupVisitorChange(idx, "email", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {/* ID Proof Type */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>ID Proof <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span></label>
                      <div style={{ position: "relative" }}>
                        <ClipboardList size={16} style={iconStyle} />
                        <select
                          style={inputStyle}
                          value={member.typeOfIDProof}
                          onChange={(e) => handleGroupVisitorChange(idx, "typeOfIDProof", e.target.value)}
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

                    {/* ID Proof Number */}
                    {member.typeOfIDProof && (
                      <div className="form-group full-width">
                        <label style={{ fontSize: "12px" }}>ID Proof Number</label>
                        <div style={{ position: "relative" }}>
                          <Hash size={16} style={iconStyle} />
                          <input
                            type="text"
                            placeholder="Enter ID proof number"
                            style={inputStyle}
                            value={member.idProofNumber}
                            onChange={(e) => handleGroupVisitorChange(idx, "idProofNumber", e.target.value.toUpperCase())}
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {!readOnly && (
                <button
                  type="button"
                  onClick={addGroupVisitorRow}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: "#f0fdf4",
                    color: "#059669",
                    border: "1px dashed #6ee7b7",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    marginTop: "6px"
                  }}
                >
                  <Plus size={15} /> Add Another Group Visitor (e.g. 4–5 people)
                </button>
              )}
            </div>
          )}

          {/* Person to Visit - Adjusted below */}
          <div className="form-group full-width">
            <HostSelect
              selectedHostId={formData.host_id}
              siteId={formData.site_id || formData.siteId || sessionStorage.getItem("active_site_id")}
              onChange={(host) => {
                setFormData((prev) => ({
                  ...prev,
                  host_id: host ? host.id : "",
                  personToVisit: host ? host.name : "",
                  person_to_visit: host ? host.name : ""
                }));
                setFieldErrors((prev) => ({ ...prev, host_id: "" }));
              }}
              error={fieldErrors.host_id}
              required={true}
              label="Person to Visit"
              disabled={readOnly}
            />
          </div>


          {/* Multi-day Visit Toggle Card Button */}
          <div className="form-group full-width" style={{ marginTop: "4px", marginBottom: "10px" }}>
            <button
              type="button"
              onClick={() => {
                if (readOnly) return;
                const nextChecked = !(formData.isMultiDay === "Yes" || formData.isMultiDay === true);
                setFormData(prev => ({
                  ...prev,
                  isMultiDay: nextChecked ? "Yes" : "No",
                  valid_till: nextChecked ? (prev.valid_till || prev.scheduled_date || todayStr) : ""
                }));
              }}
              disabled={readOnly}
              style={{
                width: "100%",
                minHeight: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: (formData.isMultiDay === "Yes" || formData.isMultiDay === true)
                  ? "rgba(37, 99, 235, 0.15)"
                  : "rgba(255, 255, 255, 0.04)",
                border: (formData.isMultiDay === "Yes" || formData.isMultiDay === true)
                  ? "1.5px solid #3b82f6"
                  : "1px solid var(--border-color, #334155)",
                borderRadius: "8px",
                cursor: readOnly ? "default" : "pointer",
                color: (formData.isMultiDay === "Yes" || formData.isMultiDay === true)
                  ? "#60a5fa"
                  : "var(--foreground, #f8fafc)",
                fontWeight: 600,
                fontSize: "13px",
                transition: "all 0.2s ease",
                boxSizing: "border-box"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
                <Calendar size={18} style={{ color: (formData.isMultiDay === "Yes" || formData.isMultiDay === true) ? "#3b82f6" : "#94a3b8" }} />
                <div>
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>
                    {(formData.isMultiDay === "Yes" || formData.isMultiDay === true)
                      ? "Multiple Days Visit (Active)"
                      : "Multiple Days Visit"}
                  </span>
                  <span style={{ display: "block", fontSize: "11px", color: "var(--text-gray, #94a3b8)", fontWeight: 400 }}>
                    {(formData.isMultiDay === "Yes" || formData.isMultiDay === true)
                      ? "Start Date and Till Date are enabled below for multi-day on-site access"
                      : "Enable for contractors, vendors, audits or multi-day on-site access"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    background: (formData.isMultiDay === "Yes" || formData.isMultiDay === true)
                      ? "#2563eb"
                      : "rgba(148, 163, 184, 0.15)",
                    color: (formData.isMultiDay === "Yes" || formData.isMultiDay === true)
                      ? "#ffffff"
                      : "#94a3b8"
                  }}
                >
                  {(formData.isMultiDay === "Yes" || formData.isMultiDay === true) ? "Multi-Day" : "Single Day"}
                </span>
                <div
                  style={{
                    width: "36px",
                    height: "20px",
                    borderRadius: "9999px",
                    background: (formData.isMultiDay === "Yes" || formData.isMultiDay === true) ? "#2563eb" : "rgba(100, 116, 139, 0.4)",
                    position: "relative",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div
                    style={{
                      width: "14px",
                      height: "14px",
                      borderRadius: "50%",
                      background: "#ffffff",
                      position: "absolute",
                      top: "3px",
                      left: (formData.isMultiDay === "Yes" || formData.isMultiDay === true) ? "19px" : "3px",
                      transition: "all 0.2s ease"
                    }}
                  />
                </div>
              </div>
            </button>
          </div>

          {/* Visit Date(s) & Time */}
          {formData.isMultiDay === "Yes" || formData.isMultiDay === true ? (
            <>
              {/* From Date */}
              <div className="form-group">
                <label>From Date (Start) <span>*</span></label>
                <div style={{ position: "relative" }}>
                  <Calendar size={18} style={iconStyle} />
                  <input
                    type="date"
                    name="scheduled_date"
                    min={todayStr}
                    required
                    style={inputStyle}
                    value={formData.scheduled_date || todayStr}
                    onChange={(e) => {
                      handleChange(e);
                      if (formData.valid_till && e.target.value > formData.valid_till) {
                        setFormData(prev => ({ ...prev, valid_till: e.target.value }));
                      }
                    }}
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* Till Date */}
              <div className="form-group">
                <label>Till Date (End) <span>*</span></label>
                <div style={{ position: "relative" }}>
                  <Calendar size={18} style={iconStyle} />
                  <input
                    type="date"
                    name="valid_till"
                    min={formData.scheduled_date || todayStr}
                    required
                    style={inputStyle}
                    value={formData.valid_till || formData.scheduled_date || todayStr}
                    onChange={handleChange}
                    disabled={readOnly}
                  />
                </div>
              </div>

              {/* Visit Time */}
              <div className="form-group full-width">
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
            </>
          ) : (
            <>
              {/* Single Visit Date */}
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
            </>
          )}

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
                  background: "var(--input-bg, #f8fafc)",
                  border: "1px solid var(--input-border, #cbd5e1)",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  color: "var(--input-text, #334155)"
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
                  className={fieldErrors.phone ? "invalid-input" : ""}
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
            {fieldErrors.phone && (
              <span className="error-text" style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px", display: "block" }}>
                ⚠️ {fieldErrors.phone}
              </span>
            )}
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
                {unitOptions.map((unitName, idx) => (
                  <option key={idx} value={unitName}>{unitName}</option>
                ))}
                {formData.unit && !unitOptions.includes(formData.unit) && (
                  <option value={formData.unit}>{formData.unit}</option>
                )}
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
                {accessLevelOptions.map((opt, idx) => (
                  <option key={idx} value={String(idx + 1)}>{opt}</option>
                ))}
                {formData.accessLevel && !accessLevelOptions.some((_, i) => String(i + 1) === String(formData.accessLevel)) && (
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
                {reasonOptions.map((reasonName, idx) => (
                  <option key={idx} value={reasonName}>{reasonName}</option>
                ))}
                {formData.reasonOfVisit && !reasonOptions.includes(formData.reasonOfVisit) && (
                  <option value={formData.reasonOfVisit}>{formData.reasonOfVisit}</option>
                )}
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
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value === "Yes" && devices.length === 0) {
                    setDevices([{ deviceType: "", deviceMake: "", deviceSerialNumber: "" }]);
                  }
                }}
                disabled={readOnly}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          {formData.hasDevice === "Yes" && (
            <div className="form-group full-width" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                  Accompanying Devices ({devices.length}) <span>*</span>
                </label>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={addDeviceRow}
                    style={{
                      background: "#eff6ff",
                      color: "#2563eb",
                      border: "1px solid #bfdbfe",
                      borderRadius: "6px",
                      padding: "6px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <Plus size={14} /> Add Another Device
                  </button>
                )}
              </div>

              {devices.map((device, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--muted, #f8fafc)",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "10px",
                    padding: "16px",
                    marginBottom: "12px",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--foreground, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Device #{idx + 1}
                    </span>
                    {!readOnly && devices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDeviceRow(idx)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          borderRadius: "4px",
                          color: "#dc2626",
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Remove this device"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="form-grid" style={{ gap: "12px" }}>
                    {/* Device Type */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Device Type <span>*</span></label>
                      <div style={{ position: "relative" }}>
                        <Laptop size={18} style={iconStyle} />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Laptop, Tablet"
                          style={inputStyle}
                          value={device.deviceType}
                          onChange={(e) => handleDeviceChange(idx, "deviceType", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {/* Device Make */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Device Make <span>*</span></label>
                      <div style={{ position: "relative" }}>
                        <Laptop size={18} style={iconStyle} />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dell, Apple"
                          style={inputStyle}
                          value={device.deviceMake}
                          onChange={(e) => handleDeviceChange(idx, "deviceMake", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {/* Device Serial Number */}
                    <div className="form-group full-width">
                      <label style={{ fontSize: "12px" }}>Device Serial Number <span>*</span></label>
                      <div style={{ position: "relative" }}>
                        <Hash size={18} style={iconStyle} />
                        <input
                          type="text"
                          required
                          placeholder="Enter Serial Number"
                          style={inputStyle}
                          value={device.deviceSerialNumber}
                          onChange={(e) => handleDeviceChange(idx, "deviceSerialNumber", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Has Material / Goods / Equipment? */}
          <div className="form-group full-width">
            <label>Carrying any Material/Goods/Equipment? <span>*</span></label>
            <div style={{ position: "relative" }}>
              <Package size={18} style={iconStyle} />
              <select
                name="hasMaterial"
                required
                style={inputStyle}
                value={formData.hasMaterial}
                onChange={(e) => {
                  handleChange(e);
                  if (e.target.value === "Yes" && materials.length === 0) {
                    setMaterials([{ materialName: "", materialQuantity: "", materialSerialNumber: "" }]);
                  }
                }}
                disabled={readOnly}
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          {formData.hasMaterial === "Yes" && (
            <div className="form-group full-width" style={{ marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--foreground, #1e293b)", margin: 0 }}>
                  Material / Goods / Equipment Details ({materials.length}) <span>*</span>
                </label>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={addMaterialRow}
                    style={{
                      background: "rgba(34, 197, 94, 0.15)",
                      color: "#16a34a",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                      borderRadius: "6px",
                      padding: "6px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <Plus size={14} /> Add Another Material
                  </button>
                )}
              </div>

              {materials.map((mat, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--muted, #f8fafc)",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    borderRadius: "10px",
                    padding: "16px",
                    marginBottom: "12px",
                    position: "relative"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--foreground, #475569)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Material #{idx + 1}
                    </span>
                    {!readOnly && materials.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMaterialRow(idx)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          borderRadius: "4px",
                          color: "#dc2626",
                          cursor: "pointer",
                          padding: "4px 8px",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Remove this material"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    )}
                  </div>

                  <div className="form-grid" style={{ gap: "12px" }}>
                    {/* Material Name / Description */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Material Description / Item <span>*</span></label>
                      <div style={{ position: "relative" }}>
                        <Package size={18} style={iconStyle} />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Spare Parts, Cable Box, Demo Unit"
                          style={inputStyle}
                          value={mat.materialName}
                          onChange={(e) => handleMaterialChange(idx, "materialName", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {/* Material Quantity */}
                    <div className="form-group">
                      <label style={{ fontSize: "12px" }}>Quantity / Units <span>*</span></label>
                      <div style={{ position: "relative" }}>
                        <Hash size={18} style={iconStyle} />
                        <input
                          type="text"
                          required
                          placeholder="e.g. 2 Boxes, 5 Pcs, 10 Kg"
                          style={inputStyle}
                          value={mat.materialQuantity}
                          onChange={(e) => handleMaterialChange(idx, "materialQuantity", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>

                    {/* Challan / Serial Number */}
                    <div className="form-group full-width">
                      <label style={{ fontSize: "12px" }}>Challan / Invoice / Serial Number</label>
                      <div style={{ position: "relative" }}>
                        <Hash size={18} style={iconStyle} />
                        <input
                          type="text"
                          placeholder="Enter Challan #, Invoice # or Serial # (Optional)"
                          style={inputStyle}
                          value={mat.materialSerialNumber}
                          onChange={(e) => handleMaterialChange(idx, "materialSerialNumber", e.target.value)}
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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