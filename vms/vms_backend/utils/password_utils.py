# utils/password_utils.py

import pymysql.cursors
import sys
import os

# Helper to transform a password
def transform_password(password):
    if not password:
        return password
    # Make the first character uppercase
    password = password[0].upper() + password[1:]
    
    # Add @ between alphabets and numeric characters
    result = []
    for i in range(len(password)):
        result.append(password[i])
        if i < len(password) - 1:
            c = password[i]
            n = password[i+1]
            # Check transitions: alpha -> digit or digit -> alpha
            if (c.isalpha() and n.isdigit()) or (c.isdigit() and n.isalpha()):
                result.append('@')
    return "".join(result)

# Helper to validate a password against the standard format
def is_valid_password(password):
    if not password or len(password) < 8:
        return False
    has_uppercase = any(c.isupper() for c in password)
    has_number = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    return has_uppercase and has_number and has_special

# Migrate existing passwords in the database
def migrate_existing_passwords():
    # Append backend path to sys.path to resolve db module if run directly or as module
    backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_path not in sys.path:
        sys.path.append(backend_path)
    
    try:
        from db import get_db_connection
    except ImportError:
        # Fallback if db package structure differs
        print("[Password Migration] Could not import get_db_connection, skipping database update.")
        return

    conn = get_db_connection()
    if not conn:
        print("[Password Migration] Failed to connect to database.")
        return
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT user_id, email, password FROM users")
        users = cursor.fetchall()
        print(f"[Password Migration] Scanning {len(users)} user passwords...")
        for u in users:
            uid = u["user_id"]
            email = u["email"]
            pwd = u["password"]
            transformed = transform_password(pwd)
            if pwd != transformed:
                print(f"[Password Migration] Migrating user '{email}' password to new standard format.")
                cursor.execute(
                    "UPDATE users SET password = %s WHERE user_id = %s",
                    (transformed, uid)
                )
        print("[Password Migration] Completed password migration scan.")
    except Exception as e:
        print(f"[Password Migration] Error during migration: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    # Allow running this directly to migrate existing database passwords
    migrate_existing_passwords()
