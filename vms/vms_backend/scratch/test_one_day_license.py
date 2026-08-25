import os
import sys
import datetime
import jwt
import json
import pymysql
from unittest.mock import patch

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from utils.license_verifier import verify_system_license

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

def run_tests():
    print("--- STARTING 1-DAY LICENSE & 2-HOUR BUFFER TESTS ---")
    
    # Database connection parameters
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

    # Case 1: Standard Active 1-Day License (Remaining standard: 12 hours, remaining buffer: 2 hours)
    # term = 1 day, expires_at = now + 12 hours, activation = now - 12 hours
    activation = now - datetime.timedelta(hours=12)
    expiry = now + datetime.timedelta(hours=12)
    
    payload = {
        "client_name": "Test Company 1-Day",
        "expires_at": expiry.isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    token = jwt.encode(payload, private_key_pem, algorithm="RS256")
    
    cursor.execute("TRUNCATE TABLE system_license")
    cursor.execute(
        "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early) VALUES (%s, %s, FALSE, FALSE)",
        (token, activation)
    )
    
    # Delete state file to prevent CLOCK_TAMPERED from previous runs
    temp_state_file = os.path.join(os.path.dirname(__file__), "test_license_state.json")
    if os.path.exists(temp_state_file):
        os.remove(temp_state_file)

    with patch("utils.license_verifier.STATE_FILE", temp_state_file):
        res = verify_system_license()
        print("Case 1 Result:", res)
        assert res["status"] == "ACTIVE", f"Expected ACTIVE, got {res['status']}"
        assert res["is_one_day_license"] is True, "Should be flagged as a 1-day license"
        assert res["buffer_hours"] == 2, f"Expected 2 hour buffer, got {res['buffer_hours']}"
        assert res["is_in_buffer"] is False, "Should not be in grace buffer period yet"
        print("PASS: Case 1 - Standard Active 1-Day license verified.")

        # Case 2: Standard Expired but in 2-Hour Buffer Period (Expired 1 hour ago, 1 hour remaining in grace)
        # term = 1 day, expires_at = now - 1 hour, activation = now - 25 hours
        activation = now - datetime.timedelta(hours=25)
        expiry = now - datetime.timedelta(hours=1)
        
        payload["expires_at"] = expiry.isoformat()
        token = jwt.encode(payload, private_key_pem, algorithm="RS256")
        
        cursor.execute("TRUNCATE TABLE system_license")
        cursor.execute(
            "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early) VALUES (%s, %s, FALSE, FALSE)",
            (token, activation)
        )
        
        if os.path.exists(temp_state_file):
            os.remove(temp_state_file)

        res = verify_system_license()
        print("Case 2 Result:", res)
        assert res["status"] == "ACTIVE", f"Expected ACTIVE (in grace), got {res['status']}"
        assert res["is_in_buffer"] is True, "Should be in grace buffer period"
        assert res["hours_remaining_in_buffer"] == 1, f"Expected 1 hour remaining in buffer, got {res['hours_remaining_in_buffer']}"
        print("PASS: Case 2 - 1-Day license in 2-hour grace period verified.")

        # Case 3: Fully Expired 1-Day License (Expired 3 hours ago, 2-hour grace period ended)
        # term = 1 day, expires_at = now - 3 hours, activation = now - 27 hours
        activation = now - datetime.timedelta(hours=27)
        expiry = now - datetime.timedelta(hours=3)
        
        payload["expires_at"] = expiry.isoformat()
        token = jwt.encode(payload, private_key_pem, algorithm="RS256")
        
        cursor.execute("TRUNCATE TABLE system_license")
        cursor.execute(
            "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early) VALUES (%s, %s, FALSE, FALSE)",
            (token, activation)
        )
        
        if os.path.exists(temp_state_file):
            os.remove(temp_state_file)

        res = verify_system_license()
        print("Case 3 Result:", res)
        assert res["status"] == "EXPIRED", f"Expected EXPIRED, got {res['status']}"
        assert "2-hour grace period" in res["error"], f"Expected 2-hour grace message, got {res['error']}"
        print("PASS: Case 3 - Expired 1-Day license blocked successfully.")

    # Cleanup DB license
    cursor.execute("TRUNCATE TABLE system_license")
    conn.close()
    
    if os.path.exists(temp_state_file):
        os.remove(temp_state_file)
        
    print("\n--- ALL 1-DAY LICENSE & 2-HOUR BUFFER TESTS PASSED ---")

if __name__ == "__main__":
    run_tests()
