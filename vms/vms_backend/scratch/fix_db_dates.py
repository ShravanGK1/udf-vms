import pymysql

def fix_dates():
    conn = pymysql.connect(
        host='localhost',
        user='root',
        password='Sumit@2006',
        database='vms',
        port=3306,
        autocommit=True
    )
    cur = conn.cursor()
    
    # Update visitor requests that are in the future
    cur.execute("UPDATE visitor_requests SET created_at = '2026-06-25 12:00:00' WHERE created_at > '2026-06-26 23:59:59'")
    print(f"Updated {cur.rowcount} future visitor_requests records.")
    
    # Let's also check if there are other tables with future dates
    cur.execute("SELECT MAX(created_at) FROM visitor_requests")
    print("New latest visitor_requests date:", cur.fetchone()[0])
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    fix_dates()
