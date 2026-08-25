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
from VMS_Provider.app import app as provider_app

# RSA private key for JWT generation
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

def start_provider_server():
    provider_app.run(port=5001, debug=False, use_reloader=False)

# Store DB connection configs globally for cleanup access
db_host = "localhost"
db_port = 3306
db_user = "root"
db_pass = ""
db_name = "vms"

def setup_db():
    global db_host, db_port, db_user, db_pass, db_name
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
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
    return conn

def inject_test_license(conn, activation_time, expires_at):
    cursor = conn.cursor()
    payload = {
        "client_name": "Sumeet Group",
        "expires_at": expires_at.isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    token = jwt.encode(payload, private_key_pem, algorithm="RS256")
    
    cursor.execute("TRUNCATE TABLE system_license")
    cursor.execute(
        "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early, extension_requested) VALUES (%s, %s, FALSE, FALSE, FALSE)",
        (token, activation_time)
    )
    cursor.close()
    print(f"Injected test license: activation={activation_time.date()}, expiry={expires_at.date()}")

def run_tests():
    print("--- STARTING EXTENSION TIMING RESTRAINTS & SPAM PREVENTION TESTS ---")
    
    # Setup Provider registry database path and backup
    db_file_path = os.path.join(os.path.dirname(__file__), "..", "..", "VMS_Provider", "generated_licenses.json")
    original_db_content = None
    if os.path.exists(db_file_path):
        with open(db_file_path, "r", encoding="utf-8") as f:
            original_db_content = f.read()

    try:
        # Load and verify Sumeet Group exists in provider registry
        if original_db_content:
            licenses = json.loads(original_db_content)
        else:
            licenses = []
            
        sg_exists = any(c["client_name"] == "Sumeet Group" for c in licenses)
        if not sg_exists:
            licenses.append({
                "id": 1,
                "client_name": "Sumeet Group",
                "max_users": 100,
                "max_sites": 10,
                "machine_uuid": "Universal",
                "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(days=10)).isoformat(),
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
            print("Configured Sumeet Group client in provider database registry.")

        # 1. Start provider server in background
        t = threading.Thread(target=start_provider_server)
        t.daemon = True
        t.start()
        time.sleep(1.0) # allow server to boot
        
        # Setup DB
        from utils.license_verifier import ensure_license_table
        ensure_license_table()
        
        conn = setup_db()
        client = client_app.test_client()
        now = datetime.datetime.utcnow()
        
        # Case 1: 365 Days License, 40 days before expiry (Should fail - threshold is 30 days)
        # term = 365 days, expires_at = now + 40 days, activation_time = now - 325 days
        activation = now - datetime.timedelta(days=325)
        expiry = now + datetime.timedelta(days=40)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"365 Days License, 40 days before expiry: Response code={res.status_code}")
        assert res.status_code == 400
        data = json.loads(res.data)
        assert "not eligible for extension request yet" in data["error"]
        print("OK Passed Case 1")

        # Case 2: 365 Days License, 25 days before expiry (Should succeed)
        # term = 365 days, expires_at = now + 25 days, activation = now - 340 days
        activation = now - datetime.timedelta(days=340)
        expiry = now + datetime.timedelta(days=25)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"365 Days License, 25 days before expiry: Response code={res.status_code}, Body={res.data}")
        assert res.status_code == 200
        data = json.loads(res.data)
        assert "submitted successfully" in data["message"]
        print("OK Passed Case 2")

        # Case 3: Spam Prevention / Once per licensing period (Should fail on duplicate)
        # The previous request already set extension_requested = True. Requesting again should fail.
        res = client.post("/api/admin/request-extension")
        print(f"Requesting extension again in same period: Response code={res.status_code}")
        assert res.status_code == 400
        data = json.loads(res.data)
        assert "already been submitted" in data["error"]
        print("OK Passed Case 3 (Spam Prevention)")

        # Case 4: 180 Days License, 20 days before expiry (Should fail - threshold is 15 days)
        # term = 180 days, expires_at = now + 20 days, activation = now - 160 days
        activation = now - datetime.timedelta(days=160)
        expiry = now + datetime.timedelta(days=20)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"180 Days License, 20 days before expiry: Response code={res.status_code}, Body={res.data}")
        assert res.status_code == 400
        data = json.loads(res.data)
        assert "not eligible for extension request yet" in data["error"]
        print("OK Passed Case 4")

        # Case 5: 180 Days License, 10 days before expiry (Should succeed)
        # term = 180 days, expires_at = now + 10 days, activation = now - 170 days
        activation = now - datetime.timedelta(days=170)
        expiry = now + datetime.timedelta(days=10)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"180 Days License, 10 days before expiry: Response code={res.status_code}")
        assert res.status_code == 200
        print("OK Passed Case 5")

        # Case 6: 90 Days License, 10 days before expiry (Should fail - threshold is 7 days)
        # term = 90 days, expires_at = now + 10 days, activation = now - 80 days
        activation = now - datetime.timedelta(days=80)
        expiry = now + datetime.timedelta(days=10)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"90 Days License, 10 days before expiry: Response code={res.status_code}")
        assert res.status_code == 400
        print("OK Passed Case 6")

        # Case 7: 90 Days License, 5 days before expiry (Should succeed)
        activation = now - datetime.timedelta(days=85)
        expiry = now + datetime.timedelta(days=5)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"90 Days License, 5 days before expiry: Response code={res.status_code}")
        assert res.status_code == 200
        print("OK Passed Case 7")

        # Case 8: 30 Days License, 3 days before expiry (Should fail - threshold is 1 day)
        activation = now - datetime.timedelta(days=27)
        expiry = now + datetime.timedelta(days=3)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"30 Days License, 3 days before expiry: Response code={res.status_code}")
        assert res.status_code == 400
        print("OK Passed Case 8")

        # Case 9: 30 Days License, 12 hours before expiry (Should succeed)
        activation = now - datetime.timedelta(days=29.5)
        expiry = now + datetime.timedelta(days=0.5)
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"30 Days License, 12 hours before expiry: Response code={res.status_code}")
        assert res.status_code == 200
        print("OK Passed Case 9")

        # Case 10: Grace Period / Buffer Time check (Any term, standard expired but within 90 days buffer)
        # expires_at = now - 10 days (expired standard contract), trusted_time <= expires_at + 90 days. Should succeed.
        activation = now - datetime.timedelta(days=40)
        expiry = now - datetime.timedelta(days=10) # standard expired 10 days ago
        inject_test_license(conn, activation, expiry)
        
        res = client.post("/api/admin/request-extension")
        print(f"Grace Period check: Response code={res.status_code}")
        assert res.status_code == 200
        print("OK Passed Case 10 (Grace Period)")
        
        print("\n--- ALL TIMING RESTRAINTS & SPAM PREVENTION TESTS PASSED ---")

    finally:
        # Restore generated_licenses.json
        if original_db_content is not None:
            with open(db_file_path, "w", encoding="utf-8") as f:
                f.write(original_db_content)
            print("Restored original provider database registry.")
            
        # Clean state cache file if it was created
        state_file = os.path.join(os.path.dirname(__file__), "..", "utils", "license_state.json")
        if os.path.exists(state_file):
            os.remove(state_file)
            print("Removed license_state.json cache.")

        # Cleanup DB system_license
        conn_clean = pymysql.connect(
            host=db_host, user=db_user, password=db_pass, database=db_name, port=db_port, autocommit=True
        )
        cursor_clean = conn_clean.cursor()
        cursor_clean.execute("TRUNCATE TABLE system_license")
        cursor_clean.close()
        conn_clean.close()
        print("Cleaned up database license table.")

if __name__ == "__main__":
    run_tests()
