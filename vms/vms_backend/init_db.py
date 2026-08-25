import os
import re
import pymysql
from config import DB_CONFIG

def init_database():
    print("Database Connection Config:")
    print(f"  Host: {DB_CONFIG['host']}")
    print(f"  Port: {DB_CONFIG['port']}")
    print(f"  User: {DB_CONFIG['user']}")
    print(f"  Database: {DB_CONFIG['database']}")
    print("----------------------------------------")

    # Step 1: Connect to MySQL server without database to create it if missing
    try:
        conn = pymysql.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            port=DB_CONFIG['port'],
            autocommit=True
        )
        cursor = conn.cursor()
        db_name = DB_CONFIG['database']
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        print(f"MySQL server connection verified. Database '{db_name}' ensured.")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error connecting to MySQL server: {e}")
        print("\nPlease verify that your MySQL server is running and that your credentials in the `.env` file are correct.")
        return False

    # Step 2: Connect to the database and run schema
    try:
        conn = pymysql.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            database=DB_CONFIG['database'],
            port=DB_CONFIG['port'],
            autocommit=True
        )
        cursor = conn.cursor()
        print("Connected to database successfully. Checking schema...")

        # Find the mysql_schema.sql file
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        schema_path = os.path.join(backend_dir, "..", "mysql_schema.sql")
        if not os.path.exists(schema_path):
            schema_path = os.path.join(backend_dir, "mysql_schema.sql")

        if not os.path.exists(schema_path):
            print(f"Error: mysql_schema.sql not found at {schema_path}")
            return False

        print(f"Reading schema from: {schema_path}")
        with open(schema_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        # Split SQL into individual statements
        # First, remove block comments (/* ... */) and single-line comments
        # Although re is simple, we can filter lines or use regex.
        sql_clean = re.sub(r'/\*.*?\*/', '', sql_content, flags=re.DOTALL)
        
        # Split by semicolon followed by whitespace/newline
        statements = []
        # Keep track of current statement
        curr_stmt = []
        for line in sql_clean.splitlines():
            # Skip comments and empty lines
            trimmed = line.strip()
            if not trimmed or trimmed.startswith('--') or trimmed.startswith('#'):
                continue
            curr_stmt.append(line)
            if trimmed.endswith(';'):
                statements.append("\n".join(curr_stmt))
                curr_stmt = []
        
        if curr_stmt:
            stmt = "\n".join(curr_stmt).strip()
            if stmt:
                statements.append(stmt)

        print(f"Found {len(statements)} SQL statements to execute.")
        
        executed_count = 0
        for i, stmt in enumerate(statements, 1):
            stmt_str = stmt.strip()
            if not stmt_str:
                continue
            
            # Skip USE statement if it explicitly sets a different DB name
            if stmt_str.upper().startswith("USE "):
                continue

            try:
                cursor.execute(stmt_str)
                executed_count += 1
            except Exception as stmt_error:
                print(f"Warning in statement {i}: {stmt_error}")
                print(f"Statement: {stmt_str[:150]}...")
                # We continue to let other tables/inserts run (e.g. if tables already exist)

        print(f"Successfully executed {executed_count} SQL statements.")
        cursor.close()
        conn.close()
        print("Database initialization complete.")
        return True
    except Exception as e:
        print(f"An error occurred during schema execution: {e}")
        return False

if __name__ == "__main__":
    init_database()
