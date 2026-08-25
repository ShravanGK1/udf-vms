import os
import json
import datetime
import jwt
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for

# Helper to load .env file manually
def load_dotenv():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if not os.path.exists(env_path):
        env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    val = val.strip().strip("'\"")
                    os.environ[key.strip()] = val

load_dotenv()

def transform_password(password):
    if not password:
        return password
    # Make the first character uppercase
    password = password[0].upper() + password[1:]
    
    # Add @ between alphabets and numeric characters
    result = []
    for i in range(len(password)):
        result.append(password[i])
        if i < len(password) - 1:
            c = password[i]
            n = password[i+1]
            if (c.isalpha() and n.isdigit()) or (c.isdigit() and n.isalpha()):
                result.append('@')
    return "".join(result)

def is_valid_password(password):
    if not password or len(password) < 8:
        return False
    has_uppercase = any(c.isupper() for c in password)
    has_number = any(c.isdigit() for c in password)
    has_special = any(not c.isalnum() for c in password)
    return has_uppercase and has_number and has_special

app = Flask(__name__, static_folder='static')
app.secret_key = os.environ.get("PROVIDER_SECRET_KEY", "vms_authority_provider_secret_salt_2026")

ADMIN_USER = os.environ.get("PROVIDER_ADMIN_USER", "admin")
ADMIN_PASSWORD = transform_password(os.environ.get("PROVIDER_ADMIN_PASSWORD", "admin123"))

@app.before_request
def require_login():
    allowed_paths = [
        '/login',
        '/api/login',
        '/static/index.css',
        '/static/index.js',
        '/api/license/request-extension',
        '/api/active-contracts-count'
    ]
    if request.path in allowed_paths or request.path.startswith('/static/'):
        return None
        
    if request.path in ('/login.html', '/login.css'):
        return None

    if not session.get('logged_in'):
        if request.path.startswith('/api/'):
            return jsonify({"error": "Unauthorized", "message": "Authentication required."}), 401
        return redirect(url_for('login_page'))

@app.route('/login')
def login_page():
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    
    if not is_valid_password(password):
        return jsonify({"error": "Password must be at least 8 characters, contain at least one uppercase letter, one special character, and one number"}), 400
        
    if username == ADMIN_USER and password == ADMIN_PASSWORD:
        session['logged_in'] = True
        return jsonify({"message": "Login successful!"}), 200
    else:
        return jsonify({"error": "Invalid username or password"}), 401

