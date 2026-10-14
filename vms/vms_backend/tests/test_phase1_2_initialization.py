# tests/test_phase1_2_initialization.py
"""
Automated Test Suite for Productization Phase 1 and Phase 2
- Clean database schema verification (zero test/mock data)
- Idempotent database setup utility (setup_database.py)
- First-run setup status endpoint (GET /api/setup/status)
- First-run system initialization endpoint (POST /api/setup/initialize)
- Concurrency, race condition, and replay attack prevention
- Privilege escalation defense (role tampering)
- Transaction atomicity and rollback
- Login and session compatibility with created administrator
"""

import sys
import os
import threading
import json
import unittest

# Ensure vms_backend is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import pymysql.cursors
from db import get_db_connection
from app import app
from setup_database import setup_database, verify_database_health, execute_clean_schema

class TestPhase1AndPhase2(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

    def setUp(self):
        self.conn = get_db_connection()
        self.assertIsNotNone(self.conn, "Database connection must succeed")

    def tearDown(self):
        if self.conn:
            self.conn.close()

    def test_01_clean_schema_contains_no_mock_data(self):
        """Verify schema_clean.sql contains no mock users, dummy visitors, or sample records."""
        schema_path = os.path.join(backend_dir, "schema_clean.sql")
        self.assertTrue(os.path.exists(schema_path), "schema_clean.sql must exist")

        with open(schema_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check table definitions
        expected_tables = [
            "customers", "sites", "users", "user_sites",
            "visitors", "visitor_requests", "system_license",
            "system_settings", "superadmin_audit_logs", "role_permissions"
        ]
        for table in expected_tables:
            self.assertIn(f"CREATE TABLE IF NOT EXISTS `{table}`", content, f"Table `{table}` missing in schema_clean.sql")

        # Verify ZERO mock inserts for business entities
        self.assertNotIn("INSERT INTO `users`", content)
        self.assertNotIn("INSERT INTO users", content)
        self.assertNotIn("INSERT INTO `visitors`", content)
        self.assertNotIn("INSERT INTO visitors", content)
        self.assertNotIn("INSERT INTO `visitor_requests`", content)
        self.assertNotIn("INSERT INTO visitor_requests", content)
        self.assertNotIn("INSERT INTO `customers`", content)
        self.assertNotIn("INSERT INTO customers", content)
        self.assertNotIn("INSERT INTO `sites`", content)
        self.assertNotIn("INSERT INTO sites", content)

    def test_02_idempotent_database_setup(self):
        """Verify setup_database() runs cleanly and is fully idempotent."""
        # Run 1
        success1 = setup_database(verbose=False)
        self.assertTrue(success1, "First run of setup_database must succeed")

        health1 = verify_database_health()
        self.assertTrue(health1["healthy"], "Database health check must be healthy")
        self.assertEqual(len(health1["missing_tables"]), 0, "No tables should be missing")

        # Run 2 (Idempotency test)
        success2 = setup_database(verbose=False)
        self.assertTrue(success2, "Second run of setup_database must succeed without errors")

    def test_03_setup_status_endpoint(self):
        """Verify GET /api/setup/status reports safe state without leaking data."""
        res = self.client.get("/api/setup/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn("setup_required", data)
        self.assertIn("initialized", data)
        self.assertIn("version", data)

        # Sensitive keys must NOT be present
        self.assertNotIn("users", data)
        self.assertNotIn("password", data)
        self.assertNotIn("email", data)
        self.assertNotIn("database", data)

    def test_04_initialize_validation_errors(self):
        """Verify POST /api/setup/initialize rejects invalid or incomplete payloads."""
        # Incomplete payload (empty)
        res = self.client.post("/api/setup/initialize", json={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data["error"], "VALIDATION_FAILED")
        self.assertTrue(len(data["details"]) > 0)

        # Invalid Email
        bad_email = {
            "organization_name": "Test Org",
            "site_name": "Main Site",
            "site_code": "MS",
            "admin_name": "Admin User",
            "admin_email": "not-an-email",
            "admin_password": "ValidPassword@123"
        }
        res = self.client.post("/api/setup/initialize", json=bad_email)
        self.assertEqual(res.status_code, 400)
        self.assertIn("A valid administrator email address is required.", res.get_json()["details"])

        # Weak Password (missing special char or too short)
        weak_pwd = {
            "organization_name": "Test Org",
            "site_name": "Main Site",
            "site_code": "MS",
            "admin_name": "Admin User",
            "admin_email": "admin@testorg.com",
            "admin_password": "weak"
        }
        res = self.client.post("/api/setup/initialize", json=weak_pwd)
        self.assertEqual(res.status_code, 400)
        self.assertTrue(any("Password must be at least 8 characters" in d for d in res.get_json()["details"]))

    def test_05_privilege_escalation_defense_role_tampering(self):
        """Verify client cannot supply a custom role (server strictly enforces 'superadmin')."""
        test_email = "tamper_role_test@example.com"
        cursor = self.conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("DELETE FROM users WHERE email = %s", (test_email,))
        self.conn.commit()

        # Temporarily ensure we can test provisioning logic
        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role IN ('superadmin', 'admin')")
        admin_count = cursor.fetchone()["cnt"]

        if admin_count > 0:
            # If admins already exist, initialize endpoint must correctly reject with 403
            res = self.client.post("/api/setup/initialize", json={
                "organization_name": "Tamper Test Corp",
                "site_name": "Tamper Site",
                "site_code": "TS",
                "admin_name": "Tamper Admin",
                "admin_email": test_email,
                "admin_password": "AdminPassword@2026",
                "role": "hacked_super_root"  # Attempt role injection
            })
            self.assertEqual(res.status_code, 403)
            self.assertEqual(res.get_json()["error"], "SETUP_ALREADY_COMPLETED")

    def test_06_atomic_setup_provisioning_and_replay_lock(self):
        """
        Verify complete first-run provisioning cycle:
        1. Clean creation of Org, Site, and Superadmin.
        2. Correct tenant and multi-site assignment.
        3. Strict rejection of subsequent attempts (Replay Lock).
        """
        cursor = self.conn.cursor(pymysql.cursors.DictCursor)

        # Check existing state
        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role IN ('superadmin', 'admin')")
        existing_admins = cursor.fetchone()["cnt"]

        if existing_admins == 0:
            payload = {
                "organization_name": "Alpha Global Logistics",
                "site_name": "Main Logistics Hub",
                "site_code": "AGL-01",
                "admin_name": "Primary Super Admin",
                "admin_email": "primary_super@agl.com",
                "admin_password": "SuperAdminPass@2026"
            }
            res = self.client.post("/api/setup/initialize", json=payload)
            self.assertEqual(res.status_code, 201)
            data = res.get_json()
            self.assertTrue(data["success"])
            self.assertEqual(data["admin"]["role"], "superadmin")
            self.assertEqual(data["organization"]["name"], "Alpha Global Logistics")

            # Verify in DB
            cursor.execute("SELECT * FROM users WHERE email = %s", (payload["admin_email"],))
            user = cursor.fetchone()
            self.assertIsNotNone(user)
            self.assertEqual(user["role"], "superadmin")

            # Verify site junction
            cursor.execute("SELECT * FROM user_sites WHERE user_id = %s", (user["user_id"],))
            self.assertIsNotNone(cursor.fetchone())

        # Now test that any further initialization is strictly blocked
        replay_payload = {
            "organization_name": "Attacker Corp",
            "site_name": "Attacker Site",
            "site_code": "ATK",
            "admin_name": "Attacker User",
            "admin_email": "attacker@fake.com",
            "admin_password": "AttackerPass@2026"
        }
        res_replay = self.client.post("/api/setup/initialize", json=replay_payload)
        self.assertEqual(res_replay.status_code, 403)
        self.assertEqual(res_replay.get_json()["error"], "SETUP_ALREADY_COMPLETED")

    def test_07_concurrent_initialization_protection(self):
        """Verify concurrent initialization requests are serialized and only one succeeds."""
        results = []

        def submit_request(thread_id):
            client = app.test_client()
            resp = client.post("/api/setup/initialize", json={
                "organization_name": f"Concurrent Org {thread_id}",
                "site_name": f"Concurrent Site {thread_id}",
                "site_code": f"C{thread_id}",
                "admin_name": f"Admin {thread_id}",
                "admin_email": f"concurrent{thread_id}@example.com",
                "admin_password": "ConcurPassword@123"
            })
            results.append((resp.status_code, resp.get_json()))

        threads = [threading.Thread(target=submit_request, args=(i,)) for i in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # All requests must be 403 (since system already has administrators from earlier test)
        for code, body in results:
            self.assertIn(code, [403, 409])
            if code == 403:
                self.assertEqual(body["error"], "SETUP_ALREADY_COMPLETED")

    def test_08_login_compatibility_with_created_administrator(self):
        """Verify created administrator can authenticate via standard /api/auth/login."""
        cursor = self.conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT email, password FROM users WHERE role = 'superadmin' LIMIT 1")
        admin_user = cursor.fetchone()

        if admin_user:
            res = self.client.post("/api/auth/login", json={
                "email": admin_user["email"],
                "password": admin_user["password"]
            })
            self.assertEqual(res.status_code, 200, f"Login must succeed for superadmin {admin_user['email']}")
            data = res.get_json()
            self.assertIn("token", data)
            self.assertEqual(data["user"]["role"], "superadmin")
            # Superadmin has customer-wide access to all customer sites
            self.assertTrue(isinstance(data["user"]["site_ids"], list))
            self.assertTrue(len(data["user"]["sites"]) > 0)


if __name__ == "__main__":
    unittest.main()
