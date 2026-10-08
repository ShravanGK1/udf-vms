from flask import Blueprint, jsonify, request
from db import get_db_connection
from flask import request
import time
import re
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timedelta, date
import pymysql.cursors
from routes.request_routes import auto_expire_past_requests
from utils.signature_utils import save_signature_image

security_bp = Blueprint("security", __name__)


# ---------------------------------------------------
# SECURITY DASHBOARD STATS
# ---------------------------------------------------

@security_bp.route("/api/security/dashboard", methods=["GET"])
def security_dashboard():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Automatically expire un-checked-in past scheduled requests
        auto_expire_past_requests(cursor)
        conn.commit()

        cursor.execute("""
            SELECT COUNT(*)
            FROM visitor_requests
            WHERE check_in_time IS NOT NULL
            AND check_out_time IS NULL
        """)
        visitors_inside = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*)
            FROM visitor_requests
            WHERE status = 'APPROVED'
            AND check_in_time IS NULL
            AND scheduled_date = CURRENT_DATE
        """)
        expected_today = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*)
            FROM visitor_requests
            WHERE status = 'PENDING'
            AND scheduled_date = CURRENT_DATE
        """)
        pending_approval = cursor.fetchone()[0]

        cursor.execute("""
            SELECT check_in_time, is_multi_day, valid_till 
            FROM visitor_requests 
            WHERE check_in_time IS NOT NULL 
            AND check_out_time IS NULL
        """)
        live_visitors_times = cursor.fetchall()
        overstay = 0
        now = datetime.now()
        for row in live_visitors_times:
            cit = row[0]
            is_multi = bool(row[1]) if len(row) > 1 and row[1] is not None else False
            v_till = row[2] if len(row) > 2 else None

            if is_multi and v_till:
                try:
                    if isinstance(v_till, str):
                        v_till_date = datetime.strptime(v_till.split("T")[0], "%Y-%m-%d").date()
                    elif hasattr(v_till, "date"):
                        v_till_date = v_till.date()
                    elif isinstance(v_till, date):
                        v_till_date = v_till
                    else:
                        v_till_date = None
                    if v_till_date and now.date() > v_till_date:
                        overstay += 1
                except Exception as ex:
                    print("Error checking multi-day overstay in dashboard:", ex)
            else:
                if cit and isinstance(cit, datetime) and now - cit > timedelta(hours=2):
                    overstay += 1

        conn.close()

        return jsonify({
            "visitors_inside": visitors_inside,
            "expected_today": expected_today,
            "pending_approval": pending_approval,
            "overstay_alerts": overstay
        })

    except Exception as e:
        print("[ERROR] dashboard:", e)
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------
# LIVE VISITORS
# ---------------------------------------------------
@security_bp.route("/api/security/live-visitors", methods=["GET"])
def live_visitors():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT
                vr.request_id,
                vr.is_multi_day,
                vr.valid_till,
                vr.purpose as "reasonOfVisit",
                vr.purpose,
                vr.scheduled_date,
                vr.scheduled_time,
                vr.check_in_time,
                vr.check_out_time,
                vr.is_temp_out,
                vr.physical_badge_no as "physical_badge_no",
                vr.signature_path as "signature_path",
                vr.checkout_signature_path as "checkout_signature_path",
                v.visitor_name as name,
                v.company_name as company,
                v.company_name as "companyName",
                v.person_to_visit as host,
                v.person_to_visit as "personToVisit",
                v.photo,
                v.email,
                v.mobile_number as phone,
                v.mobile_number,
                v.pabx_number as pabx,
                v.unit,
                v.department,
                v.location,
                v.access_level as "accessLevel",
                v.access_level,
                v.id_proof_type as "typeOfIDProof",
                v.id_proof_number as "idProofNumber",
                v.has_device as "hasDevice",
                v.device_type as "deviceType",
                v.device_make as "deviceMake",
                v.device_serial_number as "deviceSerialNumber",
                v.has_material as "hasMaterial",
                v.material_name as "materialName",
                v.material_quantity as "materialQuantity",
                v.material_serial_number as "materialSerialNumber",
                v.vehicle_type as "vehicleType",
                v.vehicle_number as "vehicleNumber",
                v.vehicle_photo_front as "vehiclePhotoFront",
                v.vehicle_photo_side as "vehiclePhotoSide",
                approver.name as approver,
                approver.user_id as employee_id
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            LEFT JOIN users approver ON vr.approved_by = approver.user_id
            WHERE vr.check_in_time IS NOT NULL
            AND vr.check_out_time IS NULL
            ORDER BY vr.check_in_time DESC
        """)

        rows = cursor.fetchall()
        visitors = []

        for r in rows:
            check_in_time = r.get("check_in_time")
            is_multi_day = bool(r.get("is_multi_day"))
            valid_till = r.get("valid_till")
            is_temp_out = bool(r.get("is_temp_out"))
            status = "Inside"

            if is_temp_out:
                status = "Temp Out"
            else:
                now = datetime.now()
                if is_multi_day and valid_till:
                    try:
                        if isinstance(valid_till, str):
                            till_date = datetime.strptime(valid_till.split("T")[0], "%Y-%m-%d").date()
                        elif hasattr(valid_till, "date"):
                            till_date = valid_till.date()
                        elif isinstance(valid_till, date):
                            till_date = valid_till
                        else:
                            till_date = None
                        if till_date and now.date() > till_date:
                            status = "Overstay"
                    except Exception as ex:
                        print("Error checking multi-day overstay in live_visitors:", ex)
                else:
                    if check_in_time and isinstance(check_in_time, datetime) and now - check_in_time > timedelta(hours=2):
                        status = "Overstay"

            r["badge"] = f"V-{r['request_id']}"
            r["physical_badge"] = r.get("physical_badge_no") or None
            r["signature_url"] = f"/{r['signature_path']}" if r.get("signature_path") else None
            r["checkout_signature_url"] = f"/{r['checkout_signature_path']}" if r.get("checkout_signature_path") else None
            r["status"] = status
            r["checkIn"] = check_in_time.strftime("%d %b %Y, %I:%M %p") if check_in_time and isinstance(check_in_time, datetime) else str(check_in_time or "-")
            if r.get("scheduled_date"):
                r["scheduled_date"] = str(r["scheduled_date"])
            if r.get("valid_till"):
                r["valid_till"] = str(r["valid_till"])
            if r.get("scheduled_time"):
                r["scheduled_time"] = str(r["scheduled_time"])
            if r.get("check_in_time"):
                r["check_in_time"] = str(r["check_in_time"])
            visitors.append(r)

        conn.close()
        return jsonify(visitors)

    except Exception as e:
        print("[ERROR] live_visitors:", e)
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------
# EXPECTED VISITORS
# ---------------------------------------------------

@security_bp.route("/api/security/expected-visitors", methods=["GET"])
def expected_visitors():

    conn = get_db_connection()
    cursor = conn.cursor()
    auto_expire_past_requests(cursor)
    conn.commit()

    cursor.execute("""
    SELECT
    vr.request_id,
    v.visitor_name,
    v.company_name,
    v.person_to_visit,
    vr.purpose,
    vr.scheduled_time,
    v.access_level,
    v.employee_id
    FROM visitor_requests vr
    LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
    WHERE vr.status = 'APPROVED'
    AND vr.check_in_time IS NULL
    AND vr.scheduled_date = CURRENT_DATE
    ORDER BY vr.scheduled_time
