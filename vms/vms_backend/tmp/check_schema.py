from db import get_db_connection
import psycopg2.extras

def check_schema():
    conn = get_db_connection()
    if not conn:
        print("Failed to connect")
        return
    
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'")
        cols = cursor.fetchall()
        print("Columns in 'users' table:")
        for col in cols:
            print(f"- {col[0]} ({col[1]})")
    except Exception as e:
        print("Error:", e)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    check_schema()
