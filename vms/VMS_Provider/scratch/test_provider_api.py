import os
import sys
import json
import jwt

# Add VMS_Provider directory to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from app import app, load_licenses, PUBLIC_KEY_PEM

def run_provider_tests():
    print("--- STARTING PROVIDER CONSOLE API TESTS ---")
    client = app.test_client()

    # 1. Access without login should be rejected with 401
    res = client.post("/api/clients/resume", json={"client_id": 1782374069})
    print("Unauthenticated response:", res.status_code, res.get_json())
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"

    # 2. Login using session transaction
    with client.session_transaction() as sess:
        sess['logged_in'] = True
    print("Authenticated successfully.")

    # 3. Get currently terminated client details before test
    licenses_before = load_licenses()
    target_client_id = 1782374069  # Google client ID
    client_before = next((c for c in licenses_before if c["id"] == target_client_id), None)
    assert client_before is not None, "Target client Google not found in database."
    
    # Ensure it's currently terminated for the test
    client_before["terminated_early"] = True
    from app import save_licenses
    save_licenses(licenses_before)
    
    original_key = client_before.get("license_key")
    original_expiry = client_before.get("expires_at")
    original_users = client_before.get("max_users")
    original_sites = client_before.get("max_sites")

    # 4. Resume the client subscription
    res = client.post("/api/clients/resume", json={"client_id": target_client_id})
    print("Resume response:", res.status_code, res.get_json())
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    
    # 5. Reload licenses and assert properties
    licenses_after = load_licenses()
    client_after = next((c for c in licenses_after if c["id"] == target_client_id), None)
    
    assert client_after is not None
    assert client_after["terminated_early"] == False, "terminated_early should be False after resume"
    assert client_after["will_terminate"] == False, "will_terminate should be False after resume"
    
    # Check that key is present
    new_key = client_after.get("license_key")
    assert new_key is not None, "License key token is missing"
    
    # Verify new key token contains the same client details
    payload = jwt.decode(new_key, PUBLIC_KEY_PEM, algorithms=["RS256"])
    assert payload.get("client_name") == "Google"
    assert payload.get("expires_at") == original_expiry
    assert payload.get("max_users") == original_users
    assert payload.get("max_sites") == original_sites
    print("Verified: Newly generated key matches original details perfectly!")
    
    print("--- ALL PROVIDER CONSOLE API TESTS PASSED! ---")

if __name__ == "__main__":
    run_provider_tests()
