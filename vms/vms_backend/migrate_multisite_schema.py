import sys
import os
import pymysql

# Add vms_backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_db_connection

def run_migration():
    print("=== STARTING MULTI-SITE SCHEMATIC MIGRATION ===")
    conn = get_db_connection()
    if not conn:
        print("ERROR: Failed to connect to database.")
        sys.exit(1)
        
    cursor = conn.cursor()

    try:
        # STEP 1: Ensure Customers Table
        print("\n[Step 1] Checking `customers` table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                customer_id INT AUTO_INCREMENT PRIMARY KEY,
                customer_name VARCHAR(255) NOT NULL UNIQUE,
                code VARCHAR(50) DEFAULT 'MAIN',
                status VARCHAR(50) DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Seed default Customer if empty
        cursor.execute("SELECT COUNT(*) FROM customers")
        if cursor.fetchone()[0] == 0:
            # Check active license client_name
            client_name = "Test Company"
            try:
                cursor.execute("SELECT license_key FROM system_license ORDER BY id DESC LIMIT 1")
                row = cursor.fetchone()
                if row and row[0]:
                    import jwt
                    payload = jwt.decode(row[0], options={"verify_signature": False})
                    if payload.get("client_name"):
                        client_name = payload["client_name"]
            except Exception as e:
                print("Note: Could not parse license client_name, using default 'Test Company':", e)
                
            cursor.execute("INSERT INTO customers (customer_id, customer_name, code, status) VALUES (1, %s, 'SG', 'Active')", (client_name,))
            print(f"  -> Created default customer (ID 1: '{client_name}')")

        # STEP 2: Update `sites` Table
        print("\n[Step 2] Updating `sites` table structure...")
        try:
            cursor.execute("SELECT customer_id FROM sites LIMIT 1")
        except Exception:
            print("  -> Adding `customer_id` column to `sites` table...")
            cursor.execute("ALTER TABLE sites ADD COLUMN customer_id INT DEFAULT 1")
            
        # Add Foreign Key if missing
        try:
            cursor.execute("""
                SELECT CONSTRAINT_NAME 
                FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS 
                WHERE CONSTRAINT_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'sites' 
                  AND CONSTRAINT_NAME = 'fk_sites_customer'
            """)
            if not cursor.fetchone():
                cursor.execute("""
                    ALTER TABLE sites 
                    ADD CONSTRAINT fk_sites_customer 
                    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
                """)
                print("  -> Added FK `fk_sites_customer` on `sites`.")
        except Exception as e:
            print("  -> FK `fk_sites_customer` check/addition notice:", e)

        # STEP 3: Update `users` Table
        print("\n[Step 3] Updating `users` table structure...")
        try:
            cursor.execute("SELECT customer_id FROM users LIMIT 1")
        except Exception:
            print("  -> Adding `customer_id` column to `users` table...")
            cursor.execute("ALTER TABLE users ADD COLUMN customer_id INT DEFAULT 1")

        # STEP 4: Create `user_sites` Junction Table
        print("\n[Step 4] Checking `user_sites` junction table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sites (
                user_id INT NOT NULL,
                site_id INT NOT NULL,
                PRIMARY KEY (user_id, site_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (site_id) REFERENCES sites(site_id) ON DELETE CASCADE
            )
        """)

        # Backfill existing users into user_sites
        cursor.execute("SELECT user_id, role FROM users")
        users = cursor.fetchall()
        
        # Fetch active sites
        cursor.execute("SELECT site_id FROM sites")
        site_ids = [r[0] for r in cursor.fetchall()]
        default_site = site_ids[0] if site_ids else 1

        for uid, role in users:
            cursor.execute("SELECT COUNT(*) FROM user_sites WHERE user_id = %s", (uid,))
            if cursor.fetchone()[0] == 0:
                if role == 'superadmin':
                    # Superadmin has access to ALL sites
                    for s_id in site_ids:
                        cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, %s)", (uid, s_id))
                else:
                    # Assign default site to host, security, admin
                    cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, %s)", (uid, default_site))
                print(f"  -> Backfilled site assignment for user_id={uid} (role: {role})")

        # STEP 5: Update `visitor_requests` Table
        print("\n[Step 5] Updating `visitor_requests` table structure...")
        try:
            cursor.execute("SELECT site_id FROM visitor_requests LIMIT 1")
        except Exception:
            print("  -> Adding `site_id` column to `visitor_requests` table...")
            cursor.execute("ALTER TABLE visitor_requests ADD COLUMN site_id INT DEFAULT NULL")

        # Add Foreign Key if missing
        try:
            cursor.execute("""
                SELECT CONSTRAINT_NAME 
                FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS 
                WHERE CONSTRAINT_SCHEMA = DATABASE() 
                  AND TABLE_NAME = 'visitor_requests' 
                  AND CONSTRAINT_NAME = 'fk_vr_site'
            """)
            if not cursor.fetchone():
                cursor.execute("""
                    ALTER TABLE visitor_requests 
                    ADD CONSTRAINT fk_vr_site 
                    FOREIGN KEY (site_id) REFERENCES sites(site_id) ON DELETE SET NULL
                """)
                print("  -> Added FK `fk_vr_site` on `visitor_requests`.")
        except Exception as e:
            print("  -> FK `fk_vr_site` check/addition notice:", e)

        # Backfill `site_id` in `visitor_requests` based on visitors location/unit or default site
        cursor.execute("""
            SELECT vr.request_id, v.unit, v.location
            FROM visitor_requests vr
            JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE vr.site_id IS NULL
        """)
        unmapped = cursor.fetchall()
        
        # Build lookup dict of site names to site_id
        cursor.execute("SELECT site_id, name FROM sites")
        site_name_map = {name.lower().strip(): s_id for s_id, name in cursor.fetchall()}
        
        updated_count = 0
        for req_id, unit, location in unmapped:
            target_site = None
            if unit and unit.lower().strip() in site_name_map:
                target_site = site_name_map[unit.lower().strip()]
            elif location and location.lower().strip() in site_name_map:
                target_site = site_name_map[location.lower().strip()]
            
            if not target_site:
                target_site = default_site
                
            cursor.execute("UPDATE visitor_requests SET site_id = %s WHERE request_id = %s", (target_site, req_id))
            updated_count += 1
            
        print(f"  -> Backfilled site_id for {updated_count} visitor requests.")

        conn.commit()
        print("\n=== MIGRATION COMPLETED SUCCESSFULLY ===")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
