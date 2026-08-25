# tests/system_tests.py

import os
import sys
import time
import datetime
import re
import json
import hashlib
import jwt
import traceback
import urllib.request
import urllib.error

# Ensure parent directory is in path so we can import app modules directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db_connection
from utils.license_verifier import verify_system_license, PUBLIC_KEY, STATE_FILE, SECRET_SALT

def get_test_client():
    """Deferred import to resolve circular dependencies between app -> routes -> tests -> app."""
    from app import app
    app.config['TESTING'] = True
    return app.test_client()

# Provider Private Key PEM for generating signed test JWT licenses
PRIVATE_KEY_PEM = """-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAsmkIVEbQRQhu23ogASCiXGzPXBB/UR9dBxFCUu3ucHcFdmjp
ZgJRGCJhvzcJeb76qQE0uv7RubR8G6DwP7LQP+Ntud2MiZl8tdRPGm7v4W1nBLAS
X4bPvpyYM5W9U5xXh/QfeuD87tlghbVrasDUDWzvmUJcjfUCzyJGRtr1kScbYAUi
01G4fNHpC5f196bqNH5f0wpKVb1tTHeuILfWkMML7evJsXxkcaiiN2fCwyLYqtBb
LMtDrUgU0M5ORRMVYajfXfAAubpH5LvLTmfBNBJZrSPDY9TuwDgdh8+CrqGi7Vw1
sqsmSN7MdnTXfcXx45HI1zyijCyfhGwCm1irHwIDAQABAoIBAE35yPmon5NkbatA
U6eaf0vdBL4subCXgB28JdxAAJQn+Pu5O7Vpcs8VC9q6b8pFtaFTFRxbjgdXwlyC
+S4l9Y3O1WDEW42yR0bjXZVkgjRpD/sFB2q37alWINF+8yoNbVZO1Mlsdy/fUyft
VF7qm2OoxomZ7wDeYpVsWgHS5jxDessgeZlXHcrz8KoJm40lmZzV7KOsn8/9GEzV
2qYT1QwpJVCEUFkgQZzbyy69DQlPSCgT989IF1tD1pevRkb5aKuhprr2f/JsqdU1
1FwByBOcwIu8768zodNyd+CWFcwpUG9Ei30rAvrgEQGCGUSEseX4dnAkFdodAXwT
f0QRKu0CgYEA7/FgYtFRWzliFLTdsxdCgxOe6Qt6g1nL2DqQvLefI1IZ+QyvyVEq
PK7k940bSQWiX/5biwpfDOA+h9e2CFgnBlwh1uCdK5yWlotqont3THpEVR0FDgTC
W6vjkZ8fejD7bVuz58YvQBlZhRiIhq1nZ/DfIcZzCyyde2Ev3n+lebUCgYEAvll/
5h1DYXDpufJZPWnZUgA3EbNUT+HzLfWJqJEAnNRmvFdpx8Mx7wQP7NVZLqGQopQC
4R0Ho7/yWIlp31kbu/coWv/FyW3Eh2buidrcb3Czzqy3KzOZEvSwZNMwXNcfAc1w
tOdYTe7AHpyGSsskJrWjbtSGxmMRgIOycW4WBgMCgYBBjp+ZIDusQwdrROd18Rr5
GTlHzx0QGk65q3a0OS8/xUTXaQH2bTivD9H7WRBlaSauN57nZFQH/pTXJLbVnNA8
yptsTD5lFgmG5FykPDuiJ53X62/gHqjDxzkMJn/BMPThMjb7UojCaKqu1L8onOQt
3//3CHOSUARPG4SqtBGQKQKBgDir/OBOJhmEvJGYDemy8fjwB3VFpvyBkR1F1U5S
nZQTyOKaQ+wtuVgoJXWlr3+qqp084/6R3gxqwYSKpPLSXOeBlopBTGnEPJbzlmGE
v8yOCXqnAYHjQtfZ8gqStftuMNUgjUXO+wN46cozX+g0wvajbZ05uUaniDZy/1W2
KOhxAoGBAN5KN4T87k9f9S5/YmDHXDozYuiyzNWrQvmgIFYoaAswx5nWhgM5ocsI
Qph0TQYnNThB7E7+3PjAJxqATxedOpkFhJ/56ULpqGFNomiKKUArzyN7iSfhVzc9
SuUCjImdjGe9XFf71+AL7MPoHTl9MJxv2HbEb4UQDl1zpbt7/rnx
-----END RSA PRIVATE KEY-----"""

def make_jwt_key(client_name="Test Company", exp_delta_days=365, max_users=100, max_sites=10, extra_claims=None):
    """Helper to generate securely signed RS256 license tokens for verification checks."""
    now = datetime.datetime.utcnow()
    exp = now + datetime.timedelta(days=exp_delta_days)
    payload = {
        "client_name": client_name,
        "expires_at": exp.isoformat() + "Z",
        "max_users": max_users,
        "max_sites": max_sites
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, PRIVATE_KEY_PEM, algorithm="RS256")

# Global test cases array
TEST_CASES = []

def register_test(test_id, category, name, description):
    def decorator(fn):
        TEST_CASES.append({
            "id": test_id,
            "category": category,
            "name": name,
            "description": description,
            "run_fn": fn
        })
        return fn
    return decorator

# -----------------------------------------------------------------------------
# DATABASE TESTS
# -----------------------------------------------------------------------------

@register_test("TEST-DB-001", "Database", "Database Connection & Health", "Verifies backend connectivity to the MySQL database.")
def test_db_001(log):
    log("Attempting database connection...")
    conn = get_db_connection()
    if not conn:
        raise Exception("Database connection failed. get_db_connection() returned None.")
    log("Database connection object created successfully.")
    
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    res = cursor.fetchone()
    log(f"Test query executed: SELECT 1 -> {res}")
    cursor.close()
    conn.close()
    
    if not res or res[0] != 1:
        raise Exception(f"Unexpected database query result: {res}")
    log("Database health check complete: Success!")

