from flask import Blueprint, request, jsonify
import pymysql.cursors
from db import get_db_connection
from werkzeug.utils import secure_filename
import os
import time
import re
import json
import random
try:
    from utils.auth_utils import get_current_user_from_request, get_user_site_scope, is_site_authorized
except ImportError:
    from auth_utils import get_current_user_from_request, get_user_site_scope, is_site_authorized

request_bp = Blueprint("request_bp", __name__)

def check_and_add_columns():
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            # 1. Update visitor_requests table for transfer columns
            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'parent_request_id'")
            if not cursor.fetchone():
                print("Adding parent_request_id column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN parent_request_id INT DEFAULT NULL")
            
            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'transfer_from_host_id'")
            if not cursor.fetchone():
                print("Adding transfer_from_host_id column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN transfer_from_host_id INT DEFAULT NULL")
            
            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'is_multi_day'")
            if not cursor.fetchone():
                print("Adding is_multi_day column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN is_multi_day BOOLEAN DEFAULT FALSE")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'valid_till'")
            if not cursor.fetchone():
                print("Adding valid_till column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN valid_till DATE DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'physical_badge_no'")
            if not cursor.fetchone():
                print("Adding physical_badge_no column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN physical_badge_no VARCHAR(50) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'checked_in_by'")
            if not cursor.fetchone():
                print("Adding checked_in_by column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN checked_in_by INT DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'checkout_signature_path'")
            if not cursor.fetchone():
                print("Adding checkout_signature_path column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN checkout_signature_path VARCHAR(255) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'has_device'")
            if not cursor.fetchone():
                print("Adding has_device column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN has_device BOOLEAN DEFAULT FALSE")
            
            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'device_type'")
            if not cursor.fetchone():
                print("Adding device_type column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN device_type VARCHAR(100) DEFAULT NULL")
                
            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'device_make'")
            if not cursor.fetchone():
                print("Adding device_make column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN device_make VARCHAR(100) DEFAULT NULL")
                
            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'device_serial_number'")
            if not cursor.fetchone():
                print("Adding device_serial_number column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN device_serial_number VARCHAR(100) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'has_material'")
            if not cursor.fetchone():
                print("Adding has_material column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN has_material BOOLEAN DEFAULT FALSE")

            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'material_name'")
            if not cursor.fetchone():
                print("Adding material_name column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN material_name TEXT DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'material_quantity'")
            if not cursor.fetchone():
                print("Adding material_quantity column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN material_quantity VARCHAR(100) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitors LIKE 'material_serial_number'")
            if not cursor.fetchone():
                print("Adding material_serial_number column to visitors...")
                cursor.execute("ALTER TABLE visitors ADD COLUMN material_serial_number VARCHAR(100) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'has_material'")
            if not cursor.fetchone():
                print("Adding has_material column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN has_material BOOLEAN DEFAULT FALSE")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'material_name'")
            if not cursor.fetchone():
                print("Adding material_name column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN material_name TEXT DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'material_quantity'")
            if not cursor.fetchone():
                print("Adding material_quantity column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN material_quantity VARCHAR(100) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'material_serial_number'")
            if not cursor.fetchone():
                print("Adding material_serial_number column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN material_serial_number VARCHAR(100) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'group_id'")
            if not cursor.fetchone():
                print("Adding group_id column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN group_id VARCHAR(50) DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'is_group_lead'")
            if not cursor.fetchone():
                print("Adding is_group_lead column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN is_group_lead BOOLEAN DEFAULT FALSE")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'accompanying_visitors'")
            if not cursor.fetchone():
                print("Adding accompanying_visitors column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN accompanying_visitors TEXT DEFAULT NULL")

            cursor.execute("SHOW COLUMNS FROM visitor_requests LIKE 'accompanying_count'")
            if not cursor.fetchone():
                print("Adding accompanying_count column to visitor_requests...")
                cursor.execute("ALTER TABLE visitor_requests ADD COLUMN accompanying_count INT DEFAULT 0")

            cursor.execute("SHOW TABLES LIKE 'system_settings'")
            if not cursor.fetchone():
                print("Creating system_settings table...")
                cursor.execute("""
                    CREATE TABLE system_settings (
                        setting_key VARCHAR(255) PRIMARY KEY,
                        setting_value TEXT NOT NULL
                    )
                """)
            else:
                try:
                    cursor.execute("ALTER TABLE system_settings MODIFY COLUMN setting_value TEXT NOT NULL")
                except Exception as ex:
                    print("Note modifying system_settings:", ex)

            conn.commit()
            cursor.close()
        except Exception as e:
            print("Error checking/adding columns in request_routes:", e)
        finally:
            conn.close()

check_and_add_columns()

UPLOAD_FOLDER = "uploads"

def auto_expire_past_requests(cursor):
    """
    Automatically marks visitor requests as 'EXPIRED' if:
    1. Check in time is NULL (not checked in)
    2. Scheduled date is strictly before current date (scheduled_date < CURRENT_DATE)
    3. Status is currently pending or approved ('PENDING', 'APPROVED', 'PENDING_TRANSFER')
    """
    try:
        cursor.execute("""
            UPDATE visitor_requests
            SET status = 'EXPIRED'
            WHERE check_in_time IS NULL
              AND scheduled_date < CURRENT_DATE
              AND status IN ('PENDING', 'APPROVED', 'PENDING_TRANSFER')
        """)
    except Exception as e:
        print("Error auto-expiring past requests:", e)

