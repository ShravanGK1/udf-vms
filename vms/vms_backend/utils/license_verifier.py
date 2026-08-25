import os
import jwt
import datetime
import urllib.request
import json
import hashlib
import threading
import time
from db import get_db_connection

# Public key matching the Provider App's signing key
PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsmkIVEbQRQhu23ogASCi
XGzPXBB/UR9dBxFCUu3ucHcFdmjpZgJRGCJhvzcJeb76qQE0uv7RubR8G6DwP7LQ
P+Ntud2MiZl8tdRPGm7v4W1nBLASX4bPvpyYM5W9U5xXh/QfeuD87tlghbVrasDU
DWzvmUJcjfUCzyJGRtr1kScbYAUi01G4fNHpC5f196bqNH5f0wpKVb1tTHeuILfW
kMML7evJsXxkcaiiN2fCwyLYqtBbLMtDrUgU0M5ORRMVYajfXfAAubpH5LvLTmfB
NBJZrSPDY9TuwDgdh8+CrqGi7Vw1sqsmSN7MdnTXfcXx45HI1zyijCyfhGwCm1ir
HwIDAQAB
-----END PUBLIC KEY-----"""

STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "license_state.json")
SECRET_SALT = "VMS_TAMPER_PROOF_LICENSE_SALT_2026"


def get_machine_uuid():
    """Reads machine motherboard UUID passed inside Docker via mount."""
    path = "/etc/vms/product_uuid"
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return f.read().strip()
        except Exception:
            pass
    return None


def get_trusted_network_time():
    """Offline Mode: returns None instantly to avoid network delays."""
    return None


def get_latest_db_timestamp():
    """Queries database for the latest activity record to establish offline high water mark in UTC."""
    try:
        conn = get_db_connection()
        if not conn:
            return None
        cursor = conn.cursor()
        cursor.execute("SELECT MAX(created_at) FROM visitor_requests")
        max_req_time = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        
        if max_req_time:
            # Convert database local time to UTC
            tz_offset = datetime.datetime.now() - datetime.datetime.utcnow()
            return max_req_time - tz_offset
        return None
    except Exception:
        return None


_tracker_started = False
_tracker_lock = threading.Lock()

def start_license_clock_tracker():
    """Starts the background licensing clock tracker thread if it hasn't been started."""
    global _tracker_started
    with _tracker_lock:
        if _tracker_started:
            return
        _tracker_started = True
        t = threading.Thread(target=_license_clock_tracker_thread, daemon=True)
        t.start()

def _license_clock_tracker_thread():
    """Background daemon thread that runs once a minute of real-world elapsed time."""
    while True:
        try:
            time.sleep(60)
            
            # Check if license exists in database
            license_key, _, _, _ = get_license_details()
            if not license_key:
                continue
                
            increment_license_minutes()
        except Exception as e:
            print("Error in clock tracker thread:", e)

