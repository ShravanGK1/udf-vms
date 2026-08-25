import psycopg2
from config import DB_CONFIG

def test_insert():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("Testing SELECT...")
        cur.execute("SELECT user_id, name, email, role, department, status, profile_photo FROM users LIMIT 1")
        print("SELECT OK")
        
        print("Checking for password column...")
        cur.execute("SELECT password FROM users LIMIT 1")
        print("Password OK")
        
        cur.close()
        conn.close()
    except Exception as e:
        print("ERROR:", e)

if __name__ == "__main__":
    test_insert()