@app.route('/api/active-contracts-count', methods=['GET'])
def get_active_contracts_count():
    try:
        licenses = load_licenses()
        # count only licenses where terminated_early is False
        count = sum(1 for c in licenses if not c.get("terminated_early"))
        return jsonify({"count": count}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/logout', methods=['POST', 'GET'])
def api_logout():
    session.pop('logged_in', None)
    return jsonify({"message": "Logged out successfully!"}), 200


import pymysql
from dbutils.pooled_db import PooledDB

_db_pool = PooledDB(
    creator=pymysql,
    maxconnections=20,
    mincached=2,
    maxcached=10,
    maxshared=10,
    blocking=True,
    host=os.environ.get("DB_HOST", "localhost"),
    user=os.environ.get("DB_USER", "root"),
    password=os.environ.get("DB_PASSWORD", "root"),
    database=os.environ.get("DB_NAME", "vms"),
    port=int(os.environ.get("DB_PORT", 3306)),
    autocommit=True
)

def get_db_connection():
    try:
        return _db_pool.connection()
    except Exception as e:
        print("Provider DB pool checkout error:", e)
        return None


DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generated_licenses.json')

# RSA Cryptography Keys matching the client verifier public key
PRIVATE_KEY_PEM = """-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAsmkIVEbQRQhu23ogASCiXGzPXBB/UR9dBxFCUu3ucHcFdmjp
ZgJRGCJhvzcJeb76qQE0uv7RubR8G6DwP7LQP+Ntud2MiZl8tdRPGm7v4W1nBLAS
X4bPvpyYM5W9U5xXh/QfeuD87tlghbVrasDUDWzvmUJcjfUCzyJGRtr1kScbYAUi
01G4fNHpC5f196bqNH5f0wpKVb1tTHeuILfWkMML7evJsXxkcaiiN2fCwyLYqtBb
LMtDrUgU0M5ORRMVYajfXfAAubpH5LvLTmfBNBJZrSPDY9TuwDgdh8+CrqGi7Vw1
sqsmSN7MdnTXfcXx45HI1zyijCyfhGwCm1irHwIDAQABAoIBAE35yPmon5NkbatA
U6eaf0vdBL4subCXgB28JdxAAJQn+Pu5O7Vpcs8VC9q6b8pFtaFTFRxbjgdXwlyC
+S4l9Y3O1WDEW42yR0bjXZVkgjRpD/sFB2q37alWINF+8yoNbVZO1Mlsdy/fUyft
VF7qm2OoxomZ7wDeYpVsWgHS5jxDessgeZlXHcrz8KoJm40lmZzV7KOsn8/9GEzV
2qYT1QwpJVCEUFkgQZzbyy69DQlPSCgT989IF1tD1pevRkb5aKuhprr2f/JsqdU1
1FwByBOcwIu8768zodNyd+CWFcwpUG9Ei30rAvrgEQGCGUSEseX4dnAkFdodAXwT
f0QRKu0CgYEA7/FgYtFRWzliFLTdsxdCgxOe6Qt6g1nL2DqQvLefI1IZ+QyvyVEq
PK7k940bSQWiX/5biwpfDOA+h9e2CFgnBlwh1uCdK5yWlotqont3THpEVR0FDgTC
W6vjkZ8fejD7bVuz58YvQBlZhRiIhq1nZ/DfIcZzCyyde2Ev3n+lebUCgYEAvll/
5h1DYXDpufJZPWnZUgA3EbNUT+HzLfWJqJEAnNRmvFdpx8Mx7wQP7NVZLqGQopQC
4R0Ho7/yWIlp31kbu/coWv/FyW3Eh2buidrcb3Czzqy3KzOZEvSwZNMwXNcfAc1w
tOdYTe7AHpyGSsskJrWjbtSGxmMRgIOycW4WBgMCgYBBjp+ZIDusQwdrROd18Rr5
GTlHzx0QGk65q3a0OS8/xUTXaQH2bTivD9H7WRBlaSauN57nZFQH/pTXJLbVnNA8
yptsTD5lFgmG5FykPDuiJ53X62/gHqjDxzkMJn/BMPThMjb7UojCaKqu1L8onOQt
3//3CHOSUARPG4SqtBGQKQKBgDir/OBOJhmEvJGYDemy8fjwB3VFpvyBkR1F1U5S
nZQTyOKaQ+wtuVgoJXWlr3+qqp084/6R3gxqwYSKpPLSXOeBlopBTGnEPJbzlmGE
v8yOCXqnAYHjQtfZ8gqStftuMNUgjUXO+wN46cozX+g0wvajbZ05uUaniDZy/1W2
KOhxAoGBAN5KN4T87k9f9S5/YmDHXDozYuiyzNWrQvmgIFYoaAswx5nWhgM5ocsI
Qph0TQYnNThB7E7+3PjAJxqATxedOpkFhJ/56ULpqGFNomiKKUArzyN7iSfhVzc9
SuUCjImdjGe9XFf71+AL7MPoHTl9MJxv2HbEb4UQDl1zpbt7/rnx
-----END RSA PRIVATE KEY-----"""

PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsmkIVEbQRQhu23ogASCi
XGzPXBB/UR9dBxFCUu3ucHcFdmjpZgJRGCJhvzcJeb76qQE0uv7RubR8G6DwP7LQ
P+Ntud2MiZl8tdRPGm7v4W1nBLASX4bPvpyYM5W9U5xXh/QfeuD87tlghbVrasDU
DWzvmUJcjfUCzyJGRtr1kScbYAUi01G4fNHpC5f196bqNH5f0wpKVb1tTHeuILfW
kMML7evJsXxkcaiiN2fCwyLYqtBbLMtDrUgU0M5ORRMVYajfXfAAubpH5LvLTmfB
NBJZrSPDY9TuwDgdh8+CrqGi7Vw1sqsmSN7MdnTXfcXx45HI1zyijCyfhGwCm1ir
HwIDAQAB
-----END PUBLIC KEY-----"""


def load_licenses():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r') as f:
                data = json.load(f)
            
            # Schema migration helper for legacy keys
            migrated = False
            for client in data:
                if "sites" not in client:
                    client["sites"] = []
                    migrated = True
                if "permissions" not in client:
                    client["permissions"] = {
                        "superadmin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "manage_licenses", "system_settings", "data_purging"],
                        "admin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "system_settings"],
                        "host": ["view_dashboard", "approve_requests"],
                        "security": ["view_dashboard", "check_in_out"]
                    }
                    migrated = True
                if "settings" not in client:
                    client["settings"] = {
                        "max_visitors": 500,
                        "session_timeout": 60,
                        "support_email": "support@" + client.get("client_name", "client").lower().replace(" ", "") + ".com",
                        "enable_sms": True,
                        "enable_face_recognition": False,
                        "auto_purge_days": 90
                    }
                    migrated = True
                if "will_terminate" not in client:
                    client["will_terminate"] = False
                    migrated = True
                if "terminated_early" not in client:
                    client["terminated_early"] = False
                    migrated = True
            if migrated:
                save_licenses(data)
            return data
        except Exception:
            pass
            
    # Seed default data structured to hold client profiles, sites, permissions, and settings
    default_data = [
        {
            "id": 1,
            "client_name": "Sumeet Group",
            "max_users": 100,
            "max_sites": 10,
            "machine_uuid": "Universal",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(days=10)).isoformat(),
            "created_at": datetime.datetime.utcnow().isoformat(),
            "will_terminate": False,
            "terminated_early": False,
            "sites": [
                {"id": 101, "name": "Pune Corporate", "address": "Sumeet Heights, Shivaji Nagar, Pune", "lat": 18.5204, "lng": 73.8567, "status": "Active"},
                {"id": 102, "name": "Mumbai West", "address": "Sumeet Chambers, Andheri East, Mumbai", "lat": 19.1136, "lng": 72.8697, "status": "Active"},
                {"id": 103, "name": "Bangalore HQ", "address": "Sumeet Tech Park, Whitefield, Bangalore", "lat": 12.9698, "lng": 77.7500, "status": "Active"}
            ],
            "permissions": {
                "superadmin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "manage_licenses", "system_settings", "data_purging"],
                "admin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "system_settings"],
                "host": ["view_dashboard", "approve_requests"],
                "security": ["view_dashboard", "check_in_out"]
            },
            "settings": {
                "max_visitors": 500,
                "session_timeout": 60,
                "support_email": "support@sumeetgroup.com",
                "enable_sms": True,
                "enable_face_recognition": False,
                "auto_purge_days": 90
            }
        },
        {
            "id": 2,
            "client_name": "Tata Corp",
            "max_users": 340,
            "max_sites": 20,
            "machine_uuid": "Universal",
            "expires_at": (datetime.datetime.utcnow() + datetime.timedelta(days=120)).isoformat(),
            "created_at": datetime.datetime.utcnow().isoformat(),
            "will_terminate": False,
            "terminated_early": False,
            "sites": [
                {"id": 201, "name": "Mumbai HQ", "address": "Bombay House, Fort, Mumbai", "lat": 18.9322, "lng": 72.8335, "status": "Active"},
                {"id": 202, "name": "Pune IT Park", "address": "Hinjewadi Phase 3, Pune", "lat": 18.5913, "lng": 73.7191, "status": "Active"}
            ],
            "permissions": {
                "superadmin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "manage_licenses", "system_settings", "data_purging"],
                "admin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "system_settings"],
                "host": ["view_dashboard", "approve_requests"],
                "security": ["view_dashboard", "check_in_out"]
            },
            "settings": {
                "max_visitors": 1000,
                "session_timeout": 45,
                "support_email": "admin@tata.com",
                "enable_sms": True,
                "enable_face_recognition": True,
                "auto_purge_days": 180
            }
        }
    ]
    
    # Generate license key tokens initially for seeded clients
    for client in default_data:
        payload = {
            "client_name": client["client_name"],
            "expires_at": client["expires_at"],
            "max_users": client["max_users"],
            "max_sites": client["max_sites"]
        }
        client["license_key"] = jwt.encode(payload, PRIVATE_KEY_PEM, algorithm="RS256")
        
    save_licenses(default_data)
    return default_data


def save_licenses(licenses):
    try:
        with open(DB_FILE, 'w') as f:
            json.dump(licenses, f, indent=4)
        return True
    except Exception:
        return False


# Route to serve the frontend homepage
@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')


# Static routing proxy
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)


@app.route('/api/public-key', methods=['GET'])
def get_public_key():
    return jsonify({"public_key": PUBLIC_KEY_PEM})


@app.route('/api/clients', methods=['GET'])
def get_clients():
    licenses = load_licenses()
    now = datetime.datetime.utcnow()
    
    # Check client database for termination notices
    db_will_terminate_clients = set()
    try:
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT license_key, will_terminate FROM system_license WHERE will_terminate = TRUE")
            rows = cursor.fetchall()
            for row in rows:
                lic_key = row[0]
                try:
                    payload = jwt.decode(lic_key, PUBLIC_KEY_PEM, algorithms=["RS256"])
                    client_name = payload.get("client_name")
                    if client_name:
                        db_will_terminate_clients.add(client_name)
                except Exception:
                    pass
            cursor.close()
            conn.close()
    except Exception as e:
        print("Error checking DB for will_terminate:", e)

    save_needed = False
    for lic in licenses:
        # If client notified termination in DB but it's not reflected yet, update it
        if lic.get('client_name') in db_will_terminate_clients and not lic.get('will_terminate'):
            lic['will_terminate'] = True
            save_needed = True
            
        try:
            exp = datetime.datetime.fromisoformat(lic['expires_at'])
            created_at_str = lic.get("created_at")
            if created_at_str:
                activation = datetime.datetime.fromisoformat(created_at_str)
            else:
                activation = exp - datetime.timedelta(days=365)
                
            total_term_seconds = (exp - activation).total_seconds()
            is_test_license = total_term_seconds <= 7500
            is_one_day_license = total_term_seconds <= 90000
            
            if is_test_license:
                buffer_limit = exp + datetime.timedelta(minutes=30)
                if lic.get("terminated_early"):
                    lic['status'] = 'Terminated'
                    lic['days_remaining'] = "0m"
                    lic['days_remaining_in_buffer'] = "0m"
                elif now > buffer_limit:
                    lic['status'] = 'Expired'
                    lic['days_remaining'] = "0m"
                    lic['days_remaining_in_buffer'] = "0m"
                elif now > exp:
                    lic['status'] = 'In Buffer'
                    lic['days_remaining'] = "0m"
                    rem_mins = int((buffer_limit - now).total_seconds() / 60)
                    lic['days_remaining_in_buffer'] = f"{rem_mins}m"
                else:
                    lic['status'] = 'Active'
                    rem_mins = int((exp - now).total_seconds() / 60)
                    lic['days_remaining'] = f"{rem_mins}m"
                    lic['days_remaining_in_buffer'] = "30m"
            elif is_one_day_license:
                buffer_limit = exp + datetime.timedelta(hours=2)
                if lic.get("terminated_early"):
                    lic['status'] = 'Terminated'
                    lic['days_remaining'] = "0h"
                    lic['days_remaining_in_buffer'] = "0h"
                elif now > buffer_limit:
                    lic['status'] = 'Expired'
                    lic['days_remaining'] = "0h"
                    lic['days_remaining_in_buffer'] = "0h"
                elif now > exp:
                    lic['status'] = 'In Buffer'
                    lic['days_remaining'] = "0h"
                    rem_hours = int((buffer_limit - now).total_seconds() / 3600)
                    lic['days_remaining_in_buffer'] = f"{rem_hours}h"
                else:
                    lic['status'] = 'Active'
                    rem_hours = int((exp - now).total_seconds() / 3600)
                    lic['days_remaining'] = f"{rem_hours}h"
                    lic['days_remaining_in_buffer'] = "2h"
            else:
                client_buffer_days = lic.get("buffer_days", 90)
                buffer_limit = exp + datetime.timedelta(days=client_buffer_days)
                if lic.get("terminated_early"):
                    lic['status'] = 'Terminated'
                    lic['days_remaining'] = "0d"
                    lic['days_remaining_in_buffer'] = "0d"
                elif now > buffer_limit:
                    lic['status'] = 'Expired'
                    lic['days_remaining'] = "0d"
                    lic['days_remaining_in_buffer'] = "0d"
                elif now > exp:
                    lic['status'] = 'In Buffer'
                    lic['days_remaining'] = "0d"
                    lic['days_remaining_in_buffer'] = f"{(buffer_limit - now).days}d"
                else:
                    lic['status'] = 'Active'
                    lic['days_remaining'] = f"{(exp - now).days}d"
                    lic['days_remaining_in_buffer'] = f"{client_buffer_days}d"
        except Exception:
            lic['status'] = 'Invalid'
            lic['days_remaining'] = "0d"
            lic['days_remaining_in_buffer'] = "0d"
            
    if save_needed:
        save_licenses(licenses)
            
    return jsonify(licenses)


@app.route('/api/generate-license', methods=['POST'])
def generate_license():
    try:
        data = request.get_json() or {}
        client_name = data.get('client_name')
        max_users = int(data.get('max_users', 100))
        max_sites = int(data.get('max_sites', 10))
        expiry_days = float(data.get('expiry_days', 365))
        machine_uuid = data.get('machine_uuid', '').strip()
        start_date_str = data.get('start_date')
        buffer_days = int(data.get('buffer_days', 90))

        if not client_name:
            return jsonify({"error": "Client Name is required"}), 400

        # Parse start_date or default to utcnow
        if start_date_str:
            try:
                # Expecting YYYY-MM-DD
                start_dt = datetime.datetime.fromisoformat(start_date_str)
            except Exception:
                start_dt = datetime.datetime.utcnow()
        else:
            start_dt = datetime.datetime.utcnow()

        # Compute expiration datetime
        expires_dt = start_dt + datetime.timedelta(days=expiry_days)
        expires_at_str = expires_dt.isoformat()

        # Build token payload claims
        payload = {
            "client_name": client_name,
            "expires_at": expires_at_str,
            "max_users": max_users,
            "max_sites": max_sites,
            "buffer_days": buffer_days
        }

        if machine_uuid:
            payload["machine_uuid"] = machine_uuid

        license_key = jwt.encode(payload, PRIVATE_KEY_PEM, algorithm='RS256')

        # Create entry with default settings, sites and permissions structure
        licenses = load_licenses()
        new_entry = {
            "id": int(datetime.datetime.utcnow().timestamp()),
            "client_name": client_name,
            "max_users": max_users,
            "max_sites": max_sites,
            "machine_uuid": machine_uuid if machine_uuid else "Universal",
            "expires_at": expires_at_str,
            "created_at": start_dt.isoformat(),
            "license_key": license_key,
            "will_terminate": False,
            "terminated_early": False,
            "buffer_days": buffer_days,
            "sites": [],
            "permissions": {
                "superadmin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "manage_licenses", "system_settings", "data_purging"],
                "admin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "system_settings"],
                "host": ["view_dashboard", "approve_requests"],
                "security": ["view_dashboard", "check_in_out"]
            },
            "settings": {
                "max_visitors": 500,
                "session_timeout": 60,
                "support_email": "support@" + client_name.lower().replace(" ", "") + ".com",
                "enable_sms": True,
                "enable_face_recognition": False,
                "auto_purge_days": 90
            }
        }
        licenses.append(new_entry)
        save_licenses(licenses)

        return jsonify({
            "message": "License generated successfully!",
            "license_key": license_key,
            "payload": payload,
            "client": new_entry
        }), 200

    except Exception as e:
        return jsonify({"error": f"Internal generator error: {str(e)}"}), 500


@app.route('/api/clients/save-config', methods=['POST'])
def save_client_config():
    try:
        data = request.get_json() or {}
        client_id = int(data.get('client_id'))
        
        licenses = load_licenses()
        updated = False
        
        for client in licenses:
            if client['id'] == client_id:
                if 'sites' in data:
                    client['sites'] = data['sites']
                if 'permissions' in data:
                    client['permissions'] = data['permissions']
                if 'settings' in data:
                    client['settings'] = data['settings']
                updated = True
                break
                
        if updated:
            save_licenses(licenses)
            return jsonify({"message": "Configurations saved successfully!"}), 200
        else:
            return jsonify({"error": "Client profile not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/terminate', methods=['POST'])
def terminate_client_license():
    try:
        data = request.get_json() or {}
        client_id = int(data.get('client_id'))
        
        licenses = load_licenses()
        updated = False
        
        for client in licenses:
            if client['id'] == client_id:
                client['terminated_early'] = True
                updated = True
                
                # Dynamic Sync: Update the client's MySQL database to set terminated_early = TRUE
                try:
                    conn = get_db_connection()
                    if conn:
                        cursor = conn.cursor()
                        # Verify the active client license matches the decoded client_name
                        cursor.execute("SELECT license_key FROM system_license ORDER BY id DESC LIMIT 1")
                        row = cursor.fetchone()
                        if row:
                            lic_key = row[0]
                            try:
                                payload = jwt.decode(lic_key, PUBLIC_KEY_PEM, algorithms=["RS256"])
                                if payload.get("client_name") == client["client_name"]:
                                    # Alter table if column is missing (migration safety check)
                                    try:
                                        cursor.execute("SELECT terminated_early FROM system_license LIMIT 1")
                                    except Exception:
                                        cursor.execute("ALTER TABLE system_license ADD COLUMN terminated_early BOOLEAN DEFAULT FALSE")
                                    
                                    cursor.execute("UPDATE system_license SET terminated_early = TRUE ORDER BY id DESC LIMIT 1")
                                    print(f"Synced termination for {client['client_name']} to client DB.")
                            except Exception as ex:
                                print("Error decoding license during termination sync:", ex)
                        cursor.close()
                        conn.close()
                except Exception as ex:
                    print("Error updating client DB during termination:", ex)
                
                break
                
        if updated:
            save_licenses(licenses)
            return jsonify({"message": "Client contract terminated early."}), 200
        else:
            return jsonify({"error": "Client not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/extend', methods=['POST'])
def extend_client_license():
    try:
        data = request.get_json() or {}
        client_id = int(data.get('client_id'))
        add_days = int(data.get('add_days', 365))
        
        licenses = load_licenses()
        updated = False
        
        for client in licenses:
            if client['id'] == client_id:
                # Update expires_at
                try:
                    current_exp = datetime.datetime.fromisoformat(client['expires_at'])
                except Exception:
                    current_exp = datetime.datetime.utcnow()
                    
                new_exp = current_exp + datetime.timedelta(days=add_days)
                client['expires_at'] = new_exp.isoformat()
                client['terminated_early'] = False
                client['will_terminate'] = False
                
                # Regenerate the token with new expiry
                payload = {
                    "client_name": client["client_name"],
                    "expires_at": client["expires_at"],
                    "max_users": client["max_users"],
                    "max_sites": client["max_sites"],
                    "buffer_days": client.get("buffer_days", 90)
                }
                if client.get("machine_uuid") and client["machine_uuid"] != "Universal":
                    payload["machine_uuid"] = client["machine_uuid"]
                    
                client["license_key"] = jwt.encode(payload, PRIVATE_KEY_PEM, algorithm="RS256")
                
                # Dynamic Sync: Update the client's MySQL database to set terminated_early = FALSE and update the license key
                try:
                    conn = get_db_connection()
                    if conn:
                        cursor = conn.cursor()
                        cursor.execute("UPDATE system_license SET license_key = %s, terminated_early = FALSE, will_terminate = FALSE ORDER BY id DESC LIMIT 1", (client["license_key"],))
                        print(f"Synced license extension for {client['client_name']} to client DB.")
                        cursor.close()
                        conn.close()
                except Exception as ex:
                    print("Error updating client DB during extension:", ex)
                
                updated = True
                break
                
        if updated:
            save_licenses(licenses)
            return jsonify({"message": f"Client contract extended by {add_days} days.", "client": client}), 200
        else:
            return jsonify({"error": "Client profile not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/resume', methods=['POST'])
def resume_client_license():
    try:
        data = request.get_json() or {}
        client_id = int(data.get('client_id'))
        
        licenses = load_licenses()
        updated = False
        
        for client in licenses:
            if client['id'] == client_id:
                client['terminated_early'] = False
                client['will_terminate'] = False
                
                # Regenerate the token with all other details same
                payload = {
                    "client_name": client["client_name"],
                    "expires_at": client["expires_at"],
                    "max_users": client["max_users"],
                    "max_sites": client["max_sites"],
                    "buffer_days": client.get("buffer_days", 90)
                }
                if client.get("machine_uuid") and client["machine_uuid"] != "Universal":
                    payload["machine_uuid"] = client["machine_uuid"]
                    
                client["license_key"] = jwt.encode(payload, PRIVATE_KEY_PEM, algorithm="RS256")
                
                # Dynamic Sync: Update the client's MySQL database to set terminated_early = FALSE and update the license key
                try:
                    conn = get_db_connection()
                    if conn:
                        cursor = conn.cursor()
                        cursor.execute("UPDATE system_license SET license_key = %s, terminated_early = FALSE, will_terminate = FALSE ORDER BY id DESC LIMIT 1", (client["license_key"],))
                        print(f"Synced license resumption for {client['client_name']} to client DB.")
                        cursor.close()
                        conn.close()
                except Exception as ex:
                    print("Error updating client DB during resumption:", ex)
                
                updated = True
                break
                
        if updated:
            save_licenses(licenses)
            return jsonify({"message": "Client subscription resumed successfully.", "client": client}), 200
        else:
            return jsonify({"error": "Client profile not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/delete', methods=['POST'])
def delete_client_license():
    try:
        data = request.get_json() or {}
        client_id = int(data.get('client_id'))
        
        licenses = load_licenses()
        updated = False
        
        # Filter out the client with the specified ID
        filtered_licenses = [c for c in licenses if c['id'] != client_id]
        if len(filtered_licenses) < len(licenses):
            updated = True
            
        if updated:
            save_licenses(filtered_licenses)
            return jsonify({"message": "Client license deleted successfully."}), 200
        else:
            return jsonify({"error": "Client not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/license/request-extension', methods=['POST'])
def receive_extension_request():
    try:
        data = request.get_json() or {}
        license_key = data.get('license_key')
        if not license_key:
            return jsonify({"error": "license_key is required"}), 400
        
        try:
            payload = jwt.decode(license_key, PUBLIC_KEY_PEM, algorithms=["RS256"])
        except Exception as e:
            return jsonify({"error": f"Invalid license key format or signature: {str(e)}"}), 400
            
        client_name = payload.get("client_name")
        if not client_name:
            return jsonify({"error": "License key does not contain client_name"}), 400
            
        licenses = load_licenses()
        client = None
        for c in licenses:
            if c["client_name"] == client_name:
                client = c
                break
                
        if not client:
            return jsonify({"error": f"Client company '{client_name}' not found in registry."}), 404
            
        client["extension_request"] = {
            "status": "pending",
            "requested_at": datetime.datetime.utcnow().isoformat(),
            "add_days": 365
        }
        
        save_licenses(licenses)
        
        return jsonify({
            "message": f"License extension request for '{client_name}' submitted successfully to the licensing authority. Contact support@sumeetgroup.com for further updates."
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/approve-extension', methods=['POST'])
def approve_client_extension():
    try:
        data = request.get_json() or {}
        client_id = int(data.get('client_id'))
        
        licenses = load_licenses()
        updated = False
        
        for client in licenses:
            if client['id'] == client_id:
                add_days = 365
                req_details = client.get("extension_request")
                if req_details and "add_days" in req_details:
                    add_days = int(req_details["add_days"])
                
                try:
                    current_exp = datetime.datetime.fromisoformat(client['expires_at'])
                except Exception:
                    current_exp = datetime.datetime.utcnow()
                    
                new_exp = current_exp + datetime.timedelta(days=add_days)
                client['expires_at'] = new_exp.isoformat()
                client['terminated_early'] = False
                client['will_terminate'] = False
                client['extension_request'] = None
                
                payload = {
                    "client_name": client["client_name"],
                    "expires_at": client["expires_at"],
                    "max_users": client["max_users"],
                    "max_sites": client["max_sites"],
                    "buffer_days": client.get("buffer_days", 90)
                }
                if client.get("machine_uuid") and client["machine_uuid"] != "Universal":
                    payload["machine_uuid"] = client["machine_uuid"]
                    
                client["license_key"] = jwt.encode(payload, PRIVATE_KEY_PEM, algorithm="RS256")
                
                try:
                    conn = get_db_connection()
                    if conn:
                        cursor = conn.cursor()
                        cursor.execute("UPDATE system_license SET license_key = %s, terminated_early = FALSE, will_terminate = FALSE ORDER BY id DESC LIMIT 1", (client["license_key"],))
                        print(f"Synced license approval extension for {client['client_name']} to client DB.")
                        cursor.close()
                        conn.close()
                except Exception as ex:
                    print("Error updating client DB during extension approval sync:", ex)
                
                updated = True
                break
                
        if updated:
            save_licenses(licenses)
            return jsonify({"message": f"Client extension request approved. Contract extended by {add_days} days.", "client": client}), 200
        else:
            return jsonify({"error": "Client profile not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/clients/deny-extension', methods=['POST'])
def deny_client_extension():
    try:
        data = request.get_json() or {}
        client_id = int(data.get('client_id'))
        
        licenses = load_licenses()
        updated = False
        
        for client in licenses:
            if client['id'] == client_id:
                client['extension_request'] = None
                updated = True
                break
                
        if updated:
            save_licenses(licenses)
            return jsonify({"message": "Client extension request denied.", "client": client}), 200
        else:
            return jsonify({"error": "Client profile not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("--------------------------------------------------")
    print("  VMS LICENSE PROVIDER WEB SERVICE")
    print("  Running locally: http://localhost:5001")
    print("--------------------------------------------------")
    app.run(host='0.0.0.0', port=5001, debug=True)
