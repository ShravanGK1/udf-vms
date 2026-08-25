import os
import sys
import datetime
import jwt
import json

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app import app
from utils.license_verifier import get_license_details, verify_system_license

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

def run_api_tests():
    print("--- STARTING API RESUMPTION TESTS ---")
    client = app.test_client()

    # 1. Run simulate_suspended logic
    import pymysql
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
    
    # Let's insert a suspended license key with a specific expiration time (e.g. 10 days from now)
    # and a start date 5 days in the past to verify the start date is preserved
    original_activation_time = datetime.datetime.now() - datetime.timedelta(days=5)
    expiry_time = datetime.datetime.utcnow() + datetime.timedelta(days=10)
    
    payload = {
        "client_name": "Sumeet Group (Current Server)",
        "expires_at": expiry_time.isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    suspended_token = jwt.encode(payload, private_key_pem, algorithm="RS256")
    
    cursor.execute("TRUNCATE TABLE system_license")
    cursor.execute(
        "INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early) VALUES (%s, %s, FALSE, TRUE)",
        (suspended_token, original_activation_time)
    )
    conn.close()

    print("Suspension simulated with activation_time:", original_activation_time)

    # Verify that get_license_status reports TERMINATED
    res = client.get("/api/license-status")
    data = json.loads(res.data)
    assert data["status"] == "TERMINATED", f"Expected TERMINATED, got {data['status']}"
    print("Pre-test status check PASS: status is TERMINATED.")

    # 2. Try to activate a key with a DIFFERENT expiration date (e.g. 20 days from now)
    mismatch_expiry_time = datetime.datetime.utcnow() + datetime.timedelta(days=20)
    mismatch_payload = {
        "client_name": "Sumeet Group (Current Server)",
        "expires_at": mismatch_expiry_time.isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    mismatch_token = jwt.encode(mismatch_payload, private_key_pem, algorithm="RS256")

    res = client.post("/api/activate-license", json={"license_key": mismatch_token})
    data = json.loads(res.data)
    
    print("Mismatch test response:", data)
    assert res.status_code == 400, f"Expected 400, got {res.status_code}"
    assert "must remain identical" in data.get("error", ""), f"Unexpected error message: {data.get('error')}"
    print("Test 1 PASS: API correctly rejected key with mismatching expiration date!")

    # 3. Try to activate a key with the SAME expiration date
    matching_payload = {
        "client_name": "Sumeet Group (Current Server)",
        "expires_at": expiry_time.isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    matching_token = jwt.encode(matching_payload, private_key_pem, algorithm="RS256")

    res = client.post("/api/activate-license", json={"license_key": matching_token})
    data = json.loads(res.data)
    
    print("Match test response:", data)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert "resumed successfully" in data.get("message", "").lower(), f"Unexpected success message: {data.get('message')}"
    print("Test 2 PASS: API successfully accepted matching key and resumed services!")

    # 4. Verify that the start date (activation_time) in the DB is preserved
    new_key, new_activation_time, will_terminate, terminated_early = get_license_details()
    assert not terminated_early, "License is still marked as terminated early!"
    
    # Compare original and new activation times (ignoring microseconds due to database storage limits if any)
    time_diff = abs((original_activation_time - new_activation_time).total_seconds())
    assert time_diff < 2, f"Activation time changed! Original: {original_activation_time}, New: {new_activation_time}"
    print(f"Test 3 PASS: Start date preserved successfully! Time difference: {time_diff}s")

    # Verify get_license_status reports ACTIVE now
    res = client.get("/api/license-status")
    data = json.loads(res.data)
    assert data["status"] == "ACTIVE", f"Expected ACTIVE, got {data['status']}"
    print("Post-test status check PASS: status is ACTIVE.")
    
    print("--- ALL API RESUMPTION TESTS PASSED! ---")

if __name__ == "__main__":
    run_api_tests()