@request_bp.route("/api/visitor-requests", methods=["GET"])
def get_requests():
    conn = get_db_connection()
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Run auto-expiration check for past un-checked-in requests
        auto_expire_past_requests(cursor)
        conn.commit()

        user_id, role = get_current_user_from_request(request)
        site_filter_sql = ""
        params = []

        req_site_id = request.args.get("site_id") or request.headers.get("X-Site-ID")

        if user_id:
            scope_type, site_ids = get_user_site_scope(user_id, role)
            if req_site_id and req_site_id != "all":
                try:
                    s_id = int(req_site_id)
                    if scope_type == "ALL" or s_id in site_ids:
                        site_filter_sql = "WHERE (vr.site_id = %s OR vr.site_id IS NULL)"
                        params.append(s_id)
                    else:
                        site_filter_sql = "WHERE 1=0" # Unauthorized site requested
                except (ValueError, TypeError):
                    pass
            elif scope_type == "SCOPED":
                format_strings = ','.join(['%s'] * len(site_ids))
                site_filter_sql = f"WHERE (vr.site_id IN ({format_strings}) OR vr.site_id IS NULL)"
                params.extend(site_ids)
        elif req_site_id and req_site_id != "all":
            try:
                s_id = int(req_site_id)
                site_filter_sql = "WHERE (vr.site_id = %s OR vr.site_id IS NULL)"
                params.append(s_id)
            except (ValueError, TypeError):
                pass

        query = f"""
            SELECT vr.*, 
                   v.visitor_name, v.full_name, v.email, v.mobile_number, v.pabx_number,
                   v.company_name, v.unit, v.department, v.location,
                   v.id_proof_type, v.id_proof_number, v.access_level,
                   v.reason_of_visit, v.employee_id, v.photo,
                   s.name AS site_name,
                   COALESCE(
                       CASE WHEN LOWER(u_host.role) != 'security' THEN u_host.name ELSE NULL END,
                       CASE WHEN LOWER(u_person.role) != 'security' AND v.person_to_visit IS NOT NULL AND v.person_to_visit != '' THEN v.person_to_visit ELSE NULL END,
                       'Host information unavailable'
                   ) AS person_to_visit,
                   COALESCE(
                       CASE WHEN LOWER(u_host.role) != 'security' THEN u_host.name ELSE NULL END,
                       CASE WHEN LOWER(u_person.role) != 'security' AND v.person_to_visit IS NOT NULL AND v.person_to_visit != '' THEN v.person_to_visit ELSE NULL END,
                       'Host information unavailable'
                   ) AS host_name,
                   u_host.department AS host_department,
                   u_checkin.name AS checked_in_by_name,
                   u.name AS transfer_from_host_name
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            LEFT JOIN sites s ON vr.site_id = s.site_id
            LEFT JOIN users u_host ON vr.host_id = u_host.user_id
            LEFT JOIN users u_person ON LOWER(v.person_to_visit) = LOWER(u_person.name)
            LEFT JOIN users u ON vr.transfer_from_host_id = u.user_id
            LEFT JOIN users u_checkin ON vr.checked_in_by = u_checkin.user_id
            {site_filter_sql}
            ORDER BY vr.created_at DESC
        """
        cursor.execute(query, tuple(params))
        requests = cursor.fetchall()


        # 🔄 Clean and format data for JSON serialization
        from datetime import datetime, date, time
        for req in requests:
            # Attach host object
            if req.get("host_id"):
                req["host"] = {
                    "id": req["host_id"],
                    "name": req.get("host_name") or req.get("person_to_visit"),
                    "department": req.get("host_department") or ""
                }
            if req.get("checked_in_by"):
                req["checked_in_by_info"] = {
                    "id": req["checked_in_by"],
                    "name": req.get("checked_in_by_name") or ""
                }
            for key, value in req.items():
                if value is not None and key not in ["host", "checked_in_by_info"]:
                    if isinstance(value, datetime):
                        req[key] = value.strftime("%d %b %Y, %I:%M %p")
                    elif isinstance(value, date):
                        req[key] = value.strftime("%Y-%m-%d")
                    elif isinstance(value, time):
                        req[key] = value.strftime("%I:%M %p")
                    elif not isinstance(value, (int, float, str, bool, dict, list)):
                        req[key] = str(value)

        return jsonify(requests), 200

    except Exception as e:
        print(f"DATABASE ERROR in get_requests: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@request_bp.route("/api/visitor-requests", methods=["POST"])
def create_request():
    # Handle both JSON and Form data
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    conn = get_db_connection()

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # 🛑 Backend Validation
        email = data.get("email")
        mobile = data.get("mobile_number")

        # 1. Email Validation (if provided)
        if email and not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return jsonify({"error": "Invalid email format"}), 400

        # 2. Phone Validation (Universal: 7 to 15 digits, optionally starting with +)
        mobile_str = str(mobile).strip()
        if not re.match(r"^\+?\d{7,15}$", mobile_str):
            return jsonify({"error": "Mobile number must be a valid universal format (7 to 15 digits, optionally starting with +)"}), 400

        # 3. ID Proof Validation
        id_type = data.get("id_proof_type")
        id_number = data.get("id_proof_number")
        
        if id_type == "Aadhar Card":
            if not id_number or not re.match(r"^\d{12}$", str(id_number)):
                return jsonify({"error": "Aadhar Card must be exactly 12 digits"}), 400
        elif id_type == "PAN Card":
            if not id_number or not re.match(r"^[A-Z0-9]{10}$", str(id_number).upper()):
                return jsonify({"error": "PAN Card must be exactly 10 alphanumeric characters"}), 400

        # 4. Vehicle Number Validation
        vehicle_number = data.get("vehicle_number") or data.get("vehicleNumber")
        if vehicle_number and str(vehicle_number).strip() != "":
            clean_vehicle = re.sub(r'[^A-Za-z0-9]', '', str(vehicle_number))
            if not re.match(r"^[A-Za-z]{2}\d{2}[A-Za-z]{1,2}\d{4}$", clean_vehicle):
                return jsonify({"error": "Please enter a valid Indian vehicle registration number (e.g., MH12AB1234)"}), 400

        # 5. Host Validation & Resolution
        raw_host_id = data.get("host_id")
        person_to_visit = data.get("person_to_visit") or data.get("personToVisit")
        host_id = None

        if raw_host_id and str(raw_host_id).strip() != "":
            try:
                host_id = int(raw_host_id)
            except (ValueError, TypeError):
                return jsonify({"error": "Invalid host_id format"}), 400

            cursor.execute("""
                SELECT user_id, name, department, role, status
                FROM users
                WHERE user_id = %s AND LOWER(role) IN ('host', 'admin', 'superadmin') AND (LOWER(status) = 'active' OR status IS NULL)
            """, (host_id,))
            host_row = cursor.fetchone()
            if not host_row:
                return jsonify({"error": "Selected employee is not an eligible host."}), 400
            person_to_visit = host_row["name"]
        elif person_to_visit and str(person_to_visit).strip() != "":
            cursor.execute("""
                SELECT user_id, name, department, role, status
                FROM users
                WHERE LOWER(name) = LOWER(%s) AND LOWER(role) IN ('host', 'admin', 'superadmin') AND (LOWER(status) = 'active' OR status IS NULL)
                LIMIT 1
            """, (str(person_to_visit).strip(),))
            host_row = cursor.fetchone()
            if host_row:
                host_id = host_row["user_id"]
                person_to_visit = host_row["name"]

        if not host_id:
            return jsonify({"error": "Please select a valid host/person to visit."}), 400

        # Handle Photo Upload
        photo_path = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file and file.filename != '':
                filename = f"{int(time.time())}_{secure_filename(file.filename)}"
                if not os.path.exists(UPLOAD_FOLDER):
                    os.makedirs(UPLOAD_FOLDER)
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                photo_path = f"uploads/{filename}"

        # Handle Vehicle Photos Upload
        vehicle_photo_front_path = None
        if 'vehicle_photo_front' in request.files:
            file = request.files['vehicle_photo_front']
            if file and file.filename != '':
                filename = f"{int(time.time())}_front_{secure_filename(file.filename)}"
                if not os.path.exists(UPLOAD_FOLDER):
                    os.makedirs(UPLOAD_FOLDER)
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                vehicle_photo_front_path = f"uploads/{filename}"

        vehicle_photo_side_path = None
        if 'vehicle_photo_side' in request.files:
            file = request.files['vehicle_photo_side']
            if file and file.filename != '':
                filename = f"{int(time.time())}_side_{secure_filename(file.filename)}"
                if not os.path.exists(UPLOAD_FOLDER):
                    os.makedirs(UPLOAD_FOLDER)
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                file.save(filepath)
                vehicle_photo_side_path = f"uploads/{filename}"

        # 1️⃣ Check if visitor already exists by mobile
        cursor.execute("SELECT visitor_id FROM visitors WHERE mobile_number = %s LIMIT 1", (mobile_str,))
        existing_visitor = cursor.fetchone()
        has_device = True if data.get("hasDevice") == "Yes" else False
        has_material = True if str(data.get("hasMaterial")).lower() in ["yes", "true", "1"] else False
        material_name = data.get("materialName") or data.get("material_name")
        material_quantity = data.get("materialQuantity") or data.get("material_quantity")
        material_serial_number = data.get("materialSerialNumber") or data.get("material_serial_number")

        if existing_visitor:
            visitor_id = existing_visitor["visitor_id"]
            print(f"Using existing visitor ID: {visitor_id}")
            
            # Update existing visitor details (specifically vehicle, photos, devices, materials, and host)
            update_fields = []
            update_params = []
            
            def add_field(col_name, val):
                if val is not None:
                    update_fields.append(f"{col_name} = %s")
                    update_params.append(val)
                    
            add_field("vehicle_type", data.get("vehicle_type") or data.get("vehicleType"))
            add_field("vehicle_number", data.get("vehicle_number") or data.get("vehicleNumber"))
            add_field("has_device", has_device)
            add_field("device_type", data.get("deviceType"))
            add_field("device_make", data.get("deviceMake"))
            add_field("device_serial_number", data.get("deviceSerialNumber"))
            add_field("has_material", has_material)
            add_field("material_name", material_name)
            add_field("material_quantity", material_quantity)
            add_field("material_serial_number", material_serial_number)
            add_field("person_to_visit", person_to_visit)
            add_field("employee_id", str(host_id))
            if photo_path:
                add_field("photo", photo_path)
            if vehicle_photo_front_path:
                add_field("vehicle_photo_front", vehicle_photo_front_path)
            if vehicle_photo_side_path:
                add_field("vehicle_photo_side", vehicle_photo_side_path)
                
            if update_fields:
                update_params.append(visitor_id)
                cursor.execute(f"UPDATE visitors SET {', '.join(update_fields)} WHERE visitor_id = %s", tuple(update_params))
        else:
            visitor_data = {
                "visitor_name": data.get("visitor_name"),
                "full_name": data.get("full_name"),
                "email": data.get("email"),
                "mobile_number": data.get("mobile_number"),
                "pabx_number": data.get("pabx"),
                "company_name": data.get("company_name"),
                "unit": data.get("unit"),
                "department": data.get("department"),
                "location": data.get("location"),
                "id_proof_type": data.get("id_proof_type"),
                "id_proof_number": data.get("id_proof_number"),
                "access_level": data.get("access_level"),
                "reason_of_visit": data.get("purpose"),
                "employee_id": str(host_id),
                "photo": photo_path,
                "person_to_visit": person_to_visit,
                "vehicle_type": data.get("vehicle_type") or data.get("vehicleType"),
                "vehicle_number": data.get("vehicle_number") or data.get("vehicleNumber"),
                "vehicle_photo_front": vehicle_photo_front_path,
                "vehicle_photo_side": vehicle_photo_side_path,
                "has_device": has_device,
                "device_type": data.get("deviceType"),
                "device_make": data.get("deviceMake"),
                "device_serial_number": data.get("deviceSerialNumber"),
                "has_material": has_material,
                "material_name": material_name,
                "material_quantity": material_quantity,
                "material_serial_number": material_serial_number
            }

            cursor.execute("""
                INSERT INTO visitors (
                    visitor_name, full_name, email, mobile_number, pabx_number,
                    company_name, unit, department, location, id_proof_type,
                    id_proof_number, access_level, reason_of_visit, employee_id,
                    photo, person_to_visit, vehicle_type, vehicle_number,
                    vehicle_photo_front, vehicle_photo_side, has_device,
                    device_type, device_make, device_serial_number,
                    has_material, material_name, material_quantity, material_serial_number
                )
                VALUES (
                    %(visitor_name)s, %(full_name)s, %(email)s, %(mobile_number)s, 
                    %(pabx_number)s, %(company_name)s, %(unit)s, %(department)s, 
                    %(location)s, %(id_proof_type)s, %(id_proof_number)s, %(access_level)s, 
                    %(reason_of_visit)s, %(employee_id)s, %(photo)s, %(person_to_visit)s,
                    %(vehicle_type)s, %(vehicle_number)s, %(vehicle_photo_front)s, %(vehicle_photo_side)s,
                    %(has_device)s, %(device_type)s, %(device_make)s, %(device_serial_number)s,
                    %(has_material)s, %(material_name)s, %(material_quantity)s, %(material_serial_number)s
                )
            """, visitor_data)
            visitor_id = cursor.lastrowid

        # 2️⃣ Insert request
        scheduled_date = data.get("scheduled_date")
        scheduled_time = data.get("scheduled_time")

        from datetime import datetime, date
        if not scheduled_date or str(scheduled_date).strip() == "":
            sched_date_val = date.today().strftime("%Y-%m-%d")
        else:
            sched_date_val = str(scheduled_date).strip()

        if not scheduled_time or str(scheduled_time).strip() == "":
            sched_time_val = datetime.now().strftime("%H:%M:%S")
        else:
            sched_time_val = str(scheduled_time).strip()
            if len(sched_time_val) == 5:
                sched_time_val += ":00"

        is_multi_day_raw = data.get("is_multi_day") or data.get("isMultiDay")
        is_multi_day = True if str(is_multi_day_raw).lower() in ["1", "true", "yes"] else False
        valid_till = data.get("valid_till") or data.get("validTill") or sched_date_val

        # Determine site_id
        target_site_id = data.get("site_id") or data.get("siteId") or request.headers.get("X-Site-ID")
        if not target_site_id and host_id:
            cursor.execute("SELECT site_id FROM user_sites WHERE user_id = %s LIMIT 1", (host_id,))
            user_site_row = cursor.fetchone()
            target_site_id = user_site_row["site_id"] if user_site_row else 1
        try:
            target_site_id = int(target_site_id) if target_site_id else 1
        except (ValueError, TypeError):
            target_site_id = 1

        # Check for group / accompanying visitors
        raw_group = data.get("group_visitors")
        group_visitors = []
        if raw_group:
            if isinstance(raw_group, str):
                try:
                    group_visitors = json.loads(raw_group)
                except Exception as ex:
                    print(f"Error parsing group_visitors JSON: {ex}")
                    group_visitors = []
            elif isinstance(raw_group, list):
                group_visitors = raw_group

        # Filter out empty entries (require at least a non-empty name)
        valid_group_members = []
        if isinstance(group_visitors, list):
            for g in group_visitors:
                if isinstance(g, dict) and g.get("name") and str(g.get("name")).strip():
                    valid_group_members.append(g)

        group_id = None
        if valid_group_members:
            group_id = f"GRP-{int(time.time())}-{random.randint(1000, 9999)}"

        request_data = {
            "visitor_id": visitor_id,
            "host_id": host_id,
            "site_id": target_site_id,
            "purpose": data.get("purpose"),
            "scheduled_date": sched_date_val,
            "scheduled_time": sched_time_val,
            "is_multi_day": is_multi_day,
            "valid_till": valid_till if valid_till else sched_date_val,
            "has_device": has_device,
            "device_type": data.get("deviceType"),
            "device_make": data.get("deviceMake"),
            "device_serial_number": data.get("deviceSerialNumber"),
            "has_material": has_material,
            "material_name": material_name,
            "material_quantity": material_quantity,
            "material_serial_number": material_serial_number,
            "group_id": group_id,
            "is_group_lead": True if group_id else False,
            "accompanying_count": len(valid_group_members),
            "accompanying_visitors": json.dumps(valid_group_members) if valid_group_members else None
        }

        cursor.execute("""
            INSERT INTO visitor_requests (
                visitor_id,
                host_id,
                site_id,
                purpose,
                scheduled_date,
                scheduled_time,
                is_multi_day,
                valid_till,
                has_device,
                device_type,
                device_make,
                device_serial_number,
                has_material,
                material_name,
                material_quantity,
                material_serial_number,
                group_id,
                is_group_lead,
                accompanying_count,
                accompanying_visitors,
                status,
                created_at
            )
            VALUES (
                %(visitor_id)s, %(host_id)s, %(site_id)s, %(purpose)s, 
                %(scheduled_date)s, %(scheduled_time)s,
                %(is_multi_day)s, %(valid_till)s,
                %(has_device)s, %(device_type)s, %(device_make)s, %(device_serial_number)s,
                %(has_material)s, %(material_name)s, %(material_quantity)s, %(material_serial_number)s,
                %(group_id)s, %(is_group_lead)s, %(accompanying_count)s, %(accompanying_visitors)s,
                'PENDING', NOW()
            )
        """, request_data)

        new_request_id = cursor.lastrowid

        # Insert requests for accompanying group members
        created_group_requests = []
        if group_id and valid_group_members:
            for member in valid_group_members:
                m_name = str(member.get("name")).strip()
                m_phone = str(member.get("phone") or member.get("mobile_number") or mobile_str).strip()
                m_email = str(member.get("email") or "").strip()
                m_id_type = str(member.get("typeOfIDProof") or member.get("id_proof_type") or "").strip()
                m_id_num = str(member.get("idProofNumber") or member.get("id_proof_number") or "").strip()

                cursor.execute("""
                    SELECT visitor_id FROM visitors 
                    WHERE mobile_number = %s AND (LOWER(visitor_name) = LOWER(%s) OR LOWER(full_name) = LOWER(%s))
                    LIMIT 1
                """, (m_phone, m_name, m_name))
                m_existing = cursor.fetchone()

                if m_existing:
                    m_visitor_id = m_existing["visitor_id"]
                else:
                    m_visitor_data = {
                        "visitor_name": m_name,
                        "full_name": m_name,
                        "email": m_email,
                        "mobile_number": m_phone,
                        "pabx_number": data.get("pabx") or "",
                        "company_name": data.get("company_name") or data.get("companyName"),
                        "unit": data.get("unit"),
                        "department": data.get("department"),
                        "location": data.get("location"),
                        "id_proof_type": m_id_type or None,
                        "id_proof_number": m_id_num or None,
                        "access_level": data.get("access_level") or data.get("accessLevel"),
                        "reason_of_visit": data.get("purpose") or data.get("reasonOfVisit"),
                        "employee_id": str(host_id),
                        "photo": None,
                        "person_to_visit": person_to_visit,
                        "vehicle_type": data.get("vehicle_type") or data.get("vehicleType"),
                        "vehicle_number": data.get("vehicle_number") or data.get("vehicleNumber"),
                        "vehicle_photo_front": None,
                        "vehicle_photo_side": None,
                        "has_device": False,
                        "device_type": None,
                        "device_make": None,
                        "device_serial_number": None,
                        "has_material": False,
                        "material_name": None,
                        "material_quantity": None,
                        "material_serial_number": None
                    }
                    cursor.execute("""
                        INSERT INTO visitors (
                            visitor_name, full_name, email, mobile_number, pabx_number,
                            company_name, unit, department, location, id_proof_type,
                            id_proof_number, access_level, reason_of_visit, employee_id,
                            photo, person_to_visit, vehicle_type, vehicle_number,
                            vehicle_photo_front, vehicle_photo_side, has_device,
                            device_type, device_make, device_serial_number,
                            has_material, material_name, material_quantity, material_serial_number
                        )
                        VALUES (
                            %(visitor_name)s, %(full_name)s, %(email)s, %(mobile_number)s, 
                            %(pabx_number)s, %(company_name)s, %(unit)s, %(department)s, 
                            %(location)s, %(id_proof_type)s, %(id_proof_number)s, %(access_level)s, 
                            %(reason_of_visit)s, %(employee_id)s, %(photo)s, %(person_to_visit)s,
                            %(vehicle_type)s, %(vehicle_number)s, %(vehicle_photo_front)s, %(vehicle_photo_side)s,
                            %(has_device)s, %(device_type)s, %(device_make)s, %(device_serial_number)s,
                            %(has_material)s, %(material_name)s, %(material_quantity)s, %(material_serial_number)s
                        )
                    """, m_visitor_data)
                    m_visitor_id = cursor.lastrowid

                m_req_data = {
                    "visitor_id": m_visitor_id,
                    "host_id": host_id,
                    "site_id": target_site_id,
                    "purpose": data.get("purpose") or data.get("reasonOfVisit"),
                    "scheduled_date": sched_date_val,
                    "scheduled_time": sched_time_val,
                    "is_multi_day": is_multi_day,
                    "valid_till": valid_till if valid_till else sched_date_val,
                    "has_device": False,
                    "device_type": None,
                    "device_make": None,
                    "device_serial_number": None,
                    "has_material": False,
                    "material_name": None,
                    "material_quantity": None,
                    "material_serial_number": None,
                    "group_id": group_id,
                    "is_group_lead": False,
                    "accompanying_count": 0,
                    "accompanying_visitors": None
                }
                cursor.execute("""
                    INSERT INTO visitor_requests (
                        visitor_id, host_id, site_id, purpose,
                        scheduled_date, scheduled_time, is_multi_day, valid_till,
                        has_device, device_type, device_make, device_serial_number,
                        has_material, material_name, material_quantity, material_serial_number,
                        group_id, is_group_lead, accompanying_count, accompanying_visitors,
                        status, created_at
                    )
                    VALUES (
                        %(visitor_id)s, %(host_id)s, %(site_id)s, %(purpose)s,
                        %(scheduled_date)s, %(scheduled_time)s, %(is_multi_day)s, %(valid_till)s,
                        %(has_device)s, %(device_type)s, %(device_make)s, %(device_serial_number)s,
                        %(has_material)s, %(material_name)s, %(material_quantity)s, %(material_serial_number)s,
                        %(group_id)s, %(is_group_lead)s, %(accompanying_count)s, %(accompanying_visitors)s,
                        'PENDING', NOW()
                    )
                """, m_req_data)
                created_group_requests.append(cursor.lastrowid)

        cursor.execute("SELECT * FROM visitor_requests WHERE request_id = %s", (new_request_id,))
        new_request = cursor.fetchone()

        for key in new_request:
            if new_request[key] is not None:
                new_request[key] = str(new_request[key])

        conn.commit()
        return jsonify(new_request), 201

    except Exception as e:
        print(f"DATABASE ERROR in create_request: {str(e)}")
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@request_bp.route("/api/visitor-requests/<int:request_id>/approve", methods=["PUT"])
def approve_request(request_id):
    data = request.get_json() or {}
    conn = get_db_connection()

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        approver_id = data.get("approved_by")

        # Site RBAC Authorization check
        user_id, role = get_current_user_from_request(request)
        if not user_id and approver_id:
            user_id = approver_id
            cursor.execute("SELECT role FROM users WHERE user_id = %s", (approver_id,))
            u_row = cursor.fetchone()
            if u_row:
                role = u_row["role"]

        cursor.execute("SELECT site_id, parent_request_id, visitor_id FROM visitor_requests WHERE request_id = %s", (request_id,))
        request_row = cursor.fetchone()
        
        if not request_row:
            return jsonify({"error": "Request not found"}), 404

        if user_id and not is_site_authorized(user_id, role, request_row.get("site_id")):
            return jsonify({"error": "Forbidden: You are not authorized to approve requests for this site"}), 403
            
        parent_request_id = request_row["parent_request_id"]
        visitor_id = request_row["visitor_id"]

        if parent_request_id:
            # Check if parent request had checked in
            cursor.execute("SELECT check_in_time FROM visitor_requests WHERE request_id = %s", (parent_request_id,))
            parent_row = cursor.fetchone()
            parent_checked_in = parent_row and parent_row["check_in_time"]

            if parent_checked_in:
                cursor.execute("""
                    UPDATE visitor_requests
                    SET status='APPROVED',
                        approved_by=%s,
                        approved_at=NOW(),
                        check_in_time=NOW()
                    WHERE request_id=%s
                """, (approver_id, request_id))
                
                # Automatically check out of parent request and mark as TRANSFERRED
                cursor.execute("""
                    UPDATE visitor_requests
                    SET status='TRANSFERRED',
                        check_out_time=NOW(),
                        is_temp_out=FALSE
                    WHERE request_id=%s
                """, (parent_request_id,))
            else:
                cursor.execute("""
                    UPDATE visitor_requests
                    SET status='APPROVED',
                        approved_by=%s,
                        approved_at=NOW()
                    WHERE request_id=%s
                """, (approver_id, request_id))
                
                # Mark parent request as TRANSFERRED to close/complete it
                cursor.execute("""
                    UPDATE visitor_requests
                    SET status='TRANSFERRED'
                    WHERE request_id=%s
                """, (parent_request_id,))
        else:
            cursor.execute("""
                UPDATE visitor_requests
                SET status='APPROVED',
                    approved_by=%s,
                    approved_at=NOW()
                WHERE request_id=%s
            """, (approver_id, request_id))

        # If part of a group visit, approve all accompanying group members
        cursor.execute("SELECT group_id FROM visitor_requests WHERE request_id = %s", (request_id,))
        grp_row = cursor.fetchone()
        if grp_row and grp_row.get("group_id"):
            cursor.execute("""
                UPDATE visitor_requests
                SET status='APPROVED',
                    approved_by=%s,
                    approved_at=NOW()
                WHERE group_id=%s AND status='PENDING'
            """, (approver_id, grp_row["group_id"]))
        
        conn.commit()
        return jsonify({"message": "Approved"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@request_bp.route("/api/visitor-requests/<int:request_id>/reject", methods=["PUT"])
def reject_request(request_id):
    data = request.get_json() or {}
    conn = get_db_connection()

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        user_id, role = get_current_user_from_request(request)
        approver_id = data.get("approved_by")
        if not user_id and approver_id:
            user_id = approver_id
            cursor.execute("SELECT role FROM users WHERE user_id = %s", (approver_id,))
            u_row = cursor.fetchone()
            if u_row:
                role = u_row["role"]

        cursor.execute("SELECT site_id FROM visitor_requests WHERE request_id = %s", (request_id,))
        request_row = cursor.fetchone()
        if not request_row:
            return jsonify({"error": "Request not found"}), 404

        if user_id and not is_site_authorized(user_id, role, request_row.get("site_id")):
            return jsonify({"error": "Forbidden: You are not authorized to reject requests for this site"}), 403

        cursor.execute("""
            UPDATE visitor_requests
            SET status='REJECTED',
                approved_by=%s,
                approved_at=NOW()
            WHERE request_id=%s
        """, (approver_id, request_id))

        # If part of a group visit, reject all accompanying group members
        cursor.execute("SELECT group_id FROM visitor_requests WHERE request_id = %s", (request_id,))
        grp_row = cursor.fetchone()
        if grp_row and grp_row.get("group_id"):
            cursor.execute("""
                UPDATE visitor_requests
                SET status='REJECTED',
                    approved_by=%s,
                    approved_at=NOW()
                WHERE group_id=%s AND status='PENDING'
            """, (approver_id, grp_row["group_id"]))

        conn.commit()
        return jsonify({"message": "Rejected"}), 200

    finally:
        conn.close()


@request_bp.route("/api/visitor-requests/<int:request_id>/transfer", methods=["POST"])
def transfer_visitor(request_id):
    user_id, role = get_current_user_from_request(request)
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    to_host_id = data.get("to_host_id")
    purpose = data.get("purpose")

    if not to_host_id:
        return jsonify({"error": "Target host ID is required"}), 400
    if not purpose:
        return jsonify({"error": "Purpose/reason for transfer is required"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # 1. Verify original request and check site authorization
        cursor.execute("""
            SELECT visitor_id, host_id, check_in_time, check_out_time, status, site_id 
            FROM visitor_requests 
            WHERE request_id = %s
        """, (request_id,))

        original_req = cursor.fetchone()

        if not original_req:
            return jsonify({"error": "Original visit request not found"}), 404

        if not is_site_authorized(user_id, role, original_req.get("site_id")):
            return jsonify({"error": "Unauthorized to access this visit request"}), 403

        if original_req["check_out_time"] or original_req["status"] == "Checked Out":
            return jsonify({"error": "Visitor has already checked out"}), 400

        # 2. Check if a pending transfer already exists for this request
        cursor.execute("""
            SELECT request_id FROM visitor_requests 
            WHERE parent_request_id = %s AND status = 'PENDING_TRANSFER'
        """, (request_id,))
        if cursor.fetchone():
            return jsonify({"error": "A transfer request is already pending for this visitor"}), 400

        # 3. Verify target host exists and belongs to same customer
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (user_id,))
        c_row = cursor.fetchone()
        caller_cust_id = c_row["customer_id"] if (c_row and c_row.get("customer_id")) else 1

        cursor.execute("SELECT name, customer_id FROM users WHERE user_id = %s AND LOWER(role) IN ('host', 'admin', 'superadmin')", (to_host_id,))
        target_host = cursor.fetchone()
        if not target_host or target_host.get("customer_id") != caller_cust_id:
            return jsonify({"error": "Target host not found or user is not a host in your organization"}), 404

        # 4. Insert new request
        cursor.execute("""
            INSERT INTO visitor_requests (
                visitor_id,
                host_id,
                purpose,
                scheduled_date,
                scheduled_time,
                status,
                created_at,
                parent_request_id,
                transfer_from_host_id,
                site_id
            )
            VALUES (
                %s, %s, %s, CURRENT_DATE, CURRENT_TIME, 'PENDING_TRANSFER', NOW(), %s, %s, %s
            )
        """, (
            original_req["visitor_id"],
            to_host_id,
            f"Transfer: {purpose}",
            request_id,
            original_req["host_id"],
            original_req.get("site_id") or 1
        ))

        new_request_id = cursor.lastrowid
        conn.commit()



        return jsonify({
            "message": "Transfer request sent successfully",
            "request_id": new_request_id
        }), 201

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@request_bp.route("/api/host/recent-activity", methods=["GET"])
def host_recent_activity():
    host_id = request.args.get("host_id")
    if not host_id:
        return jsonify({"error": "Host ID is required"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        sql = """
        SELECT
            vr.request_id,
            v.visitor_name,
            u.name AS approver_name,
            vr.status,
            vr.created_at,
            vr.check_in_time,
            vr.check_out_time,
            vr.approved_at,
            vr.temp_out_time,
            vr.temp_in_time,
            vr.manual_check_out_time,
            vr.parent_request_id,
            vr.transfer_from_host_id,
            u_from.name AS transfer_from_host_name,
            u_to.name AS target_host_name
        FROM visitor_requests vr
        LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
        LEFT JOIN users u ON vr.approved_by = u.user_id
        LEFT JOIN users u_from ON vr.transfer_from_host_id = u_from.user_id
        LEFT JOIN users u_to ON vr.host_id = u_to.user_id
        WHERE (vr.host_id = %s OR vr.transfer_from_host_id = %s)
        ORDER BY COALESCE(vr.check_in_time, vr.approved_at, vr.created_at) DESC
        LIMIT 15
        """
        cursor.execute(sql, (host_id, host_id))
        rows = cursor.fetchall()

        activity = []
        for r in rows:
            request_id = r[0]
            visitor = r[1]
            approved_by = r[2] if r[2] else "Security"
            status = r[3]
            created = r[4]
            checkin = r[5]
            checkout = r[6]
            approved = r[7]
            temp_out = r[8]
            temp_in = r[9]
            manual_checkout = r[10]
            parent_request_id = r[11]
            transfer_from_host_id = r[12]
            transfer_from_host_name = r[13]
            target_host_name = r[14]

            # Transfer Initiated activity
            if status == "PENDING_TRANSFER":
                from_name = transfer_from_host_name or "Host"
                to_name = target_host_name or "Host"
                activity.append({
                    "request_id": request_id,
                    "action": "Transfer Initiated",
                    "name": visitor,
                    "detail": f"Transferred from {from_name} to {to_name}",
                    "time": created.strftime("%d %b %Y, %I:%M %p") if created else ""
                })

            # Transferred (original request closed)
            elif status == "TRANSFERRED":
                activity.append({
                    "request_id": request_id,
                    "action": "Transferred",
                    "name": visitor,
                    "detail": "Visitor transferred to another host",
                    "time": checkout.strftime("%d %b %Y, %I:%M %p") if checkout else (created.strftime("%d %b %Y, %I:%M %p") if created else "")
                })

            # Approved activity
            elif status == "APPROVED":
                if parent_request_id and transfer_from_host_id:
                    from_name = transfer_from_host_name or "Host"
                    to_name = approved_by or target_host_name or "Host"
                    activity.append({
                        "request_id": request_id,
                        "action": "Transfer Approved",
                        "name": visitor,
                        "detail": f"Transfer to {to_name} approved (from {from_name})",
                        "time": approved.strftime("%d %b %Y, %I:%M %p") if approved else (created.strftime("%d %b %Y, %I:%M %p") if created else "")
                    })
                else:
                    activity.append({
                        "request_id": request_id,
                        "action": "Approved",
                        "name": visitor,
                        "detail": f"Approved by {approved_by}",
                        "time": approved.strftime("%d %b %Y, %I:%M %p") if approved else (created.strftime("%d %b %Y, %I:%M %p") if created else "")
                    })

            # Rejected activity
            elif status == "REJECTED":
                if parent_request_id and transfer_from_host_id:
                    from_name = transfer_from_host_name or "Host"
                    to_name = approved_by or target_host_name or "Host"
                    activity.append({
                        "request_id": request_id,
                        "action": "Transfer Rejected",
                        "name": visitor,
                        "detail": f"Transfer to {to_name} rejected by {approved_by}",
                        "time": approved.strftime("%d %b %Y, %I:%M %p") if approved else (created.strftime("%d %b %Y, %I:%M %p") if created else "")
                    })
                else:
                    activity.append({
                        "request_id": request_id,
                        "action": "Rejected",
                        "name": visitor,
                        "detail": f"Rejected by {approved_by}",
                        "time": approved.strftime("%d %b %Y, %I:%M %p") if approved else (created.strftime("%d %b %Y, %I:%M %p") if created else "")
                    })

            # Check-in activity
            if checkin:
                activity.append({
                    "request_id": request_id,
                    "action": "Check-in",
                    "name": visitor,
                    "detail": f"Badge V-{1000 + request_id} issued",
                    "time": checkin.strftime("%d %b %Y, %I:%M %p")
                })

            # Temp-out activity
            if temp_out:
                activity.append({
                    "request_id": request_id,
                    "action": "Temp Check-Out",
                    "name": visitor,
                    "detail": "Visitor went outside temporarily",
                    "time": temp_out.strftime("%d %b %Y, %I:%M %p")
                })

            # Temp-in activity
            if temp_in:
                activity.append({
                    "request_id": request_id,
                    "action": "Temp Check-In",
                    "name": visitor,
                    "detail": "Visitor returned",
                    "time": temp_in.strftime("%d %b %Y, %I:%M %p")
                })

            # Check-out activity
            if checkout:
                detail = "Visitor exited"
                if manual_checkout:
                    detail += f" (Manual: {manual_checkout.strftime('%I:%M %p')})"
                activity.append({
                    "request_id": request_id,
                    "action": "Check-out",
                    "name": visitor,
                    "detail": detail,
                    "time": checkout.strftime("%d %b %Y, %I:%M %p")
                })

        # Sort the activity array so newest is first
        from datetime import datetime
        def get_time_obj(act):
            try:
                return datetime.strptime(act["time"], "%d %b %Y, %I:%M %p")
            except:
                return datetime.min
                
        activity.sort(key=get_time_obj, reverse=True)

        return jsonify(activity), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@request_bp.route("/api/visitor-requests/bulk", methods=["POST"])
def bulk_create_requests():
    caller_id, caller_role = get_current_user_from_request(request)
    if not caller_id:
        return jsonify({"error": "Authentication required"}), 401

    data = request.get_json()
    if not data or "visitors" not in data:
        return jsonify({"error": "No visitors data provided"}), 400

    from utils.auth_utils import get_user_site_scope, is_site_authorized

    # Determine site scope
    scope_type, allowed_site_ids = get_user_site_scope(caller_id, caller_role)
    raw_site_id = data.get("site_id") or request.headers.get("X-Site-ID")
    target_site_id = None
    if raw_site_id and str(raw_site_id).lower() != "all":
        try:
            target_site_id = int(raw_site_id)
        except (ValueError, TypeError):
            pass

    if not target_site_id and allowed_site_ids:
        target_site_id = allowed_site_ids[0]

    # Validate caller's authorization for target_site_id
    if caller_role not in ['superadmin', 'global_admin']:
        if target_site_id and not is_site_authorized(caller_id, caller_role, target_site_id):
            return jsonify({"error": "Access denied: Unauthorized to import visitors to this site."}), 403

    visitors_list = data.get("visitors", [])
    default_date = data.get("scheduled_date")
    if not default_date:
        from datetime import datetime
        default_date = datetime.now().strftime("%Y-%m-%d")

    default_time = data.get("scheduled_time") or "09:00:00"
    if len(default_time) == 5: # HH:MM format from html input
        default_time = f"{default_time}:00"
    
    raw_default_host_id = data.get("default_host_id")
    try:
        default_host_id = int(raw_default_host_id) if raw_default_host_id else None
    except (ValueError, TypeError):
        default_host_id = None

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        conn.begin()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        created_request_ids = []
        row_errors = []

        for index, item in enumerate(visitors_list):
            row_num = index + 1
            name = item.get("visitor_name") or item.get("name")
            mobile = item.get("mobile_number") or item.get("phone")
            email = item.get("email")
            purpose = item.get("purpose") or item.get("reasonOfVisit")
            location = item.get("location")
            unit = item.get("unit")

            if not name or not str(name).strip():
                row_errors.append(f"Row {row_num}: Visitor Name is required.")
                continue
            if not mobile or not str(mobile).strip():
                row_errors.append(f"Row {row_num}: Mobile Number is required.")
                continue
            
            mobile_str = str(mobile).strip()
            if not re.match(r"^\+?\d{7,15}$", mobile_str):
                row_errors.append(f"Row {row_num}: Mobile Number must be a valid universal format (7 to 15 digits, optionally starting with +).")
                continue

            if email and not re.match(r"[^@]+@[^@]+\.[^@]+", str(email).strip()):
                row_errors.append(f"Row {row_num}: Invalid email format.")
                continue

            if not location or not str(location).strip():
                row_errors.append(f"Row {row_num}: Location is required.")
                continue

            if not unit or not str(unit).strip():
                row_errors.append(f"Row {row_num}: Unit is required.")
                continue

            if not purpose or not str(purpose).strip():
                row_errors.append(f"Row {row_num}: Reason of visit is required.")
                continue

            id_type = item.get("id_proof_type") or item.get("typeOfIDProof")
            id_number = item.get("id_proof_number") or item.get("idProofNumber")
            if id_type == "Aadhar Card":
                if not id_number or not re.match(r"^\d{12}$", str(id_number)):
                    row_errors.append(f"Row {row_num}: Aadhar Card must be exactly 12 digits.")
                    continue
            elif id_type == "PAN Card":
                if not id_number or not re.match(r"^[A-Z0-9]{10}$", str(id_number).upper()):
                    row_errors.append(f"Row {row_num}: PAN Card must be exactly 10 alphanumeric characters.")
                    continue

            vehicle_number = item.get("vehicle_number") or item.get("vehicleNumber")
            if vehicle_number and str(vehicle_number).strip() != "":
                clean_vehicle = re.sub(r'[^A-Za-z0-9]', '', str(vehicle_number))
                if not re.match(r"^[A-Za-z]{2}\d{2}[A-Za-z]{1,2}\d{4}$", clean_vehicle):
                    row_errors.append(f"Row {row_num}: Invalid Indian vehicle number (e.g. MH12AB1234).")
                    continue

            if row_errors:
                continue

            host_id = None
            person_to_visit = item.get("person_to_visit") or item.get("personToVisit")
            if person_to_visit:
                cursor.execute("SELECT user_id FROM users WHERE LOWER(name) = LOWER(%s) LIMIT 1", (person_to_visit.strip(),))
                user_row = cursor.fetchone()
                if user_row:
                    host_id = user_row["user_id"]

            if not host_id:
                host_id = default_host_id

            cursor.execute("SELECT visitor_id FROM visitors WHERE mobile_number = %s LIMIT 1", (mobile_str,))
            existing_visitor = cursor.fetchone()
            vehicle_type = item.get("vehicle_type") or item.get("vehicleType")
            has_device = True if str(item.get("hasDevice")).lower() in ["yes", "true"] else False
            has_material = True if str(item.get("hasMaterial")).lower() in ["yes", "true", "1"] else False
            material_name = item.get("materialName") or item.get("material_name")
            material_quantity = item.get("materialQuantity") or item.get("material_quantity")
            material_serial_number = item.get("materialSerialNumber") or item.get("material_serial_number")

            if existing_visitor:
                visitor_id = existing_visitor["visitor_id"]
                cursor.execute("""
                    UPDATE visitors 
                    SET visitor_name = %s,
                        full_name = %s,
                        email = %s,
                        company_name = %s,
                        unit = %s,
                        department = %s,
                        location = %s,
                        id_proof_type = %s,
                        id_proof_number = %s,
                        person_to_visit = %s,
                        vehicle_type = %s,
                        vehicle_number = %s,
                        employee_id = %s,
                        has_device = %s,
                        device_type = %s,
                        device_make = %s,
                        device_serial_number = %s,
                        has_material = %s,
                        material_name = %s,
                        material_quantity = %s,
                        material_serial_number = %s
                    WHERE visitor_id = %s
                """, (
                    name, name, email, item.get("company_name") or item.get("companyName"),
                    unit, item.get("department"), location, id_type, id_number,
                    person_to_visit, vehicle_type, vehicle_number, str(host_id) if host_id else None,
                    has_device, item.get("deviceType"), item.get("deviceMake"), item.get("deviceSerialNumber"),
                    has_material, material_name, material_quantity, material_serial_number,
                    visitor_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO visitors (
                        visitor_name, full_name, email, mobile_number,
                        company_name, unit, department, location, id_proof_type,
                        id_proof_number, access_level, reason_of_visit, employee_id,
                        person_to_visit, vehicle_type, vehicle_number,
                        has_device, device_type, device_make, device_serial_number,
                        has_material, material_name, material_quantity, material_serial_number
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    name, name, email, mobile_str,
                    item.get("company_name") or item.get("companyName"), unit, item.get("department"),
                    location, id_type, id_number, item.get("access_level") or "Visitor (Level 1)",
                    purpose, str(host_id) if host_id else None, person_to_visit, vehicle_type, vehicle_number,
                    has_device, item.get("deviceType"), item.get("deviceMake"), item.get("deviceSerialNumber"),
                    has_material, material_name, material_quantity, material_serial_number
                ))
                visitor_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO visitor_requests (
                    visitor_id,
                    host_id,
                    site_id,
                    purpose,
                    scheduled_date,
                    scheduled_time,
                    has_device,
                    device_type,
                    device_make,
                    device_serial_number,
                    has_material,
                    material_name,
                    material_quantity,
                    material_serial_number,
                    status,
                    created_at,
                    approved_by,
                    approved_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'APPROVED', NOW(), %s, NOW())
            """, (
                visitor_id, host_id, target_site_id, purpose,
                default_date, default_time,
                has_device, item.get("deviceType"), item.get("deviceMake"), item.get("deviceSerialNumber"),
                has_material, material_name, material_quantity, material_serial_number,
                default_host_id
            ))
            created_request_ids.append(cursor.lastrowid)

        if row_errors:
            conn.rollback()
            return jsonify({"errors": row_errors}), 400

        conn.commit()
        return jsonify({
            "message": f"Successfully imported {len(created_request_ids)} visitors.",
            "request_ids": created_request_ids
        }), 201

    except Exception as e:
        print(f"ERROR in bulk upload: {str(e)}")
        conn.rollback()
        return jsonify({"error": f"Database transaction failed: {str(e)}"}), 500
    finally:
        conn.close()


@request_bp.route("/api/visitor-requests/bulk-template", methods=["GET"])
def download_bulk_template():
    import pandas as pd
    import io
    from flask import send_file
    
    headers = [
        "Visitor Name",
        "Mobile Number",
        "Email",
        "Company Name",
        "Person to Visit",
        "Unit",
        "Department",
        "Location",
        "Reason of Visit",
        "Access Level",
        "Type of ID Proof",
        "ID Proof Number",
        "Has Device (Yes/No)",
        "Device Type",
        "Device Make",
        "Device Serial",
        "Has Material (Yes/No)",
        "Material Name",
        "Material Quantity",
        "Material Serial",
        "Vehicle Type",
        "Vehicle Number"
    ]
    sample_row = [
        "John Doe",
        "9876543210",
        "john.doe@example.com",
        "Acme Corp",
        "Kunal Malekar",
        "UDF-Kasarwadi",
        "Engineering",
        "Pune",
        "Meeting",
        "Visitor (Level 1)",
        "Aadhar Card",
        "123456789012",
        "No",
        "",
        "",
        "",
        "No",
        "",
        "",
        "",
        "4 Wheeler",
        "MH12AB1234"
    ]
    
    df = pd.DataFrame([sample_row], columns=headers)
    format_type = request.args.get("format", "xlsx").lower()
    
    if format_type == "csv":
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        output = io.BytesIO(csv_buffer.getvalue().encode('utf-8'))
        output.seek(0)
        return send_file(
            output,
            download_name="vms_bulk_visitor_template.csv",
            as_attachment=True,
            mimetype="text/csv"
        )
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Template')
        worksheet = writer.sheets['Template']
        workbook = writer.book
        
        # Freeze top row (row 1)
        worksheet.freeze_panes(1, 0)
        
        # Formats
        header_format_mandatory = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'vcenter',
            'align': 'center',
            'fg_color': '#FFD966', # Darker Gold/Yellow
            'font_color': '#3F3000', # Very Dark Gold/Brown
            'border': 1
        })
        
        header_format_optional = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'vcenter',
            'align': 'center',
            'fg_color': '#E2EFDA', # Soft Light Green
            'font_color': '#375623', # Dark Green
            'border': 1
        })
        
        mandatory_headers = {"Visitor Name", "Mobile Number", "Person to Visit", "Unit", "Location", "Reason of Visit", "Has Device (Yes/No)"}
        
        # Write headers with colors and formatting
        for col_num, header in enumerate(headers):
            if header in mandatory_headers:
                header_text = f"{header} *"
                worksheet.write(0, col_num, header_text, header_format_mandatory)
            else:
                worksheet.write(0, col_num, header, header_format_optional)
        
        # Auto-adjust column widths
        for i, col in enumerate(df.columns):
            column_len = max(df[col].astype(str).str.len().max(), len(col)) + 6
            worksheet.set_column(i, i, column_len)

        # Instructions Sheet
        instructions_data = [
            ["Column Name", "Requirement", "Allowed Values / Examples", "Validation Rules"],
            ["Visitor Name *", "Required", "e.g., John Doe", "Letters and spaces"],
            ["Mobile Number *", "Required", "e.g., 9876543210 or +919876543210", "7 to 15 digits (international format allowed)"],
            ["Email", "Optional", "e.g., visitor@example.com", "Valid email address format"],
            ["Company Name", "Optional", "e.g., Acme Technologies", "Free text"],
            ["Person to Visit *", "Required", "e.g., Host full name", "Must match an existing registered user"],
            ["Unit *", "Required", "Pune Eduction Foundation-Kasarwadi, Sason-Kasarwadi, Humankind-Kasarwadi, UDF-Kasarwadi, Eagle-Kasarwadi", "Select valid facility unit"],
            ["Department", "Optional", "IT, HR, Operations, Sales & Marketing, Accounts, Legal, Store", "Department name"],
            ["Location *", "Required", "e.g., Pune, Mumbai, Bangalore", "Site or city location"],
            ["Reason of Visit *", "Required", "Meeting, Interview, Police Verification, Document Verification, Delivery, Contractor Work, Audit, IT, Other", "Standard visit reason"],
            ["Access Level", "Optional", "Visitor (Level 1), Vendor (Level 2), Security (Level 3), Host (Level 4), Admin (Level 5)", "Default: Visitor (Level 1)"],
            ["Type of ID Proof", "Optional", "Aadhar Card, PAN Card, Driving License, Passport, Voter ID", "Valid government ID"],
            ["ID Proof Number", "Optional", "e.g., 123456789012 (Aadhar 12 digits), ABCDE1234F (PAN 10 chars)", "Validated if Aadhar/PAN"],
            ["Has Device (Yes/No) *", "Required", "Yes or No", "Defaults to No"],
            ["Device Type", "Optional", "e.g., Laptop, Tablet", "Required if Has Device is Yes"],
            ["Device Make", "Optional", "e.g., Dell, Apple, Lenovo", "Device manufacturer"],
            ["Device Serial", "Optional", "e.g., SN12345678", "Hardware serial number"],
            ["Has Material (Yes/No)", "Optional", "Yes or No", "Defaults to No"],
            ["Material Name", "Optional", "e.g., Tool kit, Projector", "Material description"],
            ["Material Quantity", "Optional", "e.g., 1, 5", "Numeric quantity"],
            ["Material Serial", "Optional", "e.g., MAT-098", "Tracking identifier"],
            ["Vehicle Type", "Optional", "2 Wheeler, 4 Wheeler, Commercial", "Vehicle category"],
            ["Vehicle Number", "Optional", "e.g., MH12AB1234", "Format: 2 state letters + 2 district digits + 1-2 series letters + 4 digits"]
        ]
        inst_df = pd.DataFrame(instructions_data[1:], columns=instructions_data[0])
        inst_df.to_excel(writer, index=False, sheet_name='Allowed Values & Guidelines')
        inst_worksheet = writer.sheets['Allowed Values & Guidelines']
        inst_header_fmt = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1})
        for c_idx, h in enumerate(instructions_data[0]):
            inst_worksheet.write(0, c_idx, h, inst_header_fmt)
        for idx, col in enumerate(inst_df.columns):
            inst_worksheet.set_column(idx, idx, max(inst_df[col].astype(str).str.len().max(), len(col)) + 4)
            
    output.seek(0)
    return send_file(
        output,
        download_name="vms_bulk_visitor_template.xlsx",
        as_attachment=True,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@request_bp.route("/api/visitor-requests/parse-excel", methods=["POST"])
@request_bp.route("/api/visitor-requests/parse_excel", methods=["POST"])
@request_bp.route("/api/visitor_requests/parse-excel", methods=["POST"])
@request_bp.route("/api/visitor_requests/parse_excel", methods=["POST"])
def parse_bulk_excel():
    import pandas as pd
    import io
    import csv
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
        
    filename = file.filename.lower()
    try:
        raw_bytes = file.read()
        if not raw_bytes:
            return jsonify({"error": "The uploaded file is empty."}), 400

        df = None

        # 1. Automatic Excel signature detection (handles misnamed .csv or .xlsx)
        if raw_bytes.startswith(b"PK\x03\x04") or raw_bytes.startswith(b"\xd0\xcf\x11\xe0"):
            try:
                df = pd.read_excel(io.BytesIO(raw_bytes))
            except Exception as ex:
                return jsonify({"error": f"Failed to parse Excel workbook: {str(ex)}"}), 400

        # 2. UTF-16 BOM or wide-character CSV detection (Excel 'Unicode Text' export)
        elif raw_bytes.startswith(b"\xff\xfe") or raw_bytes.startswith(b"\xfe\xff") or (b"\x00" in raw_bytes[:60]):
            for enc in ["utf-16", "utf-16-le", "utf-16-be"]:
                try:
                    df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc, sep=None, engine="python", on_bad_lines="skip")
                    break
                except Exception:
                    try:
                        df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc, on_bad_lines="skip")
                        break
                    except Exception:
                        continue

        # 3. Standard Text CSV / TSV encodings with automatic delimiter detection
        if df is None:
            encodings = ["utf-8-sig", "utf-8", "cp1252", "latin1", "iso-8859-1"]
            for enc in encodings:
                try:
                    df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc, sep=None, engine="python", on_bad_lines="skip")
                    break
                except Exception:
                    try:
                        df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc, on_bad_lines="skip")
                        break
                    except Exception:
                        continue

        # 4. Standard Python csv.reader fallback
        if df is None:
            for enc in ["utf-8-sig", "utf-8", "cp1252", "latin1"]:
                try:
                    text = raw_bytes.decode(enc)
                    lines = [l for l in text.splitlines() if l.strip()]
                    if not lines:
                        continue
                    sample = "\n".join(lines[:5])
                    try:
                        dialect = csv.Sniffer().sniff(sample)
                        delimiter = dialect.delimiter
                    except Exception:
                        delimiter = ";" if ";" in lines[0] else "\t" if "\t" in lines[0] else ","
                    
                    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
                    rows = list(reader)
                    if len(rows) > 1:
                        df = pd.DataFrame(rows[1:], columns=rows[0])
                        break
                except Exception:
                    continue

        # 5. Last resort fallback: read_excel
        if df is None:
            try:
                df = pd.read_excel(io.BytesIO(raw_bytes))
            except Exception:
                pass

        if df is None:
            return jsonify({"error": "Could not parse file. Please verify it is a valid Excel (.xlsx/.xls) or CSV file."}), 400
            
        # Clean columns to lowercase and remove BOM / asterisks for mapping
        df.columns = [
            str(c).replace("\ufeff", "").replace("\xef\xbb\xbf", "").strip().lower().replace("*", "").strip() 
            for c in df.columns
        ]
        
        # Mappings
        HEADER_MAPPING = {
            "visitor name": "name",
            "name": "name",
            "mobile number": "phone",
            "mobile": "phone",
            "phone number": "phone",
            "phone": "phone",
            "email id": "email",
            "email": "email",
            "company name": "companyName",
            "company": "companyName",
            "person to visit": "personToVisit",
            "host": "personToVisit",
            "unit": "unit",
            "department": "department",
            "location": "location",
            "reason of visit": "reasonOfVisit",
            "reason": "reasonOfVisit",
            "purpose": "reasonOfVisit",
            "has device": "hasDevice",
            "has device (yes/no)": "hasDevice",
            "carrying device": "hasDevice",
            "device type": "deviceType",
            "device make": "deviceMake",
            "device serial": "deviceSerialNumber",
            "device serial number": "deviceSerialNumber",
            "access level": "accessLevel",
            "type of id proof": "typeOfIDProof",
            "id proof type": "typeOfIDProof",
            "id proof number": "idProofNumber",
            "id number": "idProofNumber",
            "has material": "hasMaterial",
            "has material (yes/no)": "hasMaterial",
            "material name": "materialName",
            "material quantity": "materialQuantity",
            "material serial": "materialSerialNumber",
            "material serial number": "materialSerialNumber",
            "vehicle type": "vehicleType",
            "vehicle number": "vehicleNumber"
        }
        
        parsed_visitors = []
        for index, row in df.iterrows():
            # Skip completely empty rows
            if row.dropna().empty:
                continue
                
            visitor = {
                "name": "", "phone": "", "email": "", "companyName": "",
                "personToVisit": "", "unit": "", "department": "", "location": "",
                "reasonOfVisit": "Meeting", "accessLevel": "Visitor (Level 1)",
                "typeOfIDProof": "", "idProofNumber": "",
                "hasDevice": "No", "deviceType": "", "deviceMake": "", "deviceSerialNumber": "",
                "hasMaterial": "No", "materialName": "", "materialQuantity": "", "materialSerialNumber": "",
                "vehicleType": "", "vehicleNumber": ""
            }
            # Fill mapped keys
            for col in df.columns:
                key = HEADER_MAPPING.get(col)
                if key:
                    val = row[col]
                    if pd.isna(val):
                        val = ""
                    else:
                        # Convert float numbers (e.g. phone numbers) to string without .0
                        if isinstance(val, float) and val.is_integer():
                            val = str(int(val))
                        else:
                            val = str(val).strip()
                    visitor[key] = val
            
            # Simple normalization
            if visitor["hasDevice"] and str(visitor["hasDevice"]).lower().startswith("y"):
                visitor["hasDevice"] = "Yes"
            else:
                visitor["hasDevice"] = "No"
                
            parsed_visitors.append(visitor)
            
        return jsonify({"visitors": parsed_visitors}), 200
        
    except Exception as e:
        return jsonify({"error": f"Failed to parse file: {str(e)}"}), 500