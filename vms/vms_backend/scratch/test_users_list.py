import sys
sys.path.append('.')
from db import get_db_connection
import pymysql.cursors

try:
    conn = get_db_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    cursor.execute("SELECT user_id, email, role, name, department, status FROM users WHERE role IN ('host', 'security')")
    users = cursor.fetchall()
    print("Fetched successfully:", users)
    cursor.close()
    conn.close()
except Exception as e:
    import traceback
    traceback.print_exc()
