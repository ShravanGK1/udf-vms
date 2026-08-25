import os
import json
import datetime
import jwt
import sys

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from utils.license_verifier import verify_system_license, STATE_FILE, SECRET_SALT
import hashlib

def run_tests():
    print("--- STARTING LICENSING & CLOCK-TAMPER-PROOF TESTS ---")
    
    # 1. Clean up existing state file
    if os.path.exists(STATE_FILE):
        try:
            os.remove(STATE_FILE)
            print("Cleaned up previous state file.")
        except Exception as e:
            print(f"Error removing state file: {e}")
            
    # 2. Simulate standard license key generation (equivalent to Provider App)
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

    payload = {
        "client_name": "Test Company",
        "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(days=10)).isoformat(),
        "max_users": 100,
        "max_sites": 10
    }
    
    token = jwt.encode(payload, private_key_pem, algorithm="RS256")
    
    # 2b. Test Database Storage
    from utils.license_verifier import save_license_to_db, get_stored_license
    db_save_ok = save_license_to_db(token)
    assert db_save_ok, "Failed to save license to database."
    print("Database license storage tested: Saved license token.")

    stored_token = get_stored_license()
    assert stored_token == token, "Retrieved token from database does not match saved token."
    print("Database license retrieval tested: Stored token matches successfully.")

    # 3. Test 1: Verify license with fresh state (should succeed)

    res = verify_system_license()
    print("Test 1 Result:", res)
    assert res["status"] == "ACTIVE", f"Expected ACTIVE status, got: {res.get('status')}"
    print("Test 1 PASS: License correctly verified and active!")

    # 4. Test 2: Clock-winding Offline Check.
    # We simulate clock manipulation by manually editing the high-watermark state file into the future
    future_time = datetime.datetime.utcnow() + datetime.timedelta(days=2)
    time_str = future_time.isoformat()
    sig_data = time_str + "0" + "False" + SECRET_SALT
    new_hash = hashlib.sha256(sig_data.encode()).hexdigest()
    
    with open(STATE_FILE, "w") as f:
        json.dump({
            "last_verified_time": time_str,
            "accumulated_minutes": 0,
            "tampered": False,
            "hash": new_hash
        }, f, indent=4)
    print(f"Manually wrote future high watermark ({time_str}) to state file to simulate clock winding back.")
    
    res = verify_system_license()
    print("Test 2 Result:", res)
    assert res["status"] == "CLOCK_TAMPERED", f"Expected CLOCK_TAMPERED status, got: {res.get('status')}"
    print("Test 2 PASS: Clock tampering successfully blocked!")

    # 5. Test 3: State File Hash Mismatch (Tampering with the state file contents)
    with open(STATE_FILE, "w") as f:
        json.dump({
            "last_verified_time": time_str,
            "hash": "invalid-tampered-hash-signature"
        }, f, indent=4)
    print("Manually wrote invalid hash in state file to simulate tampering.")
    
    res = verify_system_license()
    print("Test 3 Result:", res)
    assert res["status"] == "CLOCK_TAMPERED", f"Expected CLOCK_TAMPERED status, got: {res.get('status')}"
    assert "corrupted" in res.get("error", "").lower()
    print("Test 3 PASS: State file tampering correctly blocked!")

    # Clean up state file after tests
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)
    print("Cleaned up test state file.")
    print("--- ALL LICENSING TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
