import os
import sys
import datetime
import jwt
import json
import pymysql
import threading
import time

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

from app import app as client_app

# RSA keys for signature generation
private_key_pem = """-----BEGIN RSA PRIVATE KEY-----
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

# Import provider app and start in background
from VMS_Provider.app import app as provider_app

def run_provider():
    provider_app.run(port=5001, debug=False, use_reloader=False)

def run_tests():
    print("--- STARTING EXTENSION REQUEST & APPROVAL INTEGRATION TESTS ---")
    
    # 1. Setup DB connection configuration
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    db_host = "localhost"
    db_port = 3306
    db_user = "root"
    db_pass = ""
    db_name = "vms"

    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    k = parts[0].strip()
                    v = parts[1].strip().strip("'\"")
                    if k == "DB_HOST": db_host = v
                    elif k == "DB_PORT": db_port = int(v)
                    elif k == "DB_USER": db_user = v
                    elif k == "DB_PASSWORD": db_pass = v
                    elif k == "DB_NAME": db_name = v

    conn = pymysql.connect(
        host=db_host, user=db_user, password=db_pass, database=db_name, port=db_port, autocommit=True
    )
    cursor = conn.cursor()

    # 2. Insert valid active license for test (Sumeet Group)
    # The client name must match the one in the provider's list (default id 1 is "Sumeet Group")
    now = datetime.datetime.utcnow()
    activation_time = now - datetime.timedelta(days=29.5)
    expiry_time = now + datetime.timedelta(days=0.5)
    payload = {
        "client_name": "Sumeet Group",
        "expires_at": expiry_time.isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    active_token = jwt.encode(payload, private_key_pem, algorithm="RS256")
    
    cursor.execute("TRUNCATE TABLE system_license")
    cursor.execute(
        "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early) VALUES (%s, %s, FALSE, FALSE)",
        (active_token, activation_time)
    )
    print("Pre-requisite: Configured active license for Sumeet Group in DB.")
    conn.close()

    # 3. Back up and modify generated_licenses.json to inject Sumeet Group
    db_file_path = os.path.join(os.path.dirname(__file__), "..", "..", "VMS_Provider", "generated_licenses.json")
    original_db_content = None
    if os.path.exists(db_file_path):
        with open(db_file_path, "r", encoding="utf-8") as f:
            original_db_content = f.read()
            
    try:
        if original_db_content:
            licenses = json.loads(original_db_content)
        else:
            licenses = []
            
        # Check if Sumeet Group already exists
        sg_exists = any(c["client_name"] == "Sumeet Group" for c in licenses)
        if not sg_exists:
            licenses.append({
                "id": 1,
                "client_name": "Sumeet Group",
                "max_users": 100,
                "max_sites": 10,
                "machine_uuid": "Universal",
                "expires_at": expiry_time.isoformat(),
                "created_at": datetime.datetime.utcnow().isoformat(),
                "license_key": active_token,
                "will_terminate": False,
                "terminated_early": False,
                "sites": [],
                "permissions": {
                    "superadmin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "manage_licenses", "system_settings", "data_purging"],
                    "admin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "system_settings"],
                    "host": ["view_dashboard", "approve_requests"],
                    "security": ["view_dashboard", "check_in_out"]
                },
                "settings": {
                    "max_visitors": 500,
                    "session_timeout": 60,
                    "support_email": "support@sumeetgroup.com",
                    "enable_sms": True,
                    "enable_face_recognition": False,
                    "auto_purge_days": 90
                }
            })
            with open(db_file_path, "w", encoding="utf-8") as f:
                json.dump(licenses, f, indent=4)
            print("Configured Sumeet Group client in provider database registry.")
    except Exception as e:
        print("Failed to setup provider DB file:", e)

    # 4. Start provider server thread
    import VMS_Provider.app
    print("Provider imported from:", VMS_Provider.app.__file__)
    print("Provider routes:")
    for rule in provider_app.url_map.iter_rules():
        print(f"  {rule.endpoint}: {rule}")

    provider_thread = threading.Thread(target=run_provider)
    provider_thread.daemon = True
    provider_thread.start()
    print("Provider server thread started on port 5001.")
    time.sleep(1.0) # allow server to initialize

    client_test = client_app.test_client()
    provider_test = provider_app.test_client()

    try:
        # 5. Trigger extension request from client route POST /api/admin/request-extension
        print("Triggering client extension request...")
        res = client_test.post("/api/admin/request-extension")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = json.loads(res.data)
        assert "submitted successfully" in data["message"], f"Unexpected message: {data['message']}"
        print("Client request triggered: PASS")

        # 6. Verify request registered on the provider side
        print("Checking provider registry for pending request...")
        with provider_test.session_transaction() as sess:
            sess['logged_in'] = True

        res = provider_test.get("/api/clients")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        clients = json.loads(res.data)
        
        sumeet_group = next((c for c in clients if c["client_name"] == "Sumeet Group"), None)
        assert sumeet_group is not None, "Sumeet Group client not found in provider registry"
        
        assert "extension_request" in sumeet_group, "Sumeet Group should have extension_request field"
        assert sumeet_group["extension_request"]["status"] == "pending", f"Expected pending status, got {sumeet_group['extension_request']['status']}"
        print("Provider request registry checks: PASS")

        # 7. Approve the request via Provider API
        print("Approving request on provider side...")
        approve_res = provider_test.post("/api/clients/approve-extension", json={"client_id": sumeet_group["id"]})
        assert approve_res.status_code == 200, f"Expected 200, got {approve_res.status_code}"
        approve_data = json.loads(approve_res.data)
        assert "approved" in approve_data["message"], f"Unexpected approval response: {approve_data['message']}"
        print("Provider approval endpoint check: PASS")

        # 8. Check if client DB was updated with the new extended license key
        print("Verifying updated license key in client database...")
        conn_check = pymysql.connect(
            host=db_host, user=db_user, password=db_pass, database=db_name, port=db_port, autocommit=True
        )
        cursor_check = conn_check.cursor()
        cursor_check.execute("SELECT license_key FROM system_license ORDER BY id DESC LIMIT 1")
        updated_key = cursor_check.fetchone()[0]
        cursor_check.close()
        conn_check.close()

        assert updated_key != active_token, "License key should have been updated in the DB"
        
        # Verify new key claims
        public_key_pem = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsmkIVEbQRQhu23ogASCi
XGzPXBB/UR9dBxFCUu3ucHcFdmjpZgJRGCJhvzcJeb76qQE0uv7RubR8G6DwP7LQ
P+Ntud2MiZl8tdRPGm7v4W1nBLASX4bPvpyYM5W9U5xXh/QfeuD87tlghbVrasDU
DWzvmUJcjfUCzyJGRtr1kScbYAUi01G4fNHpC5f196bqNH5f0wpKVb1tTHeuILfW
kMML7evJsXxkcaiiN2fCwyLYqtBbLMtDrUgU0M5ORRMVYajfXfAAubpH5LvLTmfB
NBJZrSPDY9TuwDgdh8+CrqGi7Vw1sqsmSN7MdnTXfcXx45HI1zyijCyfhGwCm1ir
HwIDAQAB
-----END PUBLIC KEY-----"""
        
        decoded = jwt.decode(updated_key, public_key_pem, algorithms=["RS256"])
        new_exp = datetime.datetime.fromisoformat(decoded["expires_at"])
        expected_min_exp = expiry_time + datetime.timedelta(days=364) # ~1 year extension
        assert new_exp > expected_min_exp, f"Expected expiry to be extended, got {new_exp}"
        print("Client DB verification checks: PASS")

        # 9. Test Denial Flow
        print("Triggering denial flow tests...")
        sumeet_group["extension_request"] = {
            "status": "pending",
            "requested_at": datetime.datetime.utcnow().isoformat(),
            "add_days": 365
        }
        from VMS_Provider.app import save_licenses, load_licenses
        prov_licenses = load_licenses()
        for c in prov_licenses:
            if c["id"] == sumeet_group["id"]:
                c["extension_request"] = sumeet_group["extension_request"]
                break
        save_licenses(prov_licenses)

        # Deny the request
        deny_res = provider_test.post("/api/clients/deny-extension", json={"client_id": sumeet_group["id"]})
        assert deny_res.status_code == 200, f"Expected 200, got {deny_res.status_code}"
        
        # Verify request is cleared on provider side
        res = provider_test.get("/api/clients")
        clients = json.loads(res.data)
        refreshed_sumeet = next((c for c in clients if c["client_name"] == "Sumeet Group"), None)
        assert refreshed_sumeet.get("extension_request") is None, "Extension request should be cleared after denial"
        print("Provider denial flow checks: PASS")

        print("\n--- ALL EXTENSION REQUEST & APPROVAL INTEGRATION TESTS PASSED ---")

    finally:
        # Restore generated_licenses.json
        if original_db_content is not None:
            with open(db_file_path, "w", encoding="utf-8") as f:
                f.write(original_db_content)
            print("Restored original provider database registry.")

        # Cleanup client DB license table
        print("Cleaning up database license table...")
        conn_clean = pymysql.connect(
            host=db_host, user=db_user, password=db_pass, database=db_name, port=db_port, autocommit=True
        )
        cursor_clean = conn_clean.cursor()
        cursor_clean.execute("TRUNCATE TABLE system_license")
        cursor_clean.close()
        conn_clean.close()
        
        # Clean state cache file if it was created
        state_file = os.path.join(os.path.dirname(__file__), "..", "utils", "license_state.json")
        if os.path.exists(state_file):
            os.remove(state_file)
            print("Removed license_state.json cache.")

if __name__ == "__main__":
    run_tests()
