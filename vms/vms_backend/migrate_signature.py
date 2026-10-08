import os
import sys

# Ensure parent directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import get_db_connection

def migrate():
    conn = get_db_connection()
    if not conn:
        print("Failed to connect to database for migration.")
        sys.exit(1)
        
    cursor = conn.cursor()
    try:
        # Check if column signature_path already exists
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'visitor_requests'
              AND COLUMN_NAME = 'signature_path'
        """)
        exists = cursor.fetchone()[0]
        
        if not exists:
            print("Adding column 'signature_path' to table 'visitor_requests'...")
            cursor.execute("""
                ALTER TABLE visitor_requests
                ADD COLUMN signature_path VARCHAR(255) DEFAULT NULL
            """)
            conn.commit()
            print("Successfully added 'signature_path' column.")
        else:
            print("Column 'signature_path' already exists in 'visitor_requests'.")
    except Exception as e:
        print(f"Error during migration: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    migrate()
