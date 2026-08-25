from db import get_db_connection

def check_visitor_cols():
    try:
        conn = get_db_connection()
        if not conn:
            return
        cursor = conn.cursor()
        print("\nColumns in visitors table:")
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'visitors'
            ORDER BY ordinal_position;
        """)
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]}")
        cursor.close()
        conn.close()
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    check_visitor_cols()
