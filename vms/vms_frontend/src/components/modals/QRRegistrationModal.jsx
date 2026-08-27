import React from 'react';
import { X, Copy, ExternalLink } from "lucide-react";
import "./QRRegistrationModal.css";

const QRRegistrationModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const registrationUrl = `https://amusable-eclair-squash.ngrok-free.dev/visitor/register`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(registrationUrl);
    alert("Link copied!");
  };

  const handleOpenForm = () => {
    window.open("/visitor/register", "_blank");
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content-wrapper qr-modal-custom">
        <div className="qr-modal-header">
          <div style={{ flex: 1 }}></div>
          <button className="close-modal-btn-qr" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="qr-modal-body">
          <h2 className="qr-modal-title">Visitor Registration QR</h2>
          <p className="qr-modal-subtitle">Scan this QR code or use the link below to register a new visitor.</p>

          <div className="qr-code-box">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(registrationUrl)}`}
              alt="Visitor Registration QR Code"
              className="qr-image"
            />
          </div>

          <div className="qr-link-container">
            <input type="text" readOnly value={registrationUrl} className="qr-link-input" />
            <button className="qr-copy-btn" onClick={handleCopyLink}>
              <Copy size={16} />
            </button>
          </div>

          <button className="qr-open-btn" onClick={handleOpenForm}>
            <ExternalLink size={16} /> Open Form
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRRegistrationModal;
