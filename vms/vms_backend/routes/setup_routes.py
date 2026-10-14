# routes/setup_routes.py
"""
First-Run Setup and Provisioning Routes
Enterprise Visitor Management System

Handles initial system provisioning when deployed on-premise:
- GET  /api/setup/status       : Checks if initial setup is required.
- POST /api/setup/initialize   : Atomically initializes organization, primary site, and master administrator.
"""

import re
import logging
from flask import Blueprint, request, jsonify
import pymysql.cursors
from db import get_db_connection
from utils.password_utils import is_valid_password

logger = logging.getLogger(__name__)

setup_bp = Blueprint("setup", __name__)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


@setup_bp.route("/api/setup/status", methods=["GET"])
def get_setup_status():
    """
    Report whether first-run setup is required.
    Does NOT leak any user records, emails, or sensitive information.
    """
    conn = get_db_connection()
    if not conn:
        return jsonify({
            "error": "DATABASE_ERROR",
            "message": "Database service is unavailable."
        }), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        # Check if any administrative users exist
        cursor.execute("SELECT COUNT(*) AS admin_count FROM users WHERE role IN ('superadmin', 'admin')")
        result = cursor.fetchone()
        admin_count = result["admin_count"] if result else 0

        # Also check general users count for complete clean state verification
        cursor.execute("SELECT COUNT(*) AS total_users FROM users")
        total_result = cursor.fetchone()
        total_users = total_result["total_users"] if total_result else 0

        setup_required = (admin_count == 0 or total_users == 0)

        cursor.close()
        return jsonify({
            "setup_required": setup_required,
            "initialized": not setup_required,
            "version": "1.0.0"
        }), 200
    except Exception as e:
        logger.error(f"Error checking setup status: {e}")
        return jsonify({
            "error": "STATUS_CHECK_FAILED",
            "message": "Unable to verify system setup status."
        }), 500
    finally:
        conn.close()