""")
    rows = cursor.fetchall()

    visitors = []

    for r in rows:
        visitors.append({
            "id": r[0],
            "request_id": r[0],
            "name": r[1],
            "company": r[2],
            "company_name": r[2],
            "host": r[3],
            "purpose": r[4],
            "time": str(r[5]),
            "access_level": r[6],
            "employee_id": r[7]
        })

    conn.close()
    return jsonify(visitors)


# ---------------------------------------------------
# PENDING REQUESTS
# ---------------------------------------------------

@security_bp.route("/api/security/pending-requests", methods=["GET"])
def pending_requests():

    conn = get_db_connection()
    cursor = conn.cursor()
    auto_expire_past_requests(cursor)
    conn.commit()

    cursor.execute("""
    SELECT
    vr.request_id,
    v.visitor_name,
    v.company_name,
    v.mobile_number,
    v.person_to_visit,
    vr.purpose,
    v.access_level,
    v.employee_id
    FROM visitor_requests vr
    JOIN visitors v ON vr.visitor_id = v.visitor_id
    WHERE vr.status = 'PENDING'
    AND vr.scheduled_date = CURRENT_DATE
    ORDER BY vr.created_at DESC
""")

    rows = cursor.fetchall()

    requests = []

    for r in rows:
        requests.append({
            "id": r[0],
            "request_id": r[0],
            "name": r[1],
            "company": r[2],
            "company_name": r[2],
            "mobile": r[3],
            "host": r[4],
            "purpose": r[5],
            "time": "Just now",
            "access_level": r[6],
            "employee_id": r[7]
        })

    conn.close()
    return jsonify(requests)


# ---------------------------------------------------
# CHECK IN VISITOR
# ---------------------------------------------------

@security_bp.route("/api/security/checkin/<int:request_id>", methods=["POST"])
def checkin_visitor(request_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    data = request.get_json() or {}
    physical_badge = data.get("physical_badge_no") or data.get("physical_badge") or data.get("badge")
    if isinstance(physical_badge, str):
        physical_badge = physical_badge.strip()
    if not physical_badge:
        physical_badge = None

    signature_data = data.get("signature")
    try:
        signature_path = save_signature_image(signature_data, request_id)
    except ValueError as err:
        conn.close()
        return jsonify({"error": str(err)}), 400
    except Exception as err:
        conn.close()
        return jsonify({"error": f"Failed to process signature: {str(err)}"}), 500

    # Extract checked_in_by user ID
    checked_in_by = data.get("checked_in_by") or data.get("user_id")
    if not checked_in_by:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                import jwt
                from config import SECRET_KEY
                token = auth_header.split(" ")[1]
                payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
                checked_in_by = payload.get("user_id")
            except Exception:
                pass

    if physical_badge:
        cursor.execute("""
            UPDATE visitor_requests
            SET check_in_time = NOW(), physical_badge_no = %s, signature_path = %s, checked_in_by = %s
            WHERE request_id = %s
        """, (physical_badge, signature_path, checked_in_by, request_id))
    else:
        cursor.execute("""
            UPDATE visitor_requests
            SET check_in_time = NOW(), signature_path = %s, checked_in_by = %s
            WHERE request_id = %s
        """, (signature_path, checked_in_by, request_id))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Visitor checked in successfully",
        "physical_badge_no": physical_badge,
        "signature_path": signature_path,
        "signature_url": f"/{signature_path}" if signature_path else None
    }), 200


# ---------------------------------------------------
# REASSIGN / UPDATE PHYSICAL BADGE
# ---------------------------------------------------
@security_bp.route("/api/security/reassign-badge/<int:request_id>", methods=["PUT", "POST"])
def reassign_badge(request_id):
    try:
        data = request.get_json() or {}
        physical_badge = data.get("physical_badge_no") or data.get("physical_badge") or data.get("badge")
        if isinstance(physical_badge, str):
            physical_badge = physical_badge.strip()
        if not physical_badge:
            physical_badge = None

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE visitor_requests
            SET physical_badge_no = %s
            WHERE request_id = %s
        """, (physical_badge, request_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Physical badge updated successfully", "physical_badge_no": physical_badge})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------
# EXPIRED VISITS
# ---------------------------------------------------
@security_bp.route("/api/security/expired-visits", methods=["GET"])
def expired_visits():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        auto_expire_past_requests(cursor)
        conn.commit()
        
        filter_type = request.args.get("filter", "all")
        
        query = """
            SELECT
            vr.request_id,
            v.visitor_name,
            v.company_name,
            v.person_to_visit,
            vr.purpose,
            vr.created_at,
            v.access_level
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE (
                vr.status = 'EXPIRED'
                OR (vr.check_in_time IS NULL AND vr.scheduled_date < CURRENT_DATE)
            )
        """
        
        if filter_type == "week":
            query += " AND vr.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)"
        elif filter_type == "month":
            query += " AND vr.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        elif filter_type == "quarter":
            query += " AND vr.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)"
        elif filter_type == "year":
            query += " AND vr.created_at >= DATE_SUB(NOW(), INTERVAL 365 DAY)"
            
        query += " ORDER BY vr.created_at DESC"
        
        cursor.execute(query)
        
        rows = cursor.fetchall()
        expired = []
        for r in rows:
            expired.append({
                "id": r[0],
                "request_id": r[0],
                "name": r[1],
                "company": r[2],
                "company_name": r[2],
                "host": r[3],
                "purpose": r[4],
                "created_at": str(r[5]),
                "access_level": r[6]
            })
            
        conn.close()
        return jsonify(expired)
        
    except Exception as e:
        print("[ERROR] expired_visits:", e)
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------
# CHECK OUT VISITOR
# ---------------------------------------------------

def validate_manual_checkout_time(manual_checkout_str):
    if not manual_checkout_str or manual_checkout_str == "-":
        return None
    try:
        dt_str = manual_checkout_str.replace("T", " ")
        if len(dt_str) == 16:
            dt_str += ":00"
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        if dt > datetime.now():
            return "Manual check-out time cannot be in the future!"
    except Exception as e:
        print("[ERROR] validate_manual_checkout_time parse error:", e)
        return "Invalid manual check-out time format."
    return None

@security_bp.route("/api/security/checkout/<int:request_id>", methods=["POST"])
def checkout_visitor(request_id):
    manual_checkout_val = None
    signature_data = None
    try:
        if request.is_json:
            data = request.get_json() or {}
            manual_checkout = data.get("manualCheckOutTime")
            if manual_checkout and manual_checkout != "-":
                err = validate_manual_checkout_time(manual_checkout)
                if err:
                    return jsonify({"error": err}), 400
                manual_checkout_val = manual_checkout.replace("T", " ")
                if len(manual_checkout_val) == 16:
                    manual_checkout_val += ":00"
            signature_data = data.get("checkout_signature") or data.get("signature")
    except Exception as e:
        print("[ERROR] checkout_visitor parse payload error:", e)

    # Validate and save checkout signature (Mandatory for Permanent Checkout)
    try:
        checkout_signature_path = save_signature_image(
            signature_data,
            request_id,
            prefix="checkout_sig_",
            action_label="permanent checkout"
        )
    except ValueError as val_err:
        return jsonify({"error": str(val_err)}), 400
    except Exception as err:
        return jsonify({"error": f"Failed to save checkout signature: {str(err)}"}), 500

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE visitor_requests
        SET check_out_time = NOW(),
            manual_check_out_time = COALESCE(%s, manual_check_out_time),
            checkout_signature_path = %s,
            is_temp_out = FALSE
        WHERE request_id = %s
    """, (manual_checkout_val, checkout_signature_path, request_id))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Visitor checked out successfully",
        "checkout_signature_path": checkout_signature_path,
        "checkout_signature_url": f"/{checkout_signature_path}"
    })


@security_bp.route("/api/security/requests/<int:request_id>/manual-checkout", methods=["POST"])
def set_manual_checkout_time(request_id):
    try:
        data = request.get_json() or {}
        manual_checkout = data.get("manualCheckOutTime")
        if not manual_checkout:
            return jsonify({"error": "Manual check out time is required"}), 400

        if manual_checkout != "-":
            err = validate_manual_checkout_time(manual_checkout)
            if err:
                return jsonify({"error": err}), 400

        manual_checkout_val = None
        if manual_checkout != "-":
            try:
                manual_checkout_val = manual_checkout.replace("T", " ")
                if len(manual_checkout_val) == 16:
                    manual_checkout_val += ":00"
            except Exception:
                manual_checkout_val = manual_checkout

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE visitor_requests
            SET manual_check_out_time = %s
            WHERE request_id = %s
        """, (manual_checkout_val, request_id))
        conn.commit()
        conn.close()

        return jsonify({"message": "Manual checkout time updated successfully"})
    except Exception as e:
        print("[ERROR] set_manual_checkout_time:", e)
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------
# TEMP CHECKOUT / CHECKIN
# ---------------------------------------------------

