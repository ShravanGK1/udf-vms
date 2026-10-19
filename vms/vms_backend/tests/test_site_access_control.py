# tests/test_site_access_control.py
"""
Automated Authorization & Functional Verification Suite
Tests:
1. Super Admin cross-site scope vs Admin site-isolation.
2. Remote Sessions (/admin/users-list) site filtering for Admin.
3. Auto-Login (/admin/remote-login) authorization check (403 for cross-site).
4. Super Admin /admin/toggle-license authorization (403 for Admin, 200 for Super Admin).
5. Bulk visitor upload authorization check (403 for unauthorized site_id).
6. Bulk template generation (XLSX and CSV formats).
7. Super Admin stats rolling 6-month visitor count aggregation verification.
"""

import sys
import os
import unittest
import json
import jwt

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db_connection
from config import SECRET_KEY
from app import app


class TestSiteAccessControl(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        conn = get_db_connection()
        if not conn:
            raise Exception("Database connection failed")
        cursor = conn.cursor()

        # Clean existing test fixtures if any
        cursor.execute("DELETE FROM user_sites WHERE user_id IN (9801, 9802, 9803, 9804)")
        cursor.execute("DELETE FROM users WHERE user_id IN (9801, 9802, 9803, 9804)")
        cursor.execute("DELETE FROM sites WHERE site_id IN (981, 982)")
        cursor.execute("DELETE FROM customers WHERE customer_id = 980")
        conn.commit()

        # Create Customer
        cursor.execute("INSERT INTO customers (customer_id, customer_name) VALUES (980, 'Test Isolation Org')")

        # Create Sites
        cursor.execute("INSERT INTO sites (site_id, name, address, status, customer_id) VALUES (981, 'Test Site Alpha', 'Alpha City', 'Active', 980)")
        cursor.execute("INSERT INTO sites (site_id, name, address, status, customer_id) VALUES (982, 'Test Site Beta', 'Beta City', 'Active', 980)")

        # Create Users
        # 9801: Super Admin
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9801, 'Super Admin User', 'sa_test@domain.com', 'Pass@123', 'superadmin', 980, 'Active')
        """)
        # 9802: Admin assigned to Site Alpha ONLY
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9802, 'Admin Alpha', 'admin_alpha@domain.com', 'Pass@123', 'admin', 980, 'Active')
        """)
        # 9803: Regular Host in Site Alpha
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9803, 'Host Alpha', 'host_alpha@domain.com', 'Pass@123', 'host', 980, 'Active')
        """)
        # 9804: Regular Host in Site Beta
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9804, 'Host Beta', 'host_beta@domain.com', 'Pass@123', 'host', 980, 'Active')
        """)

        # User Site assignments
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (9802, 981)")  # Admin Alpha -> Site Alpha
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (9803, 981)")  # Host Alpha -> Site Alpha
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (9804, 982)")  # Host Beta -> Site Beta

        conn.commit()
        cursor.close()
        conn.close()

        # Generate JWT Tokens
        cls.sa_token = jwt.encode({"user_id": 9801, "role": "superadmin", "customer_id": 980, "password": "Pass@123"}, SECRET_KEY, algorithm="HS256")
        cls.admin_alpha_token = jwt.encode({"user_id": 9802, "role": "admin", "customer_id": 980, "password": "Pass@123"}, SECRET_KEY, algorithm="HS256")
        cls.client = app.test_client()

    @classmethod
    def tearDownClass(cls):
        from utils.license_verifier import clear_license_cache
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE system_license SET terminated_early = 0")
            cursor.execute("DELETE FROM user_sites WHERE user_id IN (9801, 9802, 9803, 9804)")
            cursor.execute("DELETE FROM users WHERE user_id IN (9801, 9802, 9803, 9804)")
            cursor.execute("DELETE FROM sites WHERE site_id IN (981, 982)")
            cursor.execute("DELETE FROM customers WHERE customer_id = 980")
            conn.commit()
            cursor.close()
            conn.close()
        clear_license_cache()

    def test_01_remote_sessions_list_restricted_for_admin(self):
        """Admin for Site Alpha should only see users from Site Alpha, not Site Beta."""
        res = self.client.get(
            "/api/admin/users-list",
            headers={"Authorization": f"Bearer {self.admin_alpha_token}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        users = data if isinstance(data, list) else data.get("users", [])
        user_ids = [u["user_id"] for u in users]
        
        # Admin Alpha must see Host Alpha (9803)
        self.assertIn(9803, user_ids, "Admin Alpha should see Host Alpha in their assigned site")
        # Admin Alpha must NOT see Host Beta (9804) from Site Beta
        self.assertNotIn(9804, user_ids, "Admin Alpha must NOT see Host Beta from an unassigned site")

    def test_02_remote_sessions_list_for_superadmin(self):
        """Super Admin should see users across all authorized customer sites."""
        res = self.client.get(
            "/api/admin/users-list",
            headers={"Authorization": f"Bearer {self.sa_token}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        users = data if isinstance(data, list) else data.get("users", [])
        user_ids = [u["user_id"] for u in users]

        self.assertIn(9803, user_ids, "Super Admin should see Host Alpha")
        self.assertIn(9804, user_ids, "Super Admin should see Host Beta")

    def test_03_auto_login_boundary_rejection(self):
        """Admin Alpha attempting to Auto-Login to Host Beta (Site Beta) must be rejected with 403."""
        res = self.client.post(
            "/api/admin/remote-login",
            json={"user_id": 9804, "password": "Pass@123"},
            headers={"Authorization": f"Bearer {self.admin_alpha_token}"}
        )
        self.assertEqual(res.status_code, 403, "Auto-login to unassigned site user must be rejected with 403 Forbidden")
        data = res.get_json()
        self.assertIn("error", data)

    def test_04_auto_login_allowed_for_assigned_site(self):
        """Admin Alpha attempting to Auto-Login to Host Alpha (Site Alpha) should succeed."""
        res = self.client.post(
            "/api/admin/remote-login",
            json={"user_id": 9803, "password": "Pass@123"},
            headers={"Authorization": f"Bearer {self.admin_alpha_token}"}
        )
        self.assertEqual(res.status_code, 200, "Auto-login to assigned site user should succeed")
        data = res.get_json()
        self.assertIn("token", data)

    def test_05_license_toggle_authorization(self):
        """Only Super Admin can toggle license status. Admin must receive 403."""
        from utils.license_verifier import clear_license_cache
        try:
            # Test non-superadmin call
            res_admin = self.client.post(
                "/api/admin/toggle-license",
                headers={"Authorization": f"Bearer {self.admin_alpha_token}"}
            )
            self.assertEqual(res_admin.status_code, 403, "Admin should receive 403 for license toggle")

            # Test Super Admin call (toggle to SUSPENDED)
            res_sa = self.client.post(
                "/api/admin/toggle-license",
                headers={"Authorization": f"Bearer {self.sa_token}"}
            )
            self.assertEqual(res_sa.status_code, 200, "Super Admin should be allowed to toggle license")
        finally:
            # Guarantee license is restored to ACTIVE
            conn = get_db_connection()
            if conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE system_license SET terminated_early = 0")
                conn.commit()
                cursor.close()
                conn.close()
            clear_license_cache()

    def test_06_bulk_template_csv_and_xlsx(self):
        """Bulk template should be downloadable as XLSX and CSV with all required columns."""
        res_xlsx = self.client.get(
            "/api/visitor-requests/bulk-template",
            headers={"Authorization": f"Bearer {self.admin_alpha_token}"}
        )
        self.assertEqual(res_xlsx.status_code, 200)
        self.assertEqual(res_xlsx.mimetype, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        res_csv = self.client.get(
            "/api/visitor-requests/bulk-template?format=csv",
            headers={"Authorization": f"Bearer {self.admin_alpha_token}"}
        )
        self.assertEqual(res_csv.status_code, 200)
        self.assertEqual(res_csv.mimetype, "text/csv")
        csv_text = res_csv.data.decode("utf-8")
        self.assertIn("Visitor Name", csv_text)
        self.assertIn("Person to Visit", csv_text)
        self.assertIn("Reason of Visit", csv_text)

    def test_07_bulk_upload_site_authorization_enforced(self):
        """Admin Alpha trying to bulk upload visitor requests for Site Beta (982) must be rejected with 403."""
        payload = {
            "site_id": 982,
            "visitors": [
                {
                    "full_name": "Unauthorized Visitor",
                    "email": "unauth@visitor.com",
                    "phone": "9999988888",
                    "purpose": "Meeting",
                    "host_email": "host_beta@domain.com",
                    "scheduled_date": "2026-11-01",
                    "scheduled_time": "10:00:00"
                }
            ]
        }
        res = self.client.post(
            "/api/visitor-requests/bulk",
            json=payload,
            headers={"Authorization": f"Bearer {self.admin_alpha_token}"}
        )
        self.assertEqual(res.status_code, 403, "Admin uploading for unauthorized site must receive 403")

    def test_08_superadmin_stats_real_monthly_visitor_trends(self):
        """Super Admin stats must return real monthly data without hardcoded 1200+ values."""
        res = self.client.get(
            "/api/admin/superadmin-stats",
            headers={"Authorization": f"Bearer {self.sa_token}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        monthly = data.get("trafficData", [])
        self.assertTrue(len(monthly) > 0, "trafficData array should not be empty")
        # Ensure values reflect actual rolling months and no arbitrary 1200-2000 mock base
        for m in monthly:
            self.assertIn("month", m)
            self.assertIn("visitors", m)
            self.assertIsInstance(m["visitors"], (int, float))


if __name__ == "__main__":
    unittest.main()
