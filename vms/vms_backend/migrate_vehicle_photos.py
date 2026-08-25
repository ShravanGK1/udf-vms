import pymysql
from db import get_db_connection
import os

def run_migration():
    conn = get_db_connection()
    if not conn:
        print("Failed to connect to the database.")
        return False
    
    try:
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'visitors' 
              AND COLUMN_NAME IN ('vehicle_photo_front', 'vehicle_photo_side')
        """)
        existing_cols = [row[0] for row in cursor.fetchall()]
        
        if 'vehicle_photo_front' not in existing_cols:
            print("Adding vehicle_photo_front column to visitors table...")
            cursor.execute("ALTER TABLE visitors ADD COLUMN vehicle_photo_front VARCHAR(255) DEFAULT NULL")
            print("vehicle_photo_front column added successfully.")
        else:
            print("vehicle_photo_front column already exists.")
            
        if 'vehicle_photo_side' not in existing_cols:
            print("Adding vehicle_photo_side column to visitors table...")
            cursor.execute("ALTER TABLE visitors ADD COLUMN vehicle_photo_side VARCHAR(255) DEFAULT NULL")
            print("vehicle_photo_side column added successfully.")
        else:
            print("vehicle_photo_side column already exists.")
            
        conn.commit()
        print("Migration completed successfully.")
        return True
    except Exception as e:
        print(f"Error executing migration: {e}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
