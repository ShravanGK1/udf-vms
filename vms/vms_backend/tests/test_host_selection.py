import os
import sys
import unittest
import json
import base64

# Add backend root to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from db import get_db_connection

class TestHostSelectionWorkflow(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        self.conn = get_db_connection()
        self.cursor = self.conn.cursor()

        # Ensure test hosts and security users exist
        # Host: Manish Godase (role: 'host')
        self.cursor.execute("SELECT user_id FROM users WHERE email = 'manishgodase@test.com'")
        row = self.cursor.fetchone()
        if not row:
            self.cursor.execute("""
                INSERT INTO users (name, email, password, role, department, status)
                VALUES ('Manish Godase', 'manishgodase@test.com', 'Host@123', 'host', 'Engineering', 'Active')
            """)
            self.host_id = self.cursor.lastrowid
        else:
            self.host_id = row[0]

        # Security Operator: Aashish Paigude (role: 'security')
        self.cursor.execute("SELECT user_id FROM users WHERE email = 'aashishpaigude_sec@test.com'")
        row = self.cursor.fetchone()
        if not row:
            self.cursor.execute("""
                INSERT INTO users (name, email, password, role, department, status)
                VALUES ('Aashish Paigude', 'aashishpaigude_sec@test.com', 'Sec@123', 'security', 'Security', 'Active')
            """)
            self.security_id = self.cursor.lastrowid
        else:
            self.security_id = row[0]

        self.conn.commit()

    def tearDown(self):
        if hasattr(self, 'created_request_ids'):
            for req_id in self.created_request_ids:
                self.cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (req_id,))
            self.conn.commit()
        self.cursor.close()
        self.conn.close()

    def test_01_get_hosts_endpoint(self):
        """Test GET /api/hosts returns enrolled hosts and excludes security guards"""
        res = self.client.get("/api/hosts")
        self.assertEqual(res.status_code, 200)
        hosts = res.get_json()
        self.assertIsInstance(hosts, list)
        
        # Verify Manish Godase is present
        host_names = [h["name"] for h in hosts]
        self.assertIn("Manish Godase", host_names)
        
        # Verify security users are excluded
        roles = [h["role"].lower() for h in hosts]
        self.assertNotIn("security", roles)

    def test_02_create_request_with_invalid_host(self):
        """Test creating visitor request with security user as host fails with 400"""
        payload = {
            "visitor_name": "Test Visitor",
            "full_name": "Test Visitor",
            "email": "testvisitor@example.com",
            "mobile_number": "+919876543210",
            "purpose": "Meeting",
            "host_id": self.security_id,  # Invalid: security guard is not a host
            "person_to_visit": "Aashish Paigude"
        }
        res = self.client.post("/api/visitor-requests", json=payload)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("not an eligible host", data.get("error", "").lower())

    def test_03_create_request_with_valid_host(self):
        """Test creating visitor request with valid host succeeds"""
        payload = {
            "visitor_name": "Vitthal",
            "full_name": "Vitthal",
            "email": "vitthal@test.com",
            "mobile_number": "+919123456789",
            "purpose": "Discussion",
            "host_id": self.host_id,
            "person_to_visit": "Manish Godase"
        }
        res = self.client.post("/api/visitor-requests", json=payload)
        self.assertIn(res.status_code, [200, 201])
        data = res.get_json()
        self.assertIn("request_id", data)
        req_id = data["request_id"]
        
        if not hasattr(self, 'created_request_ids'):
            self.created_request_ids = []
        self.created_request_ids.append(req_id)

        # Verify host_id in database
        self.cursor.execute("SELECT host_id FROM visitor_requests WHERE request_id = %s", (req_id,))
        db_host_id = self.cursor.fetchone()[0]
        self.assertEqual(db_host_id, self.host_id)

    def test_04_acceptance_criteria_host_vs_checkin_operator(self):
        """Acceptance Criteria Test: Host=Manish Godase, Security=Aashish Paigude. Report MUST show Person Visited = Manish Godase."""
        # Step A: Create request for Visitor Vitthal to visit Host Manish Godase
        payload = {
            "visitor_name": "Vitthal",
            "full_name": "Vitthal",
            "email": "vitthal_acc@test.com",
            "mobile_number": "+919988776655",
            "purpose": "Vendor Visit",
            "host_id": self.host_id,
            "person_to_visit": "Manish Godase"
        }
        res = self.client.post("/api/visitor-requests", json=payload)
        self.assertIn(res.status_code, [200, 201])
        req_id = res.get_json()["request_id"]
        if not hasattr(self, 'created_request_ids'):
            self.created_request_ids = []
        self.created_request_ids.append(req_id)

        # Step B: Security Guard Aashish Paigude checks in Visitor Vitthal
        # 1x1 white PNG base64
        valid_sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
        checkin_res = self.client.post(f"/api/security/checkin/{req_id}", json={
            "physical_badge_no": "BADGE-101",
            "signature": valid_sig,
            "checked_in_by": self.security_id
        })
        self.assertEqual(checkin_res.status_code, 200)

        # Step C: Fetch reports and verify Person Visited & Checked In By
        report_res = self.client.get("/api/reports?period=daily")
        self.assertEqual(report_res.status_code, 200)
        report_data = report_res.get_json()
        visitors_list = report_data.get("visitors", [])
        
        target_visitor = None
        for v in visitors_list:
            if v.get("email") == "vitthal_acc@test.com" or v.get("visitor_id") == req_id:
                target_visitor = v
                break

        self.assertIsNotNone(target_visitor, "Created visitor request was not found in report")
        
        # CRITICAL VERIFICATIONS:
        # Person Visited MUST be Manish Godase
        self.assertEqual(target_visitor.get("person_visited"), "Manish Godase", 
                         f"Expected PERSON VISITED = 'Manish Godase', got '{target_visitor.get('person_visited')}'")
        self.assertNotEqual(target_visitor.get("person_visited"), "Aashish Paigude", 
                            "PERSON VISITED MUST NOT be security guard Aashish Paigude")
        
        # Checked In By MUST be Aashish Paigude
        self.assertEqual(target_visitor.get("checked_in_by"), "Aashish Paigude",
                         f"Expected CHECKED IN BY = 'Aashish Paigude', got '{target_visitor.get('checked_in_by')}'")

if __name__ == "__main__":
    unittest.main()
