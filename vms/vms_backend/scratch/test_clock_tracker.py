import os
import json
import datetime
import hashlib
import sys

# Add backend directories to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "utils"))

from utils.license_verifier import (
    STATE_FILE,
    SECRET_SALT,
    init_license_state,
    save_state_safely,
    increment_license_minutes,
    verify_system_license,
    verify_monotonic_time
)

def test_tracker_logic():
    print("--- STARTING CLOCK TRACKER & 24H VERIFICATION TESTS ---")
    
    # Clean up previous state file
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)

    # 1. Initialize state
    print("[Step 1] Initializing state file...")
    init_license_state()
    assert os.path.exists(STATE_FILE), "State file should exist after init."
    
    with open(STATE_FILE, "r") as f:
        data = json.load(f)
    print("Initialized State:", data)
    assert data["accumulated_minutes"] == 0
    assert data["tampered"] is False

    # 2. Simulate background counting minutes up to 1439 (just before 24-hour mark)
    print("[Step 2] Simulating 1439 minutes elapsed...")
    past_checkpoint = datetime.datetime.utcnow() - datetime.timedelta(days=1)
    data["last_verified_time"] = past_checkpoint.isoformat()
    data["accumulated_minutes"] = 1439
    save_state_safely(data)
    
    increment_license_minutes()
    
    with open(STATE_FILE, "r") as f:
        data = json.load(f)
    print("State after 1440th minute check:", data)
    
    # Since accumulated reached 1440, it should trigger 24-hour verification block.
    # Because we did not wind back the clock, current system UTC time is >= checkpoint.
    # Therefore, expected check should PASS, resetting minutes to 0 and advancing checkpoint.
    assert data["accumulated_minutes"] == 0, "Uptime minutes counter should reset to 0 after 24h transition."
    assert data["tampered"] is False, "Clock should not be tampered."
    
    # 3. Simulate clock winding back during the 24-hour check
    print("[Step 3] Simulating clock windback at 24-hour mark...")
    # Set last checkpoint into the future (so system time looks like it was wound back)
    future_checkpoint = datetime.datetime.utcnow() + datetime.timedelta(hours=2)
    data["last_verified_time"] = future_checkpoint.isoformat()
    data["accumulated_minutes"] = 1439
    save_state_safely(data)
    
    # Run the 1440th minute check
    increment_license_minutes()
    
    with open(STATE_FILE, "r") as f:
        data = json.load(f)
    print("State after clock windback detection:", data)
    assert data["tampered"] is True, "State should be marked tampered."
    assert "expected_db_time" in data, "Should store expected database checkpoint time."

    # 4. Verify that monotonic check blocks access
    print("[Step 4] Checking license verification status under tampered clock...")
    res, bound = verify_monotonic_time(datetime.datetime.utcnow())
    assert res is False, "Clock verification should fail under tampering."
    print("Tampered state result successfully caught.")

    # 5. Verify recovery when the clock is corrected back
    print("[Step 5] Simulating clock correction to check automatic recovery...")
    # Simulate current time moving past the expected_db_time
    expected_db_time = datetime.datetime.fromisoformat(data["expected_db_time"])
    future_corrected_time = expected_db_time + datetime.timedelta(minutes=5)
    
    res, bound = verify_monotonic_time(future_corrected_time)
    assert res is True, "Verification should recover when system time is restored."
    
    with open(STATE_FILE, "r") as f:
        data = json.load(f)
    print("State after automatic recovery:", data)
    assert data["tampered"] is False, "Tampered flag should be cleared."
    assert data["accumulated_minutes"] == 0, "Uptime minutes counter should reset to 0 after recovery."
    
    # Clean up state file after tests
    if os.path.exists(STATE_FILE):
        os.remove(STATE_FILE)
    print("--- ALL CLOCK TRACKER TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    test_tracker_logic()
