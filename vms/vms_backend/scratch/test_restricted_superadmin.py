import os
import sys
import datetime
import jwt
import json
import pymysql

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))

from app import app

# Private RSA key to sign the JWT token
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

def run_restricted_superadmin_tests():
    print("--- STARTING RESTRICTED SUPERADMIN API TESTS ---")
    
    # Start provider server in background
    from VMS_Provider.app import app as provider_app
    import threading
    import time
    
    def start_provider_server():
        provider_app.run(port=5001, debug=False, use_reloader=False)

    t = threading.Thread(target=start_provider_server)
    t.daemon = True
    t.start()
    time.sleep(1.0) # allow server to boot

    # Setup Provider registry database path and backup
    db_file_path = os.path.join(os.path.dirname(__file__), "..", "..", "VMS_Provider", "generated_licenses.json")
    original_db_content = None
    if os.path.exists(db_file_path):
        with open(db_file_path, "r", encoding="utf-8") as f:
            original_db_content = f.read()

    # Load and verify Sumeet Group (Current Server) exists in provider registry
    if original_db_content:
        licenses = json.loads(original_db_content)
    else:
        licenses = []
        
    sg_exists = any(c["client_name"] == "Sumeet Group (Current Server)" for c in licenses)
    if not sg_exists:
        licenses.append({
            "id": 999,
            "client_name": "Sumeet Group (Current Server)",
            "max_users": 100,
            "max_sites": 10,
            "machine_uuid": "Universal",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(days=30)).isoformat(),
            "created_at": datetime.datetime.utcnow().isoformat(),
            "license_key": "mock_key",
            "will_terminate": False,
            "terminated_early": False,
            "sites": [],
            "permissions": {},
            "settings": {}
        })
        with open(db_file_path, "w", encoding="utf-8") as f:
            json.dump(licenses, f, indent=4)
        print("Configured Sumeet Group (Current Server) client in provider database registry.")

    # 1. Setup Database Connection and Insert Active License
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

    now = datetime.datetime.utcnow()
    activation_time = now - datetime.timedelta(days=29.5)
    expiry_time = now + datetime.timedelta(days=0.5)
    payload = {
        "client_name": "Sumeet Group (Current Server)",
        "expires_at": expiry_time.isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    active_token = jwt.encode(payload, private_key_pem, algorithm="RS256")
    
    # Empty any existing licenses and insert active license for test
    cursor.execute("TRUNCATE TABLE system_license")
    cursor.execute(
        "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early) VALUES (%s, %s, FALSE, FALSE)",
        (active_token, activation_time)
    )
    print("Temporary active license token configured in DB.")

    client = app.test_client()

    try:
        # 2. Test /api/admin/superadmin-stats
        print("Testing GET /api/admin/superadmin-stats...")
        res = client.get("/api/admin/superadmin-stats")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = json.loads(res.data)
        
        assert "licenses" in data, "Response should contain licenses list"
        assert len(data["licenses"]) == 1, f"Expected 1 license record, got {len(data['licenses'])}"
        assert data["licenses"][0]["company"] == "Sumeet Group (Current Server)", f"Expected Sumeet Group (Current Server), got {data['licenses'][0]['company']}"
        assert data["totalCompanies"] == 1, f"Expected totalCompanies to be 1, got {data['totalCompanies']}"
        print("GET /api/admin/superadmin-stats: PASS")

        # 3. Test GET /api/admin/companies-sites
        print("Testing GET /api/admin/companies-sites...")
        res = client.get("/api/admin/companies-sites")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        companies = json.loads(res.data)
        
        assert len(companies) == 1, f"Expected 1 filtered company, got {len(companies)}"
        assert companies[0]["name"] == "Sumeet Group (Current Server)", f"Expected Sumeet Group (Current Server), got {companies[0]['name']}"
        print("GET /api/admin/companies-sites: PASS")

        # 4. Test POST /api/admin/request-extension
        print("Testing POST /api/admin/request-extension...")
        res = client.post("/api/admin/request-extension")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        data = json.loads(res.data)
        assert "submitted successfully" in data["message"], f"Unexpected message: {data['message']}"
        assert "support@sumeetgroup.com" in data["message"], f"Unexpected message: {data['message']}"
        print("POST /api/admin/request-extension: PASS")

        # 5. Test GET /api/admin/roles-permissions
        print("Testing GET /api/admin/roles-permissions...")
        res = client.get("/api/admin/roles-permissions")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        roles = json.loads(res.data)
        assert "superadmin" in roles, "superadmin role key should be in permissions map"
        assert "admin" in roles, "admin role key should be in permissions map"
        print("GET /api/admin/roles-permissions: PASS")

        # 6. Test GET /api/admin/system-settings
        print("Testing GET /api/admin/system-settings...")
        res = client.get("/api/admin/system-settings")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        settings = json.loads(res.data)
        assert "support_email" in settings, "support_email should be in settings"
        print("GET /api/admin/system-settings: PASS")

        print("\n--- ALL RESTRICTED SUPERADMIN API TESTS PASSED SUCCESSFULLY ---")

    finally:
        # Clean up database: return it to reset state
        print("Cleaning up database license table...")
        cursor.execute("TRUNCATE TABLE system_license")
        conn.close()
        
        # Restore generated_licenses.json
        if 'original_db_content' in locals() and original_db_content is not None:
            with open(db_file_path, "w", encoding="utf-8") as f:
                f.write(original_db_content)
            print("Restored original provider database registry.")

        # Clean state cache file if it was created
        state_file = os.path.join(os.path.dirname(__file__), "..", "utils", "license_state.json")
        if os.path.exists(state_file):
            os.remove(state_file)
            print("Removed license_state.json cache.")

if __name__ == "__main__":
    run_restricted_superadmin_tests()