@security_bp.route("/api/security/temp-checkout/<int:request_id>", methods=["POST"])
def temp_checkout(request_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE visitor_requests SET is_temp_out = TRUE, temp_out_time = NOW(), temp_in_time = NULL WHERE request_id = %s", (request_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Temporary checkout successful"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@security_bp.route("/api/security/temp-checkin/<int:request_id>", methods=["POST"])
def temp_checkin(request_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE visitor_requests SET is_temp_out = FALSE, temp_in_time = NOW() WHERE request_id = %s", (request_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Temporary checkin successful"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------
# SEARCH VISITORS
# ---------------------------------------------------

@security_bp.route("/api/security/search", methods=["GET"])
def search_visitors():

    query = request.args.get("query")

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
        vr.request_id,
        v.visitor_name,
        v.company_name,
        v.person_to_visit,
        vr.check_in_time,
        vr.check_out_time,
        vr.is_temp_out
        FROM visitor_requests vr
        JOIN visitors v ON vr.visitor_id = v.visitor_id
        WHERE LOWER(v.visitor_name) LIKE LOWER(%s)
    """, (f"%{query}%",))

    rows = cursor.fetchall()

    visitors = []

    for r in rows:

        status = "Inside"

        if r[5] is not None:
            status = "Checked Out"

        visitors.append({
            "request_id": r[0],
            "name": r[1],
            "company": r[2],
            "host": r[3],
            "checkIn": str(r[4]) if r[4] else "-",
            "status": status,
            "is_temp_out": r[6]
        })

    conn.close()
    return jsonify(visitors)


# ---------------------------------------------------
# RECENT ACTIVITY
# ---------------------------------------------------
@security_bp.route("/api/security/recent-activity", methods=["GET"])
def recent_activity():
    query = request.args.get("query", "").strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()

    if query:
        # Search mode: Historical data
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
        WHERE LOWER(v.visitor_name) LIKE LOWER(%s)
        ORDER BY COALESCE(vr.check_in_time, vr.approved_at, vr.created_at) DESC
        LIMIT 20
        """
        cursor.execute(sql, (f"%{query}%",))
    else:
        # Default mode: Today's activities
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
        WHERE DATE(COALESCE(vr.check_in_time, vr.approved_at, vr.created_at)) = CURRENT_DATE
        ORDER BY COALESCE(vr.check_in_time, vr.approved_at, vr.created_at) DESC
        LIMIT 10
        """
        cursor.execute(sql)

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
    def get_time_obj(act):
        try:
            return datetime.strptime(act["time"], "%d %b %Y, %I:%M %p")
        except:
            return datetime.min
            
    activity.sort(key=get_time_obj, reverse=True)

    conn.close()

    return jsonify(activity)



UPLOAD_FOLDER = "uploads"

@security_bp.route("/api/security/upload-photo/<int:request_id>", methods=["POST"])
def upload_visitor_photo(request_id):

    if "photo" not in request.files:
        return {"error": "No file"}, 400

    file = request.files["photo"]

  

    filename = f"{int(time.time())}_{secure_filename(file.filename)}"

    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

    filepath = os.path.join(UPLOAD_FOLDER, filename)

    file.save(filepath)

    conn = get_db_connection()
    cursor = conn.cursor()

    # get visitor_id from request_id
    cursor.execute("""
        SELECT visitor_id
        FROM visitor_requests
        WHERE request_id = %s
    """, (request_id,))

    visitor_id = cursor.fetchone()[0]

    cursor.execute("""
     UPDATE visitors
     SET photo = %s
     WHERE visitor_id = %s
""", (f"uploads/{filename}", visitor_id))

    conn.commit()
    conn.close()

    return {"message": "Photo uploaded"}
    
@security_bp.route("/api/security/spot-requests", methods=["GET"])
def spot_requests():

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
        vr.request_id,
        v.visitor_name,
        v.company_name,
        v.person_to_visit as "personToVisit",
        vr.purpose as "reasonOfVisit",
        vr.created_at
        FROM visitor_requests vr
        JOIN visitors v ON vr.visitor_id = v.visitor_id
        WHERE vr.status NOT IN ('APPROVED','REJECTED')
        AND vr.created_at >= NOW() - INTERVAL 36 HOUR
        ORDER BY vr.created_at DESC
    """)

    rows = cursor.fetchall()

    requests = []

    for r in rows:
        requests.append({
            "id": r[0],
            "request_id": r[0],
            "name": r[1],
            "company": r[2],
            "company_name": r[2],
            "host": r[3],
            "purpose": r[4],
            "time": str(r[5])
        })

    conn.close()
    return jsonify(requests)

@security_bp.route("/api/security/approve-request/<int:request_id>", methods=["POST"])
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
                    SET status = 'APPROVED',
                        approved_by = %s,
                        approved_at = NOW(),
                        check_in_time = NOW()
                    WHERE request_id = %s
                """, (approver_id, request_id))
                
                # Automatically check out of parent request
                cursor.execute("""
                    UPDATE visitor_requests
                    SET check_out_time = NOW(),
                        is_temp_out = FALSE
                    WHERE request_id = %s
                """, (parent_request_id,))
            else:
                cursor.execute("""
                    UPDATE visitor_requests
                    SET status = 'APPROVED',
                        approved_by = %s,
                        approved_at = NOW()
                    WHERE request_id = %s
                """, (approver_id, request_id))
                
                # Mark parent request as TRANSFERRED to close/complete it
                cursor.execute("""
                    UPDATE visitor_requests
                    SET status = 'TRANSFERRED'
                    WHERE request_id = %s
                """, (parent_request_id,))
        else:
            cursor.execute("""
                UPDATE visitor_requests
                SET status = 'APPROVED',
                    approved_by = %s,
                    approved_at = NOW()
                WHERE request_id = %s
            """, (approver_id, request_id))

        conn.commit()
        return jsonify({"message": "Request approved"}), 200
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@security_bp.route("/api/security/reject-request/<int:request_id>", methods=["POST"])
def reject_request(request_id):

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE visitor_requests
        SET status = 'REJECTED'
        WHERE request_id = %s
    """, (request_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "Request rejected"})


