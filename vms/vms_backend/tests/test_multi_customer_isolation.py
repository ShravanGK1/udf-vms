# tests/test_multi_customer_isolation.py

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pymysql.cursors
from db import get_db_connection
from utils.auth_utils import get_user_site_scope, is_site_authorized, get_user_authorized_sites

import jwt
from config import SECRET_KEY
from app import app

def run_multi_customer_isolation_suite():
    print("--- STARTING ISOLATED MULTI-CUSTOMER FIXTURE VERIFICATION ---")
    conn = get_db_connection()
    if not conn:
        raise Exception("Database connection failed")
    cursor = conn.cursor()

    try:
        # 1. Setup Test Fixtures in Database
        print("[SETUP] Setting up Customer A and Customer B fixtures...")
        
        # Customers
        cursor.execute("INSERT IGNORE INTO customers (customer_id, customer_name) VALUES (10, 'Test Customer A Corp')")
        cursor.execute("INSERT IGNORE INTO customers (customer_id, customer_name) VALUES (20, 'Test Customer B Inc')")

        # Sites
        cursor.execute("INSERT IGNORE INTO sites (site_id, name, address, status, customer_id) VALUES (101, 'Site A1', 'Pune', 'Active', 10)")
        cursor.execute("INSERT IGNORE INTO sites (site_id, name, address, status, customer_id) VALUES (102, 'Site A2', 'Mumbai', 'Active', 10)")
        cursor.execute("INSERT IGNORE INTO sites (site_id, name, address, status, customer_id) VALUES (201, 'Site B1', 'Bangalore', 'Active', 20)")

        # Users
        cursor.execute("INSERT IGNORE INTO users (user_id, name, email, password, role, customer_id, status) VALUES (1001, 'Super Admin A', 'supera@test.com', 'Pass@123', 'superadmin', 10, 'Active')")
        cursor.execute("INSERT IGNORE INTO users (user_id, name, email, password, role, customer_id, status) VALUES (1002, 'Site Admin A1', 'admina1@test.com', 'Pass@123', 'admin', 10, 'Active')")
        cursor.execute("INSERT IGNORE INTO users (user_id, name, email, password, role, customer_id, status) VALUES (2001, 'Super Admin B', 'superb@test.com', 'Pass@123', 'superadmin', 20, 'Active')")
        cursor.execute("INSERT IGNORE INTO users (user_id, name, email, password, role, customer_id, status) VALUES (2002, 'Host B1', 'hostb1@test.com', 'Pass@123', 'host', 20, 'Active')")

        # Site Mappings
        cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (1002, 101)")
        cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (2001, 201)")

        conn.commit()

        # 2. Test Super Admin A Scope
        print("[TEST 1] Verifying Super Admin A scope...")
        scope_a, sites_a = get_user_site_scope(1001, "superadmin")
        print(f"Super Admin A Scope: {scope_a}, sites: {sites_a}")
        if 101 not in sites_a or 102 not in sites_a or 201 in sites_a:
            raise Exception(f"Super Admin A scope leaked cross-customer site 201! sites={sites_a}")
        print("[PASS] Super Admin A restricted to Customer A sites (101, 102) only!")


        # 3. Test Super Admin B Scope
        print("[TEST 2] Verifying Super Admin B scope...")
        scope_b, sites_b = get_user_site_scope(2001, "superadmin")
        print(f"Super Admin B Scope: {scope_b}, sites: {sites_b}")
        if 201 not in sites_b or 101 in sites_b or 102 in sites_b:
            raise Exception(f"Super Admin B scope leaked Customer A sites! sites={sites_b}")
        print("[PASS] Super Admin B restricted to Customer B site (201) only!")

        # 4. Test Site Admin A1 Scope
        print("[TEST 3] Verifying Site Admin A1 scope...")
        scope_a1, sites_a1 = get_user_site_scope(1002, "admin")
        print(f"Site Admin A1 Scope: {scope_a1}, sites: {sites_a1}")
        if 101 not in sites_a1 or 102 in sites_a1 or 201 in sites_a1:
            raise Exception(f"Site Admin A1 leaked unassigned sites! sites={sites_a1}")
        print("[PASS] Site Admin A1 restricted to assigned site 101 only!")

        # 5. Test Cross-Customer User Site Assignment API Rejection
        print("[TEST 4] Verifying cross-customer user-site mapping API rejection...")
        with app.test_client() as client:
            token_a = jwt.encode({"user_id": 1001, "role": "superadmin", "password": "Pass@123"}, SECRET_KEY, algorithm="HS256")
            res = client.put("/api/admin/users/1002/sites", json={"site_ids": [201]}, headers={"Authorization": f"Bearer {token_a}"})
            if res.status_code != 403:
                raise Exception(f"Expected 403 when assigning Customer B site 201 to User 1002, got {res.status_code}")
            print("[PASS] Cross-customer site assignment rejected with 403 Forbidden!")

        # 6. Test Cross-Customer Visitor Transfer API Rejection
        print("[TEST 5] Verifying cross-customer visitor transfer API rejection...")
        cursor.execute("SELECT visitor_id FROM visitors LIMIT 1")
        v_id = cursor.fetchone()[0]
        cursor.execute("INSERT INTO visitor_requests (visitor_id, host_id, site_id, purpose, scheduled_date, scheduled_time, status, created_at) VALUES (%s, 1002, 101, 'Test Transfer', CURRENT_DATE, CURRENT_TIME, 'APPROVED', NOW())", (v_id,))
        test_req_id = cursor.lastrowid
        conn.commit()

        with app.test_client() as client:
            token_host_a = jwt.encode({"user_id": 1002, "role": "admin", "password": "Pass@123"}, SECRET_KEY, algorithm="HS256")
            res = client.post(f"/api/visitor-requests/{test_req_id}/transfer", json={"to_host_id": 2001, "purpose": "Cross Customer Transfer"}, headers={"Authorization": f"Bearer {token_host_a}"})
            if res.status_code != 404 and res.status_code != 403:
                raise Exception(f"Expected 404/403 when transferring to Customer B host 2001, got {res.status_code}")
            print("[PASS] Cross-customer visitor transfer rejected with 404/403!")

            cursor.execute("DELETE FROM visitor_requests WHERE request_id = %s", (test_req_id,))
            conn.commit()



        print("--- MULTI-CUSTOMER ISOLATION VERIFICATION PASSED SUCCESSFULLY! ---")
    finally:
        # Cleanup Fixtures
        cursor.execute("DELETE FROM user_sites WHERE user_id IN (1001, 1002, 2001, 2002)")
        cursor.execute("DELETE FROM users WHERE user_id IN (1001, 1002, 2001, 2002)")
        cursor.execute("DELETE FROM sites WHERE site_id IN (101, 102, 201)")
        cursor.execute("DELETE FROM customers WHERE customer_id IN (10, 20)")
        conn.commit()
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_multi_customer_isolation_suite()
