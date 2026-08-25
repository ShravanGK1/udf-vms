import React, { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { Camera, RotateCw, X, Check, RefreshCw } from "lucide-react";
import "./CameraModal.css";

export default function CameraModal({ isOpen, onClose, onCapture, title = "Capture Photo" }) {
  if (!isOpen) return null;

  const webcamRef = useRef(null);
  const [screenshot, setScreenshot] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // default to rear camera
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: facingMode
  };

  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setScreenshot(imageSrc);
    }
  }, [webcamRef]);

  const handleRetake = () => {
    setScreenshot(null);
  };

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleUsePhoto = () => {
    if (screenshot) {
      const timestamp = new Date().getTime();
      const file = dataURLtoFile(screenshot, `camera_capture_${timestamp}.jpg`);
      onCapture(file);
      onClose();
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const handleUserMediaError = (error) => {
    console.error("Camera error:", error);
    setHasError(true);
    setErrorMessage("Unable to access the camera. Please ensure camera permissions are granted.");
  };

  return (
    <div className="camera-modal-overlay">
      <div className="camera-modal-wrapper">
        
        {/* Header */}
        <div className="camera-modal-header">
          <h3>{title}</h3>
          <button type="button" className="camera-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="camera-modal-viewport">
          {hasError ? (
            <div className="camera-error-container">
              <p className="camera-error-message">{errorMessage}</p>
              <button 
                type="button" 
                className="btn-retry" 
                onClick={() => {
                  setHasError(false);
                  setScreenshot(null);
                }}
              >
                Retry
              </button>
            </div>
          ) : screenshot ? (
            <img src={screenshot} alt="Captured preview" className="captured-preview-img" />
          ) : (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMediaError={handleUserMediaError}
              className="webcam-stream"
            />
          )}
        </div>

        {/* Footer controls */}
        <div className="camera-modal-footer">
          {screenshot ? (
            <div className="capture-controls-done">
              <button type="button" className="btn-camera-retake" onClick={handleRetake}>
                <RefreshCw size={16} /> Retake
              </button>
              <button type="button" className="btn-camera-use" onClick={handleUsePhoto}>
                <Check size={16} /> Use Photo
              </button>
            </div>
          ) : (
            <div className="capture-controls-active">
              {!hasError && (
                <>
                  <button type="button" className="btn-camera-switch" onClick={switchCamera} title="Switch Front/Rear Camera">
                    <RotateCw size={18} /> Switch Camera
                  </button>
                  <button type="button" className="btn-camera-shutter" onClick={handleCapture} title="Capture Image">
                    <div className="shutter-inner">
                      <Camera size={24} />
                    </div>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
