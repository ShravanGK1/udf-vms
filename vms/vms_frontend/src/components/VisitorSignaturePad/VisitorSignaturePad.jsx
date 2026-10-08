import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Edit3, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';

const VisitorSignaturePad = ({
  onSignatureChange,
  required = true,
  disabled = false,
  height = 220,
  className = '',
  mode = 'check-in',
  label = null,
  requiredText = null
}) => {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef([]);
  
  const [isEmpty, setIsEmpty] = useState(true);
  const [activePointerType, setActivePointerType] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Setup High-DPI canvas context
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    redrawCanvas();
  }, [height]);

  // Redraw all stored strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    const rect = container.getBoundingClientRect();

    // Clear context
    ctx.clearRect(0, 0, rect.width, height);

    // Draw grid / signature baseline
    const baselineY = height - 40;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.moveTo(30, baselineY);
    ctx.lineTo(rect.width - 30, baselineY);
    ctx.stroke();
    ctx.restore();

    // Baseline "X" sign indicator
    ctx.save();
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('X', 32, baselineY - 8);
    ctx.restore();

    // Render strokes
    const allStrokes = strokesRef.current;
    if (allStrokes.length === 0 && currentStrokeRef.current.length === 0) {
      setIsEmpty(true);
      return;
    }

    setIsEmpty(false);

    ctx.strokeStyle = '#0f172a'; // Deep crisp ink color

    const drawStrokePoints = (points) => {
      if (points.length < 2) {
        if (points.length === 1) {
          const pt = points[0];
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (pt.width || 2.5) / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#0f172a';
          ctx.fill();
        }
        return;
      }

      for (let i = 0; i < points.length - 1; i++) {
        const pt1 = points[i];
        const pt2 = points[i + 1];

        const midX = (pt1.x + pt2.x) / 2;
        const midY = (pt1.y + pt2.y) / 2;

        ctx.beginPath();
        ctx.lineWidth = pt1.width || 2.5;

        if (i === 0) {
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(midX, midY);
        } else {
          const prevMidX = (points[i - 1].x + pt1.x) / 2;
          const prevMidY = (points[i - 1].y + pt1.y) / 2;
          ctx.moveTo(prevMidX, prevMidY);
          ctx.quadraticCurveTo(pt1.x, pt1.y, midX, midY);
        }
        ctx.stroke();
      }
    };

    allStrokes.forEach(drawStrokePoints);
    if (currentStrokeRef.current.length > 0) {
      drawStrokePoints(currentStrokeRef.current);
    }
  }, [height]);

  // Resize listener
  useEffect(() => {
    setupCanvas();
    const handleResize = () => {
      setupCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  // Export current canvas data URL
  const exportSignature = useCallback(() => {
    if (strokesRef.current.length === 0) {
      if (onSignatureChange) onSignatureChange(null);
      return null;
    }

    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Create export canvas to omit dashed baseline and output clean signature with transparent background
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    expCtx.scale(dpr, dpr);
    expCtx.lineCap = 'round';
    expCtx.lineJoin = 'round';
    expCtx.strokeStyle = '#0f172a';

    strokesRef.current.forEach((points) => {
      if (points.length < 2) {
        if (points.length === 1) {
          const pt = points[0];
          expCtx.beginPath();
          expCtx.arc(pt.x, pt.y, (pt.width || 2.5) / 2, 0, Math.PI * 2);
          expCtx.fillStyle = '#0f172a';
          expCtx.fill();
        }
        return;
      }

      for (let i = 0; i < points.length - 1; i++) {
        const pt1 = points[i];
        const pt2 = points[i + 1];
        const midX = (pt1.x + pt2.x) / 2;
        const midY = (pt1.y + pt2.y) / 2;

        expCtx.beginPath();
        expCtx.lineWidth = pt1.width || 2.5;

        if (i === 0) {
          expCtx.moveTo(pt1.x, pt1.y);
          expCtx.lineTo(midX, midY);
        } else {
          const prevMidX = (points[i - 1].x + pt1.x) / 2;
          const prevMidY = (points[i - 1].y + pt1.y) / 2;
          expCtx.moveTo(prevMidX, prevMidY);
          expCtx.quadraticCurveTo(pt1.x, pt1.y, midX, midY);
        }
        expCtx.stroke();
      }
    });

    const dataUrl = exportCanvas.toDataURL('image/png');
    if (onSignatureChange) {
      onSignatureChange(dataUrl);
    }
    return dataUrl;
  }, [onSignatureChange]);

  // Pointer Event Handlers
  const handlePointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture pointer to track outside canvas bounds smoothly
    canvas.setPointerCapture(e.pointerId);

    isDrawingRef.current = true;
    setActivePointerType(e.pointerType || 'pen');
    setValidationError('');

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate dynamic stroke width based on pressure if hardware supports it
    let width = 2.5;
    if (e.pressure && e.pressure > 0) {
      width = Math.max(1.2, Math.min(4.5, e.pressure * 5.0));
    }

    const point = { x, y, width };
    lastPointRef.current = point;
    currentStrokeRef.current = [point];

    redrawCanvas();
  };

  const handlePointerMove = (e) => {
    if (!isDrawingRef.current || disabled) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let width = 2.5;
    if (e.pressure && e.pressure > 0) {
      width = Math.max(1.2, Math.min(4.5, e.pressure * 5.0));
    } else if (lastPointRef.current) {
      // Smooth width transition
      width = lastPointRef.current.width;
    }

    const point = { x, y, width };
    currentStrokeRef.current.push(point);
    lastPointRef.current = point;

    redrawCanvas();
  };

  const handlePointerUp = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Safe fallback
      }
    }

    isDrawingRef.current = false;
    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current]);
      currentStrokeRef.current = [];
    }

    redrawCanvas();
    exportSignature();
  };

  const handlePointerCancel = (e) => {
    handlePointerUp(e);
  };

  const clearCanvas = () => {
    strokesRef.current = [];
    currentStrokeRef.current = [];
    isDrawingRef.current = false;
    lastPointRef.current = null;
    setIsEmpty(true);
    setValidationError('');
    redrawCanvas();
    if (onSignatureChange) {
      onSignatureChange(null);
    }
  };

  return (
    <div className={`visitor-signature-container ${className}`} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
            <Edit3 size={16} className="text-blue-600" style={{ color: '#2563eb' }} />
            Visitor Signature <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            Please sign inside the box below using your digital stylus pen.
          </p>
        </div>

        {activePointerType && (
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: '12px',
            background: activePointerType === 'pen' ? '#dbeafe' : '#f1f5f9',
            color: activePointerType === 'pen' ? '#1d4ed8' : '#475569',
            border: '1px solid #cbd5e1'
          }}>
            Input: {activePointerType === 'pen' ? '🖊️ Stylus Pen' : activePointerType === 'touch' ? '👆 Touch' : '🖱️ Pointer'}
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          borderRadius: '12px',
          border: validationError ? '2px solid #ef4444' : isEmpty ? '1.5px dashed #94a3b8' : '1.5px solid #2563eb',
          background: disabled ? '#f8fafc' : '#ffffff',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerCancel}
          style={{
            touchAction: 'none', // Critical: disables page scroll while signing with stylus/finger
            cursor: disabled ? 'not-allowed' : 'crosshair',
            display: 'block',
            width: '100%',
            height: `${height}px`
          }}
        />

        {isEmpty && !disabled && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            textAlign: 'center',
            opacity: 0.45,
            color: '#64748b'
          }}>
            <Edit3 size={32} style={{ margin: '0 auto 6px auto', display: 'block', color: '#94a3b8' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>SIGN HERE USING STYLUS</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <div style={{ fontSize: '12px' }}>
          {isEmpty ? (
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={13} style={{ color: '#f59e0b' }} />{' '}
              {requiredText || (mode === 'checkout' ? 'Signature required to confirm permanent checkout.' : 'Signature required before check-in.')}
            </span>
          ) : (
            <span style={{ color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Signature captured.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={clearCanvas}
          disabled={disabled || isEmpty}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '5px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: isEmpty ? '#f8fafc' : '#ffffff',
            color: isEmpty ? '#94a3b8' : '#475569',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isEmpty || disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <RotateCcw size={13} />
          Clear Signature
        </button>
      </div>

      {validationError && (
        <div style={{ marginTop: '6px', color: '#ef4444', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={14} />
          {validationError}
        </div>
      )}
    </div>
  );
};

export default VisitorSignaturePad;
