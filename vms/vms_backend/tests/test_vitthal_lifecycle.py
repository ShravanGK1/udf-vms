import os
import sys
import unittest

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from db import get_db_connection

class TestVisitorCheckoutSignatureLifecycle(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        self.conn = get_db_connection()
        self.cursor = self.conn.cursor()

    def tearDown(self):
        if hasattr(self, 'request_id') and self.request_id:
            self.cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (self.request_id,))
        if hasattr(self, 'visitor_id') and self.visitor_id:
            self.cursor.execute("DELETE FROM visitors WHERE visitor_id = %s", (self.visitor_id,))
        self.conn.commit()
        self.cursor.close()
        self.conn.close()

    def test_complete_visitor_signature_lifecycle(self):
        """
        Required Test Case:
        Visitor: Vitthal
        Host: Manish Godase
        Security Guard: Aashish Paigude

        CHECK-IN:
            Signature: Signature A
            Result: Status Inside Site

        TEMPORARY CHECKOUT:
            No signature requested.
            Result: Visitor temporarily checked out.

        VISITOR RETURNS:
            Temp check-in.

        PERMANENT CHECKOUT:
            Signature: Signature B
            Result: Visitor permanently checked out.

        Database:
            signature_path: Signature A
            checkout_signature_path: Signature B
            check_in_time: timestamp
            checkout_time: timestamp
        """
        print("\n--- Executing Step 21 Required Test Case ---")

        # 1. Ensure Visitor 'Vitthal' exists or create
        self.cursor.execute("""
            INSERT INTO visitors (visitor_name, mobile_number, email, person_to_visit, company_name)
            VALUES ('Vitthal', '9876543210', 'vitthal@example.com', 'Manish Godase', 'Test Corp')
        """)
        self.visitor_id = self.cursor.lastrowid

        # 2. Create Visitor Request
        self.cursor.execute("""
            INSERT INTO visitor_requests (visitor_id, host_id, purpose, scheduled_date, scheduled_time, status, created_at)
            VALUES (%s, 1, 'Official Meeting', CURRENT_DATE, CURRENT_TIME, 'APPROVED', NOW())
        """, (self.visitor_id,))
        self.request_id = self.cursor.lastrowid
        self.conn.commit()

        # Dummy Base64 Signatures A and B (Valid PNGs)
        sig_a_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        sig_b_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

        # --- STEP A: CHECK-IN WITH SIGNATURE A ---
        print("[Step A] Performing Check-In with Signature A...")
        res_checkin = self.client.post(f"/api/security/checkin/{self.request_id}", json={
            "physical_badge_no": "BADGE-V1",
            "signature": sig_a_b64
        })
        self.assertEqual(res_checkin.status_code, 200, f"Check-in failed: {res_checkin.get_json()}")

        # Verify Check-In Signature A saved in DB
        self.cursor.execute("""
            SELECT check_in_time, signature_path, checkout_signature_path, is_temp_out
            FROM visitor_requests WHERE request_id = %s
        """, (self.request_id,))
        row_checkin = self.cursor.fetchone()
        check_in_time_val = row_checkin[0]
        sig_a_path = row_checkin[1]
        self.assertIsNotNone(check_in_time_val, "check_in_time must be set")
        self.assertIsNotNone(sig_a_path, "signature_path (Signature A) must be saved")
        self.assertTrue(sig_a_path.startswith("uploads/signatures/sig_"), "signature_path must use sig_ prefix")
        self.assertIsNone(row_checkin[2], "checkout_signature_path must be NULL at check-in")
        print(f" -> Check-In Signature A saved at: {sig_a_path}")

        # --- STEP B: TEMPORARY CHECKOUT (NO SIGNATURE) ---
        print("[Step B] Performing Temporary Checkout (No Signature)...")
        res_temp_out = self.client.post(f"/api/security/temp-checkout/{self.request_id}")
        self.assertEqual(res_temp_out.status_code, 200, "Temp checkout should succeed without signature")

        # Verify DB: is_temp_out = TRUE, signature_path = Signature A, checkout_signature_path = NULL
        self.cursor.execute("""
            SELECT is_temp_out, temp_out_time, signature_path, checkout_signature_path
            FROM visitor_requests WHERE request_id = %s
        """, (self.request_id,))
        row_temp = self.cursor.fetchone()
        self.assertEqual(row_temp[0], 1, "is_temp_out must be TRUE")
        self.assertIsNotNone(row_temp[1], "temp_out_time must be recorded")
        self.assertEqual(row_temp[2], sig_a_path, "Check-in Signature A must remain unchanged")
        self.assertIsNone(row_temp[3], "checkout_signature_path must remain NULL during temp checkout")
        print(" -> Temporary Checkout verified. Signature A untouched, no checkout signature requested.")

        # --- STEP C: VISITOR RETURNS (TEMP CHECK-IN) ---
        print("[Step C] Visitor Vitthal returns (Temp Check-In)...")
        res_temp_in = self.client.post(f"/api/security/temp-checkin/{self.request_id}")
        self.assertEqual(res_temp_in.status_code, 200)

        self.cursor.execute("SELECT is_temp_out FROM visitor_requests WHERE request_id = %s", (self.request_id,))
        self.assertEqual(self.cursor.fetchone()[0], 0, "is_temp_out must be FALSE after return")
        print(" -> Visitor Vitthal re-entered site successfully.")

        # --- STEP D: PERMANENT CHECKOUT WITHOUT SIGNATURE (MUST BE BLOCKED) ---
        print("[Step D] Attempting Permanent Checkout WITHOUT signature (Must fail)...")
        res_no_sig_checkout = self.client.post(f"/api/security/checkout/{self.request_id}", json={})
        self.assertEqual(res_no_sig_checkout.status_code, 400, "Permanent checkout without signature must return HTTP 400")
        self.assertIn("signature", res_no_sig_checkout.get_json().get("error", "").lower())
        print(" -> Permanent checkout blocked without signature as required.")

        # --- STEP E: PERMANENT CHECKOUT WITH SIGNATURE B ---
        print("[Step E] Performing Permanent Checkout with Signature B...")
        res_perm_out = self.client.post(f"/api/security/checkout/{self.request_id}", json={
            "checkout_signature": sig_b_b64
        })
        self.assertEqual(res_perm_out.status_code, 200, f"Permanent checkout failed: {res_perm_out.get_json()}")

        # --- STEP F: DATABASE VERIFICATION ---
        print("[Step F] Verifying Database records...")
        self.cursor.execute("""
            SELECT request_id, signature_path, checkout_signature_path, check_in_time, check_out_time
            FROM visitor_requests WHERE request_id = %s
        """, (self.request_id,))
        final_row = self.cursor.fetchone()
        
        final_req_id = final_row[0]
        final_sig_a = final_row[1]
        final_sig_b = final_row[2]
        final_checkin_time = final_row[3]
        final_checkout_time = final_row[4]

        print(f"  request_id: {final_req_id}")
        print(f"  signature_path (Check-In): {final_sig_a}")
        print(f"  checkout_signature_path (Checkout): {final_sig_b}")
        print(f"  check_in_time: {final_checkin_time}")
        print(f"  check_out_time: {final_checkout_time}")

        # Assertions
        self.assertEqual(final_sig_a, sig_a_path, "Check-in signature A MUST NOT be overwritten")
        self.assertIsNotNone(final_sig_b, "Checkout signature B MUST be present")
        self.assertTrue(final_sig_b.startswith("uploads/signatures/checkout_sig_"), "Checkout signature MUST use checkout_sig_ prefix")
        self.assertNotEqual(final_sig_a, final_sig_b, "Check-in and checkout signatures MUST be separate files")
        self.assertIsNotNone(final_checkin_time, "Check-in timestamp MUST exist")
        self.assertIsNotNone(final_checkout_time, "Checkout timestamp MUST exist")

        print("--- Required Test Case PASSED SUCCESSFULLY ---\n")

if __name__ == '__main__':
    unittest.main()
