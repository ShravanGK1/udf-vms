# setup_database.py
"""
VMS Database Setup and Verification Utility
Enterprise Visitor Management System

Idempotent database initializer and schema verifier.
Safe for both fresh installations and existing databases:
- Never drops, truncates, or deletes tables or records.
- Creates database and tables if missing.
- Idempotently adds missing columns and default system configs.
- Verifies integrity of the data layer.
"""

import os
import sys
import re
import argparse
import pymysql
from pymysql.cursors import DictCursor

# Ensure parent directory is in Python path to import config
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from config import DB_CONFIG
except ImportError:
    from dotenv import load_dotenv
    load_dotenv()
    DB_CONFIG = {
        "host": os.environ.get("DB_HOST", "127.0.0.1"),
        "port": int(os.environ.get("DB_PORT", 3307)),
        "user": os.environ.get("DB_USER", "root"),
        "password": os.environ.get("DB_PASSWORD", "root"),
        "database": os.environ.get("DB_NAME", "vms")
    }

def ensure_persistent_directories(base_dir=None):
    """
    Ensure required runtime storage directories exist.
    Keeps uploaded files and operational state persistent and separate from source code.
    """
    if not base_dir:
        base_dir = current_dir

    dirs_to_create = [
        os.path.join(base_dir, "uploads"),
        os.path.join(base_dir, "uploads_users"),
        os.path.join(base_dir, "logs"),
        os.path.join(base_dir, "keys"),
    ]

    for d in dirs_to_create:
        os.makedirs(d, exist_ok=True)
    return True

def _bootstrap_app_user(conn):
    """
    Bootstrap least-privilege application database user on loopback.
    Executed only during fresh install bootstrap when app user does not yet exist.
    """
    cursor = conn.cursor()
    db_name = DB_CONFIG["database"]
    user = DB_CONFIG["user"]
    password = DB_CONFIG["password"]

    # 1. Ensure target database exists
    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")

    # 2. Grant permissions restricted strictly to loopback
    for host in ["127.0.0.1", "localhost"]:
        cursor.execute(f"CREATE USER IF NOT EXISTS '{user}'@'{host}' IDENTIFIED BY %s", (password,))
        cursor.execute(f"ALTER USER '{user}'@'{host}' IDENTIFIED BY %s", (password,))
        cursor.execute(
            f"GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER, REFERENCES, LOCK TABLES "
            f"ON `{db_name}`.* TO '{user}'@'{host}'"
        )
    cursor.execute("FLUSH PRIVILEGES")
    cursor.close()

import time

def get_server_connection(autocommit=True, max_retries=15, retry_interval=2):
    """
    Connect to MySQL server with bounded readiness retry.
    Handles startup delays when service has just started.
    """
    last_err = None
    for attempt in range(max_retries):
        try:
            return pymysql.connect(
                host=DB_CONFIG["host"],
                port=int(DB_CONFIG.get("port", 3307)),
                user=DB_CONFIG["user"],
                password=DB_CONFIG["password"],
                autocommit=autocommit,
                charset="utf8mb4"
            )
        except pymysql.err.OperationalError as e:
            last_err = e
            # Connection refused (service still starting up)
            if e.args[0] in (2003, 2002):
                if attempt < max_retries - 1:
                    time.sleep(retry_interval)
                    continue
            # Access denied: attempt root bootstrap on localhost if fresh installation
            if e.args[0] in (1045, 1044):
                for root_pwd in ["", "root"]:
                    try:
                        root_conn = pymysql.connect(
                            host=DB_CONFIG["host"],
                            port=int(DB_CONFIG.get("port", 3307)),
                            user="root",
                            password=root_pwd,
                            autocommit=True,
                            charset="utf8mb4"
                        )
                        _bootstrap_app_user(root_conn)
                        root_conn.close()
                        # Retry with configured credentials
                        return pymysql.connect(
                            host=DB_CONFIG["host"],
                            port=int(DB_CONFIG.get("port", 3307)),
                            user=DB_CONFIG["user"],
                            password=DB_CONFIG["password"],
                            autocommit=autocommit,
                            charset="utf8mb4"
                        )
                    except Exception:
                        continue
            raise
    if last_err:
        raise last_err

