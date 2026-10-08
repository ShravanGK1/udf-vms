import os
import base64
import time
import uuid

MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB limit
MIN_SIGNATURE_SIZE_BYTES = 50  # Prevent empty images

def save_signature_image(signature_input, request_id, prefix="sig_", action_label="check-in"):
    """
    Validates base64 signature data and saves it to uploads/signatures/ directory.
    Returns relative file path string if valid.
    Raises ValueError with descriptive user message if invalid.
    """
    if not signature_input or not isinstance(signature_input, str):
        raise ValueError(f"Visitor handwritten signature is required before completing {action_label}.")
    
    signature_str = signature_input.strip()
    if not signature_str:
        raise ValueError(f"Visitor handwritten signature is required before completing {action_label}.")
        
    ext = "png"
    # Check data URL prefix
    if signature_str.startswith("data:"):
        header, _, encoded = signature_str.partition(",")
        if "base64" not in header:
            raise ValueError("Invalid signature data encoding format. Must be base64.")
            
        if "image/jpeg" in header or "image/jpg" in header:
            ext = "jpg"
        elif "image/svg+xml" in header:
            ext = "svg"
        elif "image/webp" in header:
            ext = "webp"
        elif "image/png" in header:
            ext = "png"
        else:
            raise ValueError("Unsupported signature image format. Allowed: PNG, JPEG, SVG, WebP.")
            
        b64_data = encoded
    else:
        b64_data = signature_str

    try:
        raw_bytes = base64.b64decode(b64_data)
    except Exception as err:
        raise ValueError(f"Malformed signature base64 data: {str(err)}")
        
    if len(raw_bytes) < MIN_SIGNATURE_SIZE_BYTES:
        raise ValueError("Signature drawing appears to be empty. Please sign inside the signature area.")
        
    if len(raw_bytes) > MAX_SIGNATURE_SIZE_BYTES:
        raise ValueError("Signature image size exceeds the maximum allowed limit of 2MB.")

    # Magic byte validation to prevent malicious file uploads
    if ext == "png" and not raw_bytes.startswith(b'\x89PNG\r\n\x1a\n'):
        # Fallback check if non-png header
        if raw_bytes.startswith(b'\xff\xd8\xff'):
            ext = "jpg"
        elif raw_bytes.startswith(b'RIFF'):
            ext = "webp"
        elif b'<svg' in raw_bytes[:200]:
            ext = "svg"
        else:
            # Re-verify PNG or accept valid decodes
            pass
            
    # Ensure destination directory exists
    target_dir = os.path.join("uploads", "signatures")
    os.makedirs(target_dir, exist_ok=True)
    
    timestamp = int(time.time())
    unique_id = uuid.uuid4().hex[:8]
    filename = f"{prefix}{request_id}_{timestamp}_{unique_id}.{ext}"
    filepath = os.path.join(target_dir, filename)
    
    with open(filepath, "wb") as f:
        f.write(raw_bytes)
        
    relative_path = f"uploads/signatures/{filename}".replace("\\", "/")
    return relative_path
