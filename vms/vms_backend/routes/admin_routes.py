from flask import Blueprint, jsonify, request
from db import get_db_connection
import os
import json
import time
from werkzeug.utils import secure_filename
try:
    from utils.auth_utils import (
        get_current_user_from_request,
        get_user_site_scope,
        get_user_authorized_sites,
        is_site_authorized
    )
except ImportError:
    from auth_utils import (
        get_current_user_from_request,
        get_user_site_scope,
        get_user_authorized_sites,
        is_site_authorized
    )
try:
    from utils.password_utils import is_valid_password
except ImportError:
    from password_utils import is_valid_password


admin_bp = Blueprint("admin", __name__)

UPLOAD_FOLDER = "uploads_users"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "jfif", "webp", "avif"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ---------------- USERS ----------------
@admin_bp.route("/admin/users", methods=["GET"])
def get_users():
    caller_id, role = get_current_user_from_request(request)
    if not caller_id or role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    cursor = conn.cursor()

    cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
    c_row = cursor.fetchone()
    cust_id = c_row[0] if (c_row and c_row[0]) else 1

    req_site_id = request.headers.get("X-Site-ID") or request.args.get("site_id")

    if role not in ['superadmin', 'global_admin']:
        scope_type, site_ids = get_user_site_scope(caller_id, role)
        if req_site_id and req_site_id != "all":
            try:
                sid = int(req_site_id)
                target_ids = [sid] if sid in site_ids else [-1]
            except (ValueError, TypeError):
                target_ids = site_ids
        else:
            target_ids = site_ids

        format_strings = ','.join(['%s'] * len(target_ids))
        cursor.execute(f"""
            SELECT DISTINCT u.user_id, u.name, u.email, u.role, u.department, u.status, u.profile_photo
            FROM users u
            JOIN user_sites us ON u.user_id = us.user_id
            WHERE u.customer_id = %s AND us.site_id IN ({format_strings})
            ORDER BY u.user_id DESC
        """, (cust_id, *target_ids))
    elif req_site_id and req_site_id != "all":
        try:
            sid = int(req_site_id)
            cursor.execute("""
                SELECT DISTINCT u.user_id, u.name, u.email, u.role, u.department, u.status, u.profile_photo
                FROM users u
                JOIN user_sites us ON u.user_id = us.user_id
                WHERE u.customer_id = %s AND us.site_id = %s
                ORDER BY u.user_id DESC
            """, (cust_id, sid))
        except (ValueError, TypeError):
            cursor.execute("""
                SELECT user_id, name, email, role, department, status, profile_photo
                FROM users
                WHERE customer_id = %s
                ORDER BY user_id DESC
            """, (cust_id,))
    else:
        cursor.execute("""
            SELECT user_id, name, email, role, department, status, profile_photo
            FROM users
            WHERE customer_id = %s
            ORDER BY user_id DESC
        """, (cust_id,))

    users = cursor.fetchall()

    result = []
    for u in users:
        scope_type, site_ids = get_user_site_scope(u[0], u[3])
        user_sites = get_user_authorized_sites(u[0], u[3])
        result.append({
            "id": u[0],
            "name": u[1],
            "email": u[2],
            "role": u[3],
            "department": u[4],
            "status": u[5],
            "profile_photo": u[6],
            "site_ids": site_ids if scope_type != "ALL" else "ALL",
            "sites": user_sites
        })

    cursor.close()
    conn.close()

    return jsonify(result)


def get_sites_data_for_user(caller_id, caller_role):
    conn = get_db_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        if caller_role in ['superadmin', 'global_admin']:
            cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
            c_row = cursor.fetchone()
            cust_id = c_row[0] if (c_row and c_row[0]) else 1
            cursor.execute("""
                SELECT site_id, name, address, status, code, lat, lng, created_at 
                FROM sites 
                WHERE customer_id = %s 
                ORDER BY site_id DESC
            """, (cust_id,))
        else:
            scope_type, site_ids = get_user_site_scope(caller_id, caller_role)
            if not site_ids:
                return []
            format_strings = ','.join(['%s'] * len(site_ids))
            cursor.execute(f"""
                SELECT site_id, name, address, status, code, lat, lng, created_at 
                FROM sites 
                WHERE site_id IN ({format_strings}) 
                ORDER BY site_id DESC
            """, tuple(site_ids))

        rows = cursor.fetchall()
        result = []
        for r in rows:
            cursor.execute("""
                SELECT COUNT(*) FROM visitor_requests 
                WHERE site_id = %s AND status = 'APPROVED' AND check_in_time IS NOT NULL AND check_out_time IS NULL
            """, (r[0],))
            v_cnt = cursor.fetchone()[0]
            result.append({
                "id": r[0],
                "site_id": r[0],
                "name": r[1],
                "address": r[2] or "",
                "status": r[3] or "Active",
                "code": r[4] or "",
                "lat": float(r[5]) if r[5] is not None else 18.5204,
                "lng": float(r[6]) if r[6] is not None else 73.8567,
                "created_at": r[7].isoformat() if r[7] else None,
                "visitors": v_cnt
            })
        return result
    finally:
        cursor.close()
        conn.close()