@security_bp.route("/api/security/requests/<int:request_id>", methods=["GET"])
def get_request_details(request_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT 
                vr.request_id,
                vr.is_multi_day,
                vr.valid_till,
                vr.purpose as "reasonOfVisit",
                v.has_device,
                v.device_type as "deviceType",
                v.device_make as "deviceMake",
                v.device_serial_number as "deviceSerialNumber",
                v.has_material,
                v.material_name as "materialName",
                v.material_quantity as "materialQuantity",
                v.material_serial_number as "materialSerialNumber",
                vr.check_in_time as "checkInTime",
                vr.check_out_time as "checkOutTime",
                vr.manual_check_out_time as "manualCheckOutTime",
                v.visitor_id,
                v.visitor_name as name,
                v.email,
                v.mobile_number as phone,
                v.pabx_number as pabx,
                v.company_name as "companyName",
                v.unit,
                v.department,
                v.location,
                v.person_to_visit as "personToVisit",
                v.access_level as "accessLevel",
                v.id_proof_type as "typeOfIDProof",
                v.id_proof_number as "idProofNumber",
                v.vehicle_type as "vehicleType",
                v.vehicle_number as "vehicleNumber",
                v.vehicle_photo_front as "vehiclePhotoFront",
                v.vehicle_photo_side as "vehiclePhotoSide",
                v.photo,
                vr.signature_path as "signature_path",
                vr.checkout_signature_path as "checkout_signature_path"
            FROM visitor_requests vr
            JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE vr.request_id = %s
        """, (request_id,))

        request_details = cursor.fetchone()
        conn.close()

        if not request_details:
            return jsonify({"error": "Request not found"}), 404

        if request_details.get("signature_path"):
            sig_p = str(request_details["signature_path"]).replace("\\", "/")
            if not sig_p.startswith("/"):
                sig_p = "/" + sig_p
            request_details["signature_url"] = sig_p
            request_details["signature_path"] = sig_p
        else:
            request_details["signature_url"] = None

        if request_details.get("checkout_signature_path"):
            csig_p = str(request_details["checkout_signature_path"]).replace("\\", "/")
            if not csig_p.startswith("/"):
                csig_p = "/" + csig_p
            request_details["checkout_signature_url"] = csig_p
            request_details["checkout_signature_path"] = csig_p
        else:
            request_details["checkout_signature_url"] = None

        # Convert datetime objects to string format
        if request_details.get("checkInTime"):
            request_details["checkInTime"] = request_details["checkInTime"].strftime("%d %b %Y, %I:%M %p")
        else:
            request_details["checkInTime"] = "-"

        if request_details.get("checkOutTime"):
            request_details["checkOutTime"] = request_details["checkOutTime"].strftime("%d %b %Y, %I:%M %p")
        else:
            request_details["checkOutTime"] = "-"

        if request_details.get("manualCheckOutTime"):
            request_details["manualCheckOutTimeRaw"] = request_details["manualCheckOutTime"].strftime("%Y-%m-%dT%H:%M")
            request_details["manualCheckOutTime"] = request_details["manualCheckOutTime"].strftime("%d %b %Y, %I:%M %p")
        else:
            request_details["manualCheckOutTimeRaw"] = ""
            request_details["manualCheckOutTime"] = "-"

        # Convert bool to "Yes"/"No" for form
        request_details["hasDevice"] = "Yes" if request_details["has_device"] else "No"
        request_details["hasMaterial"] = "Yes" if request_details.get("has_material") else "No"
        
        # Ensure numeric fields are strings for React select components
        if request_details.get("accessLevel") is not None:
            val = str(request_details["accessLevel"]).strip()
            # Map full labels to codes if they exist (backward compatibility)
            mapping = {
                "Visitor (Level 1)": "1",
                "Vendor (Level 10)": "2",
                "Security (Level 50)": "3",
                "Host (Level 80)": "4",
                "Admin Override (Level 99)": "5",
                "1": "1",
                "2": "2",
                "3": "3",
                "4": "4",
                "5": "5"
            }
            request_details["accessLevel"] = mapping.get(val, val)
        else:
            request_details["accessLevel"] = ""

        # Remove original extra fields
        del request_details["has_device"]
        if "has_material" in request_details:
            del request_details["has_material"]

        return jsonify(request_details)

    except Exception as e:
        print("[ERROR] get_request_details:", e)
        return jsonify({"error": str(e)}), 500


@security_bp.route("/api/security/requests/<int:request_id>", methods=["PUT"])
def update_request_details(request_id):
    try:
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form

        # Vehicle Number Validation
        vehicle_number = data.get("vehicleNumber") or data.get("vehicle_number")
        if vehicle_number and str(vehicle_number).strip() != "":
            clean_vehicle = re.sub(r'[^A-Za-z0-9]', '', str(vehicle_number))
            if not re.match(r"^[A-Za-z]{2}\d{2}[A-Za-z]{1,2}\d{4}$", clean_vehicle):
                return jsonify({"error": "Please enter a valid Indian vehicle registration number (e.g., MH12AB1234)"}), 400

        # Handle vehicle photo uploads if present
        UPLOAD_FOLDER = "uploads"
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

        conn = get_db_connection()
        cursor = conn.cursor()

        has_device = True if data.get("hasDevice") == "Yes" else False
        has_material = True if (data.get("hasMaterial") == "Yes" or str(data.get("hasMaterial")).lower() in ["true", "1", "yes"]) else False
        cursor.execute("""
            UPDATE visitors 
            SET 
                visitor_name = %s,
                full_name = %s,
                email = %s,
                mobile_number = %s,
                pabx_number = %s,
                company_name = %s,
                unit = %s,
                department = %s,
                location = %s,
                person_to_visit = %s,
                access_level = %s,
                id_proof_type = %s,
                id_proof_number = %s,
                vehicle_type = %s,
                vehicle_number = %s,
                has_device = %s,
                device_type = %s,
                device_make = %s,
                device_serial_number = %s,
                has_material = %s,
                material_name = %s,
                material_quantity = %s,
                material_serial_number = %s
            WHERE visitor_id = (SELECT visitor_id FROM visitor_requests WHERE request_id = %s)
        """, (
            data.get("name"),
            data.get("name"),
            data.get("email"),
            data.get("phone"),
            data.get("pabx"),
            data.get("companyName"),
            data.get("unit"),
            data.get("department"),
            data.get("location"),
            data.get("personToVisit"),
            data.get("accessLevel"),
            data.get("typeOfIDProof"),
            data.get("idProofNumber"),
            data.get("vehicleType") or data.get("vehicle_type"),
            data.get("vehicleNumber") or data.get("vehicle_number"),
            has_device,
            data.get("deviceType"),
            data.get("deviceMake"),
            data.get("deviceSerialNumber"),
            has_material,
            data.get("materialName"),
            data.get("materialQuantity"),
            data.get("materialSerialNumber"),
            request_id
        ))

        if vehicle_photo_front_path:
            cursor.execute("""
                UPDATE visitors 
                SET vehicle_photo_front = %s
                WHERE visitor_id = (SELECT visitor_id FROM visitor_requests WHERE request_id = %s)
            """, (vehicle_photo_front_path, request_id))

        if vehicle_photo_side_path:
            cursor.execute("""
                UPDATE visitors 
                SET vehicle_photo_side = %s
                WHERE visitor_id = (SELECT visitor_id FROM visitor_requests WHERE request_id = %s)
            """, (vehicle_photo_side_path, request_id))

        # Update Request details
        manual_checkout = data.get("manualCheckOutTime")
        if manual_checkout is not None:
            if manual_checkout and manual_checkout != "-":
                err = validate_manual_checkout_time(manual_checkout)
                if err:
                    return jsonify({"error": err}), 400
            manual_checkout_val = None
            if manual_checkout != "-":
                try:
                    manual_checkout_val = manual_checkout.replace("T", " ")
                    if len(manual_checkout_val) == 16:
                        manual_checkout_val += ":00"
                except Exception:
                    manual_checkout_val = manual_checkout
            cursor.execute("""
                UPDATE visitor_requests
                SET purpose = %s,
                    manual_check_out_time = %s
                WHERE request_id = %s
            """, (
                data.get("reasonOfVisit"),
                manual_checkout_val,
                request_id
            ))
        is_multi_day_raw = data.get("is_multi_day") or data.get("isMultiDay")
        is_multi_day = True if str(is_multi_day_raw).lower() in ["1", "true", "yes"] else False
        valid_till = data.get("valid_till") or data.get("validTill")

        cursor.execute("""
            UPDATE visitor_requests
            SET purpose = %s,
                is_multi_day = %s,
                valid_till = %s
            WHERE request_id = %s
        """, (
            data.get("reasonOfVisit"),
            is_multi_day,
            valid_till,
            request_id
        ))

        conn.commit()
        conn.close()


        return jsonify({"message": "Request updated successfully"})

    except Exception as e:
        print("[ERROR] update_request_details:", e)
        return jsonify({"error": str(e)}), 500