# scratch/test_test_license.py

import os
import sys
import datetime
import jwt
from unittest.mock import patch

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from utils.license_verifier import verify_system_license

# RSA private key for JWT generation (matching license_verifier.py's public key)
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
    print("--- STARTING TESTING PERIOD LICENSE TESTS (2-HOUR / 30-MIN BUFFER) ---")
    
    temp_state_file = os.path.join(os.path.dirname(__file__), "test_license_state.json")
    if os.path.exists(temp_state_file):
        try:
            os.remove(temp_state_file)
        except Exception:
            pass
            
    now = datetime.datetime.utcnow()
    
    # 2-hour license: standard duration is 2 hours. Expiry = now + 1 hour. Activation = now - 1 hour.
    activation = now - datetime.timedelta(hours=1)
    expiry = now + datetime.timedelta(hours=1)
    
    payload = {
        "client_name": "Testing Period Client",
        "expires_at": expiry.isoformat(),
        "max_users": 10,
        "max_sites": 2,
        "machine_uuid": "device-uuid-1, device-uuid-2" # Multiple devices allowed
    }
    
    token = jwt.encode(payload, private_key_pem, algorithm="RS256")
    
    with patch("utils.license_verifier.STATE_FILE", temp_state_file):
        # Test Case 1: Active state on Device 1
        with patch("utils.license_verifier.get_machine_uuid", return_value="device-uuid-1"), \
             patch("utils.license_verifier.get_license_details", return_value=(token, activation, False, False)):
            res = verify_system_license()
            print("Device 1 active state verification:", res)
            assert res["status"] == "ACTIVE"
            assert res["is_test_license"] is True
            assert res["buffer_minutes"] == 30
            assert res["minutes_remaining"] > 0
            assert res["is_in_buffer"] is False
            
        # Test Case 2: Active state on Device 2
        with patch("utils.license_verifier.get_machine_uuid", return_value="device-uuid-2"), \
             patch("utils.license_verifier.get_license_details", return_value=(token, activation, False, False)):
            res = verify_system_license()
            print("Device 2 active state verification:", res)
            assert res["status"] == "ACTIVE"
            
        # Test Case 3: Reject on unauthorized Device 3
        with patch("utils.license_verifier.get_machine_uuid", return_value="device-uuid-3"), \
             patch("utils.license_verifier.get_license_details", return_value=(token, activation, False, False)):
            res = verify_system_license()
            print("Device 3 reject state verification:", res)
            assert res["status"] == "HW_MISMATCH"

        # Test Case 4: Buffer period check (expired by 10 minutes, so within the 30 mins grace period)
        # We mock trusted network time to be 10 minutes after expiry
        test_time = expiry + datetime.timedelta(minutes=10)
        with patch("utils.license_verifier.get_machine_uuid", return_value="device-uuid-1"), \
             patch("utils.license_verifier.get_license_details", return_value=(token, activation, False, False)), \
             patch("utils.license_verifier.get_trusted_network_time", return_value=test_time):
            res = verify_system_license()
            print("Buffer period active verification:", res)
            assert res["status"] == "ACTIVE"
            assert res["is_in_buffer"] is True
            assert res["minutes_remaining_in_buffer"] == 20 # 30 - 10 = 20 mins remaining

        # Test Case 5: Fully expired (expired by 35 minutes, so outside the 30 mins grace period)
        expired_time = expiry + datetime.timedelta(minutes=35)
        with patch("utils.license_verifier.get_machine_uuid", return_value="device-uuid-1"), \
             patch("utils.license_verifier.get_license_details", return_value=(token, activation, False, False)), \
             patch("utils.license_verifier.get_trusted_network_time", return_value=expired_time):
            res = verify_system_license()
            print("Grace period exceeded verification:", res)
            assert res["status"] == "EXPIRED"

    if os.path.exists(temp_state_file):
        try:
            os.remove(temp_state_file)
        except Exception:
            pass

    print("--- ALL LICENSE TEST CASES PASSED SUCCESSFULLY ---")

if __name__ == "__main__":
    run_tests()