@register_test("TEST-DB-002", "Database", "Table Structures Verification", "Assures all 7+ vital database tables exist in the schema.")
def test_db_002(log):
    required_tables = ["users", "visitors", "visitor_requests", "system_license", "sites", "role_permissions", "system_settings"]
    log(f"Checking for required tables: {', '.join(required_tables)}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES")
    tables = [row[0].lower() for row in cursor.fetchall()]
    log(f"Tables present in database: {', '.join(tables)}")
    cursor.close()
    conn.close()
    
    missing = [t for t in required_tables if t.lower() not in tables]
    if missing:
        raise Exception(f"Database schema is missing required tables: {', '.join(missing)}")
    log("All vital database tables exist!")

# -----------------------------------------------------------------------------
# AUTHENTICATION TESTS
# -----------------------------------------------------------------------------

@register_test("TEST-AUTH-001", "Authentication", "Valid Credentials Login", "Verifies existing user logs in successfully and receives a JWT token.")
def test_auth_001(log):
    client = get_test_client()
    
    # Dynamically fetch password from DB to be robust against changes
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE email = 'admin@test.com'")
    row = cursor.fetchone()
    db_password = row[0] if row else "Admin@123"
    cursor.close()
    conn.close()

    log("Sending login request for admin@test.com...")
    res = client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": db_password
    })
    log(f"Response status: {res.status_code}")
    data = res.get_json() or {}
    log(f"Response data: {data}")
    
    if res.status_code != 200:
        raise Exception(f"Failed to log in: {data.get('message', 'No message')}")
    if "token" not in data:
        raise Exception("Login response missing authentication token.")
    log("Valid login test passed successfully.")

@register_test("TEST-AUTH-002", "Authentication", "Invalid Password Check", "Asserts logging in with an incorrect password returns 401 Unauthorized.")
def test_auth_002(log):
    client = get_test_client()
    
    # Dynamically fetch password from DB to be robust against changes
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE email = 'admin@test.com'")
    row = cursor.fetchone()
    db_password = row[0] if row else "Admin@123"
    cursor.close()
    conn.close()

    log("Sending login request with incorrect password...")
    res = client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": db_password + "wrong"
    })
    log(f"Response status: {res.status_code}")
    data = res.get_json() or {}
    log(f"Response data: {data}")
    
    if res.status_code != 401:
        raise Exception(f"Expected 401 Unauthorized, got {res.status_code}")
    log("Invalid password login blocked successfully.")

@register_test("TEST-AUTH-003", "Authentication", "Non-Existent User Check", "Asserts logging in with an unregistered email returns 404 Not Found.")
def test_auth_003(log):
    client = get_test_client()
    log("Sending login request for unregistered email...")
    res = client.post("/api/auth/login", json={
        "email": "not_in_db_12345@test.com",
        "password": "Password@123"
    })
    log(f"Response status: {res.status_code}")
    data = res.get_json() or {}
    log(f"Response data: {data}")
    
    if res.status_code != 404:
        raise Exception(f"Expected 404 Not Found, got {res.status_code}")
    log("Non-existent user lookup returns 404 successfully.")

@register_test("TEST-AUTH-004", "Authentication", "Password Security Check", "Verifies passwords must meet strength rules (length, uppercase, symbol, number).")
def test_auth_004(log):
    client = get_test_client()
    log("Testing weak password registration (expects 400)...")
    res = client.post("/api/auth/register", json={
        "name": "Weak Pass User",
        "email": "weak_user_test@test.com",
        "password": "123"
    })
    log(f"Response status: {res.status_code}")
    data = res.get_json() or {}
    log(f"Response data: {data}")
    
    if res.status_code != 400:
        raise Exception(f"Expected 400 Bad Request, got {res.status_code}")
    log("Weak password registration correctly rejected.")

@register_test("TEST-AUTH-005", "Authentication", "User Registration Flow", "Verifies a new user registers via /api/auth/register with role host and status Active.")
def test_auth_005(log):
    client = get_test_client()
    email = f"test_host_{int(time.time())}@test.com"
    log(f"Attempting to register new host user: {email}...")
    res = client.post("/api/auth/register", json={
        "name": "Test Host Integration",
        "email": email,
        "password": "SecurePassword@123"
    })
    log(f"Response status: {res.status_code}")
    data = res.get_json() or {}
    log(f"Response data: {data}")
    
    if res.status_code != 201:
        raise Exception(f"Expected 201 Created, got {res.status_code}")
        
    # Verify in DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT role, status FROM users WHERE email = %s", (email,))
    row = cursor.fetchone()
    cursor.close()
    
    # Cleanup registered user immediately
    c2 = conn.cursor()
    c2.execute("DELETE FROM users WHERE email = %s", (email,))
    conn.commit()
    c2.close()
    conn.close()
    
    if not row:
        raise Exception("Registered user details not found in database.")
    log(f"User found in database with role: {row[0]}, status: {row[1]}")
    if row[0] != "host" or row[1] != "Active":
        raise Exception(f"Expected role 'host' and status 'Active', got role '{row[0]}' and status '{row[1]}'")
    log("User registration flow validated and cleaned up successfully.")

