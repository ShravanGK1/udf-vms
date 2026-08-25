from flask import Blueprint, jsonify, request
from db import get_db_connection
import os
import json
import time
from werkzeug.utils import secure_filename


admin_bp = Blueprint("admin", __name__)

UPLOAD_FOLDER = "uploads_users"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "jfif", "webp", "avif"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ---------------- USERS ----------------
@admin_bp.route("/admin/users", methods=["GET"])
def get_users():

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    cursor = conn.cursor()

    cursor.execute("""
        SELECT user_id, name, email, role, department, status,profile_photo
        FROM users
        ORDER BY user_id DESC
    """)

    users = cursor.fetchall()

    result = []

    for u in users:
        result.append({
            "id": u[0],
            "name": u[1],
            "email": u[2],
            "role": u[3],
            "department": u[4],
            "status": u[5],
            "profile_photo": u[6] 
        })

    cursor.close()
    conn.close()

    return jsonify(result)


# ---------------- SITES ----------------
@admin_bp.route("/admin/sites", methods=["GET"])
def get_sites():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch unique units already used in the visitors table
    cursor.execute("""
        SELECT unit, COUNT(*)
        FROM visitors
        WHERE unit IS NOT NULL AND unit != ''
        GROUP BY unit
        ORDER BY COUNT(*) DESC
    """)

    rows = cursor.fetchall()
    result = []

    # Add units from the database
    for r in rows:
        site_name = r[0]
        result.append({
            "name": site_name,          
            "address": site_name,       
            "visitors": r[1],      
            "status": "Active"     
        })

    cursor.close()
    conn.close()

    return jsonify(result)


# ---------------- DASHBOARD STATS ----------------
@admin_bp.route("/admin/stats", methods=["GET"])
def dashboard_stats():

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM visitors WHERE status='active'")
    active_visitors = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM visitor_requests WHERE status='PENDING'")
    pending = cursor.fetchone()[0]

    stats = {
        "users": total_users,
        "visitors": active_visitors,
        "pending": pending,
        "alerts": 3
    }

    cursor.close()
    conn.close()

    return jsonify(stats)


@admin_bp.route("/admin/charts", methods=["GET"])
def admin_charts():

    conn = get_db_connection()
    cursor = conn.cursor()

    # WEEKLY VISITORS
    cursor.execute("""
        SELECT
            DATE_FORMAT(scheduled_date, '%a') AS day,
            COUNT(*)
        FROM visitor_requests
        WHERE scheduled_date >= CURRENT_DATE - INTERVAL 6 DAY
        GROUP BY day
        ORDER BY MIN(scheduled_date)
    """)

    weekly = cursor.fetchall()

    visitData = []

    for w in weekly:
        visitData.append({
            "day": w[0],
            "visitors": w[1]
        })

    # VISIT PURPOSE
    cursor.execute("""
        SELECT purpose, COUNT(*)
        FROM visitor_requests
        GROUP BY purpose
    """)

    purposes = cursor.fetchall()

    colors = ["#2563eb", "#7c3aed", "#0891b2", "#f59e0b"]

    purposeData = []

    for i, p in enumerate(purposes):
        purposeData.append({
            "name": p[0],
            "value": p[1],
            "color": colors[i % len(colors)]
        })

    conn.close()

    return jsonify({
        "visitData": visitData,
        "purposeData": purposeData
    })


@admin_bp.route("/upload-photo", methods=["POST"])
def upload_photo():

    print("FILES:", request.files)  

    file = request.files.get("photo")

    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):

        filename = f"{int(time.time())}_{secure_filename(file.filename)}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        file.save(filepath)

        image_url = f"/uploads_users/{filename}"

        return jsonify({
            "message": "Upload successful",
            "image_url": image_url
        })

    return jsonify({"error": "Invalid file type"}), 400