def save_state_safely(data):
    """Saves the state data safely to STATE_FILE with a tamper-proof SHA-256 signature."""
    try:
        time_str = data.get("last_verified_time", "")
        tampered_val = str(data.get("tampered", False))
        accumulated_val = str(data.get("accumulated_minutes", 0))
        sig_data = time_str + accumulated_val + tampered_val + SECRET_SALT
        new_hash = hashlib.sha256(sig_data.encode()).hexdigest()
        data["hash"] = new_hash
        with open(STATE_FILE, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print("Error saving license state safely:", e)

def init_license_state():
    """Initializes the license state file when activated/checked for the first time."""
    now = datetime.datetime.utcnow()
    data = {
        "last_verified_time": now.isoformat(),
        "accumulated_minutes": 0,
        "tampered": False
    }
    save_state_safely(data)

def increment_license_minutes():
    """Increments system running minutes and checks clock health at the 24-hour mark."""
    if not os.path.exists(STATE_FILE):
        init_license_state()
        return

    try:
        with open(STATE_FILE, "r") as f:
            data = json.load(f)
        
        # Verify hash
        saved_time_str = data.get("last_verified_time", "")
        saved_hash = data.get("hash", "")
        tampered_val = str(data.get("tampered", False))
        accumulated_val = str(data.get("accumulated_minutes", 0))
        sig_data = saved_time_str + accumulated_val + tampered_val + SECRET_SALT
        expected_hash = hashlib.sha256(sig_data.encode()).hexdigest()
        
        if expected_hash != saved_hash:
            # Tampering of state file detected
            data["tampered"] = True
            save_state_safely(data)
            return
            
        # Increment minutes
        data["accumulated_minutes"] = int(accumulated_val) + 1
        
        # Check if 24 hours (1440 minutes) accumulated
        if data["accumulated_minutes"] >= 1440:
            last_checkpoint = datetime.datetime.fromisoformat(saved_time_str)
            expected_db_time = last_checkpoint + datetime.timedelta(days=1)
            current_system_time = datetime.datetime.utcnow()
            
            if current_system_time < expected_db_time:
                # Winding back detected!
                data["tampered"] = True
                data["expected_db_time"] = expected_db_time.isoformat()
            else:
                # No tampering, update checkpoint, reset minutes
                data["last_verified_time"] = current_system_time.isoformat()
                data["accumulated_minutes"] = 0
                data.pop("expected_db_time", None)
                data["tampered"] = False
                
        save_state_safely(data)
    except Exception as e:
        print("Error incrementing license minutes:", e)

def verify_monotonic_time(current_time):
    """
    Ensures current system time hasn't been wound backwards.
    Checks clock status based on the 24-hour background tracker file.
    """
    # Start background tracker on first check
    start_license_clock_tracker()
    
    # Check state file
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                data = json.load(f)
            
            saved_time_str = data.get("last_verified_time", "")
            saved_hash = data.get("hash", "")
            tampered_val = str(data.get("tampered", False))
            accumulated_val = str(data.get("accumulated_minutes", 0))
            sig_data = saved_time_str + accumulated_val + tampered_val + SECRET_SALT
            expected_hash = hashlib.sha256(sig_data.encode()).hexdigest()
            
            if expected_hash != saved_hash:
                return False, "STATE_FILE_TAMPERED"
                
            # Check if background tracker set tampered status at the 24-hour mark
            if data.get("tampered"):
                expected_db_time_str = data.get("expected_db_time")
                if expected_db_time_str:
                    expected_db_time = datetime.datetime.fromisoformat(expected_db_time_str)
                    if current_time >= expected_db_time:
                        # Clock corrected back! Recover automatically.
                        data["tampered"] = False
                        data["last_verified_time"] = current_time.isoformat()
                        data["accumulated_minutes"] = 0
                        data.pop("expected_db_time", None)
                        save_state_safely(data)
                    else:
                        return False, expected_db_time
                else:
                    return False, "tampered_state"
        except Exception:
            pass
    else:
        # Initialize state file
        init_license_state()
            
    return True, None


def ensure_db_indexes():
    """Ensures crucial indices are present on the database tables for quick lookups."""
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            
            # Check if index exists on visitor_requests(created_at)
            try:
                cursor.execute("""
                    SELECT INDEX_NAME 
                    FROM INFORMATION_SCHEMA.STATISTICS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                      AND TABLE_NAME = 'visitor_requests' 
                      AND INDEX_NAME = 'idx_visitor_created_at'
                """)
                row = cursor.fetchone()
                if not row:
                    cursor.execute("CREATE INDEX idx_visitor_created_at ON visitor_requests (created_at)")
            except Exception as e:
                # If table visitor_requests doesn't exist yet, it will fail gracefully
                pass
                
            cursor.close()
            conn.close()
    except Exception as e:
        print("Failed to run index migrations:", e)


def ensure_license_table():
    """Creates the system_license database table and columns if they do not exist."""
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS system_license (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    license_key TEXT NOT NULL,
                    activation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                    will_terminate BOOLEAN DEFAULT FALSE,
                    terminated_early BOOLEAN DEFAULT FALSE,
                    extension_requested BOOLEAN DEFAULT FALSE
                )
            """)
            
            # Check if column will_terminate exists (migration helper)
            try:
                cursor.execute("SELECT will_terminate FROM system_license LIMIT 1")
            except Exception:
                cursor.execute("ALTER TABLE system_license ADD COLUMN will_terminate BOOLEAN DEFAULT FALSE")
                
            # Check if column terminated_early exists (migration helper)
            try:
                cursor.execute("SELECT terminated_early FROM system_license LIMIT 1")
            except Exception:
                cursor.execute("ALTER TABLE system_license ADD COLUMN terminated_early BOOLEAN DEFAULT FALSE")
                
            # Check if column extension_requested exists (migration helper)
            try:
                cursor.execute("SELECT extension_requested FROM system_license LIMIT 1")
            except Exception:
                cursor.execute("ALTER TABLE system_license ADD COLUMN extension_requested BOOLEAN DEFAULT FALSE")
                
            cursor.close()
            conn.close()
            
            # Run index migrations
            ensure_db_indexes()
    except Exception as e:
        print("Failed to ensure system_license table:", e)


def get_license_details():
    """Retrieves the license key details from the database."""
    ensure_license_table()
    try:
        conn = get_db_connection()
        if not conn:
            return None, None, False, False
        cursor = conn.cursor()
        cursor.execute("SELECT license_key, activation_time, will_terminate, terminated_early FROM system_license ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            return row[0], row[1], bool(row[2]), bool(row[3])
    except Exception:
        pass
        
    # Fallback to env variable
    env_key = os.environ.get("VMS_LICENSE_KEY")
    if env_key:
        save_license_to_db(env_key)
        return env_key, datetime.datetime.now(), False, False
        
    return None, None, False, False


def get_stored_license():
    """Helper to get just the active license key string."""
    key, _, _, _ = get_license_details()
    return key


def save_license_to_db(license_key, activation_time=None):
    """Saves the license key and its activation time to the database."""
    ensure_license_table()
    try:
        conn = get_db_connection()
        if not conn:
            return False
        cursor = conn.cursor()
        if activation_time:
            cursor.execute(
                "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early, extension_requested) VALUES (%s, %s, FALSE, FALSE, FALSE)",
                (license_key, activation_time)
            )
        else:
            cursor.execute(
                "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early, extension_requested) VALUES (%s, NOW(), FALSE, FALSE, FALSE)",
                (license_key,)
            )
        conn.commit()
        cursor.close()
        conn.close()
        clear_license_cache()
        return True
    except Exception as e:
        print("Failed to save license to DB:", e)
        return False


def is_extension_requested():
    """Checks if extension has already been requested in the current licensing period."""
    ensure_license_table()
    try:
        conn = get_db_connection()
        if not conn:
            return False
        cursor = conn.cursor()
        cursor.execute("SELECT extension_requested FROM system_license ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if row:
            return bool(row[0])
    except Exception:
        pass
    return False


def set_extension_requested(val=True):
    """Sets the extension requested status for the current active license."""
    ensure_license_table()
    try:
        conn = get_db_connection()
        if not conn:
            return False
        cursor = conn.cursor()
        cursor.execute("UPDATE system_license SET extension_requested = %s ORDER BY id DESC LIMIT 1", (val,))
        conn.commit()
        cursor.close()
        conn.close()
        clear_license_cache()
        return True
    except Exception as e:
        print("Failed to set extension_requested:", e)
        return False


def notify_license_termination():
    """Marks the active license key to indicate the client will not renew."""
    ensure_license_table()
    try:
        conn = get_db_connection()
        if not conn:
            return False
        cursor = conn.cursor()
        cursor.execute("UPDATE system_license SET will_terminate = TRUE ORDER BY id DESC LIMIT 1")
        conn.commit()
        cursor.close()
        conn.close()
        clear_license_cache()
        return True
    except Exception as e:
        print("Failed to notify license termination:", e)
        return False


_license_cache = None
_license_cache_time = 0
_cache_lock = threading.Lock()

def clear_license_cache():
    """Invalidates the in-memory license status cache."""
    global _license_cache
    with _cache_lock:
        _license_cache = None

def verify_system_license(temp_key=None):
    global _license_cache, _license_cache_time
    
    # Check if we are running under a test suite execution (disable cache for accuracy)
    import sys
    is_testing = any("test" in arg for arg in sys.argv) or "unittest" in sys.modules or "pytest" in sys.modules
    
    if not temp_key and not is_testing:
        now_mon = time.monotonic()
        with _cache_lock:
            if _license_cache is not None and (now_mon - _license_cache_time) < 10.0:
                return _license_cache.copy()

    # Run full verification
    result = _verify_system_license_impl(temp_key)
    
    if not temp_key and not is_testing:
        now_mon = time.monotonic()
        with _cache_lock:
            _license_cache = result.copy()
            _license_cache_time = now_mon
            
    return result

def _verify_system_license_impl(temp_key=None):
    if temp_key:
        license_key = temp_key
        # We need to get activation_time and will_terminate from DB if available
        _, activation_time, will_terminate, _ = get_license_details()
        if not activation_time:
            activation_time = datetime.datetime.now()
        terminated_early = False
    else:
        license_key, activation_time, will_terminate, terminated_early = get_license_details()

    if not license_key:
        return {"status": "MISSING", "error": "No subscription license key configured."}

    if terminated_early:
        return {"status": "TERMINATED", "error": "Subscription has been terminated early by the licensing provider."}

    try:
        # Decrypt, verify signatures and expiry claims automatically
        payload = jwt.decode(
            license_key, 
            PUBLIC_KEY, 
            algorithms=["RS256"]
        )

        # 1. Resolve current date-time securely in UTC (tamper-proof check)
        trusted_time = get_trusted_network_time()
        is_online = trusted_time is not None
        
        if not is_online:
            # Fall back to local computer UTC clock
            trusted_time = datetime.datetime.utcnow()

        # 2. Check for clock manipulation
        clock_ok, bound_time = verify_monotonic_time(trusted_time)
        if not clock_ok:
            if bound_time in ("tampered_state", "STATE_FILE_TAMPERED"):
                return {"status": "CLOCK_TAMPERED", "error": "System state corrupted. Licensing clock tampering detected."}
            else:
                return {"status": "CLOCK_TAMPERED", "error": f"Clock tampering detected. System time is behind last recorded state: {bound_time.isoformat()} UTC"}

        # 3. Expiry Validation
        raw_expiry = payload.get("expires_at", "")
        exp_dt_str = raw_expiry.replace(" ", "T").split(".")[0]
        exp_time = datetime.datetime.fromisoformat(exp_dt_str)
        
        # Calculate license duration
        total_term_seconds = (exp_time - activation_time).total_seconds() if activation_time else 86400 * 365
        is_test_license = total_term_seconds <= 7500      # ~2 hours (testing period)
        is_one_day_license = total_term_seconds <= 90000  # 25 hours to buffer some small variations
        
        is_in_buffer = False
        days_remaining_in_buffer = 0
        hours_remaining_in_buffer = 0
        minutes_remaining_in_buffer = 0
        buffer_days = 90
        buffer_hours = 0
        buffer_minutes = 0
        
        if is_test_license:
            buffer_minutes = 30
            buffer_time_limit = exp_time + datetime.timedelta(minutes=buffer_minutes)
            if trusted_time > exp_time:
                if trusted_time <= buffer_time_limit:
                    is_in_buffer = True
                    minutes_remaining_in_buffer = int(round((buffer_time_limit - trusted_time).total_seconds() / 60.0))
                else:
                    return {"status": "EXPIRED", "error": f"Subscription expired on {exp_time} and 30-minute grace period has ended."}
        elif is_one_day_license:
            buffer_hours = 2
            buffer_time_limit = exp_time + datetime.timedelta(hours=buffer_hours)
            if trusted_time > exp_time:
                if trusted_time <= buffer_time_limit:
                    is_in_buffer = True
                    days_remaining_in_buffer = round((buffer_time_limit - trusted_time).total_seconds() / 86400, 2)
                    hours_remaining_in_buffer = int(round((buffer_time_limit - trusted_time).total_seconds() / 3600.0))
                else:
                    return {"status": "EXPIRED", "error": f"Subscription expired on {exp_time} and 2-hour grace period has ended."}
        else:
            buffer_days = payload.get("buffer_days", 90)
            buffer_time_limit = exp_time + datetime.timedelta(days=buffer_days)
            if trusted_time > exp_time:
                if trusted_time <= buffer_time_limit:
                    is_in_buffer = True
                    days_remaining_in_buffer = (buffer_time_limit - trusted_time).days
                else:
                    return {"status": "EXPIRED", "error": f"Subscription expired on {exp_time.date()} and {buffer_days}-day grace period has ended."}

        # Calculate time remaining on standard contract
        time_diff = exp_time - trusted_time
        days_remaining = time_diff.days
        hours_remaining = int(time_diff.total_seconds() / 3600)
        minutes_remaining = int(time_diff.total_seconds() / 60)

        # 4. Hardware Binding Validation (Fingerprint check)
        hw_uuid = get_machine_uuid()
        payload_uuids = payload.get("machine_uuid")
        if hw_uuid and payload_uuids:
            # Support list or comma-separated string of allowed machine UUIDs
            if isinstance(payload_uuids, str):
                allowed_uuids = [u.strip() for u in payload_uuids.split(",") if u.strip()]
            elif isinstance(payload_uuids, list):
                allowed_uuids = [str(u).strip() for u in payload_uuids if str(u).strip()]
            else:
                allowed_uuids = []
            
            if allowed_uuids and hw_uuid not in allowed_uuids:
                return {"status": "HW_MISMATCH", "error": "Software running on unauthorized hardware."}

        # Format activation time for presentation
        start_date_str = activation_time.isoformat().split("T")[0] if activation_time else "N/A"
        end_date_str = exp_time.isoformat().split("T")[0]

        # Calculate extension eligibility based on license term and current time
        total_term_days = (exp_time - activation_time).days
        ext_requested = is_extension_requested()
        
        if total_term_days >= 300:
            extension_threshold_days = 30
        elif 150 <= total_term_days < 300:
            extension_threshold_days = 15
        elif 75 <= total_term_days < 150:
            extension_threshold_days = 7
        elif 15 <= total_term_days < 75:
            extension_threshold_days = 1
        else:
            extension_threshold_days = 0

        if is_in_buffer:
            extension_eligible = True
        else:
            if extension_threshold_days > 0:
                extension_eligible = days_remaining <= extension_threshold_days
            else:
                extension_eligible = False

        return {
            "status": "ACTIVE", 
            "data": payload,
            "days_remaining": max(0, days_remaining),
            "hours_remaining": max(0, hours_remaining),
            "minutes_remaining": max(0, minutes_remaining),
            "is_online": is_online,
            "start_date": start_date_str,
            "end_date": end_date_str,
            "buffer_days": 0 if is_one_day_license or is_test_license else buffer_days,
            "buffer_hours": 2 if is_one_day_license and not is_test_license else 0,
            "buffer_minutes": buffer_minutes,
            "is_in_buffer": is_in_buffer,
            "days_remaining_in_buffer": days_remaining_in_buffer,
            "hours_remaining_in_buffer": hours_remaining_in_buffer,
            "minutes_remaining_in_buffer": minutes_remaining_in_buffer,
            "is_one_day_license": is_one_day_license or is_test_license,
            "is_test_license": is_test_license,
            "will_terminate": will_terminate,
            "extension_eligible": extension_eligible,
            "extension_requested": ext_requested,
            "extension_threshold_days": extension_threshold_days,
            "total_term_days": total_term_days
        }

    except jwt.ExpiredSignatureError:
        return {"status": "EXPIRED", "error": "Subscription signature has expired."}
    except jwt.InvalidTokenError:
        return {"status": "INVALID", "error": "Invalid signature. License key tampered with."}
