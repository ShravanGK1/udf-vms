# tests/test_vms_improvements.py
"""
Test Suite for VMS Improvements:
1. Dynamic Site Management (Super Admin CRUD, uniqueness validation, DB persistence, status toggle)
2. Removal of static default sites
3. Admin Add User (mandatory authorized site validation, unauthorized site rejection, persistence in user_sites)
4. Database integrity and isolation
"""

import sys
import os
import unittest
import json
import time

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app import app
from db import get_db_connection
from utils.auth_utils import generate_token

class TestVMSImprovements(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

        # Connect to DB to fetch or prepare test users
        conn = get_db_connection()
        assert conn is not None, "Database connection failed"
        cursor = conn.cursor()

        # Find existing superadmin or create one for test
        cursor.execute("SELECT user_id, email, customer_id FROM users WHERE role = 'superadmin' LIMIT 1")
        sa_row = cursor.fetchone()
        if sa_row:
            cls.superadmin_id = sa_row[0]
            cls.superadmin_email = sa_row[1]
            cls.customer_id = sa_row[2] or 1
        else:
            cursor.execute("INSERT INTO customers (company_name) VALUES ('Test Org')")
            cls.customer_id = cursor.lastrowid
            cursor.execute("INSERT INTO users (name, email, password, role, customer_id) VALUES ('Super Admin', 'test_sa@vms.com', 'hash', 'superadmin', %s)", (cls.customer_id,))
            cls.superadmin_id = cursor.lastrowid
            cls.superadmin_email = 'test_sa@vms.com'
            conn.commit()

        # Generate tokens
        cls.superadmin_token = generate_token(cls.superadmin_id, "superadmin")

        cursor.close()
        conn.close()

    @classmethod
    def tearDownClass(cls):
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sites WHERE name LIKE 'Dynamic Branch%' OR name LIKE 'Updated Branch%' OR name LIKE 'Branch Update Test%' OR name LIKE 'Site For User%'")
            cursor.execute("DELETE FROM users WHERE email LIKE 'host_%@test.com'")
            conn.commit()
            cursor.close()
            conn.close()

    def test_01_get_sites_returns_db_sites_without_hardcoded_defaults(self):
        """Verify GET /api/admin/sites-list loads real DB data and deleted sites are never silently recreated."""
        # Clean any historical test sites that were previously auto-synced
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sites WHERE name IN ('Custom Test Site A', 'Custom Test Site B')")
        conn.commit()
        cursor.close()
        conn.close()

        # Call stats, companies-sites, and sites-list (which used to trigger sync_db_sites)
        self.client.get("/api/admin/superadmin-stats", headers={"Authorization": f"Bearer {self.superadmin_token}"})
        self.client.get("/api/admin/companies-sites", headers={"Authorization": f"Bearer {self.superadmin_token}"})
        res = self.client.get(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, list)
        
        # Verify deleted test sites were NOT silently re-injected
        site_names = [s.get("name") for s in data]
        self.assertNotIn("Custom Test Site A", site_names)
        self.assertNotIn("Custom Test Site B", site_names)

        # Check fields in returned objects
        if len(data) > 0:
            first_site = data[0]
            self.assertIn("site_id", first_site)
            self.assertIn("name", first_site)
            self.assertIn("code", first_site)
            self.assertIn("address", first_site)
            self.assertIn("status", first_site)

    def test_02_create_site_requires_superadmin(self):
        """Verify unauthorized caller cannot create a site."""
        host_token = generate_token(999, "host")
        res = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {host_token}"},
            json={
                "name": "Unauthorized Site",
                "address": "Nowhere"
            }
        )
        self.assertEqual(res.status_code, 403)

        # Invalid token
        res_bad = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": "Bearer invalid_token_123"},
            json={
                "name": "Unauthorized Site",
                "address": "Nowhere"
            }
        )
        self.assertIn(res_bad.status_code, [401, 403])

    def test_03_create_site_validation_and_persistence(self):
        """Verify Super Admin can create a site with uniqueness check."""
        timestamp = int(time.time())
        site_name = f"Dynamic Branch {timestamp}"
        site_code = f"DB-{timestamp % 10000:04d}"

        # 1. Missing name/address fails
        res_fail = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={"name": "", "address": ""}
        )
        self.assertEqual(res_fail.status_code, 400)

        # 2. Valid creation succeeds
        res = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": site_name,
                "code": site_code,
                "address": "123 Tech Park Road",
                "lat": "18.5204",
                "lng": "73.8567",
                "status": "Active"
            }
        )
        self.assertEqual(res.status_code, 201)
        created_data = res.get_json()
        self.assertIn("site_id", created_data)
        new_site_id = created_data["site_id"]

        # 3. Duplicate name returns 409 Conflict
        res_dup_name = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": site_name,
                "code": f"DIFF-{timestamp % 1000}",
                "address": "Another address"
            }
        )
        self.assertEqual(res_dup_name.status_code, 409)

        # 4. Duplicate code returns 409 Conflict
        res_dup_code = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": f"Different Name {timestamp}",
                "code": site_code,
                "address": "Another address"
            }
        )
        self.assertEqual(res_dup_code.status_code, 409)

        # 5. Site is stored in DB
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT site_id, name, code, status FROM sites WHERE site_id = %s", (new_site_id,))
        row = cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[1], site_name)
        self.assertEqual(row[2], site_code)

        # 6. Creator is linked in user_sites
        cursor.execute("SELECT * FROM user_sites WHERE user_id = %s AND site_id = %s", (self.superadmin_id, new_site_id))
        self.assertIsNotNone(cursor.fetchone())
        cursor.close()
        conn.close()

    def test_04_update_and_status_toggle_site(self):
        """Verify Super Admin can update site details and toggle active status."""
        timestamp = int(time.time())
        site_name = f"Branch Update Test {timestamp}"
        site_code = f"UT-{timestamp % 10000:04d}"

        # Create site
        res = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": site_name,
                "code": site_code,
                "address": "Initial Address",
                "status": "Active"
            }
        )
        self.assertEqual(res.status_code, 201)
        site_id = res.get_json()["site_id"]

        # Update site details
        updated_name = f"Updated Branch {timestamp}"
        res_put = self.client.put(
            f"/api/admin/sites-list/{site_id}",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": updated_name,
                "code": site_code,
                "address": "Updated Address 456",
                "status": "Active"
            }
        )
        self.assertEqual(res_put.status_code, 200)

        # Toggle status to Inactive
        res_patch = self.client.patch(
            f"/api/admin/sites-list/{site_id}/status",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={"status": "Inactive"}
        )
        self.assertEqual(res_patch.status_code, 200)
        self.assertEqual(res_patch.get_json()["status"], "Inactive")

        # Toggle back to Active
        res_patch2 = self.client.patch(
            f"/api/admin/sites-list/{site_id}/status",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res_patch2.status_code, 200)
        self.assertEqual(res_patch2.get_json()["status"], "Active")

    def test_05_admin_add_user_mandatory_site_validation(self):
        """Verify user creation requires a valid, authorized site selection."""
        timestamp = int(time.time())

        # 1. Missing site_id fails with 400
        res_no_site = self.client.post(
            "/api/admin/add-user",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": "Test Host User",
                "email": f"host_{timestamp}@test.com",
                "password": "Password@123",
                "role": "host",
                "department": "IT"
                # site_id omitted
            }
        )
        self.assertEqual(res_no_site.status_code, 400)
        self.assertIn("site", res_no_site.get_json()["error"].lower())

        # 2. Non-existent site_id fails
        res_bad_site = self.client.post(
            "/api/admin/add-user",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": "Test Host User",
                "email": f"host_{timestamp}@test.com",
                "password": "Password@123",
                "role": "host",
                "department": "IT",
                "site_id": 999999
            }
        )
        self.assertEqual(res_bad_site.status_code, 400)

        # 3. Create a valid site first
        res_site = self.client.post(
            "/api/admin/sites-list",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": f"Site For User {timestamp}",
                "code": f"SFU-{timestamp % 1000}",
                "address": "Floor 3",
                "status": "Active"
            }
        )
        valid_site_id = res_site.get_json()["site_id"]

        # 4. Create user with valid site succeeds
        new_user_email = f"host_{timestamp}@test.com"
        res_success = self.client.post(
            "/api/admin/add-user",
            headers={"Authorization": f"Bearer {self.superadmin_token}"},
            json={
                "name": "Valid Host User",
                "email": new_user_email,
                "password": "Password@123",
                "role": "host",
                "department": "IT",
                "site_id": valid_site_id
            }
        )
        self.assertEqual(res_success.status_code, 201)
        created_user = res_success.get_json()
        new_user_id = created_user["user_id"]

        # 5. Verify user is in user_sites table
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT site_id FROM user_sites WHERE user_id = %s", (new_user_id,))
        user_sites = [r[0] for r in cursor.fetchall()]
        self.assertIn(valid_site_id, user_sites)

        # 6. Verify user list endpoint includes assigned site
        cursor.close()
        conn.close()

        res_users = self.client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res_users.status_code, 200)
        users_list = res_users.get_json()
        matching_user = next((u for u in users_list if u["id"] == new_user_id), None)
        self.assertIsNotNone(matching_user)
        self.assertTrue(len(matching_user.get("sites", [])) > 0 or matching_user.get("site_ids") is not None)

if __name__ == "__main__":
    unittest.main()
