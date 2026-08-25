import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import config

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from routes.reports_routes import reports_bp
from routes.auth_routes import auth_bp
from routes.visitor_routes import visitor_bp
from routes.request_routes import request_bp
from routes.security_routes import security_bp
from routes.admin_routes import admin_bp
from utils.license_verifier import verify_system_license
from routes.test_runner_routes import test_runner_bp

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "http://192.168.1.152:5173", "http://localhost:5174"]}}, supports_credentials=True)

BYPASS_ROUTES = [
    "/",
    "/api/license-status",
    "/api/activate-license",
    "/test-runner",
    "/api/company-branding",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/poll-remote-login",
    "/api/active-visitors-count"
]

@app.before_request
def global_request_filter():
    # 1. Bypass check
    if (
        (request.path == "/api/visitor-requests" and request.method == "POST")
        or (request.path.startswith("/api/visitors/lookup/") and request.method == "GET")
        or request.path in BYPASS_ROUTES 
        or request.path.startswith("/uploads/") 
        or request.path.startswith("/uploads_users/")
        or request.path.startswith("/api/test-runner")
    ):
        return None

    # 2. License Signature check
    license_status = verify_system_license()
    if license_status["status"] != "ACTIVE":
        return jsonify({
            "error": "LICENSE_RESTRICTION",
            "message": license_status["error"]
        }), 402

    # 3. User Authorization check
    if app.config.get("TESTING"):
        return None

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"message": "Authorization header is missing or invalid."}), 401
        
    token = auth_header.split(" ")[1]
    try:
        from config import SECRET_KEY
        import jwt
        import pymysql.cursors
        from db import get_db_connection
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        token_password = payload.get("password")
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"message": "Database connection failed"}), 500
            
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not user:
            return jsonify({"message": "User not found, session invalid."}), 401
            
        # Check if password in database has changed since token was generated
        if user["password"] != token_password:
            return jsonify({"message": "Password changed. Please log in again.", "code": "session_invalidated"}), 401
            
    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Token has expired."}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid token."}), 401
    except Exception as e:
        return jsonify({"message": f"Authorization failed: {str(e)}"}), 401



limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000 per minute"]   # Global limit
)

limiter.init_app(app)

@app.route("/")
def root():
    return jsonify({
        "message": "Visitor Management System API",
        "status": "running"
    })

@app.route("/api/license-status", methods=["GET"])
def get_license_status():
    status = verify_system_license()
    return jsonify(status)

@app.route("/api/company-branding", methods=["GET"])
def get_company_branding():
    from routes.admin_routes import load_settings
    settings = load_settings()
    return jsonify({
        "company_name": settings.get("company_name", "Unique Delta Force Security Pvt. Ltd."),
        "company_logo": settings.get("company_logo", "")
    }), 200

@app.route("/api/activate-license", methods=["POST"])
def activate_license():
    import os
    import re
    import datetime
    import jwt
    from utils.license_verifier import verify_system_license, get_license_details, save_license_to_db, PUBLIC_KEY
    
    data = request.get_json() or {}
    license_key = data.get("license_key")
    if not license_key:
        return jsonify({"error": "License key is required"}), 400
        
    # Check if currently suspended (terminated_early is True)
    current_status = verify_system_license()
    is_suspended = (current_status.get("status") == "TERMINATED")
    
    suspended_activation_time = None
    suspended_exp_dt = None
    
    if is_suspended:
        # Retrieve original license key details from DB
        suspended_key, suspended_activation_time, _, _ = get_license_details()
        if suspended_key:
            try:
                # Decrypt the old key payload to extract its expiration date
                suspended_payload = jwt.decode(
                    suspended_key,
                    PUBLIC_KEY,
                    algorithms=["RS256"]
                )
                raw_exp = suspended_payload.get("expires_at", "")
                if raw_exp:
                    suspended_exp_dt = datetime.datetime.fromisoformat(raw_exp.replace(" ", "T").split(".")[0])
            except Exception as e:
                print("Failed to decode suspended license key details:", e)

    # Verify the new key signature and active status using the temp_key parameter
    try:
        license_info = verify_system_license(temp_key=license_key)
        if license_info["status"] != "ACTIVE":
            return jsonify({"error": license_info.get("error", "Invalid license key")}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid key format: {str(e)}"}), 400

    # If it was suspended, enforce that the expiration date of the new key must match
    if is_suspended and suspended_exp_dt:
        try:
            new_payload = license_info.get("data") or {}
            raw_new_exp = new_payload.get("expires_at", "")
            if not raw_new_exp:
                return jsonify({"error": "New license key does not have an expiration date."}), 400
            
            new_exp_dt = datetime.datetime.fromisoformat(raw_new_exp.replace(" ", "T").split(".")[0])
            if suspended_exp_dt != new_exp_dt:
                return jsonify({
                    "error": f"The new license key details do not match. The end date must remain identical to the suspended license: {suspended_exp_dt.date()}."
                }), 400
        except Exception as e:
            return jsonify({"error": f"Failed to compare expiration details: {str(e)}"}), 400

    # Save to Database (preserving activation_time if it was suspended)
    if save_license_to_db(license_key, activation_time=suspended_activation_time if is_suspended else None):
        # Update env variable and .env file
        os.environ["VMS_LICENSE_KEY"] = license_key
        try:
            env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
            if not os.path.exists(env_path):
                env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
            if os.path.exists(env_path):
                with open(env_path, "r") as f:
                    content = f.read()
                if "VMS_LICENSE_KEY=" in content:
                    new_content = re.sub(r"VMS_LICENSE_KEY=.*", f"VMS_LICENSE_KEY={license_key}", content)
                else:
                    new_content = content + f"\nVMS_LICENSE_KEY={license_key}\n"
                with open(env_path, "w") as f:
                    f.write(new_content)
        except Exception as e:
            print("Failed to save to .env:", e)
            
        return jsonify({
            "message": "Services resumed successfully!" if is_suspended else "License activated successfully!",
            "license_info": license_info
        }), 200
    else:
        return jsonify({"error": "Failed to store license in database."}), 500

# Serve uploaded images
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    cwd_path = os.path.abspath(os.path.join(os.getcwd(), 'uploads'))
    if os.path.exists(os.path.join(cwd_path, filename)):
        return send_from_directory(cwd_path, filename)
    app_path = os.path.abspath(os.path.join(app.root_path, 'uploads'))
    return send_from_directory(app_path, filename)
    
@app.route('/uploads_users/<filename>')
def uploaded_user_file(filename):
    cwd_path = os.path.abspath(os.path.join(os.getcwd(), 'uploads_users'))
    if os.path.exists(os.path.join(cwd_path, filename)):
        return send_from_directory(cwd_path, filename)
    app_path = os.path.abspath(os.path.join(app.root_path, 'uploads_users'))
    return send_from_directory(app_path, filename)

# Register Blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(visitor_bp)
app.register_blueprint(request_bp)
app.register_blueprint(security_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(admin_bp, url_prefix="/api")
app.register_blueprint(test_runner_bp)

# Run database password migration for existing records on startup
from utils.password_utils import migrate_existing_passwords
migrate_existing_passwords()

if __name__ == "__main__":
    print("Backend running at http://localhost:5000")
    app.run(debug=True, port=5000, host="0.0.0.0")

