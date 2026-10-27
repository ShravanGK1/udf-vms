import React, { useState, useEffect } from "react";
import API from "../../app/apiClient";
import { User, Mail, Phone, MapPin, Building, Briefcase, Hash, Save, ClipboardList, Laptop, CheckCircle, Languages, ChevronDown, Camera, Calendar, Clock, Plus, Trash2, Users } from "lucide-react";
import "./VisitorRegistration.css";
import CameraModal from "../../components/modals/CameraModal";
import HostSelect from "../../components/common/HostSelect";
import ThemeToggle from "../../components/common/ThemeToggle";


const translations = {
  English: {
    title: "Self Registration",
    subtitle: "Please enter your details accurately for visitor access.",
    fullName: "Visitor Full Name",
    personToVisit: "Person to Visit",
    email: "Email ID",
    phone: "Phone Number",
    pabx: "PABX Phone Number",
    unit: "Unit",
    department: "Department",
    location: "Location",
    company: "Visitors Company Name",
    idType: "Type Of ID Proof",
    idNumber: "ID Proof Number",
    reason: "Reason of Visit",
    hasDevice: "Carrying any Device/Laptop?",
    deviceType: "Device Type",
    deviceMake: "Device Make",
    serial: "Device Serial Number",
    submit: "Submit Registration",
    success: "Registration Successful",
    successMsg: "Your details have been submitted. Please wait at the reception for approval.",
    selectUnit: "Select Unit",
    selectDept: "Select Department",
    selectId: "Select ID Proof",
    selectReason: "Select Reason",
    placeholderName: "Enter visitor full name",
    placeholderPerson: "Enter person name",
    placeholderEmail: "visitor@company.com",
    placeholderPhone: "+91 9876543210",
    placeholderPabx: "Extension (e.g. 405)",
    placeholderLocation: "Enter location",
    placeholderCompany: "Enter your company",
    placeholderId: "Enter ID proof number",
    placeholderSerial: "Enter Serial Number",
    placeholderDeviceType: "e.g. Laptop",
    placeholderDeviceMake: "e.g. Dell",
    yes: "Yes",
    no: "No",
    aadhar: "Aadhar Card",
    pan: "PAN Card",
    dl: "Driving License",
    passport: "Passport",
    companyID: "Company ID",
    vehicleType: "Vehicle Type",
    vehicleNumber: "Vehicle Number",
    selectVehicleType: "Select Vehicle Type",
    fourWheeler: "Four wheeler",
    twoWheeler: "Two wheeler",
    threeWheeler: "Three wheeler",
    placeholderVehicleNumber: "Enter vehicle number",
    vehiclePhotoFront: "Vehicle Photo (Front View)",
    vehiclePhotoSide: "Vehicle Photo (Side View)",
    placeholderPhotoFront: "Select front view picture",
    placeholderPhotoSide: "Select side view picture",
    noImageUploaded: "No image uploaded",
    reasons: {
      "Police Verification": "Police Verification",
      "Meeting": "Meeting",
      "IT": "IT",
      "Interview": "Interview",
      "ID(New/Renew)": "ID(New/Renew)",
      "Recruitment": "Recruitment",
      "Payment": "Payment",
      "P.F.": "P.F.",
      "E.C.S.I.": "E.C.S.I.",
      "Personal": "Personal",
      "Logistics(Depot/Receiving)": "Logistics(Depot/Receiving)",
      "Field Related": "Field Related",
      "Billings": "Billings",
      "Vendor": "Vendor",
      "Tie-ups": "Tie-ups",
      "Leave Payment": "Leave Payment",
      "Bonus Payment": "Bonus Payment",
      "Cheque": "Cheque",
      "Cheque Bearer": "Cheque Bearer",
      "Plant Visit": "Plant Visit",
      "Medical": "Medical",
      "Other": "Other"
    }
  },
  Hindi: {
    title: "स्व-पंजीकरण",
    subtitle: "कृपया विज़िटर एक्सेस के लिए अपना विवरण सटीक रूप से दर्ज करें।",
    fullName: "विज़िटर का पूरा नाम",
    personToVisit: "मिलने वाले व्यक्ति का नाम",
    email: "ईमेल आईडी",
    phone: "फोन नंबर",
    pabx: "PABX फोन नंबर",
    unit: "यूनिट",
    department: "विभाग",
    location: "स्थान",
    company: "विज़िटर कंपनी का नाम",
    idType: "पहचान पत्र का प्रकार",
    idNumber: "पहचान पत्र संख्या",
    reason: "आने का कारण",
    hasDevice: "क्या आप कोई डिवाइस/लैपटॉप ले जा रहे हैं?",
    deviceType: "डिवाइस का प्रकार",
    deviceMake: "डिवाइस मेक",
    serial: "डिवाइस सीरियल नंबर",
    submit: "पंजीकरण जमा करें",
    success: "पंजीकरण सफल",
    successMsg: "आपका विवरण जमा कर दिया गया है। कृपया अनुमोदन के लिए रिसेप्शन पर प्रतीक्षा करें।",
    selectUnit: "यूनिट चुनें",
    selectDept: "विभाग चुनें",
    selectId: "पहचान पत्र चुनें",
    selectReason: "कारण चुनें",
    placeholderName: "विज़िटर का पूरा नाम दर्ज करें",
    placeholderPerson: "व्यक्ति का नाम दर्ज करें",
    placeholderEmail: "visitor@company.com",
    placeholderPhone: "+91 9876543210",
    placeholderPabx: "एक्सटेंशन (जैसे 405)",
    placeholderLocation: "स्थान दर्ज करें",
    placeholderCompany: "अपनी कंपनी दर्ज करें",
    placeholderId: "पहचान पत्र संख्या दर्ज करें",
    placeholderSerial: "सीरियल नंबर दर्ज करें",
    placeholderDeviceType: "जैसे: लैपटॉप",
    placeholderDeviceMake: "जैसे: डेल",
    yes: "हाँ",
    no: "नहीं",
    aadhar: "आधार कार्ड",
    pan: "पैन कार्ड",
    dl: "ड्राइविंग लाइसेंस",
    passport: "पासपोर्ट",
    companyID: "कंपनी आईडी",
    vehicleType: "वाहन का प्रकार",
    vehicleNumber: "वाहन संख्या",
    selectVehicleType: "वाहन का प्रकार चुनें",
    fourWheeler: "Four wheeler",
    twoWheeler: "Two wheeler",
    threeWheeler: "Three wheeler",
    placeholderVehicleNumber: "वाहन संख्या दर्ज करें",
    vehiclePhotoFront: "वाहन फोटो (सामने का दृश्य)",
    vehiclePhotoSide: "वाहन फोटो (बगल का दृश्य)",
    placeholderPhotoFront: "सामने के दृश्य का चित्र चुनें",
    placeholderPhotoSide: "बगल के दृश्य का चित्र चुनें",
    noImageUploaded: "कोई फोटो अपलोड नहीं की गई",
    reasons: {
      "Police Verification": "पुलिस सत्यापन",
      "Meeting": "मिटिंग ",
      "IT": "आईटी",
      "Interview": "इंटरव्ह्यू",
      "ID(New/Renew)": " आयडी (न्यू /रिन्यू )",
      "Recruitment": "भर्ती",
      "Payment": "पेमेंट",
      "P.F.": "पी.एफ.",
      "E.C.S.I.": "ई.सी.एस.आई.",
      "Personal": "पर्सोनल ",
      "Logistics(Departure/Receiving)": "लॉजिस्टिक (डीपोट /रिसिविंग )",
      "Field Related": "फील्ड रिलेटेड",
      "Billings": "बिलिंग",
      "Vendor": "वेंडर",
      "Tie-ups": "टाई-अप",
      "Leave Payment": "लिव्ह पेमेंट ",
      "Bonus Payment": "बोनस पेमेंट ",
      "Cheque": "चेक",
      "Cheque Bearer": "चेक बेरिअर ",
      "Plant Visit": "प्लांट विजिट",
      "Medical": "मेडिकल",
      "Other": "अन्य"
    }
  },
  Marathi: {
    title: "स्व-नोंदणी",
    subtitle: "कृपया अभ्यागत प्रवेशासाठी आपला तपशील अचूक प्रविष्ट करा.",
    fullName: "व्हिजिटरचे पूर्ण नाव",
    personToVisit: "भेट द्यावयाची व्यक्ती",
    email: "ईमेल आयडी",
    phone: "फोन नंबर",
    pabx: "PABX फोन नंबर",
    unit: "युनिट",
    department: "विभाग",
    location: "ठिकाण",
    company: "व्हिसिटरचे कंपनीचं नाव",
    idType: "आयडी प्रूफ",
    idNumber: "ओळखपत्र क्रमांक",
    reason: "भेटीचे कारण",
    hasDevice: "आपण कोणतेही डिव्हाइस/लॅपटॉप नेत आहात का?",
    deviceType: "डिव्हाइसचा प्रकार",
    deviceMake: "डिव्हाइस मेक",
    serial: "डिव्हाइस सिरीयल नंबर",
    submit: "नोंदणी सबमिट करा",
    success: "नोंदणी यशस्वी",
    successMsg: "आपला तपशील सबमिट केला गेला आहे. कृपया मंजुरीसाठी रिसेप्शनवर प्रतीक्षा करा.",
    selectUnit: "युनिट निवडा",
    selectDept: "विभाग निवडा",
    selectId: "ओळखपत्र निवडा",
    selectReason: "कारण निवडा",
    placeholderName: "व्हिजिटरचे पूर्ण नाव प्रविष्ट करा",
    placeholderPerson: "व्यक्तीचे नाव प्रविष्ट करा",
    placeholderEmail: "visitor@company.com",
    placeholderPhone: "+91 9876543210",
    placeholderPabx: "एक्सटेंशन (उदा. 405)",
    placeholderLocation: "ठिकाण प्रविष्ट करा",
    placeholderCompany: "तुमच्या कंपनीचे नाव प्रविष्ट करा",
    placeholderId: "ओळखपत्र क्रमांक प्रविष्ट करा",
    placeholderSerial: "सिरीयल नंबर प्रविष्ट करा",
    placeholderDeviceType: "उदा. लॅपटॉप",
    placeholderDeviceMake: "उदा. डेल",
    yes: "हो",
    no: "नाही",
    aadhar: "आधार कार्ड",
    pan: "पॅन कार्ड",
    dl: "ड्रायव्हिंग लायसन्स",
    passport: "पासपोर्ट",
    companyID: "कंपनी आयडी",
    vehicleType: "वाहनाचा प्रकार",
    vehicleNumber: "वाहन क्रमांक",
    selectVehicleType: "वाहनाचा प्रकार निवडा",
    fourWheeler: "four wheeler",
    twoWheeler: "two wheeler",
    threeWheeler: "three wheeler",
    placeholderVehicleNumber: "वाहन क्रमांक प्रविष्ट करा",
    vehiclePhotoFront: "वाहनाचा फोटो (समोरून)",
    vehiclePhotoSide: "वाहनाचा फोटो (बाजूने)",
    placeholderPhotoFront: "समोरून फोटो निवडा",
    placeholderPhotoSide: "बाजूने फोटो निवडा",
    noImageUploaded: "कोणताही फोटो अपलोड केला नाही",
    reasons: {
      "Police Verification": "पोलीस पडताळणी",
      "Meeting": "मिटिंग",
      "IT": "आयटी",
      "Interview": "इंटरव्ह्यू",
      "IDNew/Renew)": "आयडी (न्यू /रिन्यू )",
      "Recruitment": "भरती",
      "Payment": "पेमेंट",
      "P.F.": "पी.एफ.",
      "E.C.S.I.": "ई.सी.एस.ई.सी.",
      "Personal": "पर्सोनल ",
      "Logitics(Depot/Receiving)": "लॉजिस्टिक (डीपोट / रिसिविंग )",
      "Field Related": "फील्ड रिलेटेड",
      "Billings": "बिलिंग",
      "Vendor": "वेंडर",
      "Tie-ups": "टाय-अप",
      "Leave Payment": "लिव्ह पेमेंट",
      "Bonus Payment": "बोनस पेमेंट",
      "Cheque": "चेक",
      "Cheque Bearer": "चेक बेरिअर",
      "Plant Visit": "प्लांट व्हिजिट",
      "Medical": "मेडिकल",
      "Other": "इतर"
    }
  }
};

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

