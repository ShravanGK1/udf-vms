import os
import pymysql
import sys

# Add parent directories to path
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

def reset_to_first_use():
    print("=== RESETTING SYSTEM LICENSE TO FIRST-TIME USAGE ===")
    
    # 1. Clear database table system_license
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    db_host = "localhost"
    db_port = 3306
    db_user = "root"
    db_pass = ""
    db_name = "vms"
    
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    k = parts[0].strip()
                    v = parts[1].strip().strip("'\"")
                    if k == "DB_HOST": db_host = v
                    elif k == "DB_PORT": db_port = int(v)
                    elif k == "DB_USER": db_user = v
                    elif k == "DB_PASSWORD": db_pass = v
                    elif k == "DB_NAME": db_name = v

    try:
        conn = pymysql.connect(
            host=db_host,
            user=db_user,
            password=db_pass,
            database=db_name,
            port=db_port,
            autocommit=True
        )
        cursor = conn.cursor()
        
        # Truncate
        cursor.execute("TRUNCATE TABLE system_license")
        print("[1/3] Database system_license table successfully truncated.")
        cursor.close()
        conn.close()
    except Exception as e:
        print("Error truncating system_license:", e)
        return

    # 2. Delete clock state file if exists
    state_file = os.path.join(os.path.dirname(__file__), "..", "utils", "license_state.json")
    if os.path.exists(state_file):
        try:
            os.remove(state_file)
            print("[2/3] Monotonic clock state file (license_state.json) deleted successfully.")
        except Exception as e:
            print("Error deleting license_state.json:", e)
    else:
        print("[2/3] Monotonic clock state file (license_state.json) did not exist (already clean).")

    # 3. Seed active license key from env / default
    print("[3/3] Running migrate_license.py to seed active license...")
    from migrate_license import run_migration
    if run_migration():
        print("Licensing date and database successfully reset to first-time usage!")
    else:
        print("Failed to run migrate_license.py.")

if __name__ == "__main__":
    reset_to_first_use()