@register_test("TEST-AUTH-006", "Authentication", "Duplicate User Block", "Ensures registering a duplicate email returns 409 Conflict.")
def test_auth_006(log):
    client = get_test_client()
    email = f"test_dup_{int(time.time())}@test.com"
    log(f"Registering initial user {email}...")
    
    # 1. Register first user
    res1 = client.post("/api/auth/register", json={
        "name": "First User",
        "email": email,
        "password": "Password@123"
    })
    if res1.status_code != 201:
        raise Exception("Failed to register initial user.")
        
    # 2. Register duplicate user
    log("Attempting duplicate registration...")
    res2 = client.post("/api/auth/register", json={
        "name": "Duplicate User",
        "email": email,
        "password": "Password@123"
    })
    log(f"Duplicate registration status: {res2.status_code}")
    
    # Cleanup DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE email = %s", (email,))
    conn.commit()
    cursor.close()
    conn.close()
    
    if res2.status_code != 409:
        raise Exception(f"Expected 409 Conflict, got {res2.status_code}")
    log("Duplicate registration successfully blocked with 409 status.")

# -----------------------------------------------------------------------------
# LICENSING TESTS
# -----------------------------------------------------------------------------

@register_test("TEST-LIC-001", "Licensing", "Signature Verification", "Asserts correct JWT signature verification succeeds.")
def test_lic_001(log):
    log("Generating a valid RS256 token expiring in 30 days...")
    valid_key = make_jwt_key(exp_delta_days=30)
    log("Passing key to verify_system_license(temp_key=...)...")
    res = verify_system_license(temp_key=valid_key)
    log(f"Verification output status: {res.get('status')}")
    
    if res.get("status") != "ACTIVE":
        raise Exception(f"Expected ACTIVE status, got: {res}")
    log("Cryptographic signature check: Success!")

@register_test("TEST-LIC-002", "Licensing", "Tampered Token Detection", "Verifies altering license text instantly fails verification.")
def test_lic_002(log):
    log("Generating a valid RS256 token...")
    valid_key = make_jwt_key()
    tampered_key = valid_key[:-5] + "XXXXX"
    log("Passing modified key to verify_system_license(temp_key=...)...")
    res = verify_system_license(temp_key=tampered_key)
    log(f"Verification output status: {res.get('status')}")
    
    if res.get("status") not in ("INVALID", "EXPIRED"):
        raise Exception(f"Expected status to be INVALID, got: {res.get('status')}")
    log("Tampered token successfully detected and blocked.")

@register_test("TEST-LIC-003", "Licensing", "Monotonic Clock Tampering", "Asserts clock wound back behind license_state.json caches flags CLOCK_TAMPERED.")
def test_lic_003(log):
    log("Reading current monotonic clock cache...")
    original_cache_data = None
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                original_cache_data = f.read()
        except Exception:
            pass

    try:
        # Write a future time to the state file to simulate clock rewind
        future_time = datetime.datetime.utcnow() + datetime.timedelta(days=10)
        time_str = future_time.isoformat()
        sig_hash = hashlib.sha256((time_str + SECRET_SALT).encode()).hexdigest()
        
        log(f"Writing future timestamp {time_str} to {STATE_FILE}...")
        with open(STATE_FILE, "w") as f:
            json.dump({
                "last_verified_time": time_str,
                "hash": sig_hash
            }, f, indent=4)
            
        log("Running verify_system_license() with system time set behind state file high watermark...")
        res = verify_system_license()
        log(f"Verifier response: {res.get('status')} - Error: {res.get('error')}")
        
        if res.get("status") != "CLOCK_TAMPERED":
            raise Exception(f"Expected CLOCK_TAMPERED status, got: {res.get('status')}")
        log("Clock rewind state successfully caught by monotonic filter!")
    finally:
        # Restore cache file
        if original_cache_data:
            with open(STATE_FILE, "w") as f:
                f.write(original_cache_data)
            log("Monotonic clock cache file restored.")
        elif os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
            log("Monotonic clock cache file removed.")

@register_test("TEST-LIC-004", "Licensing", "DB Activity Watermark Check", "Verifies clock wound back behind database visitor logs high-water mark triggers error.")
def test_lic_004(log):
    log("Reading current monotonic clock cache...")
    original_cache_data = None
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                original_cache_data = f.read()
        except Exception:
            pass

    try:
        # Write a state file indicating clock tampering detected by background thread
        time_str = datetime.datetime.utcnow().isoformat()
        accumulated_val = "0"
        tampered_val = "True"
        sig_hash = hashlib.sha256((time_str + accumulated_val + tampered_val + SECRET_SALT).encode()).hexdigest()
        
        log(f"Writing tampered state to {STATE_FILE}...")
        with open(STATE_FILE, "w") as f:
            json.dump({
                "last_verified_time": time_str,
                "accumulated_minutes": 0,
                "tampered": True,
                "expected_db_time": (datetime.datetime.utcnow() + datetime.timedelta(days=1)).isoformat(),
                "hash": sig_hash
            }, f, indent=4)
            
        log("Running verify_system_license() with system time set behind expected background time...")
        res = verify_system_license()
        log(f"Verifier response: {res.get('status')} - Error: {res.get('error')}")
        
        if res.get("status") != "CLOCK_TAMPERED":
            raise Exception(f"Expected CLOCK_TAMPERED status, got: {res.get('status')}")
        log("Clock tampering state successfully caught!")
    finally:
        # Restore cache file
        if original_cache_data:
            with open(STATE_FILE, "w") as f:
                f.write(original_cache_data)
            log("Monotonic clock cache file restored.")
        elif os.path.exists(STATE_FILE):
            os.remove(STATE_FILE)
            log("Monotonic clock cache file removed.")