@setup_bp.route("/api/setup/initialize", methods=["POST"])
def initialize_system():
    """
    Atomically provision the initial organization, primary site, and master Superadmin account.
    Enforces strict security checks:
    - Atomically locks and rejects if an administrator already exists.
    - Prevents replay attacks and unauthorized account creation.
    - Ignores or rejects client-supplied roles; strictly assigns 'superadmin'.
    - Validates inputs without leaking SQL or stack traces.
    """
    data = request.get_json() or {}

    org_name = (data.get("organization_name") or "").strip()
    site_name = (data.get("site_name") or "").strip()
    site_code = (data.get("site_code") or "HQ").strip().upper()
    admin_name = (data.get("admin_name") or "").strip()
    admin_email = (data.get("admin_email") or "").strip().lower()
    admin_password = data.get("admin_password") or ""
    license_key = (data.get("license_key") or "").strip()

    # 1. Input Validation
    errors = []
    if not org_name or len(org_name) < 2 or len(org_name) > 100:
        errors.append("Organization name is required and must be between 2 and 100 characters.")

    if not site_name or len(site_name) < 2 or len(site_name) > 100:
        errors.append("Primary site name is required and must be between 2 and 100 characters.")

    if not site_code or len(site_code) < 2 or len(site_code) > 20:
        errors.append("Site code is required and must be between 2 and 20 characters.")

    if not admin_name or len(admin_name) < 2 or len(admin_name) > 100:
        errors.append("Administrator name is required and must be between 2 and 100 characters.")

    if not admin_email or not EMAIL_REGEX.match(admin_email):
        errors.append("A valid administrator email address is required.")

    if not is_valid_password(admin_password):
        errors.append("Password must be at least 8 characters, contain at least one uppercase letter, one special character, and one number.")

    if errors:
        return jsonify({
            "error": "VALIDATION_FAILED",
            "message": "Input validation failed.",
            "details": errors
        }), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({
            "error": "DATABASE_ERROR",
            "message": "Database service is unavailable."
        }), 500

    try:
        # Begin atomic transaction with lock to prevent race conditions
        conn.begin()
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # 2. Strict Replay and Concurrency Protection
        # Use FOR UPDATE row/table lock to serialize simultaneous initialization attempts
        cursor.execute("SELECT COUNT(*) AS admin_count FROM users WHERE role IN ('superadmin', 'admin') FOR UPDATE")
        existing_admins = cursor.fetchone()["admin_count"]

        if existing_admins > 0:
            conn.rollback()
            return jsonify({
                "error": "SETUP_ALREADY_COMPLETED",
                "message": "The system has already been initialized with an administrator. Setup is permanently locked."
            }), 403

        # 3. Check if email is already registered in users table
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (admin_email,))
        if cursor.fetchone():
            conn.rollback()
            return jsonify({
                "error": "EMAIL_EXISTS",
                "message": "An account with this email address already exists."
            }), 409

        # 4. Provision Customer (Organization Tenant)
        cursor.execute("SELECT customer_id FROM customers WHERE customer_name = %s", (org_name,))
        cust_row = cursor.fetchone()
        if cust_row:
            customer_id = cust_row["customer_id"]
        else:
            cursor.execute(
                "INSERT INTO customers (customer_name, code, status) VALUES (%s, %s, 'Active')",
                (org_name, site_code)
            )
            customer_id = cursor.lastrowid

        # 5. Provision Primary Site
        cursor.execute("SELECT site_id FROM sites WHERE name = %s AND customer_id = %s", (site_name, customer_id))
        site_row = cursor.fetchone()
        if site_row:
            site_id = site_row["site_id"]
        else:
            cursor.execute(
                "INSERT INTO sites (name, address, status, customer_id) VALUES (%s, 'Main Headquarters', 'Active', %s)",
                (site_name, customer_id)
            )
            site_id = cursor.lastrowid

        # 6. Create Initial Master Administrator
        # Enforce role = 'superadmin' regardless of any client-supplied role values
        cursor.execute(
            """
            INSERT INTO users (name, email, password, role, department, status, customer_id)
            VALUES (%s, %s, %s, 'superadmin', 'Management', 'Active', %s)
            """,
            (admin_name, admin_email, admin_password, customer_id)
        )
        user_id = cursor.lastrowid

        # 7. Map Administrator to Site in user_sites junction
        cursor.execute(
            "INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, %s)",
            (user_id, site_id)
        )

        # 8. Record in Audit Log
        cursor.execute(
            """
            INSERT INTO superadmin_audit_logs (username, action, target)
            VALUES (%s, 'First-Run Setup Provisioning Completed', %s)
            """,
            (admin_name, org_name)
        )

        # 9. Optional License Key Injection
        if license_key:
            cursor.execute(
                """
                INSERT INTO system_license (license_key, activation_time, will_terminate, terminated_early, extension_requested)
                VALUES (%s, NOW(), FALSE, FALSE, FALSE)
                """,
                (license_key,)
            )

        # Commit atomic transaction
        conn.commit()
        cursor.close()

        logger.info(f"System successfully initialized: Org '{org_name}', Admin '{admin_email}'")

        return jsonify({
            "success": True,
            "message": "System initialized successfully. You may now log in with your administrator account.",
            "admin": {
                "user_id": user_id,
                "name": admin_name,
                "email": admin_email,
                "role": "superadmin"
            },
            "organization": {
                "customer_id": customer_id,
                "name": org_name
            },
            "primary_site": {
                "site_id": site_id,
                "name": site_name,
                "code": site_code
            }
        }), 201

    except Exception as e:
        conn.rollback()
        logger.error(f"Error during system initialization: {e}")
        return jsonify({
            "error": "INITIALIZATION_FAILED",
            "message": "A database error occurred during system initialization. Changes were rolled back."
        }), 500
    finally:
        conn.close()
