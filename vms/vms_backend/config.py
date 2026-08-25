# config.py
import os

# Helper to load .env file manually since python-dotenv is not installed
def load_dotenv():
    # Try looking in parent directory first (if run from VMS_Backend)
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if not os.path.exists(env_path):
        # Fallback to current directory
        env_path = os.path.join(os.path.dirname(__file__), ".env")
    
    env_keys = set()
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    os.environ[key] = val
                    env_keys.add(key)

    # Clean up cached variables that were removed/emptied from .env (e.g. from Flask auto-reloader cache)
    if "VMS_LICENSE_KEY" not in env_keys or not os.environ.get("VMS_LICENSE_KEY"):
        os.environ.pop("VMS_LICENSE_KEY", None)

load_dotenv()

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "database": os.environ.get("DB_NAME", "vms"),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", "root"),
    "port": int(os.environ.get("DB_PORT", 3306))
}

SECRET_KEY = os.environ.get("SECRET_KEY", "vms_secret_key_2026")