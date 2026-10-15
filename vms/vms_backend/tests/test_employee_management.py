# tests/test_employee_management.py
"""
Test Suite for Admin Dashboard:
1. Employee Edit (Name, Email, Role, Department, Site)
2. Validation & Duplicate Email Rejection
3. Employee Site Transfer
4. Employee Activation & Deactivation
5. Security Guards: Self-deactivation prevention, last superadmin protection, login blocking for inactive accounts
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

class TestEmployeeManagement(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()

        conn = get_db_connection()
        assert conn is not None, "Database connection failed"
        cursor = conn.cursor()

        # Get customer_id and superadmin
        cursor.execute("SELECT user_id, email, password, customer_id FROM users WHERE role = 'superadmin' LIMIT 1")
        sa_row = cursor.fetchone()
        cls.superadmin_id = sa_row[0]
        cls.superadmin_email = sa_row[1]
        cls.superadmin_password = sa_row[2]
        cls.customer_id = sa_row[3] or 1
        cls.superadmin_token = generate_token(cls.superadmin_id, "superadmin")

        # Get or create two sites for transfer tests
        cursor.execute("SELECT site_id FROM sites WHERE customer_id = %s AND status = 'Active'", (cls.customer_id,))
        site_rows = cursor.fetchall()
        cls.test_sites_created = []
        if len(site_rows) >= 2:
            cls.site_1 = site_rows[0][0]
            cls.site_2 = site_rows[1][0]
        elif len(site_rows) == 1:
            cls.site_1 = site_rows[0][0]
            cursor.execute("INSERT INTO sites (name, code, address, status, customer_id) VALUES ('Transfer Site B', 'TSB', 'Loc B', 'Active', %s)", (cls.customer_id,))
            cls.site_2 = cursor.lastrowid
            cls.test_sites_created.append(cls.site_2)
            conn.commit()
        else:
            cursor.execute("INSERT INTO sites (name, code, address, status, customer_id) VALUES ('Transfer Site A', 'TSA', 'Loc A', 'Active', %s)", (cls.customer_id,))
            cls.site_1 = cursor.lastrowid
            cls.test_sites_created.append(cls.site_1)
            cursor.execute("INSERT INTO sites (name, code, address, status, customer_id) VALUES ('Transfer Site B', 'TSB', 'Loc B', 'Active', %s)", (cls.customer_id,))
            cls.site_2 = cursor.lastrowid
            cls.test_sites_created.append(cls.site_2)
            conn.commit()

        # Create a test employee
        cls.test_emp_email = f"emp_test_{int(time.time())}@vms.com"
        cls.test_emp_password = "Password@123"
        cursor.execute("""
            INSERT INTO users (name, email, password, role, department, status, customer_id)
            VALUES ('John Doe', %s, %s, 'host', 'Engineering', 'Active', %s)
        """, (cls.test_emp_email, cls.test_emp_password, cls.customer_id))
        cls.test_emp_id = cursor.lastrowid

        # Assign employee to site_1
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (%s, %s)", (cls.test_emp_id, cls.site_1))

        # Create a second user for duplicate email tests
        cls.other_user_email = f"other_{int(time.time())}@vms.com"
        cursor.execute("""
            INSERT INTO users (name, email, password, role, department, status, customer_id)
            VALUES ('Other Person', %s, 'Password@123', 'security', 'Operations', 'Active', %s)
        """, (cls.other_user_email, cls.customer_id))
        cls.other_user_id = cursor.lastrowid

        conn.commit()
        cursor.close()
        conn.close()

    @classmethod
    def tearDownClass(cls):
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM user_sites WHERE user_id IN (%s, %s)", (cls.test_emp_id, cls.other_user_id))
            cursor.execute("DELETE FROM users WHERE user_id IN (%s, %s)", (cls.test_emp_id, cls.other_user_id))
            for sid in cls.test_sites_created:
                cursor.execute("DELETE FROM user_sites WHERE site_id = %s", (sid,))
                cursor.execute("DELETE FROM sites WHERE site_id = %s", (sid,))
            conn.commit()
            cursor.close()
            conn.close()

    def test_01_get_user_detail(self):
        res = self.client.get(f"/api/admin/users/{self.test_emp_id}", headers={"Authorization": f"Bearer {self.superadmin_token}"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["name"], "John Doe")
        self.assertEqual(data["email"], self.test_emp_email)
        self.assertEqual(data["role"], "host")
        self.assertEqual(data["department"], "Engineering")
        self.assertIn(self.site_1, [s["site_id"] for s in data["sites"]])

    def test_02_edit_employee_success(self):
        payload = {
            "name": "Johnathan Doe",
            "email": self.test_emp_email,
            "role": "admin",
            "department": "IT Operations",
            "site_id": self.site_2
        }
        res = self.client.put(
            f"/api/admin/users/{self.test_emp_id}",
            data=json.dumps(payload),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("user", data)
        self.assertEqual(data["user"]["name"], "Johnathan Doe")
        self.assertEqual(data["user"]["role"], "admin")
        self.assertEqual(data["user"]["department"], "IT Operations")

        # Verify DB persistence
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT name, role, department FROM users WHERE user_id = %s", (self.test_emp_id,))
        row = cur.fetchone()
        self.assertEqual(row[0], "Johnathan Doe")
        self.assertEqual(row[1], "admin")
        self.assertEqual(row[2], "IT Operations")
        cur.close()
        conn.close()

    def test_03_edit_employee_reject_duplicate_email(self):
        payload = {
            "name": "Johnathan Doe",
            "email": self.other_user_email,  # duplicate
            "role": "admin",
            "department": "IT Operations"
        }
        res = self.client.put(
            f"/api/admin/users/{self.test_emp_id}",
            data=json.dumps(payload),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 409)
        self.assertIn("already in use", res.get_json().get("error", "").lower())

    def test_04_edit_employee_reject_invalid_email(self):
        payload = {
            "name": "Johnathan Doe",
            "email": "not-an-email",
            "role": "admin",
            "department": "IT Operations"
        }
        res = self.client.put(
            f"/api/admin/users/{self.test_emp_id}",
            data=json.dumps(payload),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 400)

    def test_05_transfer_employee_site(self):
        # Transfer from site_2 back to site_1
        payload = {"site_id": self.site_1}
        res = self.client.patch(
            f"/api/admin/users/{self.test_emp_id}/site",
            data=json.dumps(payload),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 200)

        # Verify persistence in user_sites
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT site_id FROM user_sites WHERE user_id = %s", (self.test_emp_id,))
        rows = [r[0] for r in cur.fetchall()]
        self.assertIn(self.site_1, rows)
        self.assertNotIn(self.site_2, rows)
        cur.close()
        conn.close()

    def test_06_transfer_employee_reject_invalid_site(self):
        payload = {"site_id": 999999}
        res = self.client.patch(
            f"/api/admin/users/{self.test_emp_id}/site",
            data=json.dumps(payload),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 400)

    def test_07_deactivate_employee_and_block_login(self):
        # Deactivate
        res = self.client.patch(
            f"/api/admin/users/{self.test_emp_id}/status",
            data=json.dumps({"status": "Inactive"}),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["status"], "Inactive")

        # Verify login is blocked
        login_res = self.client.post("/api/auth/login", data=json.dumps({
            "email": self.test_emp_email,
            "password": self.test_emp_password
        }), content_type="application/json")
        self.assertEqual(login_res.status_code, 403)
        self.assertIn("deactivated", login_res.get_json().get("message", "").lower())

    def test_08_reactivate_employee_and_allow_login(self):
        # Reactivate
        res = self.client.patch(
            f"/api/admin/users/{self.test_emp_id}/status",
            data=json.dumps({"status": "Active"}),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["status"], "Active")

        # Verify login is allowed
        login_res = self.client.post("/api/auth/login", data=json.dumps({
            "email": self.test_emp_email,
            "password": self.test_emp_password
        }), content_type="application/json")
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("token", login_res.get_json())

    def test_09_prevent_self_deactivation(self):
        res = self.client.patch(
            f"/api/admin/users/{self.superadmin_id}/status",
            data=json.dumps({"status": "Inactive"}),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot deactivate your own account", res.get_json().get("error", "").lower())

    def test_10_reset_password_mismatch_rejected(self):
        res = self.client.post(
            f"/api/admin/users/{self.test_emp_id}/reset-password",
            data=json.dumps({
                "password": "ValidPass@2026",
                "confirm_password": "MismatchPass@2026"
            }),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("do not match", res.get_json().get("error", "").lower())

    def test_11_reset_password_weak_complexity_rejected(self):
        weak_passwords = [
            "short@1",          # < 8 chars
            "nocapital@123",    # no uppercase
            "NoNumbers@Special",# no number
            "NoSpecial1234"     # no special char
        ]
        for wp in weak_passwords:
            res = self.client.post(
                f"/api/admin/users/{self.test_emp_id}/reset-password",
                data=json.dumps({
                    "password": wp,
                    "confirm_password": wp
                }),
                content_type="application/json",
                headers={"Authorization": f"Bearer {self.superadmin_token}"}
            )
            self.assertEqual(res.status_code, 400, f"Expected 400 for weak password: {wp}")
            self.assertIn("password must be at least 8 characters", res.get_json().get("error", "").lower())

    def test_12_reset_password_unauthorized_non_admin(self):
        # A host user attempting to reset password must receive 403
        host_token = generate_token(self.test_emp_id, "host")
        res = self.client.post(
            f"/api/admin/users/{self.test_emp_id}/reset-password",
            data=json.dumps({
                "password": "ValidPass@2026",
                "confirm_password": "ValidPass@2026"
            }),
            content_type="application/json",
            headers={"Authorization": f"Bearer {host_token}"}
        )
        self.assertEqual(res.status_code, 403)

    def test_13_reset_password_site_admin_scope_restrictions(self):
        # Create a site admin for site_1 and another employee in site_2
        conn = get_db_connection()
        cursor = conn.cursor()
        site_admin_email = f"sa_scoped_{int(time.time())}@vms.com"
        cursor.execute("""
            INSERT INTO users (name, email, password, role, department, status, customer_id)
            VALUES ('Scoped Admin', %s, 'ScopedAdmin@123', 'admin', 'Management', 'Active', %s)
        """, (site_admin_email, self.customer_id))
        scoped_admin_id = cursor.lastrowid
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (%s, %s)", (scoped_admin_id, self.site_1))

        other_emp_email = f"other_emp_{int(time.time())}@vms.com"
        cursor.execute("""
            INSERT INTO users (name, email, password, role, department, status, customer_id)
            VALUES ('Other Site Emp', %s, 'OtherEmp@123', 'host', 'Logistics', 'Active', %s)
        """, (other_emp_email, self.customer_id))
        other_emp_id = cursor.lastrowid
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (%s, %s)", (other_emp_id, self.site_2))
        conn.commit()
        conn.close()

        scoped_admin_token = generate_token(scoped_admin_id, "admin")

        # 1. Site Admin attempts to reset Super Admin -> 403 Forbidden
        res_sa = self.client.post(
            f"/api/admin/users/{self.superadmin_id}/reset-password",
            data=json.dumps({"password": "NewSecret@123", "confirm_password": "NewSecret@123"}),
            content_type="application/json",
            headers={"Authorization": f"Bearer {scoped_admin_token}"}
        )
        self.assertEqual(res_sa.status_code, 403)
        self.assertIn("cannot reset passwords for super admin", res_sa.get_json().get("error", "").lower())

        # 2. Site Admin attempts to reset employee in site_2 (outside their site scope) -> 403 Forbidden
        res_out = self.client.post(
            f"/api/admin/users/{other_emp_id}/reset-password",
            data=json.dumps({"password": "NewSecret@123", "confirm_password": "NewSecret@123"}),
            content_type="application/json",
            headers={"Authorization": f"Bearer {scoped_admin_token}"}
        )
        self.assertEqual(res_out.status_code, 403)
        self.assertIn("outside your assigned site", res_out.get_json().get("error", "").lower())

        # Cleanup
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_sites WHERE user_id IN (%s, %s)", (scoped_admin_id, other_emp_id))
        cursor.execute("DELETE FROM users WHERE user_id IN (%s, %s)", (scoped_admin_id, other_emp_id))
        conn.commit()
        conn.close()

    def test_14_reset_password_success_by_authorized_admin(self):
        new_pwd = "ResetSuccess@2026"
        res = self.client.post(
            f"/api/admin/users/{self.test_emp_id}/reset-password",
            data=json.dumps({
                "password": new_pwd,
                "confirm_password": new_pwd
            }),
            content_type="application/json",
            headers={"Authorization": f"Bearer {self.superadmin_token}"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn("has been reset successfully", res.get_json().get("message", "").lower())

        # Verify password in database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password FROM users WHERE user_id = %s", (self.test_emp_id,))
        updated_pwd = cursor.fetchone()[0]

        # Verify audit log was recorded
        cursor.execute("""
            SELECT action, target FROM superadmin_audit_logs 
            WHERE action = 'Reset employee password' AND target LIKE %s
            ORDER BY log_id DESC LIMIT 1
        """, (f"%{self.test_emp_id}%",))
        audit_row = cursor.fetchone()
        conn.close()

        self.assertEqual(updated_pwd, new_pwd)
        self.assertIsNotNone(audit_row, "Audit log for password reset must be recorded")
        self.assertNotIn(new_pwd, audit_row[0], "Plaintext password must never be logged in action")
        self.assertNotIn(new_pwd, audit_row[1], "Plaintext password must never be logged in target")

    def test_15_authenticate_with_new_password_and_reject_old(self):
        # 1. Login with old password must fail
        old_login = self.client.post("/api/auth/login", data=json.dumps({
            "email": self.test_emp_email,
            "password": self.test_emp_password
        }), content_type="application/json")
        self.assertEqual(old_login.status_code, 401)
        self.assertIn("invalid password", old_login.get_json().get("message", "").lower())

        # 2. Login with new password must succeed
        new_login = self.client.post("/api/auth/login", data=json.dumps({
            "email": self.test_emp_email,
            "password": "ResetSuccess@2026"
        }), content_type="application/json")
        self.assertEqual(new_login.status_code, 200)
        self.assertIn("token", new_login.get_json())

    def test_16_session_invalidation_after_password_reset(self):
        # 1. Log in employee to get active session token
        login_res = self.client.post("/api/auth/login", data=json.dumps({
            "email": self.test_emp_email,
            "password": "ResetSuccess@2026"
        }), content_type="application/json")
        self.assertEqual(login_res.status_code, 200)
        active_token = login_res.get_json()["token"]

        # 2. Log in superadmin to get active session token
        admin_login = self.client.post("/api/auth/login", data=json.dumps({
            "email": self.superadmin_email,
            "password": self.superadmin_password
        }), content_type="application/json")
        self.assertEqual(admin_login.status_code, 200)
        admin_token = admin_login.get_json()["token"]

        # Temporarily toggle TESTING = False to verify session invalidation filter
        app.config["TESTING"] = False
        try:
            # Admin can access protected endpoint
            admin_check = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
            self.assertEqual(admin_check.status_code, 200)

            # Employee token passes session filter (and accesses /api/admin/users)
            user_check_before = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {active_token}"})
            self.assertEqual(user_check_before.status_code, 200)

            # 3. Admin resets employee's password
            app.config["TESTING"] = True
            admin_reset = self.client.post(
                f"/api/admin/users/{self.test_emp_id}/reset-password",
                data=json.dumps({
                    "password": "PasswordAfterReset@99",
                    "confirm_password": "PasswordAfterReset@99"
                }),
                content_type="application/json",
                headers={"Authorization": f"Bearer {self.superadmin_token}"}
            )
            self.assertEqual(admin_reset.status_code, 200)

            # 4. Target employee's old token is now session_invalidated (401)
            app.config["TESTING"] = False
            user_check_after = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {active_token}"})
            self.assertEqual(user_check_after.status_code, 401)
            self.assertEqual(user_check_after.get_json().get("code"), "session_invalidated")

            # 5. Admin's session token MUST remain valid
            admin_check_after = self.client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
            self.assertEqual(admin_check_after.status_code, 200)

        finally:
            app.config["TESTING"] = True

if __name__ == "__main__":
    unittest.main()

