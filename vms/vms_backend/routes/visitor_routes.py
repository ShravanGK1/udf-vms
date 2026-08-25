# routes/visitor_routes.py

from flask import Blueprint, request, jsonify
import pymysql.cursors
from db import get_db_connection
import re

visitor_bp = Blueprint("visitors", __name__)

@visitor_bp.route("/api/visitors", methods=["GET"])
def get_visitors():
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM visitors ORDER BY visitor_id DESC")
        visitors = cursor.fetchall()
        return jsonify(visitors), 200

    finally:
        conn.close()


@visitor_bp.route("/api/visitors/lookup/<mobile>", methods=["GET"])
def lookup_visitor(mobile):
    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT visitor_name, company_name, email, 
                   id_proof_type, id_proof_number, pabx_number, 
                   unit, department, location, vehicle_type, vehicle_number,
                   vehicle_photo_front, vehicle_photo_side
            FROM visitors
            WHERE mobile_number = %s
            LIMIT 1
        """, (mobile,))
        
        visitor = cursor.fetchone()
        if visitor:
            return jsonify(visitor), 200
        else:
            return jsonify({"message": "Visitor not found"}), 404

    finally:
        conn.close()


@visitor_bp.route("/api/visitors", methods=["POST"])
def create_visitor():
    data = request.get_json()

    # Vehicle Number Validation
    vehicle_number = data.get("vehicle_number") or data.get("vehicleNumber")
    if vehicle_number and str(vehicle_number).strip() != "":
        clean_vehicle = re.sub(r'[^A-Za-z0-9]', '', str(vehicle_number))
        if not re.match(r"^[A-Za-z]{2}\d{2}[A-Za-z]{1,2}\d{4}$", clean_vehicle):
            return jsonify({"error": "Please enter a valid Indian vehicle registration number (e.g., MH12AB1234)"}), 400

    conn = get_db_connection()

    if not conn:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Check if visitor already exists by mobile
        cursor.execute("""
            SELECT visitor_id
            FROM visitors
            WHERE mobile_number = %s
            LIMIT 1
        """, (data.get("mobile_number"),))

        existing = cursor.fetchone()

        if existing:
            visitor_id = existing["visitor_id"]
        else:
            cursor.execute("""
                INSERT INTO visitors (
                    visitor_name, company_name, email, mobile_number,
                    id_proof_type, id_proof_number,
                    employee_id, full_name, pabx_number,
                    unit, department, location,
                    access_level, reason_of_visit,
                    vehicle_type, vehicle_number
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                data.get("visitor_name"),
                data.get("company_name"),
                data.get("email"),
                data.get("mobile_number"),
                data.get("id_proof_type"),
                data.get("id_proof_number"),
                data.get("employee_id"),
                data.get("full_name"),
                data.get("pabx_number"),
                data.get("unit"),
                data.get("department"),
                data.get("location"),
                data.get("access_level"),
                data.get("reason_of_visit"),
                data.get("vehicle_type") or data.get("vehicleType"),
                data.get("vehicle_number") or data.get("vehicleNumber")
            ))

            visitor_id = cursor.lastrowid

        # Always create a NEW visit request
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
            VALUES (%s,%s,%s,CURRENT_DATE,CURRENT_TIME,'PENDING',NOW())
        """, (
            visitor_id,
            data.get("employee_id"),
            data.get("reason_of_visit")
        ))

        conn.commit()

        return jsonify({"message": "Visit request created"}), 201

    finally:
        conn.close()
        
@visitor_bp.route("/api/visit-purpose", methods=["GET"])
def get_visit_purpose():

    conn = get_db_connection()

    if not conn:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT purpose, COUNT(*) as value
            FROM visitor_requests
            GROUP BY purpose
        """)

        rows = cursor.fetchall()

        # Assign colors for chart
        colors = {
            "Meeting": "#2563EB",
            "Interview": "#10B981",
            "Delivery": "#F59E0B",
            "Maintenance": "#6366F1"
        }

        result = []

        for row in rows:
            result.append({
                "name": row["purpose"],
                "value": row["value"],
                "color": colors.get(row["purpose"], "#8884d8")
            })

        return jsonify(result), 200

    finally:
        conn.close()

@visitor_bp.route("/api/active-visitors-count", methods=["GET"])
def get_active_visitors_count():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT COUNT(*) 
            FROM visitor_requests 
            WHERE status = 'APPROVED'
            AND check_in_time IS NOT NULL
            AND check_out_time IS NULL
        """)

        count = cursor.fetchone()[0]

        return jsonify({"count": count}), 200

    except Exception as e:
        print("ERROR:", e)
        return jsonify({"message": str(e)}), 500

    finally:
        conn.close()