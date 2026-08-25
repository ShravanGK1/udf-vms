import pymysql
from db import get_db_connection

def init_db():
    conn = get_db_connection()
    if not conn:
        print("Failed to connect to database for initialization.")
        return
        
    try:
        cursor = conn.cursor()
        
        # 1. Sites Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sites (
                site_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL,
                address VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        

        
        # 3. System Settings Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(255) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL
            )
        """)
        
        # 4. Superadmin Audit Logs Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS superadmin_audit_logs (
                log_id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                action VARCHAR(255) NOT NULL,
                target VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 5. Role Permissions Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_name VARCHAR(50) PRIMARY KEY,
                reports TINYINT(1) DEFAULT 0,
                config TINYINT(1) DEFAULT 0,
                `purge` TINYINT(1) DEFAULT 0,
                users TINYINT(1) DEFAULT 0
            )
        """)
        
        # Seed Sites (Disabled default seeding per user request)
        pass
            

            
        # Seed Settings
        cursor.execute("SELECT COUNT(*) FROM system_settings")
        if cursor.fetchone()[0] == 0:
            settings_data = [
                ("session_timeout", "30"),
                ("data_purge_days", "90"),
                ("alert_sound", "Enabled"),
                ("mfa_status", "Disabled")
            ]
            cursor.executemany(
                "INSERT INTO system_settings (setting_key, setting_value) VALUES (%s, %s)",
                settings_data
            )
            print("Seeded system_settings table.")
            
        # Seed Audit Logs
        cursor.execute("SELECT COUNT(*) FROM superadmin_audit_logs")
        if cursor.fetchone()[0] == 0:
            logs_data = [
                ("Admin User", "Modified site configuration", "Mumbai HQ"),
                ("System", "Auto-purged expired visitor data", "All Sites"),
                ("Priya Sharma", "Created new user role", "Security Manager"),
                ("Admin User", "Updated global settings config", "Global Settings"),
                ("System", "Generated compliance report", "Q1 2026")
            ]
            cursor.executemany(
                "INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)",
                logs_data
            )
            print("Seeded superadmin_audit_logs table.")
            
        # Seed Role Permissions
        cursor.execute("SELECT COUNT(*) FROM role_permissions")
        if cursor.fetchone()[0] == 0:
            permissions_data = [
                ("superadmin", 1, 1, 1, 1),
                ("admin", 1, 1, 0, 1),
                ("host", 0, 0, 0, 0),
                ("security", 0, 0, 0, 0)
            ]
            cursor.executemany(
                "INSERT INTO role_permissions (role_name, reports, config, `purge`, users) VALUES (%s, %s, %s, %s, %s)",
                permissions_data
            )
            print("Seeded role_permissions table.")
            
        conn.commit()
        print("Superadmin tables initialized successfully.")
    except Exception as e:
        print("Error initializing database:", e)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_db()