# ---------------- SITES ----------------
@admin_bp.route("/admin/sites", methods=["GET"])
def get_sites():
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id:
        return jsonify([]), 401

    try:
        sites_data = get_sites_data_for_user(caller_id, caller_role)
        return jsonify(sites_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------- DASHBOARD STATS ----------------
@admin_bp.route("/admin/stats", methods=["GET"])
def dashboard_stats():
    caller_id, caller_role = get_current_user_from_request(request)
    req_site_id = request.headers.get("X-Site-ID") or request.args.get("site_id")

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()

    try:
        scope_type, allowed_site_ids = get_user_site_scope(caller_id, caller_role) if caller_id else ("ALL", [])

        target_site_ids = None
        if req_site_id and req_site_id != "all":
            try:
                sid = int(req_site_id)
                if caller_role in ['superadmin', 'global_admin'] or sid in allowed_site_ids:
                    target_site_ids = [sid]
                else:
                    target_site_ids = [-1]
            except (ValueError, TypeError):
                pass
        elif caller_role not in ['superadmin', 'global_admin'] and scope_type == "SCOPED":
            target_site_ids = allowed_site_ids

        # 1. Users count
        if target_site_ids:
            fmt = ','.join(['%s'] * len(target_site_ids))
            cursor.execute(f"SELECT COUNT(DISTINCT user_id) FROM user_sites WHERE site_id IN ({fmt})", tuple(target_site_ids))
            total_users = cursor.fetchone()[0]
        else:
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0]

        # 2. Active visitors count (Approved, Checked-in, Not Checked-out)
        if target_site_ids:
            fmt = ','.join(['%s'] * len(target_site_ids))
            cursor.execute(f"""
                SELECT COUNT(*) FROM visitor_requests 
                WHERE site_id IN ({fmt}) 
                AND status = 'APPROVED' 
                AND check_in_time IS NOT NULL 
                AND check_out_time IS NULL
            """, tuple(target_site_ids))
            active_visitors = cursor.fetchone()[0]
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM visitor_requests 
                WHERE status = 'APPROVED' 
                AND check_in_time IS NOT NULL 
                AND check_out_time IS NULL
            """)
            active_visitors = cursor.fetchone()[0]

        # 3. Pending requests
        if target_site_ids:
            fmt = ','.join(['%s'] * len(target_site_ids))
            cursor.execute(f"SELECT COUNT(*) FROM visitor_requests WHERE site_id IN ({fmt}) AND status = 'PENDING'", tuple(target_site_ids))
            pending = cursor.fetchone()[0]
        else:
            cursor.execute("SELECT COUNT(*) FROM visitor_requests WHERE status = 'PENDING'")
            pending = cursor.fetchone()[0]

        # 4. Security alerts (e.g. overstay >= 8 hours)
        if target_site_ids:
            fmt = ','.join(['%s'] * len(target_site_ids))
            cursor.execute(f"""
                SELECT COUNT(*) FROM visitor_requests 
                WHERE site_id IN ({fmt})
                AND status = 'APPROVED'
                AND check_in_time IS NOT NULL
                AND check_out_time IS NULL
                AND TIMESTAMPDIFF(HOUR, check_in_time, NOW()) >= 8
            """, tuple(target_site_ids))
            alerts = cursor.fetchone()[0]
        else:
            cursor.execute("""
                SELECT COUNT(*) FROM visitor_requests 
                WHERE status = 'APPROVED'
                AND check_in_time IS NOT NULL
                AND check_out_time IS NULL
                AND TIMESTAMPDIFF(HOUR, check_in_time, NOW()) >= 8
            """)
            alerts = cursor.fetchone()[0]

        stats = {
            "users": total_users,
            "visitors": active_visitors,
            "pending": pending,
            "alerts": alerts
        }
        return jsonify(stats)
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/charts", methods=["GET"])
def admin_charts():
    caller_id, caller_role = get_current_user_from_request(request)
    req_site_id = request.headers.get("X-Site-ID") or request.args.get("site_id")

    conn = get_db_connection()
    if not conn:
        return jsonify({"visitData": [], "purposeData": []}), 500
    cursor = conn.cursor()

    try:
        scope_type, allowed_site_ids = get_user_site_scope(caller_id, caller_role) if caller_id else ("ALL", [])
        target_site_ids = None
        if req_site_id and req_site_id != "all":
            try:
                sid = int(req_site_id)
                if caller_role in ['superadmin', 'global_admin'] or sid in allowed_site_ids:
                    target_site_ids = [sid]
                else:
                    target_site_ids = [-1]
            except (ValueError, TypeError):
                pass
        elif caller_role not in ['superadmin', 'global_admin'] and scope_type == "SCOPED":
            target_site_ids = allowed_site_ids

        # WEEKLY VISITORS
        if target_site_ids:
            fmt = ','.join(['%s'] * len(target_site_ids))
            cursor.execute(f"""
                SELECT
                    SUBSTRING(DAYNAME(scheduled_date), 1, 3) AS day,
                    COUNT(*)
                FROM visitor_requests
                WHERE scheduled_date >= CURRENT_DATE - INTERVAL 6 DAY
                AND site_id IN ({fmt})
                GROUP BY day
                ORDER BY MIN(scheduled_date)
            """, tuple(target_site_ids))
        else:
            cursor.execute("""
                SELECT
                    SUBSTRING(DAYNAME(scheduled_date), 1, 3) AS day,
                    COUNT(*)
                FROM visitor_requests
                WHERE scheduled_date >= CURRENT_DATE - INTERVAL 6 DAY
                GROUP BY day
                ORDER BY MIN(scheduled_date)
            """)

        weekly = cursor.fetchall()
        visitData = [{"day": w[0], "visitors": w[1]} for w in weekly]

        # VISIT PURPOSE
        if target_site_ids:
            fmt = ','.join(['%s'] * len(target_site_ids))
            cursor.execute(f"""
                SELECT purpose, COUNT(*)
                FROM visitor_requests
                WHERE site_id IN ({fmt})
                GROUP BY purpose
            """, tuple(target_site_ids))
        else:
            cursor.execute("""
                SELECT purpose, COUNT(*)
                FROM visitor_requests
                GROUP BY purpose
            """)

        purposes = cursor.fetchall()
        colors = ["#2563eb", "#7c3aed", "#0891b2", "#f59e0b"]
        purposeData = [
            {"name": p[0], "value": p[1], "color": colors[i % len(colors)]}
            for i, p in enumerate(purposes)
        ]

        return jsonify({
            "visitData": visitData,
            "purposeData": purposeData
        })
    finally:
        cursor.close()
        conn.close()


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
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id:
        return jsonify({"error": "Authentication required"}), 401

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()

    if caller_id != user_id:
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        caller_cust = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (user_id,))
        t_row = cursor.fetchone()
        target_cust = t_row[0] if (t_row and t_row[0]) else 1

        if caller_role not in ['superadmin', 'admin'] or caller_cust != target_cust:
            cursor.close()
            conn.close()
            return jsonify({"error": "Unauthorized user photo modification"}), 403

    data = request.get_json() or {}
    photo_url = data.get("photo_url")

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
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()

    cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
    c_row = cursor.fetchone()
    caller_cust_id = c_row[0] if (c_row and c_row[0]) else 1

    if request.is_json:
        data = request.get_json() or {}
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")
        role = data.get("role")
        department = data.get("department")
        photo = None
        site_ids_input = data.get("site_ids") or data.get("site_id")
    else:
        name = request.form.get("name")
        email = request.form.get("email")
        password = request.form.get("password")
        role = request.form.get("role")
        department = request.form.get("department")
        photo = request.files.get("photo")
        site_ids_input = request.form.get("site_ids") or request.form.get("site_id")

    if not all([name, email, password, role, department]):
        cursor.close()
        conn.close()
        return jsonify({"error": "All fields (Full Name, Email, Password, Role, Department) are mandatory"}), 400

    if not site_ids_input:
        cursor.close()
        conn.close()
        return jsonify({"error": "Site assignment is mandatory. Please select an authorized site."}), 400

    target_site_ids = []
    if isinstance(site_ids_input, list):
        target_site_ids = [int(s) for s in site_ids_input if str(s).isdigit()]
    elif isinstance(site_ids_input, int):
        target_site_ids = [site_ids_input]
    elif isinstance(site_ids_input, str):
        target_site_ids = [int(s.strip()) for s in site_ids_input.split(",") if s.strip().isdigit()]

    if not target_site_ids:
        cursor.close()
        conn.close()
        return jsonify({"error": "Invalid site assignment. Please select a valid site."}), 400

    # Authorization Check: Verify caller has permission to assign each selected site
    if caller_role not in ['superadmin', 'global_admin']:
        scope_type, caller_sites = get_user_site_scope(caller_id, caller_role)
        for s_id in target_site_ids:
            if s_id not in caller_sites:
                cursor.close()
                conn.close()
                return jsonify({"error": f"Unauthorized: You do not have permission to assign users to site #{s_id}."}), 403

    # Database Verification: Verify selected sites exist and are Active for this customer
    format_s = ','.join(['%s'] * len(target_site_ids))
    cursor.execute(
        f"SELECT site_id, name, status FROM sites WHERE customer_id = %s AND site_id IN ({format_s})",
        (caller_cust_id, *target_site_ids)
    )
    db_sites_found = {r[0]: {"name": r[1], "status": r[2]} for r in cursor.fetchall()}
    for s_id in target_site_ids:
        if s_id not in db_sites_found:
            cursor.close()
            conn.close()
            return jsonify({"error": f"Selected site #{s_id} does not exist in your organization."}), 400
        if db_sites_found[s_id]["status"].lower() != "active":
            cursor.close()
            conn.close()
            return jsonify({"error": f"Site '{db_sites_found[s_id]['name']}' is currently inactive and cannot be assigned to new users."}), 400

    if str(role).lower() in ['superadmin', 'global_admin'] and caller_role != 'superadmin':
        cursor.close()
        conn.close()
        return jsonify({"error": "Site Admins cannot create Super Admin accounts"}), 403

    # Check if email is already registered
    cursor.execute("SELECT user_id FROM users WHERE email = %s", (email.strip().lower(),))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({"error": "A user with this email address already exists."}), 409

    # Enforce license max_users limit for this customer
    from utils.license_verifier import verify_system_license
    license_info = verify_system_license()
    if license_info.get("status") == "ACTIVE":
        max_users = license_info.get("data", {}).get("max_users", 100)
        cursor.execute("SELECT COUNT(*) FROM users WHERE customer_id = %s AND status = 'Active'", (caller_cust_id,))
        current_active_users = cursor.fetchone()[0]
        if current_active_users >= max_users:
            cursor.close()
            conn.close()
            return jsonify({"error": f"User creation limit reached for active license (Maximum: {max_users} users)."}), 400

    image_url = None
    if photo and allowed_file(photo.filename):
        filename = f"{int(time.time())}_{secure_filename(photo.filename)}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        photo.save(filepath)
        image_url = f"/uploads_users/{filename}"

    try:
        cursor.execute("""
            INSERT INTO users (name, email, password, role, department, status, profile_photo, customer_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (name.strip(), email.strip().lower(), password, role, department, "Active", image_url, caller_cust_id))
        user_id = cursor.lastrowid

        # Insert user site assignments into user_sites
        for s_id in target_site_ids:
            cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, %s)", (user_id, s_id))

        conn.commit()
        return jsonify({
            "message": "User created successfully",
            "user_id": user_id,
            "assigned_sites": target_site_ids
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/users/<int:user_id>", methods=["GET"])
def get_user_detail(user_id):
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        caller_cust_id = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("""
            SELECT user_id, name, email, role, department, status, profile_photo, customer_id
            FROM users WHERE user_id = %s AND customer_id = %s
        """, (user_id, caller_cust_id))
        u = cursor.fetchone()
        if not u:
            return jsonify({"error": "User not found"}), 404

        scope_type, site_ids = get_user_site_scope(u[0], u[3])
        user_sites = get_user_authorized_sites(u[0], u[3])
        return jsonify({
            "id": u[0],
            "name": u[1],
            "email": u[2],
            "role": u[3],
            "department": u[4],
            "status": u[5],
            "profile_photo": u[6],
            "site_ids": site_ids if scope_type != "ALL" else "ALL",
            "sites": user_sites
        }), 200
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/users/<int:user_id>", methods=["PUT"])
def update_user_details(user_id):
    import re
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        caller_cust_id = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("SELECT user_id, name, email, role, department, status, profile_photo, customer_id FROM users WHERE user_id = %s", (user_id,))
        target_user = cursor.fetchone()
        if not target_user or target_user[7] != caller_cust_id:
            return jsonify({"error": "Target employee not found in your organization"}), 404

        target_role = target_user[3]

        # Site admin privilege check: cannot modify a superadmin
        if caller_role not in ['superadmin', 'global_admin'] and target_role in ['superadmin', 'global_admin']:
            return jsonify({"error": "Unauthorized: Site Admins cannot edit Super Admin accounts"}), 403

        if request.is_json:
            data = request.get_json() or {}
            name = data.get("name")
            email = data.get("email")
            role = data.get("role")
            department = data.get("department")
            status = data.get("status")
            site_ids_input = data.get("site_ids") or data.get("site_id")
            photo = None
        else:
            name = request.form.get("name")
            email = request.form.get("email")
            role = request.form.get("role")
            department = request.form.get("department")
            status = request.form.get("status")
            site_ids_input = request.form.get("site_ids") or request.form.get("site_id")
            photo = request.files.get("photo")

        # Validate mandatory fields
        if not name or not str(name).strip():
            return jsonify({"error": "Full Name is required."}), 400
        if not email or not str(email).strip():
            return jsonify({"error": "Email address is required."}), 400
        if not role or not str(role).strip():
            return jsonify({"error": "Role is required."}), 400
        if not department or not str(department).strip():
            return jsonify({"error": "Department is required."}), 400

        name = str(name).strip()
        email = str(email).strip().lower()
        role = str(role).strip().lower()
        department = str(department).strip()

        # Email format validation
        email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
        if not re.match(email_regex, email):
            return jsonify({"error": "Invalid email address format."}), 400

        # Unique email check
        cursor.execute("SELECT user_id FROM users WHERE email = %s AND user_id != %s", (email, user_id))
        if cursor.fetchone():
            return jsonify({"error": "This email address is already in use by another user."}), 409

        # Role validation
        valid_roles = ['admin', 'security', 'host']
        if caller_role in ['superadmin', 'global_admin']:
            valid_roles.extend(['superadmin', 'global_admin'])

        if role not in valid_roles:
            return jsonify({"error": f"Invalid role specified. Allowed roles: {', '.join(valid_roles)}"}), 400

        if role in ['superadmin', 'global_admin'] and caller_role not in ['superadmin', 'global_admin']:
            return jsonify({"error": "Unauthorized: Site Admins cannot assign the Super Admin role."}), 403

        # Status validation if provided
        new_status = target_user[5]
        if status:
            clean_status = str(status).strip().capitalize()
            if clean_status in ['Active', 'Inactive']:
                if clean_status == 'Inactive' and int(caller_id) == int(user_id):
                    return jsonify({"error": "You cannot deactivate your own account."}), 400
                new_status = clean_status

        # Profile photo upload if provided
        photo_url = target_user[6]
        if photo and allowed_file(photo.filename):
            filename = f"{int(time.time())}_{secure_filename(photo.filename)}"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            photo.save(filepath)
            photo_url = f"/uploads_users/{filename}"

        # Site assignment validation if provided
        target_site_ids = None
        if site_ids_input is not None:
            if isinstance(site_ids_input, list):
                target_site_ids = [int(s) for s in site_ids_input if str(s).isdigit()]
            elif isinstance(site_ids_input, int):
                target_site_ids = [site_ids_input]
            elif isinstance(site_ids_input, str):
                target_site_ids = [int(s.strip()) for s in site_ids_input.split(",") if s.strip().isdigit()]

            if not target_site_ids:
                return jsonify({"error": "Invalid site assignment. Please select a valid site."}), 400

            # Caller site authorization check
            if caller_role not in ['superadmin', 'global_admin']:
                scope_type, caller_sites = get_user_site_scope(caller_id, caller_role)
                for s_id in target_site_ids:
                    if s_id not in caller_sites:
                        return jsonify({"error": f"Unauthorized: You do not have permission to assign site #{s_id}."}), 403

            # Verify sites exist and belong to customer
            format_s = ','.join(['%s'] * len(target_site_ids))
            cursor.execute(f"SELECT site_id, name, status FROM sites WHERE customer_id = %s AND site_id IN ({format_s})", (caller_cust_id, *target_site_ids))
            found_sites = {r[0]: {"name": r[1], "status": r[2]} for r in cursor.fetchall()}
            for s_id in target_site_ids:
                if s_id not in found_sites:
                    return jsonify({"error": f"Site #{s_id} does not exist in your organization."}), 400
                if found_sites[s_id]["status"].lower() != "active":
                    return jsonify({"error": f"Site '{found_sites[s_id]['name']}' is inactive and cannot be assigned."}), 400

        # Persist updates in transaction
        cursor.execute("""
            UPDATE users
            SET name = %s, email = %s, role = %s, department = %s, status = %s, profile_photo = %s
            WHERE user_id = %s AND customer_id = %s
        """, (name, email, role, department, new_status, photo_url, user_id, caller_cust_id))

        if target_site_ids is not None:
            cursor.execute("DELETE FROM user_sites WHERE user_id = %s", (user_id,))
            for s_id in target_site_ids:
                cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, %s)", (user_id, s_id))

        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)",
                       (f"User #{caller_id} ({caller_role})", f"Updated details for employee {name} (ID {user_id})", f"Role: {role}, Dept: {department}, Status: {new_status}"))
        conn.commit()

        scope_type, updated_site_ids = get_user_site_scope(user_id, role)
        updated_sites = get_user_authorized_sites(user_id, role)

        return jsonify({
            "message": "Employee details updated successfully",
            "user": {
                "id": user_id,
                "name": name,
                "email": email,
                "role": role,
                "department": department,
                "status": new_status,
                "profile_photo": photo_url,
                "site_ids": updated_site_ids if scope_type != "ALL" else "ALL",
                "sites": updated_sites
            }
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/users/<int:user_id>/site", methods=["PATCH", "PUT"])
@admin_bp.route("/admin/users/<int:user_id>/sites", methods=["PUT"])
def transfer_user_site(user_id):
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    site_ids_input = data.get("site_ids") or data.get("site_id")

    if not site_ids_input:
        return jsonify({"error": "Target site is required for transfer."}), 400

    target_site_ids = []
    if isinstance(site_ids_input, list):
        target_site_ids = [int(s) for s in site_ids_input if str(s).isdigit()]
    elif isinstance(site_ids_input, int):
        target_site_ids = [site_ids_input]
    elif isinstance(site_ids_input, str):
        target_site_ids = [int(s.strip()) for s in site_ids_input.split(",") if s.strip().isdigit()]

    if not target_site_ids:
        return jsonify({"error": "Invalid site assignment. Please select a valid site."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        caller_cust_id = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("SELECT user_id, name, role, customer_id FROM users WHERE user_id = %s", (user_id,))
        target_user = cursor.fetchone()
        if not target_user or target_user[3] != caller_cust_id:
            return jsonify({"error": "Target employee not found in your organization"}), 404

        target_name = target_user[1]
        target_role = target_user[2]

        if caller_role not in ['superadmin', 'global_admin'] and target_role in ['superadmin', 'global_admin']:
            return jsonify({"error": "Unauthorized: Site Admins cannot transfer Super Admin site assignments"}), 403

        # Site authorization for caller
        if caller_role not in ['superadmin', 'global_admin']:
            scope_type, caller_sites = get_user_site_scope(caller_id, caller_role)
            for s_id in target_site_ids:
                if s_id not in caller_sites:
                    return jsonify({"error": f"Unauthorized: You do not have permission to assign site #{s_id}."}), 403

        # Verify sites exist, belong to customer, and are Active
        format_s = ','.join(['%s'] * len(target_site_ids))
        cursor.execute(f"SELECT site_id, name, status, customer_id FROM sites WHERE site_id IN ({format_s})", (*target_site_ids,))
        all_sites = {r[0]: {"name": r[1], "status": r[2], "customer_id": r[3]} for r in cursor.fetchall()}
        for s_id in target_site_ids:
            if s_id not in all_sites:
                return jsonify({"error": f"Invalid site assignment. Site #{s_id} does not exist."}), 400
            if all_sites[s_id]["customer_id"] != caller_cust_id:
                return jsonify({"error": f"Unauthorized: Site #{s_id} does not belong to your organization."}), 403
            if all_sites[s_id]["status"].lower() != "active":
                return jsonify({"error": f"Site '{all_sites[s_id]['name']}' is inactive and cannot be assigned."}), 400

        found_sites = all_sites

        # Update user_sites
        cursor.execute("DELETE FROM user_sites WHERE user_id = %s", (user_id,))
        for s_id in target_site_ids:
            cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, %s)", (user_id, s_id))

        site_names = [found_sites[s]["name"] for s in target_site_ids if s in found_sites]
        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)",
                       (f"User #{caller_id} ({caller_role})", f"Transferred employee {target_name} (ID {user_id}) to site(s)", ", ".join(site_names)))
        conn.commit()

        scope_type, updated_site_ids = get_user_site_scope(user_id, target_role)
        updated_sites = get_user_authorized_sites(user_id, target_role)

        return jsonify({
            "message": f"Employee {target_name} successfully transferred to {', '.join(site_names)}.",
            "user_id": user_id,
            "site_ids": updated_site_ids if scope_type != "ALL" else "ALL",
            "sites": updated_sites
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/users/<int:user_id>/status", methods=["PATCH"])
def update_user_status(user_id):
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    status_input = data.get("status")
    if status_input is None and "is_active" in data:
        status_input = "Active" if data["is_active"] else "Inactive"

    if not status_input or str(status_input).strip().capitalize() not in ['Active', 'Inactive']:
        return jsonify({"error": "Invalid status. Allowed values are 'Active' or 'Inactive'."}), 400

    new_status = str(status_input).strip().capitalize()

    # Prevent self-deactivation
    if new_status == 'Inactive' and int(caller_id) == int(user_id):
        return jsonify({"error": "You cannot deactivate your own account."}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        caller_cust_id = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("SELECT user_id, name, role, status, customer_id FROM users WHERE user_id = %s", (user_id,))
        target_user = cursor.fetchone()
        if not target_user or target_user[4] != caller_cust_id:
            return jsonify({"error": "Target employee not found in your organization"}), 404

        target_name = target_user[1]
        target_role = target_user[2]

        # Privilege checks for Site Admin
        if caller_role not in ['superadmin', 'global_admin']:
            if target_role in ['superadmin', 'global_admin']:
                return jsonify({"error": "Unauthorized: Site Admins cannot change the status of Super Admin accounts"}), 403
            scope_type, caller_sites = get_user_site_scope(caller_id, caller_role)
            scope_type_t, target_sites = get_user_site_scope(user_id, target_role)
            if target_sites and not any(sid in caller_sites for sid in target_sites):
                return jsonify({"error": "Unauthorized: You do not have permission to manage this employee's status"}), 403

        # Last Super Admin protection
        if new_status == 'Inactive' and target_role in ['superadmin', 'global_admin']:
            cursor.execute("""
                SELECT COUNT(*) FROM users
                WHERE customer_id = %s AND role IN ('superadmin', 'global_admin') AND status = 'Active' AND user_id != %s
            """, (caller_cust_id, user_id))
            active_superadmins_left = cursor.fetchone()[0]
            if active_superadmins_left == 0:
                return jsonify({"error": "Cannot deactivate the only active Super Admin account."}), 400

        cursor.execute("UPDATE users SET status = %s WHERE user_id = %s AND customer_id = %s", (new_status, user_id, caller_cust_id))
        action_verb = "Activated" if new_status == "Active" else "Deactivated"
        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)",
                       (f"User #{caller_id} ({caller_role})", f"{action_verb} employee account", f"{target_name} (ID {user_id}, {target_role})"))
        conn.commit()

        return jsonify({
            "message": f"Employee {target_name} has been {action_verb.lower()} successfully.",
            "user_id": user_id,
            "status": new_status
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()



# ---------------- USER PASSWORD RESET ----------------
@admin_bp.route("/admin/users/<int:user_id>/reset-password", methods=["POST"])
def reset_user_password(user_id):
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    new_password = (data.get("password") or data.get("new_password") or "").strip()
    confirm_password = (data.get("confirm_password") or data.get("confirmNewPassword") or "").strip()

    if not new_password:
        return jsonify({"error": "New password is required."}), 400

    if confirm_password and new_password != confirm_password:
        return jsonify({"error": "New password and confirmation password do not match."}), 400

    if not is_valid_password(new_password):
        return jsonify({
            "error": "Password must be at least 8 characters, contain at least one uppercase letter, one number, and one special character."
        }), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        caller_cust_id = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("SELECT user_id, name, email, role, customer_id FROM users WHERE user_id = %s", (user_id,))
        target_user = cursor.fetchone()
        if not target_user or target_user[4] != caller_cust_id:
            return jsonify({"error": "Target employee not found in your organization."}), 404

        target_name = target_user[1]
        target_email = target_user[2]
        target_role = target_user[3]

        # Privilege checks for Site Admin
        if caller_role not in ['superadmin', 'global_admin']:
            if target_role in ['superadmin', 'global_admin']:
                return jsonify({"error": "Unauthorized: Site Admins cannot reset passwords for Super Admin accounts."}), 403

            scope_type, caller_sites = get_user_site_scope(caller_id, caller_role)
            scope_type_t, target_sites = get_user_site_scope(user_id, target_role)
            if target_sites and not any(sid in caller_sites for sid in target_sites):
                return jsonify({"error": "Unauthorized: You do not have permission to reset passwords for employees outside your assigned site(s)."}), 403

        # Update target user password
        cursor.execute(
            "UPDATE users SET password = %s WHERE user_id = %s AND customer_id = %s",
            (new_password, user_id, caller_cust_id)
        )

        # Audit log event without recording plaintext password
        cursor.execute(
            "INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)",
            (f"User #{caller_id} ({caller_role})", "Reset employee password", f"{target_name} ({target_email}, ID {user_id}, {target_role})")
        )
        conn.commit()

        return jsonify({
            "message": f"Password for {target_name} has been reset successfully.",
            "user_id": user_id
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()



@admin_bp.route("/admin/superadmin-stats", methods=["GET"])
def get_superadmin_stats():
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        caller_id, caller_role = get_current_user_from_request(request)
        cursor = conn.cursor()

        cust_id = 1
        if caller_id:
            cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
            c_row = cursor.fetchone()
            if c_row and c_row[0]:
                cust_id = c_row[0]

        # 1. Get real users count for this customer
        cursor.execute("SELECT COUNT(*) FROM users WHERE customer_id = %s", (cust_id,))
        db_users_count = cursor.fetchone()[0]

        # 2. Get unique sites count for this customer
        cursor.execute("SELECT COUNT(*) FROM sites WHERE customer_id = %s", (cust_id,))
        db_sites_count = cursor.fetchone()[0]

        # 3. Get monthly traffic trends from visitor_requests (real DB records, rolling 6 months)
        from datetime import datetime
        now = datetime.now()
        rolling_months = []
        for i in range(5, -1, -1):
            m_idx = now.month - i
            y = now.year
            while m_idx <= 0:
                m_idx += 12
                y -= 1
            dt = datetime(y, m_idx, 1)
            rolling_months.append((y, m_idx, dt.strftime("%b"), dt.strftime("%b %Y")))

        req_site_id = request.args.get("site_id") or request.headers.get("X-Site-ID")
        site_filter_sql = ""
        query_params = [cust_id]
        if req_site_id and req_site_id != "all":
            try:
                sid = int(req_site_id)
                site_filter_sql = " AND vr.site_id = %s"
                query_params.append(sid)
            except (ValueError, TypeError):
                pass

        cursor.execute(f"""
            SELECT DATE_FORMAT(COALESCE(vr.scheduled_date, vr.created_at), '%%Y-%%m') as ym, COUNT(*) 
            FROM visitor_requests vr
            WHERE (vr.site_id IN (SELECT site_id FROM sites WHERE customer_id = %s) OR vr.site_id IS NULL)
              {site_filter_sql}
              AND COALESCE(vr.scheduled_date, vr.created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY ym
        """, tuple(query_params))
        monthly_counts = {r[0]: r[1] for r in cursor.fetchall()}

        # 4. Get real customer name from DB
        company_name = "Enterprise"
        cursor.execute("SELECT customer_name FROM customers WHERE customer_id = %s", (cust_id,))
        cust_row = cursor.fetchone()
        if cust_row and cust_row[0]:
            company_name = cust_row[0]

        cursor.close()
        conn.close()

        # 5. Get license info
        from utils.license_verifier import verify_system_license
        license_info = verify_system_license()

        expiry_date = "N/A"
        max_users = "N/A"
        license_status = "Inactive"

        if license_info.get("status") == "ACTIVE":
            license_status = "Active"
            raw_expiry = license_info.get("data", {}).get("expires_at", "2027-05-26")
            expiry_date = raw_expiry.split("T")[0] if "T" in str(raw_expiry) else str(raw_expiry)
            max_users = license_info.get("data", {}).get("max_users", 100)
        elif license_info.get("status") == "EXPIRED":
            license_status = "Expired"
            expiry_date = license_info.get("error", "Expired")
        elif license_info.get("status") == "TERMINATED":
            license_status = "Inactive"
            expiry_date = "Terminated"

        # Dynamic license entry for this customer
        dynamic_licenses = [
            {
                "company": company_name,
                "sites": db_sites_count,
                "users": db_users_count,
                "status": license_status,
                "expiry": expiry_date
            }
        ]

        total_users_sum = db_users_count
        total_sites_sum = db_sites_count

        # Build genuine rolling 6-month traffic data without fake demonstration fallbacks
        traffic_data = []
        for y, m_idx, label_short, label_full in rolling_months:
            key = f"{y:04d}-{m_idx:02d}"
            traffic_data.append({
                "month": label_short,
                "full_month": label_full,
                "visitors": int(monthly_counts.get(key, 0))
            })

        return jsonify({
            "licenses": dynamic_licenses,
            "companyName": company_name,
            "totalCompanies": len(dynamic_licenses),
            "totalSites": total_sites_sum,
            "totalUsers": total_users_sum,
            "trafficData": traffic_data,
            "licenseDetails": license_info
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------- SITES CRUD ----------------
@admin_bp.route("/admin/sites-list", methods=["GET"])
def get_sites_list():
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        sites_data = get_sites_data_for_user(caller_id, caller_role)
        return jsonify(sites_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/admin/sites-list", methods=["POST"])
@admin_bp.route("/admin/sites", methods=["POST"])
def add_site():
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'global_admin']:
        return jsonify({"error": "Forbidden: Super Admin authorization required to create sites"}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        cust_id = c_row[0] if (c_row and c_row[0]) else 1

        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        address = (data.get("address") or "").strip()
        code = (data.get("code") or "").strip().upper()
        status = data.get("status", "Active")
        lat = data.get("lat")
        lng = data.get("lng")

        if not name or not address:
            return jsonify({"error": "Site name and address are required"}), 400

        # Unique name validation within customer
        cursor.execute("SELECT site_id FROM sites WHERE customer_id = %s AND LOWER(name) = LOWER(%s)", (cust_id, name))
        if cursor.fetchone():
            return jsonify({"error": f"A site with the name '{name}' already exists."}), 409

        # Unique code validation within customer if code provided
        if code:
            cursor.execute("SELECT site_id FROM sites WHERE customer_id = %s AND LOWER(code) = LOWER(%s)", (cust_id, code))
            if cursor.fetchone():
                return jsonify({"error": f"A site with the code '{code}' already exists."}), 409
        else:
            # Generate clean code based on site name
            prefix = "".join([c for c in name if c.isalnum()]).upper()[:4] or "SITE"
            code = f"{prefix}-{int(time.time()) % 1000:03d}"

        # Enforce license max_sites limit for this customer
        from utils.license_verifier import verify_system_license
        license_info = verify_system_license()
        if license_info.get("status") == "ACTIVE":
            max_sites = license_info.get("data", {}).get("max_sites", 10)
            cursor.execute("SELECT COUNT(*) FROM sites WHERE customer_id = %s AND status = 'Active'", (cust_id,))
            current_active_sites = cursor.fetchone()[0]
            if current_active_sites >= max_sites:
                return jsonify({"error": f"Site creation limit reached for active license (Maximum: {max_sites} sites)."}), 400

        try:
            lat_val = float(lat) if lat is not None and str(lat).strip() != "" else 18.5204
        except (ValueError, TypeError):
            lat_val = 18.5204

        try:
            lng_val = float(lng) if lng is not None and str(lng).strip() != "" else 73.8567
        except (ValueError, TypeError):
            lng_val = 73.8567

        cursor.execute("""
            INSERT INTO sites (name, code, address, status, customer_id, lat, lng) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (name, code, address, status, cust_id, lat_val, lng_val))
        conn.commit()
        site_id = cursor.lastrowid

        # Associate creator with site
        cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, %s)", (caller_id, site_id))
        
        # Audit log
        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)", 
                       ("Super Admin", f"Created new site: {name} ({code})", address))
        conn.commit()
        return jsonify({
            "message": "Site created successfully",
            "site_id": site_id,
            "id": site_id,
            "name": name,
            "code": code,
            "address": address,
            "status": status,
            "lat": lat_val,
            "lng": lng_val
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/sites/<int:site_id>", methods=["PUT"])
@admin_bp.route("/admin/sites-list/<int:site_id>", methods=["PUT"])
def update_site(site_id):
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'global_admin']:
        return jsonify({"error": "Forbidden: Super Admin authorization required to update sites"}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        cust_id = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("SELECT site_id, name, code, address, status FROM sites WHERE site_id = %s AND customer_id = %s", (site_id, cust_id))
        existing = cursor.fetchone()
        if not existing:
            return jsonify({"error": "Site not found or does not belong to your organization"}), 404

        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        address = (data.get("address") or "").strip()
        code = (data.get("code") or "").strip().upper()
        status = data.get("status", existing[4] or "Active")
        lat = data.get("lat")
        lng = data.get("lng")

        if not name or not address:
            return jsonify({"error": "Site name and address are required"}), 400

        # Uniqueness check for name excluding this site
        cursor.execute("SELECT site_id FROM sites WHERE customer_id = %s AND LOWER(name) = LOWER(%s) AND site_id != %s", (cust_id, name, site_id))
        if cursor.fetchone():
            return jsonify({"error": f"Another site with the name '{name}' already exists."}), 409

        # Uniqueness check for code excluding this site if provided
        if code:
            cursor.execute("SELECT site_id FROM sites WHERE customer_id = %s AND LOWER(code) = LOWER(%s) AND site_id != %s", (cust_id, code, site_id))
            if cursor.fetchone():
                return jsonify({"error": f"Another site with the code '{code}' already exists."}), 409

        try:
            lat_val = float(lat) if lat is not None and str(lat).strip() != "" else None
        except (ValueError, TypeError):
            lat_val = None

        try:
            lng_val = float(lng) if lng is not None and str(lng).strip() != "" else None
        except (ValueError, TypeError):
            lng_val = None

        cursor.execute("""
            UPDATE sites 
            SET name = %s, 
                code = COALESCE(NULLIF(%s, ''), code), 
                address = %s, 
                status = %s, 
                lat = COALESCE(%s, lat), 
                lng = COALESCE(%s, lng)
            WHERE site_id = %s AND customer_id = %s
        """, (name, code, address, status, lat_val, lng_val, site_id, cust_id))
        conn.commit()

        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)",
                       ("Super Admin", f"Updated site: {name}", address))
        conn.commit()

        return jsonify({"message": "Site updated successfully", "site_id": site_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@admin_bp.route("/admin/sites/<int:site_id>/status", methods=["PATCH"])
@admin_bp.route("/admin/sites-list/<int:site_id>/status", methods=["PATCH"])
def toggle_site_status(site_id):
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'global_admin']:
        return jsonify({"error": "Forbidden: Super Admin authorization required"}), 403

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        cust_id = c_row[0] if (c_row and c_row[0]) else 1

        cursor.execute("SELECT status, name FROM sites WHERE site_id = %s AND customer_id = %s", (site_id, cust_id))
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Site not found"}), 404

        current_status, site_name = row[0], row[1]
        data = request.get_json(silent=True) or {}
        new_status = data.get("status")
        if not new_status:
            new_status = "Inactive" if (current_status or "").lower() == "active" else "Active"

        cursor.execute("UPDATE sites SET status = %s WHERE site_id = %s AND customer_id = %s", (new_status, site_id, cust_id))
        conn.commit()

        cursor.execute("INSERT INTO superadmin_audit_logs (username, action, target) VALUES (%s, %s, %s)",
                       ("Super Admin", f"Changed site '{site_name}' status to {new_status}", site_name))
        conn.commit()

        return jsonify({"message": "Site status updated successfully", "site_id": site_id, "status": new_status}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()




# ---------------- SYSTEM SETTINGS CRUD ----------------
@admin_bp.route("/api/form-options", methods=["GET"])
def get_form_options():
    default_reasons = ["Meeting", "Interview", "Delivery", "Maintenance", "Work", "Payment", "Official", "Vendor Visit", "Audit", "Other"]
    default_units = [
        "Pune Eduction Foundation-Kasarwadi",
        "Sason-Kasarwadi",
        "Humankind-Kasarwadi",
        "UDF-Kasarwadi",
        "Eagle-Kasarwadi"
    ]
    default_departments = ["IT", "HR", "Operations", "Sales & Marketing", "Accounts", "Legal", "Store"]
    default_access_levels = [
        "Visitor (Level 1)",
        "Vendor (Level 2)",
        "Security (Level 3)",
        "Host (Level 4)",
        "Admin (Level 5)"
    ]
    
    conn = get_db_connection()
    if not conn:
        return jsonify({
            "reasons": default_reasons,
            "units": default_units,
            "departments": default_departments,
            "access_levels": default_access_levels
        }), 200
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('reasons_of_visit', 'units', 'departments', 'access_levels')")
        rows = cursor.fetchall()
        settings = {r[0]: r[1] for r in rows}
        
        reasons_str = settings.get("reasons_of_visit")
        units_str = settings.get("units")
        departments_str = settings.get("departments")
        access_levels_str = settings.get("access_levels")
        
        reasons_list = [r.strip() for r in reasons_str.split(",") if r.strip()] if reasons_str else default_reasons
        units_list = [u.strip() for u in units_str.split(",") if u.strip()] if units_str else default_units
        departments_list = [d.strip() for d in departments_str.split(",") if d.strip()] if departments_str else default_departments
        access_levels_list = [a.strip() for a in access_levels_str.split(",") if a.strip()] if access_levels_str else default_access_levels

        return jsonify({
            "reasons": reasons_list,
            "units": units_list,
            "departments": departments_list,
            "access_levels": access_levels_list
        }), 200
    except Exception as e:
        print("Error fetching form options:", e)
        return jsonify({
            "reasons": default_reasons,
            "units": default_units,
            "departments": default_departments,
            "access_levels": default_access_levels
        }), 200
    finally:
        cursor.close()
        conn.close()

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


@admin_bp.route("/admin/companies-sites", methods=["GET", "POST"])
def manage_companies_sites():
    caller_id, caller_role = get_current_user_from_request(request)
    cust_id = 1
    company_name = "Sumeet Group"

    conn = get_db_connection()
    if not conn:
        return jsonify([]), 500
    cursor = conn.cursor()

    try:
        if caller_id:
            cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
            c_row = cursor.fetchone()
            if c_row and c_row[0]:
                cust_id = c_row[0]

        cust_code = "HQ"
        cursor.execute("SELECT customer_name, code FROM customers WHERE customer_id = %s", (cust_id,))
        cust_row = cursor.fetchone()
        if cust_row:
            if cust_row[0]:
                company_name = cust_row[0]
            if len(cust_row) > 1 and cust_row[1]:
                cust_code = cust_row[1]

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
            cursor.execute("""
                SELECT site_id, name, code, address, status, lat, lng 
                FROM sites 
                WHERE customer_id = %s 
                ORDER BY site_id ASC
            """, (cust_id,))
            sites_rows = cursor.fetchall()
            sites_list = []
            for s in sites_rows:
                sites_list.append({
                    "id": s[0],
                    "site_id": s[0],
                    "name": s[1],
                    "code": s[2] or "",
                    "address": s[3] or "",
                    "status": s[4] or "Active",
                    "lat": float(s[5]) if s[5] is not None else 18.5204,
                    "lng": float(s[6]) if s[6] is not None else 73.8567
                })

            return jsonify([{
                "id": cust_id,
                "name": company_name,
                "code": cust_code,
                "sites": sites_list
            }]), 200

        else:
            if not caller_id or caller_role not in ['superadmin', 'global_admin']:
                return jsonify({"error": "Unauthorized"}), 403

            data = request.get_json() or []
            # Sync posted sites with database
            for company in data:
                posted_sites = company.get("sites", [])
                for s in posted_sites:
                    s_id = s.get("id") or s.get("site_id")
                    s_name = (s.get("name") or "").strip()
                    s_address = (s.get("address") or "").strip()
                    s_status = s.get("status", "Active")
                    s_code = (s.get("code") or "").strip().upper()
                    s_lat = s.get("lat")
                    s_lng = s.get("lng")

                    if not s_name:
                        continue

                    # If id matches an existing site in DB, update it
                    cursor.execute("SELECT site_id FROM sites WHERE site_id = %s AND customer_id = %s", (s_id, cust_id))
                    if cursor.fetchone():
                        cursor.execute("""
                            UPDATE sites 
                            SET name = %s, address = %s, status = %s, code = COALESCE(NULLIF(%s, ''), code), lat = COALESCE(%s, lat), lng = COALESCE(%s, lng)
                            WHERE site_id = %s AND customer_id = %s
                        """, (s_name, s_address, s_status, s_code, s_lat, s_lng, s_id, cust_id))
                    else:
                        cursor.execute("""
                            INSERT INTO sites (name, code, address, status, customer_id, lat, lng)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """, (s_name, s_code or f"SITE-{int(time.time()) % 1000}", s_address, s_status, cust_id, s_lat or 18.5204, s_lng or 73.8567))
            conn.commit()

            cursor.execute("""
                SELECT site_id, name, code, address, status, lat, lng 
                FROM sites 
                WHERE customer_id = %s 
                ORDER BY site_id ASC
            """, (cust_id,))
            sites_rows = cursor.fetchall()
            sites_list = []
            for s in sites_rows:
                sites_list.append({
                    "id": s[0],
                    "site_id": s[0],
                    "name": s[1],
                    "code": s[2] or "",
                    "address": s[3] or "",
                    "status": s[4] or "Active",
                    "lat": float(s[5]) if s[5] is not None else 18.5204,
                    "lng": float(s[6]) if s[6] is not None else 73.8567
                })

            return jsonify([{
                "id": cust_id,
                "name": company_name,
                "code": cust_code,
                "sites": sites_list
            }]), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


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
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    try:
        data = request.get_json() or {}
        days = int(data.get("days", 30))
        
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
        cursor = conn.cursor()
        
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        cust_id = c_row[0] if (c_row and c_row[0]) else 1

        # Calculate count of records to be deleted for this customer
        cursor.execute("""
            SELECT COUNT(*) FROM visitor_requests 
            WHERE site_id IN (SELECT site_id FROM sites WHERE customer_id = %s)
              AND scheduled_date < CURRENT_DATE - INTERVAL %s DAY
        """, (cust_id, days))
        count = cursor.fetchone()[0]
        
        if count > 0:
            cursor.execute("""
                DELETE FROM visitor_requests 
                WHERE site_id IN (SELECT site_id FROM sites WHERE customer_id = %s)
                  AND scheduled_date < CURRENT_DATE - INTERVAL %s DAY
            """, (cust_id, days))
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
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role not in ['superadmin', 'admin']:
        return jsonify({"error": "Unauthorized"}), 403

    try:
        data = request.get_json() or {}
        role = data.get("role")
        new_password = data.get("password")
        default_password = data.get("default_password")
        
        if not role or (not new_password and not default_password):
            return jsonify({"error": "Role and either password or default_password are required."}), 400

        if str(role).lower() in ['superadmin', 'global_admin'] and caller_role != 'superadmin':
            return jsonify({"error": "Site Admins cannot reset Super Admin passwords"}), 403
            
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        cust_id = c_row[0] if (c_row and c_row[0]) else 1

        settings = load_settings()
        if default_password:
            settings[f"default_password_{role}"] = default_password
            save_settings(settings)
            
        target_password = new_password if new_password else settings.get(f"default_password_{role}", "Password@123")
        
        cursor.execute("UPDATE users SET password = %s WHERE role = %s AND customer_id = %s", (target_password, role, cust_id))
        conn.commit()
        cursor.close()
        conn.close()
        
        return jsonify({"message": f"Successfully updated passwords for all {role} users."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@admin_bp.route("/admin/toggle-license", methods=["POST"])
def toggle_license():
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id or caller_role != "superadmin":
        return jsonify({"error": "Unauthorized"}), 403
    from utils.license_verifier import toggle_license_status
    ok, result = toggle_license_status()
    if not ok:
        return jsonify({"error": result}), 400
    return jsonify({"message": f"License status toggled to {result}", "status": result}), 200


@admin_bp.route("/admin/users-list", methods=["GET"])
def get_users_list():
    try:
        import pymysql.cursors
        from utils.auth_utils import get_user_site_scope

        caller_id, caller_role = get_current_user_from_request(request)
        if not caller_id:
            return jsonify({"error": "Authentication required"}), 401

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        cust_id = c_row["customer_id"] if (c_row and c_row.get("customer_id")) else 1

        scope_type, allowed_site_ids = get_user_site_scope(caller_id, caller_role)

        search = request.args.get("search", "").strip()
        search_filter = ""
        params = [cust_id]

        if search:
            search_filter = " AND (u.name LIKE %s OR u.email LIKE %s OR u.department LIKE %s)"
            term = f"%{search}%"
            params.extend([term, term, term])

        if caller_role in ['superadmin', 'global_admin']:
            query = f"""
                SELECT DISTINCT u.user_id, u.email, u.role, u.name, u.department, u.status,
                       GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') as site_names,
                       GROUP_CONCAT(DISTINCT s.site_id SEPARATOR ', ') as site_ids
                FROM users u
                LEFT JOIN user_sites us ON u.user_id = us.user_id
                LEFT JOIN sites s ON us.site_id = s.site_id
                WHERE u.customer_id = %s AND u.role IN ('host', 'security')
                {search_filter}
                GROUP BY u.user_id, u.email, u.role, u.name, u.department, u.status
                ORDER BY u.name ASC
            """
            cursor.execute(query, tuple(params))
        else:
            if not allowed_site_ids:
                cursor.close()
                conn.close()
                return jsonify([]), 200

            placeholders = ','.join(['%s'] * len(allowed_site_ids))
            params.extend(allowed_site_ids)
            query = f"""
                SELECT DISTINCT u.user_id, u.email, u.role, u.name, u.department, u.status,
                       GROUP_CONCAT(DISTINCT s.name SEPARATOR ', ') as site_names,
                       GROUP_CONCAT(DISTINCT s.site_id SEPARATOR ', ') as site_ids
                FROM users u
                INNER JOIN user_sites us ON u.user_id = us.user_id
                INNER JOIN sites s ON us.site_id = s.site_id
                WHERE u.customer_id = %s AND u.role IN ('host', 'security')
                  AND us.site_id IN ({placeholders})
                {search_filter}
                GROUP BY u.user_id, u.email, u.role, u.name, u.department, u.status
                ORDER BY u.name ASC
            """
            cursor.execute(query, tuple(params))

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
        from utils.auth_utils import get_user_site_scope

        caller_id, caller_role = get_current_user_from_request(request)
        if not caller_id or caller_role not in ['superadmin', 'admin', 'global_admin']:
            return jsonify({"error": "Unauthorized"}), 403

        data = request.get_json() or {}
        user_id = data.get("user_id")
        password = data.get("password")

        if not user_id or not password:
            return jsonify({"error": "User ID and password are required."}), 400

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
        c_row = cursor.fetchone()
        cust_id = c_row["customer_id"] if (c_row and c_row.get("customer_id")) else 1

        cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()

        if not user:
            cursor.close()
            conn.close()
            return jsonify({"error": "User not found."}), 404

        if user.get("customer_id") != cust_id:
            cursor.close()
            conn.close()
            return jsonify({"error": "Access denied: User belongs to another organization."}), 403

        # Non-superadmin cannot auto-login to superadmin accounts
        if caller_role not in ['superadmin', 'global_admin']:
            if user.get("role") in ['superadmin', 'global_admin']:
                cursor.close()
                conn.close()
                return jsonify({"error": "Access denied: Admins cannot initiate remote login for Super Admins."}), 403

            # Admin can only access users belonging to the site(s) assigned to that Admin
            scope_type, allowed_site_ids = get_user_site_scope(caller_id, caller_role)
            cursor.execute("SELECT site_id FROM user_sites WHERE user_id = %s", (user_id,))
            target_site_rows = cursor.fetchall()
            target_site_ids = [r["site_id"] for r in target_site_rows]

            overlap = set(target_site_ids).intersection(set(allowed_site_ids))
            if not overlap:
                cursor.close()
                conn.close()
                return jsonify({"error": "Access denied: Target user is not assigned to your authorized site(s)."}), 403

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


@admin_bp.route("/hosts", methods=["GET"])
@admin_bp.route("/admin/hosts", methods=["GET"])
def get_hosts():
    try:
        import pymysql.cursors
        from utils.auth_utils import get_user_site_scope

        caller_id, caller_role = get_current_user_from_request(request)
        cust_id = 1
        if caller_id:
            conn_u = get_db_connection()
            if conn_u:
                c_u = conn_u.cursor()
                c_u.execute("SELECT customer_id FROM users WHERE user_id = %s", (caller_id,))
                r_u = c_u.fetchone()
                if r_u and r_u[0]:
                    cust_id = r_u[0]
                c_u.close()
                conn_u.close()

        search = request.args.get("search", "").strip()
        req_site_id = request.headers.get("X-Site-ID") or request.args.get("site_id")

        # Determine target site filter
        target_site_ids = None  # None means all sites across customer

        if caller_id and caller_role not in ['superadmin', 'global_admin']:
            scope_type, allowed_site_ids = get_user_site_scope(caller_id, caller_role)
            if req_site_id and req_site_id != "all":
                try:
                    sid = int(req_site_id)
                    target_site_ids = [sid] if sid in allowed_site_ids else [-1]
                except (ValueError, TypeError):
                    target_site_ids = allowed_site_ids
            else:
                target_site_ids = allowed_site_ids
        elif req_site_id and req_site_id != "all":
            try:
                target_site_ids = [int(req_site_id)]
            except (ValueError, TypeError):
                target_site_ids = None

        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        if target_site_ids is not None:
            if not target_site_ids or target_site_ids == [-1]:
                cursor.close()
                conn.close()
                return jsonify([]), 200

            format_strings = ','.join(['%s'] * len(target_site_ids))
            query = f"""
                SELECT 
                    u.user_id, u.name, u.email, u.role, u.department, u.status, u.profile_photo,
                    GROUP_CONCAT(DISTINCT us.site_id) AS site_ids
                FROM users u
                JOIN user_sites us ON u.user_id = us.user_id
                WHERE u.customer_id = %s
                  AND us.site_id IN ({format_strings})
                  AND LOWER(u.role) IN ('host', 'admin', 'superadmin')
                  AND (LOWER(u.status) = 'active' OR u.status IS NULL)
            """
            params = [cust_id, *target_site_ids]
        else:
            query = """
                SELECT 
                    u.user_id, u.name, u.email, u.role, u.department, u.status, u.profile_photo,
                    GROUP_CONCAT(DISTINCT us.site_id) AS site_ids
                FROM users u
                LEFT JOIN user_sites us ON u.user_id = us.user_id
                WHERE u.customer_id = %s
                  AND LOWER(u.role) IN ('host', 'admin', 'superadmin')
                  AND (LOWER(u.status) = 'active' OR u.status IS NULL)
            """
            params = [cust_id]

        if search:
            query += " AND (LOWER(u.name) LIKE %s OR LOWER(u.department) LIKE %s OR LOWER(u.email) LIKE %s)"
            search_param = f"%{search.lower()}%"
            params.extend([search_param, search_param, search_param])
            
        query += " GROUP BY u.user_id, u.name, u.email, u.role, u.department, u.status, u.profile_photo ORDER BY u.name ASC"
        
        cursor.execute(query, tuple(params))
        hosts = cursor.fetchall()
        cursor.close()
        conn.close()

        result = []
        for h in hosts:
            s_ids = [int(x) for x in h["site_ids"].split(",")] if h.get("site_ids") else []
            result.append({
                "id": h["user_id"],
                "user_id": h["user_id"],
                "name": h["name"],
                "employee_code": f"EMP{h['user_id']:03d}",
                "department": h["department"] or "General",
                "role": h["role"],
                "email": h["email"],
                "status": h["status"] or "Active",
                "profile_photo": h["profile_photo"] or "",
                "site_ids": s_ids
            })
            
        return jsonify(result), 200
    except Exception as e:
        print("[ERROR] get_hosts:", e)
        return jsonify({"error": str(e)}), 500