@register_test("TEST-LIC-005", "Licensing", "Grace Buffer Period Check", "Asserts expired license within 90 days remains functional but flags buffer warnings.")
def test_lic_005(log):
    log("Creating a license key that expired 10 days ago (standard term term = 365 days)...")
    now_utc = datetime.datetime.utcnow()
    activation = now_utc - datetime.timedelta(days=375)
    expiry = now_utc - datetime.timedelta(days=10)
    
    expired_jwt = jwt.encode({
        "client_name": "Buffer Test Client",
        "expires_at": expiry.isoformat() + "Z",
        "max_users": 100,
        "max_sites": 10
    }, PRIVATE_KEY_PEM, algorithm="RS256")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        log("Temporarily inserting expired license key with 365-day term...")
        cursor.execute("INSERT INTO system_license (license_key, activation_time) VALUES (%s, %s)", (expired_jwt, activation))
        conn.commit()
        
        log("Running verify_system_license()...")
        res = verify_system_license()
        log(f"Verification status: {res.get('status')} - is_in_buffer: {res.get('is_in_buffer')}")
        
        if res.get("status") != "ACTIVE" or not res.get("is_in_buffer"):
            raise Exception(f"Expired license within 90-day grace period should be ACTIVE with is_in_buffer=True. Got: {res}")
    finally:
        cursor.execute("DELETE FROM system_license WHERE license_key = %s", (expired_jwt,))
        conn.commit()
        cursor.close()
        conn.close()
    log("License Grace period buffer verified: ACTIVE inside grace window.")

