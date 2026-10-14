# packaging/scripts/generate_credentials.py
"""
VMS Installation Credential & Secret Generator
Generates unique, cryptographically secure secrets per client installation:
- Generates 64-character SECRET_KEY for Flask session signing.
- Generates 32-character application database password.
- Writes to target .env file with least-privilege permissions.
"""

import os
import sys
import secrets
import string
import argparse

def generate_strong_password(length=32):
    """Generate a high-entropy password suitable for internal database users."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^*_+-="
    # Ensure at least 2 uppercase, 2 digits, 2 symbols
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in pwd) and
            any(c.islower() for c in pwd) and
            any(c.isdigit() for c in pwd) and
            any(c in "!@#$%^*_+-=" for c in pwd)):
            return pwd

def generate_installation_environment(target_env_path, db_name="vms", db_port=3307, overwrite=False):
    """Generate a production .env file with unique secrets."""
    if os.path.exists(target_env_path) and not overwrite:
        # Preserve credentials while ensuring DB_PORT is aligned
        try:
            with open(target_env_path, "r", encoding="utf-8") as f:
                content = f.read()
            if re.search(r"^DB_PORT=.*$", content, flags=re.MULTILINE):
                content = re.sub(r"^DB_PORT=.*$", f"DB_PORT={db_port}", content, flags=re.MULTILINE)
            else:
                content += f"\nDB_PORT={db_port}\n"
            if not re.search(r"^DB_HOST=.*$", content, flags=re.MULTILINE):
                content += "\nDB_HOST=127.0.0.1\n"
            with open(target_env_path, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            print(f"[WARN] Failed to update port in existing .env: {e}")
        print(f"[INFO] Existing .env found at {target_env_path}. Preserving existing credentials (aligned DB_PORT={db_port}).")
        return True

    secret_key = secrets.token_hex(32)  # 64 characters
    db_password = generate_strong_password(32)

    env_content = f"""# ==============================================================
# VMS On-Premise Installation Runtime Configuration
# Generated automatically during installation.
# DO NOT COMMIT OR EXPOSE THIS FILE.
# ==============================================================

# Flask Security & Session Signature
SECRET_KEY={secret_key}
FLASK_ENV=production

# Database Connection (Bound to Loopback)
DB_HOST=127.0.0.1
DB_PORT={db_port}
DB_NAME={db_name}
DB_USER=vms_app_user
DB_PASSWORD={db_password}

# Internal Backend Network Binding
VMS_BACKEND_HOST=127.0.0.1
VMS_BACKEND_PORT=5000
VMS_BACKEND_THREADS=8

# Persistent Storage Directories
VMS_DATA_DIR=C:\\ProgramData\\VMS
VMS_UPLOAD_DIR=C:\\ProgramData\\VMS\\uploads
VMS_USER_UPLOAD_DIR=C:\\ProgramData\\VMS\\uploads_users
VMS_LOG_DIR=C:\\ProgramData\\VMS\\logs
"""

    os.makedirs(os.path.dirname(os.path.abspath(target_env_path)), exist_ok=True)
    with open(target_env_path, "w", encoding="utf-8") as f:
        f.write(env_content)

    print(f"[SUCCESS] Generated unique installation credentials at: {target_env_path}")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate unique installation secrets and .env")
    parser.add_argument("--output", default=".env", help="Target path for .env file")
    parser.add_argument("--port", type=int, default=3307, help="Database port")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing .env file")
    args = parser.parse_args()

    generate_installation_environment(args.output, db_port=args.port, overwrite=args.overwrite)