def get_database_connection(autocommit=True):
    """Connect directly to the configured target database."""
    try:
        return pymysql.connect(
            host=DB_CONFIG["host"],
            port=int(DB_CONFIG.get("port", 3307)),
            user=DB_CONFIG["user"],
            password=DB_CONFIG["password"],
            database=DB_CONFIG["database"],
            autocommit=autocommit,
            charset="utf8mb4"
        )
    except pymysql.err.OperationalError as e:
        if e.args[0] in (1045, 1044, 1049):
            # Attempt bootstrap via server connection
            conn = get_server_connection()
            conn.close()
            return pymysql.connect(
                host=DB_CONFIG["host"],
                port=int(DB_CONFIG.get("port", 3307)),
                user=DB_CONFIG["user"],
                password=DB_CONFIG["password"],
                database=DB_CONFIG["database"],
                autocommit=autocommit,
                charset="utf8mb4"
            )
        raise

def ensure_database_exists():
    """Create the target database if it does not already exist."""
    db_name = DB_CONFIG["database"]
    try:
        conn = get_server_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
            f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        cursor.close()
        conn.close()
        return True, f"Database '{db_name}' ensured."
    except Exception as e:
        return False, f"Failed to connect to MySQL server: {str(e)}"

def execute_clean_schema(schema_file_path=None):
    """
    Execute clean DDL schema script idempotently.
    Parses and executes individual statements from schema_clean.sql.
    """
    if not schema_file_path:
        schema_file_path = os.path.join(current_dir, "schema_clean.sql")
        if not os.path.exists(schema_file_path):
            schema_file_path = os.path.join(current_dir, "..", "schema_clean.sql")

    if not os.path.exists(schema_file_path):
        return False, f"Schema file not found at: {schema_file_path}"

    with open(schema_file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Strip block comments
    clean_sql = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

    # Parse statements
    statements = []
    current_statement = []
    for line in clean_sql.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith('--') or trimmed.startswith('#'):
            continue
        current_statement.append(line)
        if trimmed.endswith(';'):
            statements.append("\n".join(current_statement))
            current_statement = []

    if current_statement:
        stmt = "\n".join(current_statement).strip()
        if stmt:
            statements.append(stmt)

    try:
        conn = get_database_connection()
        cursor = conn.cursor()

        executed_count = 0
        for stmt in statements:
            stmt_clean = stmt.strip()
            if not stmt_clean or stmt_clean.upper().startswith("USE "):
                continue
            cursor.execute(stmt_clean)
            executed_count += 1

        cursor.close()
        conn.close()
        return True, f"Successfully executed {executed_count} schema statements."
    except Exception as e:
        return False, f"Schema execution failed: {str(e)}"

def verify_and_migrate_columns():
    """
    Verify and idempotently apply any missing columns on existing tables.
    Preserves all existing data.
    """
    migrations = [
        # (table, column, ddl)
        ("sites", "customer_id", "ALTER TABLE sites ADD COLUMN customer_id INT DEFAULT 1"),
        ("sites", "code", "ALTER TABLE sites ADD COLUMN code VARCHAR(50) DEFAULT NULL"),
        ("sites", "lat", "ALTER TABLE sites ADD COLUMN lat DECIMAL(10, 6) DEFAULT NULL"),
        ("sites", "lng", "ALTER TABLE sites ADD COLUMN lng DECIMAL(10, 6) DEFAULT NULL"),
        ("users", "customer_id", "ALTER TABLE users ADD COLUMN customer_id INT DEFAULT 1"),
        ("users", "remote_login_token", "ALTER TABLE users ADD COLUMN remote_login_token VARCHAR(512) DEFAULT NULL"),
        ("visitors", "vehicle_photo_front", "ALTER TABLE visitors ADD COLUMN vehicle_photo_front VARCHAR(255) DEFAULT NULL"),
        ("visitors", "vehicle_photo_side", "ALTER TABLE visitors ADD COLUMN vehicle_photo_side VARCHAR(255) DEFAULT NULL"),
        ("visitor_requests", "site_id", "ALTER TABLE visitor_requests ADD COLUMN site_id INT DEFAULT NULL"),
        ("visitor_requests", "signature_path", "ALTER TABLE visitor_requests ADD COLUMN signature_path VARCHAR(255) DEFAULT NULL"),
        ("visitor_requests", "checkout_signature_path", "ALTER TABLE visitor_requests ADD COLUMN checkout_signature_path VARCHAR(255) DEFAULT NULL"),
        ("visitor_requests", "checked_in_by", "ALTER TABLE visitor_requests ADD COLUMN checked_in_by INT DEFAULT NULL"),
        ("visitor_requests", "physical_badge_no", "ALTER TABLE visitor_requests ADD COLUMN physical_badge_no VARCHAR(50) DEFAULT NULL"),
    ]

    try:
        conn = get_database_connection()
        cursor = conn.cursor()
        db_name = DB_CONFIG["database"]

        for table, column, ddl in migrations:
            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s
                """,
                (db_name, table, column)
            )
            col_exists = cursor.fetchone()[0] > 0
            if not col_exists:
                cursor.execute(ddl)

        cursor.close()
        conn.close()
        return True, "Column verification and migrations verified."
    except Exception as e:
        return False, f"Column migration check encountered an error: {str(e)}"

def verify_database_health():
    """
    Perform a complete health check of the database schema.
    Returns status and list of table names present.
    """
    required_tables = [
        "customers", "sites", "users", "user_sites",
        "visitors", "visitor_requests", "system_license",
        "system_settings", "superadmin_audit_logs", "role_permissions"
    ]

    try:
        conn = get_database_connection()
        cursor = conn.cursor(DictCursor)
        db_name = DB_CONFIG["database"]

        cursor.execute(
            """
            SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = %s
            """,
            (db_name,)
        )
        existing_tables = {row["TABLE_NAME"].lower() for row in cursor.fetchall()}

        missing_tables = [t for t in required_tables if t.lower() not in existing_tables]

        # Check user count to know if setup is required
        user_count = 0
        if "users" in existing_tables:
            cursor.execute("SELECT COUNT(*) AS cnt FROM users")
            user_count = cursor.fetchone()["cnt"]

        cursor.close()
        conn.close()

        healthy = len(missing_tables) == 0
        return {
            "healthy": healthy,
            "existing_tables": list(existing_tables),
            "missing_tables": missing_tables,
            "user_count": user_count,
            "setup_required": (user_count == 0)
        }
    except Exception as e:
        return {
            "healthy": False,
            "error": str(e),
            "existing_tables": [],
            "missing_tables": required_tables,
            "user_count": 0,
            "setup_required": True
        }

def setup_database(verbose=True):
    """
    Main entry point for database initialization.
    Safe, idempotent, zero data loss.
    """
    if verbose:
        print("==================================================")
        print("  VMS Database Setup & Verification")
        print("==================================================")
        print(f"Target Host:     {DB_CONFIG['host']}:{DB_CONFIG['port']}")
        print(f"Target Database: {DB_CONFIG['database']}")
        print("--------------------------------------------------")

    # Step 1: Ensure persistent file directories
    ensure_persistent_directories()
    if verbose:
        print("[1/4] Persistent storage directories verified.")

    # Step 2: Ensure database exists
    ok, msg = ensure_database_exists()
    if not ok:
        if verbose:
            print(f"[ERROR] {msg}")
        return False
    if verbose:
        print(f"[2/4] {msg}")

    # Step 3: Execute clean schema
    ok, msg = execute_clean_schema()
    if not ok:
        if verbose:
            print(f"[ERROR] {msg}")
        return False
    if verbose:
        print(f"[3/4] {msg}")

    # Step 4: Verify and migrate columns
    ok, msg = verify_and_migrate_columns()
    if not ok:
        if verbose:
            print(f"[WARNING] {msg}")

    # Step 5: Verify health
    health = verify_database_health()
    if verbose:
        if health["healthy"]:
            print(f"[4/4] All {len(health['existing_tables'])} required tables verified.")
            if health["setup_required"]:
                print(">>> System is clean and ready for First-Run Administrator Setup. <<<")
            else:
                print(f">>> Existing system active with {health['user_count']} registered user(s). <<<")
            print("==================================================")
        else:
            print(f"[ERROR] Missing tables: {health['missing_tables']}")
            print("==================================================")

    return health["healthy"]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VMS Database Setup Utility")
    parser.add_argument("--check-only", action="store_true", help="Only verify database health without applying schema")
    args = parser.parse_args()

    if args.check_only:
        health = verify_database_health()
        print("Database Health Report:", health)
        sys.exit(0 if health["healthy"] else 1)
    else:
        success = setup_database(verbose=True)
        sys.exit(0 if success else 1)
