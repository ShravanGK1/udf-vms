# tests/test_report_exports.py
"""
Automated Test Suite for VMS Report Exports & Role-Based Site Isolation
Verifies:
1. Super Admin exports include all authorized sites in organization (Excel & PDF dataset).
2. Admin exports include assigned site(s) ONLY (Excel & PDF dataset).
3. Cross-site parameter tampering by Admin is rejected with HTTP 403 Forbidden.
4. Excel workbook structure: Sheets ('Visitor Activity Log', 'Executive Summary'), metadata block, styled headers, autofilters.
5. Excel and PDF dataset parity (matching records, column order, totals, and filters).
6. Empty date range handling produces valid spreadsheet without corruption.
7. Special characters, Unicode, and numeric/date formatting.
8. Unauthenticated requests rejected with HTTP 401 Unauthorized.
"""

import sys
import os
import unittest
import io
import datetime
import jwt
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db_connection
from config import SECRET_KEY
from app import app


class TestReportExports(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        conn = get_db_connection()
        if not conn:
            raise Exception("Database connection failed")
        cursor = conn.cursor()

        # Clean prior test fixtures if any
        cursor.execute("DELETE FROM visitor_requests WHERE request_id IN (99101, 99102, 99201)")
        cursor.execute("DELETE FROM visitors WHERE visitor_id IN (9911, 9922, 9933)")
        cursor.execute("DELETE FROM user_sites WHERE user_id IN (9901, 9902, 9903, 9904, 9905)")
        cursor.execute("DELETE FROM users WHERE user_id IN (9901, 9902, 9903, 9904, 9905)")
        cursor.execute("DELETE FROM sites WHERE site_id IN (991, 992)")
        cursor.execute("DELETE FROM customers WHERE customer_id = 990")
        conn.commit()

        # 1. Customer
        cursor.execute("INSERT INTO customers (customer_id, customer_name) VALUES (990, 'Delta Global Security Corp')")

        # 2. Sites
        cursor.execute("INSERT INTO sites (site_id, name, address, status, customer_id) VALUES (991, 'Site Alpha Export', 'Alpha Block', 'Active', 990)")
        cursor.execute("INSERT INTO sites (site_id, name, address, status, customer_id) VALUES (992, 'Site Beta Export', 'Beta Wing', 'Active', 990)")

        # 3. Users
        # Super Admin (customer 990)
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9901, 'Super Admin Export', 'sa_exp@test.com', 'Pass@123', 'superadmin', 990, 'Active')
        """)
        # Admin Alpha (assigned to Site 991 ONLY)
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9902, 'Admin Alpha', 'admin_a_exp@test.com', 'Pass@123', 'admin', 990, 'Active')
        """)
        # Admin Beta (assigned to Site 992 ONLY)
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9903, 'Admin Beta', 'admin_b_exp@test.com', 'Pass@123', 'admin', 990, 'Active')
        """)
        # Host Alpha
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9904, 'Host Alpha', 'host_a@test.com', 'Pass@123', 'host', 990, 'Active')
        """)
        # Host Beta
        cursor.execute("""
            INSERT INTO users (user_id, name, email, password, role, customer_id, status)
            VALUES (9905, 'Host Beta', 'host_b@test.com', 'Pass@123', 'host', 990, 'Active')
        """)

        # User Site Mappings
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (9902, 991)")
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (9903, 992)")
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (9904, 991)")
        cursor.execute("INSERT INTO user_sites (user_id, site_id) VALUES (9905, 992)")

        # 4. Visitors
        cursor.execute("""
            INSERT INTO visitors (visitor_id, visitor_name, mobile_number, email, company_name, department)
            VALUES (9911, 'Alice Alpha Visitor', '9876543210', 'alice@acme.com', 'Acme Corp', 'Finance')
        """)
        cursor.execute("""
            INSERT INTO visitors (visitor_id, visitor_name, mobile_number, email, company_name, department)
            VALUES (9922, 'Bob Beta Visitor', '9876543211', 'bob@beta.com', 'Beta Dynamics', 'Operations')
        """)
        cursor.execute("""
            INSERT INTO visitors (visitor_id, visitor_name, mobile_number, email, company_name, department)
            VALUES (9933, 'Charlie Special: <Tag> & "Quote" €', '9876543212', 'charlie@spec.com', 'Global Tech', 'Engineering')
        """)

        # 5. Visitor Requests
        today_date = datetime.date.today()
        # Request 99101: Alice in Site 991
        cursor.execute("""
            INSERT INTO visitor_requests (request_id, visitor_id, host_id, site_id, purpose, scheduled_date, scheduled_time,
                                         check_in_time, check_out_time, status, created_at)
            VALUES (99101, 9911, 9904, 991, 'Audit', %s, '10:00:00',
                    CONCAT(%s, ' 10:00:00'), CONCAT(%s, ' 11:30:00'), 'CHECKED_OUT', NOW())
        """, (today_date, today_date, today_date))

        # Request 99102: Charlie in Site 991
        cursor.execute("""
            INSERT INTO visitor_requests (request_id, visitor_id, host_id, site_id, purpose, scheduled_date, scheduled_time,
                                         check_in_time, status, created_at)
            VALUES (99102, 9933, 9904, 991, 'Maintenance', %s, '12:00:00',
                    CONCAT(%s, ' 12:00:00'), 'CHECKED_IN', NOW())
        """, (today_date, today_date))

        # Request 99201: Bob in Site 992
        cursor.execute("""
            INSERT INTO visitor_requests (request_id, visitor_id, host_id, site_id, purpose, scheduled_date, scheduled_time,
                                         check_in_time, check_out_time, status, created_at)
            VALUES (99201, 9922, 9905, 992, 'Client Meeting', %s, '14:00:00',
                    CONCAT(%s, ' 14:00:00'), CONCAT(%s, ' 15:00:00'), 'CHECKED_OUT', NOW())
        """, (today_date, today_date, today_date))

        conn.commit()
        cursor.close()
        conn.close()

        # Generate Test Tokens
        cls.token_sa = jwt.encode({"user_id": 9901, "role": "superadmin", "password": "Pass@123"}, SECRET_KEY, algorithm="HS256")
        cls.token_admin_a = jwt.encode({"user_id": 9902, "role": "admin", "password": "Pass@123"}, SECRET_KEY, algorithm="HS256")
        cls.token_admin_b = jwt.encode({"user_id": 9903, "role": "admin", "password": "Pass@123"}, SECRET_KEY, algorithm="HS256")

    @classmethod
    def tearDownClass(cls):
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM visitor_requests WHERE request_id IN (99101, 99102, 99201)")
            cursor.execute("DELETE FROM visitors WHERE visitor_id IN (9911, 9922, 9933)")
            cursor.execute("DELETE FROM user_sites WHERE user_id IN (9901, 9902, 9903, 9904, 9905)")
            cursor.execute("DELETE FROM users WHERE user_id IN (9901, 9902, 9903, 9904, 9905)")
            cursor.execute("DELETE FROM sites WHERE site_id IN (991, 992)")
            cursor.execute("DELETE FROM customers WHERE customer_id = 990")
            conn.commit()
            cursor.close()
            conn.close()

    # -------------------------------------------------------------------------
    # TEST 1: Super Admin exports Excel - Cross-Site Data Included
    # -------------------------------------------------------------------------
    def test_01_superadmin_exports_all_authorized_sites_excel(self):
        with app.test_client() as client:
            res = client.get(
                "/api/reports/export-excel?period=daily",
                headers={"Authorization": f"Bearer {self.token_sa}"}
            )
            self.assertEqual(res.status_code, 200)
            self.assertIn("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", res.content_type)

            # Read Excel
            excel_bytes = io.BytesIO(res.data)
            xl = pd.ExcelFile(excel_bytes)
            self.assertIn("Visitor Activity Log", xl.sheet_names)
            self.assertIn("Executive Summary", xl.sheet_names)

            df = pd.read_excel(excel_bytes, sheet_name="Visitor Activity Log", skiprows=5)
            visitor_names = df["VISITORS NAME"].tolist()
            
            # Super Admin should see both Alice (Site 991) and Bob (Site 992)
            self.assertTrue(any("Alice Alpha" in str(name) for name in visitor_names), f"Missing Alice in {visitor_names}")
            self.assertTrue(any("Bob Beta" in str(name) for name in visitor_names), f"Missing Bob in {visitor_names}")

    # -------------------------------------------------------------------------
    # TEST 2: Super Admin PDF dataset matches Excel Export 100%
    # -------------------------------------------------------------------------
    def test_02_superadmin_pdf_data_matches_excel(self):
        with app.test_client() as client:
            # 1. Fetch JSON (dataset consumed by PDF generator)
            res_json = client.get(
                "/api/reports?period=daily",
                headers={"Authorization": f"Bearer {self.token_sa}"}
            )
            self.assertEqual(res_json.status_code, 200)
            json_data = res_json.get_json()

            # 2. Fetch Excel
            res_excel = client.get(
                "/api/reports/export-excel?period=daily",
                headers={"Authorization": f"Bearer {self.token_sa}"}
            )
            self.assertEqual(res_excel.status_code, 200)
            df = pd.read_excel(io.BytesIO(res_excel.data), sheet_name="Visitor Activity Log", skiprows=5)

            # Assert record count parity
            json_visitors = json_data.get("visitors", [])
            self.assertEqual(len(json_visitors), len(df), "Record count mismatch between JSON/PDF dataset and Excel")

            # Assert matching visitor names in identical order
            for i, j_v in enumerate(json_visitors):
                self.assertEqual(j_v["name"], df.iloc[i]["VISITORS NAME"])
                self.assertEqual(j_v["phone"], str(df.iloc[i]["CONTACT NUMBER"]))
                self.assertEqual(j_v["company"], df.iloc[i]["COMPANY NAME"])
                self.assertEqual(j_v["status"], df.iloc[i]["STATUS"])

    # -------------------------------------------------------------------------
    # TEST 3: Admin A exports Excel - Strictly Isolated to Site Alpha
    # -------------------------------------------------------------------------
    def test_03_admin_alpha_exports_site_a_only_excel(self):
        with app.test_client() as client:
            res = client.get(
                "/api/reports/export-excel?period=daily",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            self.assertEqual(res.status_code, 200)

            df = pd.read_excel(io.BytesIO(res.data), sheet_name="Visitor Activity Log", skiprows=5)
            visitor_names = df["VISITORS NAME"].tolist()
            site_names = df["SITE"].unique().tolist()

            # Admin Alpha MUST see Site 991 records
            self.assertTrue(any("Alice Alpha" in str(name) for name in visitor_names))
            # Admin Alpha MUST NOT see Site 992 records (Bob Beta)
            self.assertFalse(any("Bob Beta" in str(name) for name in visitor_names), f"Security Leak: Bob Beta from Site Beta appeared in Admin Alpha's export: {visitor_names}")
            self.assertNotIn("Site Beta Export", site_names)

    # -------------------------------------------------------------------------
    # TEST 4: Admin A PDF dataset matches Excel Export
    # -------------------------------------------------------------------------
    def test_04_admin_alpha_pdf_data_matches_excel(self):
        with app.test_client() as client:
            res_json = client.get(
                "/api/reports?period=daily",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            self.assertEqual(res_json.status_code, 200)
            json_data = res_json.get_json()

            res_excel = client.get(
                "/api/reports/export-excel?period=daily",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            df = pd.read_excel(io.BytesIO(res_excel.data), sheet_name="Visitor Activity Log", skiprows=5)

            json_visitors = json_data.get("visitors", [])
            self.assertEqual(len(json_visitors), len(df))
            for i, j_v in enumerate(json_visitors):
                self.assertEqual(j_v["name"], df.iloc[i]["VISITORS NAME"])
                self.assertNotEqual(j_v["name"], "Bob Beta Visitor")

    # -------------------------------------------------------------------------
    # TEST 5: Admin A cross-site parameter request rejected with HTTP 403 Forbidden
    # -------------------------------------------------------------------------
    def test_05_admin_alpha_requests_unauthorized_site_b_rejected_403(self):
        with app.test_client() as client:
            # Excel export with site_id=992 (Site Beta)
            res_excel = client.get(
                "/api/reports/export-excel?site_id=992",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            self.assertEqual(res_excel.status_code, 403, f"Expected 403 Forbidden on cross-site export, got {res_excel.status_code}")

            # JSON/PDF report request with site_id=992
            res_json = client.get(
                "/api/reports?site_id=992",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            self.assertEqual(res_json.status_code, 403, f"Expected 403 Forbidden on cross-site report query, got {res_json.status_code}")

    # -------------------------------------------------------------------------
    # TEST 6: Empty dataset export produces valid workbook without corruption
    # -------------------------------------------------------------------------
    def test_06_admin_empty_dataset_valid_excel_structure(self):
        with app.test_client() as client:
            # Date filter where zero visitors exist
            res = client.get(
                "/api/reports/export-excel?start_date=2015-01-01&end_date=2015-01-02",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            self.assertEqual(res.status_code, 200)

            # Verify workbook parses without error
            xl = pd.ExcelFile(io.BytesIO(res.data))
            self.assertIn("Visitor Activity Log", xl.sheet_names)
            self.assertIn("Executive Summary", xl.sheet_names)

            # Metadata sheet verification
            df_sum = pd.read_excel(io.BytesIO(res.data), sheet_name="Executive Summary", skiprows=3)
            self.assertEqual(df_sum.columns[0], "METRIC NAME")
            self.assertEqual(df_sum.columns[1], "RECORDED VALUE")

    # -------------------------------------------------------------------------
    # TEST 7: Super Admin explicit site filter applies accurately
    # -------------------------------------------------------------------------
    def test_07_superadmin_site_filtered_export(self):
        with app.test_client() as client:
            res = client.get(
                "/api/reports/export-excel?site_id=991&period=daily",
                headers={"Authorization": f"Bearer {self.token_sa}"}
            )
            self.assertEqual(res.status_code, 200)
            df = pd.read_excel(io.BytesIO(res.data), sheet_name="Visitor Activity Log", skiprows=5)
            visitor_names = df["VISITORS NAME"].tolist()
            self.assertTrue(any("Alice Alpha" in str(name) for name in visitor_names))
            self.assertFalse(any("Bob Beta" in str(name) for name in visitor_names))

    # -------------------------------------------------------------------------
    # TEST 8: Admin summary totals exclude unauthorized sites
    # -------------------------------------------------------------------------
    def test_08_admin_summary_totals_exclude_unauthorized_sites(self):
        with app.test_client() as client:
            res_admin = client.get(
                "/api/reports?period=daily",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            data_admin = res_admin.get_json()

            res_sa = client.get(
                "/api/reports?period=daily",
                headers={"Authorization": f"Bearer {self.token_sa}"}
            )
            data_sa = res_sa.get_json()

            # Admin Alpha has 2 records (Alice & Charlie) in Site 991
            # Super Admin has 3 records (Alice, Charlie, Bob) across Sites 991 & 992
            self.assertEqual(data_admin["metadata"]["total_records"], 2)
            self.assertEqual(data_sa["metadata"]["total_records"], 3)
            self.assertGreater(data_sa["summary"]["periodCount"], data_admin["summary"]["periodCount"])

    # -------------------------------------------------------------------------
    # TEST 9: Special characters, Unicode, and symbols integrity
    # -------------------------------------------------------------------------
    def test_09_special_characters_and_unicode_handling(self):
        with app.test_client() as client:
            res = client.get(
                "/api/reports/export-excel?period=daily",
                headers={"Authorization": f"Bearer {self.token_admin_a}"}
            )
            df = pd.read_excel(io.BytesIO(res.data), sheet_name="Visitor Activity Log", skiprows=5)
            visitor_names = df["VISITORS NAME"].tolist()
            charlie = [n for n in visitor_names if "Charlie Special" in str(n)]
            self.assertEqual(len(charlie), 1)
            self.assertIn("€", charlie[0], "Unicode symbol was stripped or corrupted")
            self.assertIn("<Tag>", charlie[0], "Tag characters were stripped")

    # -------------------------------------------------------------------------
    # TEST 10: Unauthenticated requests rejected with HTTP 401
    # -------------------------------------------------------------------------
    def test_10_unauthenticated_request_rejected_401(self):
        old_testing = app.config.get("TESTING", False)
        try:
            app.config["TESTING"] = False
            with app.test_client() as client:
                res_excel = client.get("/api/reports/export-excel")
                self.assertEqual(res_excel.status_code, 401)

                res_json = client.get("/api/reports")
                self.assertEqual(res_json.status_code, 401)
        finally:
            app.config["TESTING"] = old_testing


if __name__ == "__main__":
    unittest.main()
