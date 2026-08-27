from flask import Blueprint, request, jsonify
import pymysql.cursors
from db import get_db_connection
from werkzeug.utils import secure_filename
import os
import time
import re

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
            
            # 2. Update visitors table for device columns (fix mismatch bug)
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

        cursor.execute("""
            SELECT vr.*, 
                   v.visitor_name, v.full_name, v.email, v.mobile_number, v.pabx_number,
                   v.company_name, v.unit, v.department, v.location,
                   v.id_proof_type, v.id_proof_number, v.access_level,
                   v.reason_of_visit, v.employee_id, v.photo, v.person_to_visit,
                   v.vehicle_type, v.vehicle_number, v.vehicle_photo_front, v.vehicle_photo_side,
                   v.has_device, v.device_type, v.device_make, v.device_serial_number,
                   u.name AS transfer_from_host_name
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            LEFT JOIN users u ON vr.transfer_from_host_id = u.user_id
            ORDER BY vr.created_at DESC
        """)

        requests = cursor.fetchall()

        # 🔄 Clean and format data for JSON serialization
        from datetime import datetime, date, time
        for req in requests:
            for key, value in req.items():
                if value is not None:
                    if isinstance(value, datetime):
                        req[key] = value.strftime("%d %b %Y, %I:%M %p")
                    elif isinstance(value, date):
                        req[key] = value.strftime("%Y-%m-%d")
                    elif isinstance(value, time):
                        req[key] = value.strftime("%I:%M %p")
                    elif not isinstance(value, (int, float, str, bool)):
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

        if existing_visitor:
            visitor_id = existing_visitor["visitor_id"]
            print(f"Using existing visitor ID: {visitor_id}")
            
            # Update existing visitor details (specifically vehicle, photos, and devices if provided)
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
                "employee_id": data.get("host_id"),
                "photo": photo_path,
                "person_to_visit": data.get("person_to_visit") or data.get("personToVisit"),
                "vehicle_type": data.get("vehicle_type") or data.get("vehicleType"),
                "vehicle_number": data.get("vehicle_number") or data.get("vehicleNumber"),
                "vehicle_photo_front": vehicle_photo_front_path,
                "vehicle_photo_side": vehicle_photo_side_path,
                "has_device": has_device,
                "device_type": data.get("deviceType"),
                "device_make": data.get("deviceMake"),
                "device_serial_number": data.get("deviceSerialNumber")
            }

            cursor.execute("""
                INSERT INTO visitors (
                    visitor_name, full_name, email, mobile_number, pabx_number,
                    company_name, unit, department, location, id_proof_type,
                    id_proof_number, access_level, reason_of_visit, employee_id,
                    photo, person_to_visit, vehicle_type, vehicle_number,
                    vehicle_photo_front, vehicle_photo_side, has_device,
                    device_type, device_make, device_serial_number
                )
                VALUES (
                    %(visitor_name)s, %(full_name)s, %(email)s, %(mobile_number)s, 
                    %(pabx_number)s, %(company_name)s, %(unit)s, %(department)s, 
                    %(location)s, %(id_proof_type)s, %(id_proof_number)s, %(access_level)s, 
                    %(reason_of_visit)s, %(employee_id)s, %(photo)s, %(person_to_visit)s,
                    %(vehicle_type)s, %(vehicle_number)s, %(vehicle_photo_front)s, %(vehicle_photo_side)s,
                    %(has_device)s, %(device_type)s, %(device_make)s, %(device_serial_number)s
                )
            """, visitor_data)
            visitor_id = cursor.lastrowid

        # 2️⃣ Insert request
        # Ensure host_id is an integer or None
        raw_host_id = data.get("host_id")
        try:
            host_id = int(raw_host_id) if raw_host_id and str(raw_host_id).strip() != "" else None
        except (ValueError, TypeError):
            host_id = None

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

        request_data = {
            "visitor_id": visitor_id,
            "host_id": host_id,
            "purpose": data.get("purpose"),
            "scheduled_date": sched_date_val,
            "scheduled_time": sched_time_val
        }

        cursor.execute("""
            INSERT INTO visitor_requests (
                visitor_id,
                host_id,
                purpose,
                scheduled_date,
                scheduled_time,
                status,
                created_at
            )
            VALUES (
                %(visitor_id)s, %(host_id)s, %(purpose)s, 
                %(scheduled_date)s, %(scheduled_time)s, 'PENDING', NOW()
            )
        """, request_data)

        new_request_id = cursor.lastrowid
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
    data = request.get_json()
    conn = get_db_connection()

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        approver_id = data.get("approved_by")

        # Check if this is a transfer request
        cursor.execute("SELECT parent_request_id, visitor_id FROM visitor_requests WHERE request_id = %s", (request_id,))
        request_row = cursor.fetchone()
        
        if not request_row:
            return jsonify({"error": "Request not found"}), 404
            
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
        
        # Retrieve the approver's name to update visitors.person_to_visit
        cursor.execute("SELECT name FROM users WHERE user_id = %s", (approver_id,))
        approver_row = cursor.fetchone()
        approver_name = approver_row["name"] if approver_row else ""

        cursor.execute("""
            UPDATE visitors
            SET employee_id = %s,
                person_to_visit = %s
            WHERE visitor_id = %s
        """, (str(approver_id), approver_name, visitor_id))

        cursor.execute("""
            UPDATE visitor_requests
            SET host_id = %s
            WHERE request_id = %s AND host_id IS NULL
        """, (approver_id, request_id))

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
    data = request.get_json()
    conn = get_db_connection()

    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE visitor_requests
            SET status='REJECTED',
                approved_by=%s,
                approved_at=NOW()
            WHERE request_id=%s
        """, (data.get("approved_by"), request_id))

        conn.commit()
        return jsonify({"message": "Rejected"}), 200

    finally:
        conn.close()

@request_bp.route("/api/visitor-requests/<int:request_id>/transfer", methods=["POST"])
def transfer_visitor(request_id):
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

        # 1. Verify original request and check if visitor is currently inside or approved
        cursor.execute("""
            SELECT visitor_id, host_id, check_in_time, check_out_time, status 
            FROM visitor_requests 
            WHERE request_id = %s
        """, (request_id,))
        original_req = cursor.fetchone()

        if not original_req:
            return jsonify({"error": "Original visit request not found"}), 404

        if original_req["check_out_time"] or original_req["status"] == "Checked Out":
            return jsonify({"error": "Visitor has already checked out"}), 400

        # 2. Check if a pending transfer already exists for this request
        cursor.execute("""
            SELECT request_id FROM visitor_requests 
            WHERE parent_request_id = %s AND status = 'PENDING_TRANSFER'
        """, (request_id,))
        if cursor.fetchone():
            return jsonify({"error": "A transfer request is already pending for this visitor"}), 400

        # 3. Verify target host exists
        cursor.execute("SELECT name FROM users WHERE user_id = %s AND role = 'host'", (to_host_id,))
        target_host = cursor.fetchone()
        if not target_host:
            return jsonify({"error": "Target host not found or user is not a host"}), 404

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
                transfer_from_host_id
            )
            VALUES (
                %s, %s, %s, CURRENT_DATE, CURRENT_TIME, 'PENDING_TRANSFER', NOW(), %s, %s
            )
        """, (
            original_req["visitor_id"],
            to_host_id,
            f"Transfer: {purpose}",
            request_id,
            original_req["host_id"]
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
    data = request.get_json()
    if not data or "visitors" not in data:
        return jsonify({"error": "No visitors data provided"}), 400

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
                        device_serial_number = %s
                    WHERE visitor_id = %s
                """, (
                    name, name, email, item.get("company_name") or item.get("companyName"),
                    unit, item.get("department"), location, id_type, id_number,
                    person_to_visit, vehicle_type, vehicle_number, str(host_id) if host_id else None,
                    has_device, item.get("deviceType"), item.get("deviceMake"), item.get("deviceSerialNumber"),
                    visitor_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO visitors (
                        visitor_name, full_name, email, mobile_number,
                        company_name, unit, department, location, id_proof_type,
                        id_proof_number, access_level, reason_of_visit, employee_id,
                        person_to_visit, vehicle_type, vehicle_number,
                        has_device, device_type, device_make, device_serial_number
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    name, name, email, mobile_str,
                    item.get("company_name") or item.get("companyName"), unit, item.get("department"),
                    location, id_type, id_number, item.get("access_level") or "Visitor (Level 1)",
                    purpose, str(host_id) if host_id else None, person_to_visit, vehicle_type, vehicle_number,
                    has_device, item.get("deviceType"), item.get("deviceMake"), item.get("deviceSerialNumber")
                ))
                visitor_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO visitor_requests (
                    visitor_id,
                    host_id,
                    purpose,
                    scheduled_date,
                    scheduled_time,
                    status,
                    created_at,
                    approved_by,
                    approved_at
                )
                VALUES (%s, %s, %s, %s, %s, 'APPROVED', NOW(), %s, NOW())
            """, (
                visitor_id, host_id, purpose,
                default_date, default_time,
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
        "Has Device (Yes/No)",
        "Device Type",
        "Device Make",
        "Device Serial",
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
        "No",
        "",
        "",
        "",
        "",
        ""
    ]
    
    df = pd.DataFrame([sample_row], columns=headers)
    
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
            
    output.seek(0)
    return send_file(
        output,
        download_name="vms_bulk_visitor_template.xlsx",
        as_attachment=True,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@request_bp.route("/api/visitor-requests/parse-excel", methods=["POST"])
def parse_bulk_excel():
    import pandas as pd
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
        
    filename = file.filename.lower()
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(file)
        elif filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(file)
        else:
            return jsonify({"error": "Unsupported file format. Please upload an Excel (.xlsx/.xls) or CSV file."}), 400
            
        # Clean columns to lowercase and remove asterisks for mapping
        df.columns = [str(c).strip().lower().replace("*", "").strip() for c in df.columns]
        
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
            "serial": "deviceSerialNumber",
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
                "reasonOfVisit": "Meeting", "hasDevice": "No", "deviceType": "",
                "deviceMake": "", "deviceSerialNumber": "", "vehicleType": "", "vehicleNumber": ""
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