export default function VisitorRegistration() {
  const [language, setLanguage] = useState(localStorage.getItem("preferred_language") || "English");
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [visitHistory, setVisitHistory] = useState([]);
  const t = translations[language];

  // Vehicle photo states
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

  useEffect(() => {
    localStorage.setItem("preferred_language", language);
  }, [language]);

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
    unit: "",
    department: "",
    location: "",
    company_name: "",
    typeOfIDProof: "",
    idProofNumber: "",
    reasonOfVisit: "",
    host_id: "",
    person_to_visit: "",
    scheduled_date: todayStr,
    scheduled_time: nowTimeStr,
    isMultiDay: "No",
    valid_till: todayStr,
    hasDevice: "No",
    deviceType: "",
    deviceMake: "",
    deviceSerialNumber: "",
    vehicleType: "",
    vehicleNumber: "",
    vehiclePhotoFront: "",
    vehiclePhotoSide: ""
  });

  const [devices, setDevices] = useState([
    { deviceType: "", deviceMake: "", deviceSerialNumber: "" }
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
      // Clear ID number if type changes to avoid mismatch
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
      // Only trigger if phone has a valid length (between 7 and 15 digits)
      if (formData.phone.length >= 7 && formData.phone.length <= 15) {
        try {
          const res = await API.get(`/visitors/lookup/${formData.phone}`);
          if (res.data) {
            const v = res.data;
            setFormData((prev) => ({
              ...prev,
              name: v.visitor_name || prev.name,
              email: v.email || prev.email,
              company_name: v.company_name || prev.company_name,
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
          // If not found, it's a new visitor, ignore and let them type
          console.log("Visitor lookup finished");
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

    const data = new FormData();
    if (isGroup && validGroupVisitors.length > 0) {
      data.append("group_visitors", JSON.stringify(validGroupVisitors));
    }
    data.append("visitor_name", formData.name);
    data.append("full_name", formData.name);
    data.append("email", formData.email);
    data.append("mobile_number", formData.phone);
    data.append("pabx", formData.pabx);
    data.append("unit", formData.unit);
    data.append("department", formData.department);
    data.append("location", formData.location);
    data.append("company_name", formData.company_name);
    data.append("id_proof_type", formData.typeOfIDProof);
    data.append("id_proof_number", formData.idProofNumber);
    data.append("purpose", formData.reasonOfVisit);
    data.append("host_id", formData.host_id);
    data.append("person_to_visit", formData.person_to_visit);
    data.append("scheduled_date", formData.scheduled_date || todayStr);
    data.append("scheduled_time", formData.scheduled_time || nowTimeStr);
    const isMulti = formData.isMultiDay === "Yes" || formData.isMultiDay === true;
    data.append("is_multi_day", isMulti ? "1" : "0");
    data.append("isMultiDay", isMulti ? "Yes" : "No");
    data.append("valid_till", isMulti ? (formData.valid_till || formData.scheduled_date || todayStr) : (formData.scheduled_date || todayStr));
    data.append("access_level", "Visitor (Level 1)");
    // host_id should be omitted or left blank if null
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
    data.append("vehicleType", formData.vehicleType);
    data.append("vehicleNumber", formData.vehicleNumber);

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
      const res = await API.post("/visitor-requests", data, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      console.log("Response:", res.data);

      // Save to history
      if (formData.person_to_visit.trim()) {
        const updatedHistory = Array.from(new Set([...visitHistory, formData.person_to_visit.trim()]));
        localStorage.setItem("visitor_history", JSON.stringify(updatedHistory));
        setVisitHistory(updatedHistory);
      }

      setSubmitted(true);
    } catch (error) {
      console.error("ERROR:", error);
      alert("❌ Failed to submit registration");
    }
  };

  if (submitted) {
    return (
      <div className="registration-wrapper">
        <ThemeToggle floating />
        <div className="success-container">
          <CheckCircle size={64} className="success-icon" />
          <h2>{t.success}</h2>
          <p>{t.successMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="registration-wrapper">
      <ThemeToggle floating />
      <div className="reg-form-container">
        <div className="reg-form-header">
          <div className="reg-header-top">
            <div className="language-selector">
              <Languages size={16} />
              <span className="selected-language">{language}</span>
              <ChevronDown size={14} className="chevron-icon" />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="hidden-select">
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिंदी)</option>
                <option value="Marathi">Marathi (मराठी)</option>
              </select>
            </div>
          </div>
          <h2>
            <User /> {t.title}
          </h2>
          <p>{t.subtitle}</p>
        </div>

        <form className="reg-form-content" onSubmit={handleSubmit}>
          <div className="reg-form-grid">
            {/* Visitor Full Name - Mandatory */}
            <div className="form-group">
              <label>{t.fullName} <span>*</span></label>
              <div style={{ position: "relative" }}>
                <User size={18} className="input-icon" />
                <input type="text" name="name" required placeholder={t.placeholderName} value={formData.name} onChange={handleChange} />
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
                  cursor: "pointer",
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


            {/* 👥 Accompanying Visitors Section (Placed right after Visitor Full Name & Host) */}
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
                      Lead visitor is listed above. Add accompanying group members below (4–5 people) — each visitor gets their own entry & pass.
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
                    </div>

                    <div className="form-grid" style={{ gap: "10px" }}>
                      {/* Visitor Full Name */}
                      <div className="form-group">
                        <label style={{ fontSize: "12px" }}>{t.fullName} <span>*</span></label>
                        <div style={{ position: "relative" }}>
                          <User size={16} className="input-icon" />
                          <input
                            type="text"
                            required
                            placeholder={t.placeholderName}
                            value={member.name}
                            onChange={(e) => handleGroupVisitorChange(idx, "name", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="form-group">
                        <label style={{ fontSize: "12px" }}>{t.phone} <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span></label>
                        <div style={{ position: "relative" }}>
                          <Phone size={16} className="input-icon" />
                          <input
                            type="tel"
                            placeholder="Defaults to Lead Visitor's mobile"
                            value={member.phone}
                            onChange={(e) => handleGroupVisitorChange(idx, "phone", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="form-group">
                        <label style={{ fontSize: "12px" }}>{t.email} <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span></label>
                        <div style={{ position: "relative" }}>
                          <Mail size={16} className="input-icon" />
                          <input
                            type="email"
                            placeholder="visitor@example.com"
                            value={member.email}
                            onChange={(e) => handleGroupVisitorChange(idx, "email", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* ID Proof Type */}
                      <div className="form-group">
                        <label style={{ fontSize: "12px" }}>{t.idType} <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span></label>
                        <div style={{ position: "relative" }}>
                          <ClipboardList size={16} className="input-icon" />
                          <select
                            value={member.typeOfIDProof}
                            onChange={(e) => handleGroupVisitorChange(idx, "typeOfIDProof", e.target.value)}
                          >
                            <option value="">{t.selectId}</option>
                            <option value="Aadhar Card">{t.aadhar}</option>
                            <option value="PAN Card">{t.pan}</option>
                            <option value="Driving License">{t.dl}</option>
                            <option value="Voting Card">Voting Card</option>
                            <option value="Passport">{t.passport}</option>
                            <option value="Company ID">{t.companyID}</option>
                          </select>
                        </div>
                      </div>

                      {/* ID Proof Number */}
                      {member.typeOfIDProof && (
                        <div className="form-group full-width">
                          <label style={{ fontSize: "12px" }}>{t.idNumber}</label>
                          <div style={{ position: "relative" }}>
                            <Hash size={16} className="input-icon" />
                            <input
                              type="text"
                              placeholder={t.placeholderId}
                              value={member.idProofNumber}
                              onChange={(e) => handleGroupVisitorChange(idx, "idProofNumber", e.target.value.toUpperCase())}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

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
              </div>
            )}

            {/* Person to Visit - Below Group Visitors Section */}
            <div className="form-group full-width">
              <HostSelect
                selectedHostId={formData.host_id}
                siteId={formData.site_id || formData.siteId || sessionStorage.getItem("active_site_id")}
                onChange={(host) => {
                  setFormData((prev) => ({
                    ...prev,
                    host_id: host ? host.id : "",
                    person_to_visit: host ? host.name : ""
                  }));
                  setFieldErrors((prev) => ({ ...prev, host_id: "" }));
                }}
                error={fieldErrors.host_id}
                required={true}
                label={t.personToVisit}
                placeholder={t.placeholderPerson}
              />
            </div>

            {/* Multi-day Visit Toggle Card Button */}
            <div className="form-group full-width" style={{ marginTop: "4px", marginBottom: "10px" }}>
              <button
                type="button"
                onClick={() => {
                  const nextChecked = !(formData.isMultiDay === "Yes" || formData.isMultiDay === true);
                  setFormData(prev => ({
                    ...prev,
                    isMultiDay: nextChecked ? "Yes" : "No",
                    valid_till: nextChecked ? (prev.valid_till || prev.scheduled_date || todayStr) : ""
                  }));
                }}
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
                  cursor: "pointer",
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
                        ? "Start Date and Till Date are enabled below for multi-day access"
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
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>From Date (Start) <span>*</span></label>
                    <div style={{ position: "relative" }}>
                      <Calendar size={18} className="input-icon" />
                      <input
                        type="date"
                        name="scheduled_date"
                        min={todayStr}
                        value={formData.scheduled_date || todayStr}
                        onChange={(e) => {
                          handleChange(e);
                          if (formData.valid_till && e.target.value > formData.valid_till) {
                            setFormData(prev => ({ ...prev, valid_till: e.target.value }));
                          }
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Till Date (End) <span>*</span></label>
                    <div style={{ position: "relative" }}>
                      <Calendar size={18} className="input-icon" />
                      <input
                        type="date"
                        name="valid_till"
                        min={formData.scheduled_date || todayStr}
                        value={formData.valid_till || formData.scheduled_date || todayStr}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t.scheduledTime || "Visit Time"} <span>*</span></label>
                  <div style={{ position: "relative" }}>
                    <Clock size={18} className="input-icon" />
                    <input
                      type="time"
                      name="scheduled_time"
                      value={formData.scheduled_time}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "1rem" }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t.scheduledDate || "Visit Date"} <span>*</span></label>
                  <div style={{ position: "relative" }}>
                    <Calendar size={18} className="input-icon" />
                    <input
                      type="date"
                      name="scheduled_date"
                      min={todayStr}
                      value={formData.scheduled_date}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t.scheduledTime || "Visit Time"} <span>*</span></label>
                  <div style={{ position: "relative" }}>
                    <Clock size={18} className="input-icon" />
                    <input
                      type="time"
                      name="scheduled_time"
                      value={formData.scheduled_time}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>{t.email}</label>
              <div style={{ position: "relative" }}>
                <Mail size={18} className="input-icon" />
                <input
                  type="email"
                  name="email"
                  placeholder={t.placeholderEmail}
                  className={fieldErrors.email ? "invalid-input" : ""}
                  value={formData.email}
                  onChange={handleChange}
                />
                {fieldErrors.email && <span className="error-text">{fieldErrors.email}</span>}
              </div>
            </div>

            <div className="form-group">
              <label>{t.phone} <span>*</span></label>
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
                  <Phone size={18} className="input-icon" />
                  <input
                    type="tel"
                    name="localPhone"
                    required
                    className={fieldErrors.phone ? "invalid-input" : ""}
                    placeholder={
                      (countries.find(c => c.code === parsePhoneNumber(formData.phone).countryCode) || countries[countries.length - 1]).placeholder
                    }
                    style={{ paddingLeft: "2.5rem" }}
                    value={parsePhoneNumber(formData.phone).localNumber}
                    onChange={handleLocalPhoneChange}
                  />
                </div>
              </div>
              {fieldErrors.phone && (
                <span className="error-text" style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  ⚠️ {fieldErrors.phone}
                </span>
              )}
            </div>

            <div className="form-group">
              <label>{t.pabx}</label>
              <div style={{ position: "relative" }}>
                <Phone size={18} className="input-icon" />
                <input type="text" name="pabx" placeholder={t.placeholderPabx} value={formData.pabx} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label>{t.unit} <span>*</span></label>
              <div style={{ position: "relative" }}>
                <Building size={18} className="input-icon" />
                <select name="unit" value={formData.unit} onChange={handleChange} required>
                  <option value="">{t.selectUnit}</option>
                  {unitOptions.map((unitName, idx) => (
                    <option key={idx} value={unitName}>{unitName}</option>
                  ))}
                  {formData.unit && !unitOptions.includes(formData.unit) && (
                    <option value={formData.unit}>{formData.unit}</option>
                  )}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t.department}</label>
              <div style={{ position: "relative" }}>
                <Briefcase size={18} className="input-icon" />
                <select name="department" value={formData.department} onChange={handleChange}>
                  <option value="">{t.selectDept}</option>
                  {departmentOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t.location} <span>*</span></label>
              <div style={{ position: "relative" }}>
                <MapPin size={18} className="input-icon" />
                <input
                  type="text"
                  name="location"
                  placeholder={t.placeholderLocation}
                  value={formData.location}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t.company}</label>
              <div style={{ position: "relative" }}>
                <Building size={18} className="input-icon" />
                <input
                  type="text"
                  name="company_name"
                  placeholder={t.placeholderCompany}
                  value={formData.company_name}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>{t.idType}</label>
              <div style={{ position: "relative" }}>
                <ClipboardList size={18} className="input-icon" />
                <select name="typeOfIDProof" value={formData.typeOfIDProof} onChange={handleChange}>
                  <option value="">{t.selectId}</option>
                  <option value="Aadhar Card">{t.aadhar}</option>
                  <option value="PAN Card">{t.pan}</option>
                  <option value="Driving License">{t.dl}</option>
                  <option value="Passport">{t.passport}</option>
                  <option value="Company ID">{t.companyID}</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t.idNumber}</label>
              <div style={{ position: "relative" }}>
                <Hash size={18} className="input-icon" />
                <input
                  type="text"
                  name="idProofNumber"
                  placeholder={t.placeholderId}
                  className={fieldErrors.idProofNumber ? "invalid-input" : ""}
                  value={formData.idProofNumber}
                  onChange={handleChange}
                  disabled={!formData.typeOfIDProof}
                />
                {fieldErrors.idProofNumber && <span className="error-text">{fieldErrors.idProofNumber}</span>}
              </div>
            </div>

            <div className="form-group">
              <label>{t.vehicleType}</label>
              <div style={{ position: "relative" }}>
                <Building size={18} className="input-icon" />
                <select name="vehicleType" value={formData.vehicleType} onChange={handleChange}>
                  <option value="">{t.selectVehicleType}</option>
                  <option value="four wheeler">{t.fourWheeler}</option>
                  <option value="two wheeler">{t.twoWheeler}</option>
                  <option value="three wheeler">{t.threeWheeler}</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>{t.vehicleNumber} {formData.vehicleType && <span>*</span>}</label>
              <div style={{ position: "relative" }}>
                <Hash size={18} className="input-icon" />
                <input
                  type="text"
                  name="vehicleNumber"
                  placeholder={t.placeholderVehicleNumber}
                  className={fieldErrors.vehicleNumber ? "invalid-input" : ""}
                  value={formData.vehicleNumber}
                  onChange={handleChange}
                  disabled={!formData.vehicleType}
                  required={!!formData.vehicleType}
                />
                {fieldErrors.vehicleNumber && <span className="error-text">{fieldErrors.vehicleNumber}</span>}
              </div>
            </div>

            {formData.vehicleType && (
              <>
                {/* Vehicle Photo (Front View) */}
                <div className="form-group">
                  <label>{t.vehiclePhotoFront} <span>*</span></label>
                  <div style={{ position: "relative" }}>
                    <div className="photo-input-container">
                      <button
                        type="button"
                        className="btn-open-camera"
                        onClick={() => openCameraModal("front")}
                      >
                        <Camera size={16} />
                        <span>{language === "Hindi" ? "फोटो खींचें" : language === "Marathi" ? "फोटो घ्या" : "Take Photo"}</span>
                      </button>
                    </div>
                    {(vehiclePhotoFrontPreview || (formData.vehiclePhotoFront && typeof formData.vehiclePhotoFront === 'string')) && (
                      <div className="vehicle-photo-preview-container">
                        <img 
                          src={vehiclePhotoFrontPreview || `/${formData.vehiclePhotoFront}`} 
                          alt="Front View Preview" 
                          className="vehicle-photo-preview"
                          onClick={() => window.open(vehiclePhotoFrontPreview || `/${formData.vehiclePhotoFront}`, "_blank")}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Vehicle Photo (Side View) */}
                <div className="form-group">
                  <label>{t.vehiclePhotoSide} <span>*</span></label>
                  <div style={{ position: "relative" }}>
                    <div className="photo-input-container">
                      <button
                        type="button"
                        className="btn-open-camera"
                        onClick={() => openCameraModal("side")}
                      >
                        <Camera size={16} />
                        <span>{language === "Hindi" ? "फोटो खींचें" : language === "Marathi" ? "फोटो घ्या" : "Take Photo"}</span>
                      </button>
                    </div>
                    {(vehiclePhotoSidePreview || (formData.vehiclePhotoSide && typeof formData.vehiclePhotoSide === 'string')) && (
                      <div className="vehicle-photo-preview-container">
                        <img 
                          src={vehiclePhotoSidePreview || `/${formData.vehiclePhotoSide}`} 
                          alt="Side View Preview" 
                          className="vehicle-photo-preview"
                          onClick={() => window.open(vehiclePhotoSidePreview || `/${formData.vehiclePhotoSide}`, "_blank")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="form-group full-width">
              <label>{t.reason} <span>*</span></label>
              <div style={{ position: "relative" }}>
                <ClipboardList size={18} className="input-icon" />
                <select name="reasonOfVisit" required value={formData.reasonOfVisit} onChange={handleChange}>
                  <option value="">{t.selectReason}</option>
                  {reasonOptions.map((reasonName, idx) => (
                    <option key={idx} value={reasonName}>{reasonName}</option>
                  ))}
                  {formData.reasonOfVisit && !reasonOptions.includes(formData.reasonOfVisit) && (
                    <option value={formData.reasonOfVisit}>{formData.reasonOfVisit}</option>
                  )}
                </select>
              </div>
            </div>



            <div className="form-group full-width">
              <label>{t.hasDevice} <span>*</span></label>
              <div style={{ position: "relative" }}>
                <Laptop size={18} className="input-icon" />
                <select
                  name="hasDevice"
                  required
                  value={formData.hasDevice}
                  onChange={(e) => {
                    handleChange(e);
                    if (e.target.value === "Yes" && devices.length === 0) {
                      setDevices([{ deviceType: "", deviceMake: "", deviceSerialNumber: "" }]);
                    }
                  }}
                >
                  <option value="No">{t.no}</option>
                  <option value="Yes">{t.yes}</option>
                </select>
              </div>
            </div>

            {formData.hasDevice === "Yes" && (
              <div className="form-group full-width" style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <label style={{ fontSize: "14px", fontWeight: 700, color: "var(--foreground, #1e293b)", margin: 0 }}>
                    Accompanying Devices ({devices.length}) <span>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={addDeviceRow}
                    style={{
                      background: "rgba(37, 99, 235, 0.15)",
                      color: "#2563eb",
                      border: "1px solid rgba(37, 99, 235, 0.3)",
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
                      {devices.length > 1 && (
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
                      <div className="form-group">
                        <label style={{ fontSize: "12px" }}>{t.deviceType} <span>*</span></label>
                        <div style={{ position: "relative" }}>
                          <Laptop size={18} className="input-icon" />
                          <input
                            type="text"
                            required
                            placeholder={t.placeholderDeviceType}
                            value={device.deviceType}
                            onChange={(e) => handleDeviceChange(idx, "deviceType", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: "12px" }}>{t.deviceMake} <span>*</span></label>
                        <div style={{ position: "relative" }}>
                          <Laptop size={18} className="input-icon" />
                          <input
                            type="text"
                            required
                            placeholder={t.placeholderDeviceMake}
                            value={device.deviceMake}
                            onChange={(e) => handleDeviceChange(idx, "deviceMake", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-group full-width">
                        <label style={{ fontSize: "12px" }}>{t.serial} <span>*</span></label>
                        <div style={{ position: "relative" }}>
                          <Hash size={18} className="input-icon" />
                          <input
                            type="text"
                            required
                            placeholder={t.placeholderSerial}
                            value={device.deviceSerialNumber}
                            onChange={(e) => handleDeviceChange(idx, "deviceSerialNumber", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
          <button type="submit" className="reg-submit-btn">
            <Save size={18} style={{ marginRight: 8 }} />
            {t.submit}
          </button>
        </form>
      </div>

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        title={cameraTarget === "front" ? t.vehiclePhotoFront : t.vehiclePhotoSide}
      />

    </div>
  );
}
