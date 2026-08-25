import pymysql
from dbutils.pooled_db import PooledDB
from config import DB_CONFIG

# Initialize thread-safe database connection pool for the client verifier
_db_pool = PooledDB(
    creator=pymysql,
    maxconnections=20,
    mincached=2,
    maxcached=10,
    maxshared=10,
    blocking=True,
    host=DB_CONFIG['host'],
    user=DB_CONFIG['user'],
    password=DB_CONFIG['password'],
    database=DB_CONFIG['database'],
    port=DB_CONFIG['port'],
    autocommit=True,
    init_command="SET time_zone = '+05:30';"
)

def get_db_connection():
    try:
        return _db_pool.connection()
    except Exception as e:
        print("Database connection pool checkout error:", e)
    return None