import os
import re
import pymysql

# 1. Clear VMS_LICENSE_KEY inside .env
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
if os.path.exists(env_path):
    print("Clearing VMS_LICENSE_KEY inside .env...")
    with open(env_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace VMS_LICENSE_KEY value with empty string
    new_content = re.sub(r"VMS_LICENSE_KEY=.*", "VMS_LICENSE_KEY=", content)
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Cleaned .env successfully.")
else:
    print(".env file not found at", env_path)

# 2. Truncate system_license table in MySQL
print("Connecting to client database to truncate system_license...")
try:
    # Load env variables manually for connecting
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
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k == "DB_HOST": db_host = v
                    elif k == "DB_PORT": db_port = int(v)
                    elif k == "DB_USER": db_user = v
                    elif k == "DB_PASSWORD": db_pass = v
                    elif k == "DB_NAME": db_name = v

    conn = pymysql.connect(
        host=db_host,
        user=db_user,
        password=db_pass,
        database=db_name,
        port=db_port,
        autocommit=True
    )
    cursor = conn.cursor()
    
    # Truncate license table
    cursor.execute("TRUNCATE TABLE system_license")
    print("Successfully truncated system_license table!")
    
    # Clean monotonic state file if it exists
    state_file = os.path.join(os.path.dirname(__file__), "..", "utils", "license_state.json")
    if os.path.exists(state_file):
        os.remove(state_file)
        print("Cleaned license_state.json monotonic time clock cache.")
        
    cursor.close()
    conn.close()
except Exception as e:
    print("Error truncating system_license:", e)