@admin_bp.route("/update-user-photo/<int:user_id>", methods=["PUT"])
def update_user_photo(user_id):

    data = request.get_json()
    print("DATA RECEIVED:", data)
    photo_url = data.get("photo_url")
    print("PHOTO URL:", photo_url)
    print("USER ID:", user_id)

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users
        SET profile_photo = %s
        WHERE user_id = %s
    """, (photo_url, user_id))

    conn.commit()

    cursor.close()
    conn.close()

    return jsonify({"message": "Photo updated"})


@admin_bp.route("/admin/add-user", methods=["POST"])
def add_user():
    name = request.form.get("name")
    email = request.form.get("email")
    password = request.form.get("password")
    role = request.form.get("role")
    department = request.form.get("department")
    photo = request.files.get("photo")

    if not all([name, email, password, role, department]):
        return jsonify({"error": "All fields are mandatory"}), 400

    image_url = None
    if photo and allowed_file(photo.filename):
        filename = f"{int(time.time())}_{secure_filename(photo.filename)}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        photo.save(filepath)
        image_url = f"/uploads_users/{filename}"

    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (name, email, password, role, department, status, profile_photo)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (name, email, password, role, department, "Active", image_url))
        user_id = cursor.lastrowid
        conn.commit()
        return jsonify({"message": "User created successfully", "user_id": user_id}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/superadmin-stats", methods=["GET"])
def get_superadmin_stats():
    try:
        # Sync DB sites with config file first
        sync_db_sites()

        # 1. Get real users count
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        db_users_count = cursor.fetchone()[0]
        
        # 2. Get unique sites count
        try:
            cursor.execute("SELECT COUNT(*) FROM sites")
            db_sites_count = cursor.fetchone()[0]
        except Exception:
            cursor.execute("SELECT COUNT(DISTINCT unit) FROM visitors WHERE unit IS NOT NULL AND unit != ''")
            db_sites_count = cursor.fetchone()[0]
        
        # 3. Get monthly traffic trends from visitor_requests
        cursor.execute("""
            SELECT DATE_FORMAT(scheduled_date, '%b') as month, COUNT(*) 
            FROM visitor_requests 
            WHERE scheduled_date IS NOT NULL
            GROUP BY month 
            ORDER BY MIN(scheduled_date)
        """)
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # 4. Get license info
        from utils.license_verifier import verify_system_license
        license_info = verify_system_license()
        
        expiry_date = "N/A"
        max_users = "N/A"
        license_status = "Inactive"
        
        if license_info["status"] == "ACTIVE":
            license_status = "Active"
            raw_expiry = license_info["data"].get("expires_at", "2027-05-26")
            expiry_date = raw_expiry.split("T")[0] if "T" in raw_expiry else raw_expiry
            max_users = license_info["data"].get("max_users", 100)
        elif license_info["status"] == "EXPIRED":
            license_status = "Expired"
            expiry_date = license_info.get("error", "Expired")
            
        # Get active company name from license key payload if available
        company_name = "Sumeet Group"
        from utils.license_verifier import get_license_details
        lic_key, _, _, _ = get_license_details()
        if lic_key:
            try:
                import jwt
                payload = jwt.decode(lic_key, options={"verify_signature": False})
                if payload and "client_name" in payload:
                    company_name = payload["client_name"]
            except Exception:
                pass

        # Build dynamic licenses list containing only own company details
        dynamic_licenses = [
            {
                "company": company_name,
                "sites": db_sites_count,
                "users": db_users_count,
                "status": license_status,
                "expiry": expiry_date
            }
        ]
        
        # Aggregated stats
        total_users_sum = sum(l["users"] for l in dynamic_licenses)
        total_sites_sum = sum(l["sites"] for l in dynamic_licenses)
        
        # Build monthly traffic data (fall back to mock if no DB traffic records)
        month_map = {"Jan": 0, "Feb": 0, "Mar": 0, "Apr": 0, "May": 0, "Jun": 0, "Jul": 0, "Aug": 0, "Sep": 0, "Oct": 0, "Nov": 0, "Dec": 0}
        for r in rows:
            if r[0] in month_map:
                month_map[r[0]] = r[1]
                
        traffic_data = []
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        for m in months:
            traffic_data.append({
                "month": m,
                "visitors": month_map[m] if month_map[m] > 0 else (1200 + months.index(m) * 150)
            })
            
        return jsonify({
            "licenses": dynamic_licenses,
            "totalCompanies": len(dynamic_licenses),
            "totalSites": total_sites_sum,
            "totalUsers": total_users_sum,
            "systemHealth": "99.9%",
            "trafficData": traffic_data,
            "licenseDetails": license_info
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------- SITES CRUD ----------------
@admin_bp.route("/admin/sites-list", methods=["GET"])
def get_sites_list():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT site_id, name, address, status FROM sites ORDER BY site_id DESC")
        rows = cursor.fetchall()
        result = [{"id": r[0], "name": r[1], "address": r[2], "status": r[3]} for r in rows]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@admin_bp.route("/admin/sites-list", methods=["POST"])
def add_site():
    data = request.get_json() or {}
    name = data.get("name")
    address = data.get("address")
    status = data.get("status", "Active")
    if not name or not address:
        return jsonify({"error": "Name and address are required"}), 400
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO sites (name, address, status) VALUES (%s, %s, %s)", (name, address, status))
        conn.commit()
        site_id = cursor.lastrowid
        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)", 
                       ("Super Admin", f"Created new site: {name}", address))
        conn.commit()
        return jsonify({"message": "Site added successfully", "id": site_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()



# ---------------- SYSTEM SETTINGS CRUD ----------------
@admin_bp.route("/admin/settings", methods=["GET"])
def get_settings():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT setting_key, setting_value FROM system_settings")
        rows = cursor.fetchall()
        result = {r[0]: r[1] for r in rows}
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@admin_bp.route("/admin/settings", methods=["POST"])
def update_settings():
    data = request.get_json() or {}
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        for k, v in data.items():
            cursor.execute("""
                INSERT INTO system_settings (setting_key, setting_value) 
                VALUES (%s, %s) 
                ON DUPLICATE KEY UPDATE setting_value=%s
            """, (k, str(v), str(v)))
        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)", 
                       ("Super Admin", "Updated system settings", "Global Config"))
        conn.commit()
        return jsonify({"message": "Settings updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# ---------------- AUDIT LOGS ----------------
@admin_bp.route("/admin/audit-logs", methods=["GET"])
def get_audit_logs():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT username, action, target, created_at FROM superadmin_audit_logs ORDER BY log_id DESC LIMIT 100")
        rows = cursor.fetchall()
        result = [{
            "user": r[0],
            "action": r[1],
            "target": r[2],
            "time": r[3].strftime("%b %d, %I:%M %p") if r[3] else "N/A"
        } for r in rows]
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

# ---------------- ROLE PERMISSIONS CRUD ----------------
@admin_bp.route("/admin/permissions", methods=["GET"])
def get_permissions():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT role_name, reports, config, `purge`, users FROM role_permissions")
        rows = cursor.fetchall()
        result = {}
        for r in rows:
            result[r[0]] = {
                "reports": bool(r[1]),
                "config": bool(r[2]),
                "purge": bool(r[3]),
                "users": bool(r[4])
            }
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@admin_bp.route("/admin/permissions", methods=["POST"])
def save_permissions():
    data = request.get_json() or {}
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        for role, perms in data.items():
            cursor.execute("""
                INSERT INTO role_permissions (role_name, reports, config, `purge`, users)
                VALUES (%s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE reports=%s, config=%s, `purge`=%s, users=%s
            """, (
                role,
                int(perms.get("reports", False)),
                int(perms.get("config", False)),
                int(perms.get("purge", False)),
                int(perms.get("users", False)),
                int(perms.get("reports", False)),
                int(perms.get("config", False)),
                int(perms.get("purge", False)),
                int(perms.get("users", False))
            ))
        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)", 
                       ("Super Admin", "Modified role access control permissions matrix", "Global ACL"))
        conn.commit()
        return jsonify({"message": "Permissions updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


# Constants for settings storage
COMPANIES_SITES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "companies_sites.json")
ROLES_PERMISSIONS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "roles_permissions.json")
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "system_settings.json")


def load_companies_sites():
    if os.path.exists(COMPANIES_SITES_FILE):
        try:
            with open(COMPANIES_SITES_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    # Default seeded data without preadded sites
    return [
        {
            "id": 1,
            "name": "Sumeet Group",
            "code": "SG",
            "sites": []
        }
    ]


def save_companies_sites(data):
    try:
        with open(COMPANIES_SITES_FILE, "w") as f:
            json.dump(data, f, indent=4)
        return True
    except Exception:
        return False


def load_roles_permissions():
    if os.path.exists(ROLES_PERMISSIONS_FILE):
        try:
            with open(ROLES_PERMISSIONS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    # Default roles & permissions configuration matrix
    return {
        "superadmin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "manage_licenses", "system_settings", "data_purging"],
        "admin": ["view_dashboard", "manage_users", "approve_requests", "check_in_out", "system_settings"],
        "host": ["view_dashboard", "approve_requests"],
        "security": ["view_dashboard", "check_in_out"]
    }


def save_roles_permissions(matrix):
    try:
        with open(ROLES_PERMISSIONS_FILE, "w") as f:
            json.dump(matrix, f, indent=4)
        return True
    except Exception:
        return False


def load_settings():
    defaults = {
        "max_visitors": 500,
        "session_timeout": 60,
        "support_email": "support@sumeetgroup.com",
        "enable_sms": True,
        "enable_face_recognition": False,
        "auto_purge_days": 90,
        "company_name": "Unique Delta Force Security Pvt. Ltd.",
        "company_logo": "",
        "default_password_admin": "Admin@123",
        "default_password_host": "Host@123",
        "default_password_security": "Security@123",
        "default_password_superadmin": "Superadmin@123"
    }
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                data = json.load(f)
                for k, v in defaults.items():
                    if k not in data:
                        data[k] = v
                return data
        except Exception:
            pass
    return defaults


def save_settings(settings):
    try:
        with open(SETTINGS_FILE, "w") as f:
            json.dump(settings, f, indent=4)
        return True
    except Exception:
        return False


def sync_db_sites():
    try:
        # Get active company name from license key payload if available
        company_name = "Sumeet Group"
        from utils.license_verifier import get_license_details
        lic_key, _, _, _ = get_license_details()
        if lic_key:
            try:
                import jwt
                payload = jwt.decode(lic_key, options={"verify_signature": False})
                if payload and "client_name" in payload:
                    company_name = payload["client_name"]
            except Exception:
                pass

        all_companies = load_companies_sites()
        active_sites = []
        for c in all_companies:
            if c.get("id") == 1 or c.get("name") == company_name:
                active_sites = c.get("sites", [])
                break

        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            
            # Fetch existing database sites
            cursor.execute("SELECT site_id, name, address, status FROM sites")
            db_sites = {r[1]: {"site_id": r[0], "address": r[2], "status": r[3]} for r in cursor.fetchall()}
            
            active_site_names = set()
            for s in active_sites:
                name = s.get("name")
                address = s.get("address", "")
                status = s.get("status", "Active")
                if not name:
                    continue
                active_site_names.add(name)
                
                if name in db_sites:
                    db_site = db_sites[name]
                    if db_site["address"] != address or db_site["status"] != status:
                        cursor.execute("UPDATE sites SET address = %s, status = %s WHERE site_id = %s", (address, status, db_site["site_id"]))
                else:
                    cursor.execute("INSERT INTO sites (name, address, status) VALUES (%s, %s, %s)", (name, address, status))
            
            for name, db_site in db_sites.items():
                if name not in active_site_names:
                    try:
                        cursor.execute("DELETE FROM sites WHERE site_id = %s", (db_site["site_id"],))
                    except Exception:
                        cursor.execute("UPDATE sites SET status = 'Inactive' WHERE site_id = %s", (db_site["site_id"],))
                        
            conn.commit()
            cursor.close()
            conn.close()
    except Exception as e:
        print("Failed to sync DB sites:", e)


@admin_bp.route("/admin/companies-sites", methods=["GET", "POST"])
def manage_companies_sites():
    # Get active company name from license key payload if available
    company_name = "Sumeet Group"
    from utils.license_verifier import get_license_details
    lic_key, _, _, _ = get_license_details()
    if lic_key:
        try:
            import jwt
            payload = jwt.decode(lic_key, options={"verify_signature": False})
            if payload and "client_name" in payload:
                company_name = payload["client_name"]
        except Exception:
            pass

    if request.method == "GET":
        sync_db_sites()
        all_companies = load_companies_sites()
        # Force the active company name to match the license name
        for c in all_companies:
            if c["id"] == 1:
                c["name"] = company_name
                break
        filtered = [c for c in all_companies if c["name"] == company_name]
        if not filtered and all_companies:
            filtered = [all_companies[0]]
        return jsonify(filtered), 200
    else:
        data = request.get_json() or []
        all_companies = load_companies_sites()
        for updated_company in data:
            for idx, c in enumerate(all_companies):
                if c["id"] == updated_company["id"]:
                    all_companies[idx] = updated_company
                    break
        # Force the active company name to match the license name before saving
        for c in all_companies:
            if c["id"] == 1:
                c["name"] = company_name
                break
        if save_companies_sites(all_companies):
            sync_db_sites()
            filtered = [c for c in all_companies if c["name"] == company_name]
            if not filtered and all_companies:
                filtered = [all_companies[0]]
            return jsonify(filtered), 200
        else:
            return jsonify({"error": "Failed to save data"}), 500


@admin_bp.route("/admin/roles-permissions", methods=["GET", "POST"])
def manage_roles_permissions():
    if request.method == "GET":
        return jsonify(load_roles_permissions()), 200
    else:
        matrix = request.get_json() or {}
        if save_roles_permissions(matrix):
            return jsonify({"message": "Permissions updated successfully", "permissions": matrix}), 200
        else:
            return jsonify({"error": "Failed to save permissions"}), 500


@admin_bp.route("/admin/system-settings", methods=["GET", "POST"])
def manage_system_settings():
    if request.method == "GET":
        return jsonify(load_settings()), 200
    else:
        current = load_settings()
        data = request.get_json() or {}
        # update fields
        for key in current.keys():
            if key in data:
                current[key] = data[key]
        
        if save_settings(current):
            return jsonify({"message": "Settings updated successfully", "settings": current}), 200
        else:
            return jsonify({"error": "Failed to save settings"}), 500


@admin_bp.route("/admin/upload-logo", methods=["POST"])
def upload_company_logo():
    if "logo" not in request.files:
        return jsonify({"error": "No logo file provided."}), 400
    file = request.files["logo"]
    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400
        
    os.makedirs("uploads", exist_ok=True)
    
    ext = file.filename.split(".")[-1].lower()
    if ext not in ["png", "jpg", "jpeg", "webp", "svg"]:
        return jsonify({"error": "Unsupported file format. Please upload PNG, JPG, JPEG, WEBP or SVG."}), 400
        
    filename = f"company_logo.{ext}"
    filepath = os.path.join("uploads", filename)
    
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception:
            pass
            
    file.save(filepath)
    
    settings = load_settings()
    # Cache buster to prevent browser cache issues
    settings["company_logo"] = f"/uploads/{filename}?t={int(time.time())}"
    save_settings(settings)
    
    return jsonify({
        "message": "Company logo uploaded successfully!",
        "company_logo": settings["company_logo"]
    }), 200


@admin_bp.route("/admin/request-extension", methods=["POST"])
def request_license_extension():
    try:
        from utils.license_verifier import get_license_details, verify_system_license
        license_key, _, _, _ = get_license_details()
        if not license_key:
            return jsonify({"error": "No license key configured on client side to extend."}), 400
        
        # Check eligibility and already-requested status
        license_info = verify_system_license()
        if license_info.get("status") != "ACTIVE":
            return jsonify({"error": license_info.get("error", "Subscription is not active or valid.")}), 400
            
        if not license_info.get("extension_eligible", False):
            threshold = license_info.get("extension_threshold_days", 0)
            if threshold > 0:
                msg = f"Subscription is not eligible for extension request yet. Extension can only be requested starting {threshold} days before standard expiration (or during the grace buffer period)."
            else:
                msg = "Subscription is not eligible for extension request yet. It can only be requested during the grace buffer period."
            return jsonify({"error": msg}), 400
            
        if license_info.get("extension_requested", False):
            return jsonify({"error": "An extension request has already been submitted in this licensing period."}), 400
        
        import urllib.request
        import json
        
        provider_url = "http://localhost:5001/api/license/request-extension"
        payload = {"license_key": license_key}
        data = json.dumps(payload).encode("utf-8")
        
        req = urllib.request.Request(
            provider_url,
            data=data,
            headers={"Content-Type": "application/json"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=5.0) as response:
                res_body = json.loads(response.read().decode())
                # Mark as requested in DB
                from utils.license_verifier import set_extension_requested
                set_extension_requested(True)
                message = res_body.get("message", "License extension request submitted successfully to the provider.")
                return jsonify({"message": message}), 200
        except Exception as e:
            print("Failed to reach provider server for extension request:", e)
            return jsonify({
                "error": "Failed to reach the licensing authority server. Please ensure the provider service is running."
            }), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/admin/update-license", methods=["POST"])
def update_license():
    try:
        import re
        data = request.get_json() or {}
        license_key = data.get("license_key")
        if not license_key:
            return jsonify({"error": "License key is required"}), 400
        
        # Verify the license key
        try:
            from utils.license_verifier import verify_system_license
            license_info = verify_system_license(temp_key=license_key)
            if license_info["status"] != "ACTIVE":
                return jsonify({"error": license_info.get("error", "Invalid license key")}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to verify license: {str(e)}"}), 400
        
        # Save to Database
        from utils.license_verifier import save_license_to_db
        save_license_to_db(license_key)
        
        # Save it to .env file if it exists, so it persists
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r") as f:
                    content = f.read()
                
                # Replace the license key line or add it
                if "VMS_LICENSE_KEY=" in content:
                    new_content = re.sub(r"VMS_LICENSE_KEY=.*", f"VMS_LICENSE_KEY={license_key}", content)
                else:
                    new_content = content + f"\nVMS_LICENSE_KEY={license_key}\n"
                
                with open(env_path, "w") as f:
                    f.write(new_content)
            except Exception as e:
                print("Failed to write to .env:", e)
                
        return jsonify({
            "message": "License key updated and verified successfully",
            "license_info": license_info
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/admin/purge-data", methods=["POST"])
def purge_data():
    try:
        data = request.get_json() or {}
        days = int(data.get("days", 30))
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()
        
        # Calculate count of records to be deleted
        cursor.execute("""
            SELECT COUNT(*) FROM visitor_requests 
            WHERE scheduled_date < CURRENT_DATE - INTERVAL %s DAY
        """, (days,))
        count = cursor.fetchone()[0]
        
        if count > 0:
            cursor.execute("""
                DELETE FROM visitor_requests 
                WHERE scheduled_date < CURRENT_DATE - INTERVAL %s DAY
            """, (days,))
            conn.commit()
            
        cursor.close()
        conn.close()
        
        return jsonify({
            "message": f"Purge successful. Deleted {count} records older than {days} days.",
            "count": count
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/admin/notify-termination", methods=["POST"])
def notify_termination():
    from utils.license_verifier import notify_license_termination
    if notify_license_termination():
        return jsonify({"message": "Termination notice sent successfully!"}), 200
    else:
        return jsonify({"error": "Failed to record termination notice in database."}), 500


@admin_bp.route("/admin/change-role-passwords", methods=["POST"])
def change_role_passwords():
    try:
        data = request.get_json() or {}
        role = data.get("role")
        new_password = data.get("password")
        default_password = data.get("default_password")
        
        if not role or (not new_password and not default_password):
            return jsonify({"error": "Role and either password or default_password are required."}), 400
            
        # Update settings if default password is provided
        settings = load_settings()
        if default_password:
            settings[f"default_password_{role}"] = default_password
            save_settings(settings)
            
        # If new_password is not provided, reset to default password
        target_password = new_password if new_password else settings.get(f"default_password_{role}", "Password@123")
        
        # Update all users in database
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET password = %s WHERE role = %s", (target_password, role))
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"message": f"Successfully updated passwords for all {role} users."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/admin/users-list", methods=["GET"])
def get_users_list():
    try:
        import pymysql.cursors
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT user_id, email, role, name, department, status FROM users WHERE role IN ('host', 'security')")
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(users), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/admin/remote-login", methods=["POST"])
def remote_login():
    try:
        import pymysql.cursors
        data = request.get_json() or {}
        user_id = data.get("user_id")
        password = data.get("password")
        
        if not user_id or not password:
            return jsonify({"error": "User ID and password are required."}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({"error": "User not found."}), 404
            
        if user["password"] != password:
            cursor.close()
            conn.close()
            return jsonify({"error": "Invalid password. Cannot authorize remote login."}), 401
            
        # Generate token
        from utils.token_utils import generate_token
        token = generate_token(user)
        
        # Save token to remote_login_token column
        cursor.execute("UPDATE users SET remote_login_token = %s WHERE user_id = %s", (token, user_id))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return jsonify({"message": f"Remote login authorized for {user['name']}.", "token": token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500