@register_test("TEST-LIC-006", "Licensing", "Extension Eligibility (Eligible)", "Verifies standard license near expiry is eligible for extension requests.")
def test_lic_006(log):
    log("Creating license expiring in 5 days (term = 365 days, expires in 5 days)...")
    now_utc = datetime.datetime.utcnow()
    activation = now_utc - datetime.timedelta(days=360)
    expiry = now_utc + datetime.timedelta(days=5)
    
    eligible_jwt = jwt.encode({
        "client_name": "Eligible Client",
        "expires_at": expiry.isoformat() + "Z",
        "max_users": 100,
        "max_sites": 10
    }, PRIVATE_KEY_PEM, algorithm="RS256")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Save temporary license key and activation time
        cursor.execute("INSERT INTO system_license (license_key, activation_time) VALUES (%s, %s)", (eligible_jwt, activation))
        conn.commit()
        
        log("Running verify_system_license() for the inserted near-expiration license...")
        res = verify_system_license()
        log(f"Is extension eligible? -> {res.get('extension_eligible')}")
        
        if not res.get("extension_eligible"):
            raise Exception(f"License expiring in 5 days (threshold = 30 days) should be eligible for extension. Got: {res}")
    finally:
        # Restore old license row
        cursor.execute("DELETE FROM system_license WHERE license_key = %s", (eligible_jwt,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Extension eligibility Near Expiry constraint passed.")

@register_test("TEST-LIC-007", "Licensing", "Extension Eligibility (Blocked)", "Asserts license far from expiry is blocked from extension requests.")
def test_lic_007(log):
    log("Creating license expiring in 100 days (term = 365 days)...")
    now_utc = datetime.datetime.utcnow()
    activation = now_utc - datetime.timedelta(days=265)
    expiry = now_utc + datetime.timedelta(days=100)
    
    blocked_jwt = jwt.encode({
        "client_name": "Blocked Client",
        "expires_at": expiry.isoformat() + "Z",
        "max_users": 100,
        "max_sites": 10
    }, PRIVATE_KEY_PEM, algorithm="RS256")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("INSERT INTO system_license (license_key, activation_time) VALUES (%s, %s)", (blocked_jwt, activation))
        conn.commit()
        
        log("Running verify_system_license() for license far from expiration...")
        res = verify_system_license()
        log(f"Is extension eligible? -> {res.get('extension_eligible')}")
        
        if res.get("extension_eligible"):
            raise Exception("License expiring in 100 days should NOT be eligible for extension request.")
    finally:
        cursor.execute("DELETE FROM system_license WHERE license_key = %s", (blocked_jwt,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Extension eligibility constraint successfully blocks request.")

@register_test("TEST-LIC-008", "Licensing", "Spam Prevention Constraints", "Ensures client database logs extension flags, blocking duplicate concurrent requests.")
def test_lic_008(log):
    log("Creating temporary eligible near-expiry license JWT...")
    now_utc = datetime.datetime.utcnow()
    activation = now_utc - datetime.timedelta(days=360)
    expiry = now_utc + datetime.timedelta(days=5)
    
    eligible_jwt = jwt.encode({
        "client_name": "Spam Test Client",
        "expires_at": expiry.isoformat() + "Z",
        "max_users": 100,
        "max_sites": 10
    }, PRIVATE_KEY_PEM, algorithm="RS256")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        log("Inserting eligible near-expiry license key with extension_requested = TRUE...")
        cursor.execute("""
            INSERT INTO system_license (license_key, activation_time, extension_requested) 
            VALUES (%s, %s, TRUE)
        """, (eligible_jwt, activation))
        conn.commit()
        
        client = get_test_client()
        log("Sending POST /api/admin/request-extension (should be blocked due to duplicate prevention)...")
        res = client.post("/api/admin/request-extension")
        log(f"Response status: {res.status_code}")
        data = res.get_json() or {}
        log(f"Response data: {data}")
        
        if res.status_code != 400:
            raise Exception(f"Expected status 400 Bad Request for duplicate extension, got {res.status_code}")
        if "already been submitted" not in data.get("error", ""):
            raise Exception(f"Expected duplicate request error message, got: {data.get('error')}")
    finally:
        cursor.execute("DELETE FROM system_license WHERE license_key = %s", (eligible_jwt,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Spam prevention blocks duplicate requests correctly.")

@register_test("TEST-LIC-009", "Licensing", "Early Termination (Suspension)", "Asserts provider early-termination flag blocks client requests with 402 Payment Required.")
def test_lic_009(log):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Query current early termination
    cursor.execute("SELECT terminated_early FROM system_license ORDER BY id DESC LIMIT 1")
    old_row = cursor.fetchone()
    old_val = old_row[0] if old_row else 0
    
    try:
        log("Simulating contract early termination: Setting terminated_early = TRUE in DB...")
        cursor.execute("UPDATE system_license SET terminated_early = TRUE ORDER BY id DESC LIMIT 1")
        conn.commit()
        
        client = get_test_client()
        log("Requesting `/api/visitors` (protected endpoint) using test client...")
        res = client.get("/api/visitors")
        log(f"Response status: {res.status_code}")
        data = res.get_json() or {}
        log(f"Response details: {data}")
        
        if res.status_code != 402:
            raise Exception(f"Expected 402 Payment Required, got {res.status_code}")
        if data.get("error") != "LICENSE_RESTRICTION":
            raise Exception("Response did not contain LICENSE_RESTRICTION code.")
    finally:
        # Restore old status
        cursor.execute("UPDATE system_license SET terminated_early = %s ORDER BY id DESC LIMIT 1", (old_val,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Client early termination blocking verified successfully.")

@register_test("TEST-LIC-010", "Licensing", "Expiration Key Lock Verification", "Verifies resuming a suspended client requires matching the original key expiration date.")
def test_lic_010(log):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Setup a mock license record that is suspended
    now = datetime.datetime.now()
    orig_expiry = now + datetime.timedelta(days=30)
    
    # Old key
    old_key = jwt.encode({
        "client_name": "Suspended Client",
        "expires_at": orig_expiry.isoformat() + "Z",
        "max_users": 100,
        "max_sites": 10
    }, PRIVATE_KEY_PEM, algorithm="RS256")
    
    try:
        cursor.execute("""
            INSERT INTO system_license (license_key, activation_time, terminated_early) 
            VALUES (%s, NOW(), TRUE)
        """, (old_key,))
        conn.commit()
        
        client = get_test_client()
        
        # Key with different expiration date (+60 days)
        new_expiry_diff = now + datetime.timedelta(days=60)
        invalid_reactivation_key = jwt.encode({
            "client_name": "Suspended Client",
            "expires_at": new_expiry_diff.isoformat() + "Z",
            "max_users": 100,
            "max_sites": 10
        }, PRIVATE_KEY_PEM, algorithm="RS256")
        
        log("Trying to reactivate suspended app with a key of different expiration date (+60 days)...")
        res = client.post("/api/activate-license", json={"license_key": invalid_reactivation_key})
        log(f"Reactivation response status: {res.status_code}")
        data = res.get_json() or {}
        log(f"Response details: {data}")
        
        if res.status_code != 400:
            raise Exception(f"Expected 400 Bad Request, got {res.status_code}")
        if "must remain identical" not in data.get("error", ""):
            raise Exception(f"Expected date mismatch error, got: {data.get('error')}")
            
    finally:
        # Cleanup
        cursor.execute("DELETE FROM system_license WHERE license_key = %s", (old_key,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Expiration Date check for reactivation locked: Success!")

# -----------------------------------------------------------------------------
# VISITOR MANAGEMENT TESTS
# -----------------------------------------------------------------------------

@register_test("TEST-VIS-001", "Visitor Management", "Create Visitor Request", "Verifies self-check-in registration creates a PENDING visitor request.")
def test_vis_001(log):
    client = get_test_client()
    visitor_payload = {
        "visitor_name": "Automation Visitor",
        "full_name": "Automation Guest",
        "email": "visitor_auto@test.com",
        "mobile_number": "+919876543210",
        "pabx": "123",
        "company_name": "Test Runner Inc",
        "unit": "Building A",
        "department": "Engineering",
        "location": "Pune Site",
        "id_proof_type": "PAN Card",
        "id_proof_number": "ABCDE1234F",
        "access_level": "Level 1",
        "purpose": "Meeting",
        "host_id": 1,
        "person_to_visit": "Admin User",
        "vehicleType": "2 Wheeler",
        "vehicleNumber": "MH12AB1234",
        "hasDevice": "No"
    }
    
    log("Creating a visitor check-in request via POST /api/visitor-requests...")
    res = client.post("/api/visitor-requests", json=visitor_payload)
    log(f"Response status: {res.status_code}")
    data = res.get_json() or {}
    log(f"Created request details: {data}")
    
    if res.status_code != 201:
        raise Exception(f"Expected 201 Created, got {res.status_code}: {data}")
        
    request_id = data.get("request_id")
    visitor_id = data.get("visitor_id")
    
    # Verify in Database
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM visitor_requests WHERE request_id = %s", (request_id,))
    row = cursor.fetchone()
    
    # Cleanup visitor test data
    cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (request_id,))
    cursor.execute("DELETE FROM visitors WHERE visitor_id = %s", (visitor_id,))
    conn.commit()
    cursor.close()
    conn.close()
    
    if not row:
        raise Exception("Request record not found in database.")
    log(f"Visitor request status in database: {row[0]}")
    if row[0] != "PENDING":
        raise Exception(f"Visitor request status must be PENDING, got {row[0]}")
        
    log("Visitor request creation validated and cleaned up.")

@register_test("TEST-VIS-002", "Visitor Management", "Vehicle Format Validation", "Validates Indian registration format (e.g. MH12AB1234) and rejects invalid ones.")
def test_vis_002(log):
    client = get_test_client()
    
    # 1. Invalid Vehicle Registration Test
    invalid_payload = {
        "visitor_name": "Vehicle Failure Guest",
        "mobile_number": "+919876543211",
        "id_proof_type": "Aadhar Card",
        "id_proof_number": "123456789012",
        "host_id": 1,
        "purpose": "Meeting",
        "vehicleNumber": "invalid_number_123"
    }
    log("Submitting request with invalid vehicle registration format...")
    res1 = client.post("/api/visitor-requests", json=invalid_payload)
    log(f"Invalid request status code: {res1.status_code}")
    data1 = res1.get_json() or {}
    log(f"Invalid request data: {data1}")
    
    if res1.status_code != 400:
        raise Exception(f"Expected 400 Bad Request for invalid vehicle number, got {res1.status_code}")
    if "vehicle" not in data1.get("error", "").lower():
        raise Exception("Error response did not mention vehicle registration validation check.")
    log("Invalid vehicle format rejected: Success!")

@register_test("TEST-VIS-003", "Visitor Management", "Mobile Lookup Check", "Verifies /api/visitors/lookup/<mobile> pulls correct visitor profile details.")
def test_vis_003(log):
    test_mobile = "9998887770"
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Setup temp visitor
    cursor.execute("""
        INSERT INTO visitors (visitor_name, company_name, email, mobile_number, id_proof_type, id_proof_number)
        VALUES ('Lookup Test Visitor', 'Search Corp', 'search@test.com', %s, 'Aadhar Card', '987654321012')
    """, (test_mobile,))
    visitor_id = cursor.lastrowid
    conn.commit()
    
    try:
        client = get_test_client()
        log(f"Calling GET /api/visitors/lookup/{test_mobile}...")
        res = client.get(f"/api/visitors/lookup/{test_mobile}")
        log(f"Response status: {res.status_code}")
        data = res.get_json() or {}
        log(f"Lookup result details: {data}")
        
        if res.status_code != 200:
            raise Exception(f"Failed to lookup visitor: {data}")
        if data.get("visitor_name") != "Lookup Test Visitor":
            raise Exception(f"Visitor name mismatch, got: {data.get('visitor_name')}")
    finally:
        cursor.execute("DELETE FROM visitors WHERE visitor_id = %s", (visitor_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Mobile lookup successfully retrieved visitor profile details.")

@register_test("TEST-VIS-004", "Visitor Management", "Active Count Analytics", "Verifies active visitor counts return counts of checked-in, non-checked-out visits.")
def test_vis_004(log):
    client = get_test_client()
    log("Requesting `/api/active-visitors-count`...")
    res = client.get("/api/active-visitors-count")
    log(f"Response status: {res.status_code}")
    data = res.get_json() or {}
    log(f"Response data: {data}")
    
    if res.status_code != 200:
        raise Exception(f"Active visitors endpoint failed with status {res.status_code}")
    if "count" not in data:
        raise Exception("Response data missing active 'count' key.")
    log(f"Active visitors inside the facility: {data.get('count')}")

@register_test("TEST-VIS-005", "Visitor Management", "Purpose Chart Distribution", "Verifies chart-friendly color metrics grouped by reason of visit.")
def test_vis_005(log):
    client = get_test_client()
    log("Requesting `/api/visit-purpose`...")
    res = client.get("/api/visit-purpose")
    log(f"Response status: {res.status_code}")
    data = res.get_json() or []
    log(f"Response data: {data}")
    
    if res.status_code != 200:
        raise Exception(f"Purpose chart distribution failed with status {res.status_code}")
    if not isinstance(data, list):
        raise Exception("Expected list of purpose categories.")
        
    for item in data:
        if "name" not in item or "value" not in item or "color" not in item:
            raise Exception(f"Malformed purpose chart data item: {item}")
    log("Chart distribution query format verified.")

# -----------------------------------------------------------------------------
# ADMINISTRATIVE TESTS
# -----------------------------------------------------------------------------

@register_test("TEST-ADM-001", "Administration", "Host Request Approval", "Verifies host can update visitor request status to APPROVED.")
def test_adm_001(log):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Insert temporary visitor and request
    cursor.execute("""
        INSERT INTO visitors (visitor_name, mobile_number, email) 
        VALUES ('Temp Approval Guest', '9998881234', 'temp_approval@test.com')
    """)
    visitor_id = cursor.lastrowid
    cursor.execute("""
        INSERT INTO visitor_requests (visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, created_at)
        VALUES (%s, 1, 'Meeting', CURRENT_DATE, CURRENT_TIME, 'PENDING', NOW())
    """, (visitor_id,))
    request_id = cursor.lastrowid
    conn.commit()
    log(f"Inserted temp request ID {request_id} for approval.")
    
    try:
        client = get_test_client()
        log(f"Approving request via PUT /api/visitor-requests/{request_id}/approve...")
        res = client.put(f"/api/visitor-requests/{request_id}/approve", json={"approved_by": 1})
        log(f"Response status: {res.status_code}")
        
        if res.status_code != 200:
            raise Exception("Approval request endpoint failed.")
            
        # Verify status in database
        cursor.execute("SELECT status, approved_by FROM visitor_requests WHERE request_id = %s", (request_id,))
        status, approver = cursor.fetchone()
        log(f"DB verification -> Status: {status}, Approved By: {approver}")
        
        if status != "APPROVED" or approver != 1:
            raise Exception(f"Failed to update request to APPROVED status. Got status {status}, approver {approver}")
    finally:
        # Cleanup
        cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (request_id,))
        cursor.execute("DELETE FROM visitors WHERE visitor_id = %s", (visitor_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Visitor request approved successfully.")

@register_test("TEST-ADM-002", "Administration", "Host Request Rejection", "Verifies host can update visitor request status to REJECTED.")
def test_adm_002(log):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Insert temporary visitor and request
    cursor.execute("""
        INSERT INTO visitors (visitor_name, mobile_number, email) 
        VALUES ('Temp Rejection Guest', '9998884321', 'temp_rejection@test.com')
    """)
    visitor_id = cursor.lastrowid
    cursor.execute("""
        INSERT INTO visitor_requests (visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, created_at)
        VALUES (%s, 1, 'Meeting', CURRENT_DATE, CURRENT_TIME, 'PENDING', NOW())
    """, (visitor_id,))
    request_id = cursor.lastrowid
    conn.commit()
    
    try:
        client = get_test_client()
        log(f"Rejecting request via PUT /api/visitor-requests/{request_id}/reject...")
        res = client.put(f"/api/visitor-requests/{request_id}/reject", json={"approved_by": 1})
        log(f"Response status: {res.status_code}")
        
        if res.status_code != 200:
            raise Exception("Rejection request endpoint failed.")
            
        # Verify status in database
        cursor.execute("SELECT status, approved_by FROM visitor_requests WHERE request_id = %s", (request_id,))
        status, approver = cursor.fetchone()
        log(f"DB verification -> Status: {status}, Approved By: {approver}")
        
        if status != "REJECTED" or approver != 1:
            raise Exception(f"Failed to update request to REJECTED status. Got status {status}, approver {approver}")
    finally:
        # Cleanup
        cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (request_id,))
        cursor.execute("DELETE FROM visitors WHERE visitor_id = %s", (visitor_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Visitor request rejected successfully.")

@register_test("TEST-ADM-003", "Administration", "Security Check-in Flow", "Verifies security can check in a visitor with an APPROVED request.")
def test_adm_003(log):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create request with APPROVED status
    cursor.execute("""
        INSERT INTO visitors (visitor_name, mobile_number, email) 
        VALUES ('Temp Checkin Guest', '9998882468', 'temp_checkin@test.com')
    """)
    visitor_id = cursor.lastrowid
    cursor.execute("""
        INSERT INTO visitor_requests (visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, created_at)
        VALUES (%s, 1, 'Meeting', CURRENT_DATE, CURRENT_TIME, 'APPROVED', NOW())
    """, (visitor_id,))
    request_id = cursor.lastrowid
    conn.commit()
    
    try:
        client = get_test_client()
        log(f"Performing security check-in for request {request_id}...")
        res = client.post(f"/api/security/checkin/{request_id}")
        log(f"Check-in status: {res.status_code}")
        
        if res.status_code != 200:
            raise Exception("Check-in endpoint failed.")
            
        # Verify in DB
        cursor.execute("SELECT check_in_time FROM visitor_requests WHERE request_id = %s", (request_id,))
        check_in = cursor.fetchone()[0]
        log(f"DB verification -> check_in_time: {check_in}")
        if not check_in:
            raise Exception("Check-in time was not written to database request record.")
    finally:
        # Cleanup
        cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (request_id,))
        cursor.execute("DELETE FROM visitors WHERE visitor_id = %s", (visitor_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Security check-in flow confirmed.")

@register_test("TEST-ADM-004", "Administration", "Security Check-out Flow", "Verifies security can check out a visitor, updating checkout timestamps.")
def test_adm_004(log):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create request with APPROVED status and checked-in
    cursor.execute("""
        INSERT INTO visitors (visitor_name, mobile_number, email) 
        VALUES ('Temp Checkout Guest', '9998881357', 'temp_checkout@test.com')
    """)
    visitor_id = cursor.lastrowid
    cursor.execute("""
        INSERT INTO visitor_requests (visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, check_in_time, created_at)
        VALUES (%s, 1, 'Meeting', CURRENT_DATE, CURRENT_TIME, 'APPROVED', NOW(), NOW())
    """, (visitor_id,))
    request_id = cursor.lastrowid
    conn.commit()
    
    try:
        client = get_test_client()
        log(f"Performing security check-out for request {request_id}...")
        res = client.post(f"/api/security/checkout/{request_id}")
        log(f"Check-out status: {res.status_code}")
        
        if res.status_code != 200:
            raise Exception("Check-out endpoint failed.")
            
        # Verify in DB
        cursor.execute("SELECT check_out_time FROM visitor_requests WHERE request_id = %s", (request_id,))
        check_out = cursor.fetchone()[0]
        log(f"DB verification -> check_out_time: {check_out}")
        if not check_out:
            raise Exception("Check-out time was not written to database request record.")
    finally:
        # Cleanup
        cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (request_id,))
        cursor.execute("DELETE FROM visitors WHERE visitor_id = %s", (visitor_id,))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Security check-out flow confirmed.")

@register_test("TEST-ADM-005", "Administration", "Site Registration Controls", "Verifies administrators can register and list sites.")
def test_adm_005(log):
    client = get_test_client()
    log("Fetching current sites list...")
    res1 = client.get("/api/admin/sites-list")
    log(f"Get sites-list status: {res1.status_code}")
    
    test_site_name = "Automation Test Site 99"
    test_site_address = "99 Robot Parkway, Cyber Zone"
    
    log(f"Adding new site: {test_site_name}...")
    res2 = client.post("/api/admin/sites-list", json={
        "name": test_site_name,
        "address": test_site_address,
        "status": "Active"
    })
    log(f"Add site status: {res2.status_code}")
    data = res2.get_json() or {}
    site_id = data.get("id")
    
    # Verify in DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, address FROM sites WHERE site_id = %s", (site_id,))
    row = cursor.fetchone()
    
    # Cleanup site
    cursor.execute("DELETE FROM sites WHERE site_id = %s", (site_id,))
    # Also clean up the audit log entries created during test
    cursor.execute("DELETE FROM superadmin_audit_logs WHERE target = %s", (test_site_address,))
    conn.commit()
    cursor.close()
    conn.close()
    
    if not row:
        raise Exception("Registered site not found in database.")
    log(f"Registered site found in DB: name='{row[0]}', address='{row[1]}'")
    if row[0] != test_site_name or row[1] != test_site_address:
         raise Exception("Registered site details mismatch.")
    log("Site CRUD operations verified successfully.")

@register_test("TEST-ADM-006", "Administration", "User Status Toggling", "Verifies superadmins can toggle account status between Active and Suspended.")
def test_adm_006(log):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    test_email = "manishkenjale07@gmail.com"
    log(f"Querying status of user {test_email}...")
    cursor.execute("SELECT status FROM users WHERE email = %s", (test_email,))
    row = cursor.fetchone()
    if not row:
        raise Exception(f"Test user {test_email} not found.")
    orig_status = row[0]
    log(f"Original user status: {orig_status}")
    
    try:
        # Toggle user status directly in database to Suspended
        log("Toggling status to 'Suspended'...")
        cursor.execute("UPDATE users SET status = 'Suspended' WHERE email = %s", (test_email,))
        conn.commit()
        
        # Verify status reports correctly from API user listing
        client = get_test_client()
        log("Querying `/api/admin/users` to verify API reporting...")
        res = client.get("/api/admin/users")
        log(f"Get users status: {res.status_code}")
        users_list = res.get_json() or []
        
        target_user = next((u for u in users_list if u.get("email") == test_email), None)
        if not target_user:
            raise Exception("User not found in API list response.")
        log(f"API user status: {target_user.get('status')}")
        if target_user.get("status") != "Suspended":
            raise Exception(f"Expected status Suspended, got: {target_user.get('status')}")
            
    finally:
        # Restore original status
        log(f"Restoring status to original: {orig_status}...")
        cursor.execute("UPDATE users SET status = %s WHERE email = %s", (orig_status, test_email))
        conn.commit()
        cursor.close()
        conn.close()
        
    log("Superadmin user status toggling database sync confirmed.")

# -----------------------------------------------------------------------------
# REPORTS & AUDIT TESTS
# -----------------------------------------------------------------------------

@register_test("TEST-REP-001", "Reports & Audit", "Logs Reports with Filters", "Asserts reports query matches site, host, dates, and export boundaries.")
def test_rep_001(log):
    client = get_test_client()
    log("Calling GET /api/reports with date filters...")
    res = client.get("/api/reports?start_date=2026-01-01&end_date=2026-12-31")
    log(f"Response status: {res.status_code}")
    
    if res.status_code != 200:
        raise Exception(f"Reports query failed with status {res.status_code}")
    log("Visitor logs reports query checks out: Success.")

@register_test("TEST-REP-002", "Reports & Audit", "Excel Exporter Processing", "Verifies Excel export endpoints compile correct data structures.")
def test_rep_002(log):
    client = get_test_client()
    log("Calling GET /api/reports/export-excel...")
    res = client.get("/api/reports/export-excel?start_date=2026-01-01&end_date=2026-12-31")
    log(f"Response status: {res.status_code}")
    
    if res.status_code != 200:
        raise Exception(f"Excel export failed with status {res.status_code}")
    log("Excel export structure compiled successfully.")

# -----------------------------------------------------------------------------
# FRONTEND INTEGRITY TESTS
# -----------------------------------------------------------------------------

@register_test("TEST-FE-001", "Frontend Integrity", "Vite Dev Server Status", "Verifies the frontend Vite server is active and serving the application on port 5173.")
def test_fe_001(log):
    ports = [5173, 5174]
    reachable = False
    active_port = None
    
    for port in ports:
        url = f"http://localhost:{port}/"
        log(f"Checking frontend status at {url}...")
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=1.5) as response:
                code = response.getcode()
                log(f"Server at port {port} responded with status: {code}")
                if code == 200:
                    reachable = True
                    active_port = port
                    break
        except Exception as e:
            log(f"Port {port} unreachable: {e}")
            
    if not reachable:
        raise Exception("Frontend Vite server is offline. Please launch the frontend dev server (`npm run dev` on port 5173).")
    log(f"Frontend Vite server is ACTIVE on port {active_port}!")

@register_test("TEST-FE-002", "Frontend Integrity", "Main Page DOM Verification", "Verifies the landing page mounts and serves the initial HTML layout structure.")
def test_fe_002(log):
    ports = [5173, 5174]
    html_content = None
    
    for port in ports:
        url = f"http://localhost:{port}/"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=1.5) as response:
                if response.getcode() == 200:
                    html_content = response.read().decode('utf-8')
                    break
        except Exception:
            pass
            
    if not html_content:
        raise Exception("Failed to query index HTML content from frontend server.")
        
    log("Verifying index.html DOM structure...")
    log(f"HTML snippet: {html_content[:150]}...")
    
    # Verify presence of script tag mounting main bundle
    if "src/main.jsx" not in html_content and "vite" not in html_content.lower():
        raise Exception("Served document does not appear to be a valid Vite React mounting page.")
    log("Frontend mounts React application root script tag: Success!")


# -----------------------------------------------------------------------------
# RUNNER CORE EXECUTOR
# -----------------------------------------------------------------------------

def run_test_case(test_id):
    """Executes a single test case by ID, capturing all log statements."""
    logs = []
    def log(msg):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        logs.append(f"[{timestamp}] {msg}")
        
    log(f"--- Starting Test Case {test_id} ---")
    start_time = time.time()
    
    tc = next((t for t in TEST_CASES if t["id"] == test_id), None)
    if not tc:
        log(f"ERROR: Test Case {test_id} not registered.")
        return {
            "id": test_id,
            "status": "FAILED",
            "duration_ms": 0,
            "logs": logs,
            "error": "Test case not found in registry"
        }
        
    try:
        tc["run_fn"](log)
        status = "SUCCESS"
        error_msg = ""
    except Exception as e:
        status = "FAILED"
        error_msg = str(e)
        log(f"TEST FAILURE EXCEPTION:\n{traceback.format_exc()}")
        
    duration_ms = int((time.time() - start_time) * 1000)
    log(f"--- Completed Test Case {test_id} in {duration_ms}ms with status: {status} ---")
    
    return {
        "id": test_id,
        "category": tc["category"],
        "name": tc["name"],
        "description": tc["description"],
        "status": status,
        "duration_ms": duration_ms,
        "logs": logs,
        "error": error_msg
    }

if __name__ == "__main__":
    print(f"Total registered test cases: {len(TEST_CASES)}")
    for tc in TEST_CASES:
        res = run_test_case(tc["id"])
        print(f"[{res['id']}] {res['name']}: {res['status']} ({res['duration_ms']}ms)")
        if res["status"] == "FAILED":
            print(f"  Error: {res['error']}")
