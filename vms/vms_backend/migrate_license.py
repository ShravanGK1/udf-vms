import pymysql
import os
import re
from db import get_db_connection

def run_migration():
    conn = get_db_connection()
    if not conn:
        print("Failed to connect to the database.")
        return False
    try:
        cursor = conn.cursor()
        # Create table system_license
        print("Creating system_license table if not exists...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_license (
                id INT AUTO_INCREMENT PRIMARY KEY,
                license_key TEXT NOT NULL,
                activation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                will_terminate BOOLEAN DEFAULT FALSE,
                terminated_early BOOLEAN DEFAULT FALSE,
                extension_requested BOOLEAN DEFAULT FALSE
            )
        """)
        
        # Check if table is empty
        cursor.execute("SELECT COUNT(*) FROM system_license")
        count = cursor.fetchone()[0]
        if count == 0:
            # Check if there is an env variable VMS_LICENSE_KEY
            env_key = os.environ.get("VMS_LICENSE_KEY")
            if not env_key:
                # Try reading .env manually
                env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
                if not os.path.exists(env_path):
                    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
                if os.path.exists(env_path):
                    with open(env_path, "r", encoding="utf-8") as f:
                        for line in f:
                            if "VMS_LICENSE_KEY=" in line:
                                env_key = line.split("=", 1)[1].strip().strip("'\"")
                                break
            if env_key:
                print("Seeding active license key from env...")
                cursor.execute("""
                    INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early, extension_requested)
                    VALUES (%s, NOW(), FALSE, FALSE, FALSE)
                """, (env_key,))
                conn.commit()
                print("Active license key seeded successfully.")
            else:
                # Seed with default key from vms_sumeetgroup if available, or print warning
                default_key = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnRfbmFtZSI6IkZsaXBrYXJ0IiwiZXhwaXJlc19hdCI6IjIwMjYtMDctMjZUMDQ6MzY6MDUuMTc3MTA4IiwibWF4X3VzZXJzIjoxMDAsIm1heF9zaXRlcyI6MTB9.XZZy0PWBCQWLCcScVAeP8ZgBbkCLHn6IQU7A06CxqOaUHo8BZxT9qiUngPr3KOlBEf4YP-vmYh6jKshmUQ6LTkjdz83B6c-bFp4ASuBrmgbh882KuKcXfhVF_u0bcozCHxEkLKBPng1egWJSJMxjhmkQOc-1Muo366c6_wrZBXuDWaYuMjYLie9KP_Vz3e15q3igxJtcMcpm0aL06QDJ5_oRRyi4fKG1f5O_g07685TdWgTNWu_ZqkSoc-DH4Fg6vP-CZ6P5qJRO3FNqbb4QQL8eXtOWrDqTc1yN7L836cyUhPfrzdtJqkuvgOR1lckP507k11ksX5UCEE3jxfQgpw"
                print("No VMS_LICENSE_KEY found in .env, seeding default Flipkart license key.")
                cursor.execute("""
                    INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early, extension_requested)
                    VALUES (%s, NOW(), FALSE, FALSE, FALSE)
                """, (default_key,))
                conn.commit()
                print("Default license key seeded.")
        else:
            print("system_license table already contains records.")
            
        print("Licensing DB migration completed successfully.")
        return True
    except Exception as e:
        print(f"Error executing licensing migration: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    run_migration()
