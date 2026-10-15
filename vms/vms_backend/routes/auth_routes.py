# routes/auth_routes.py

from flask import Blueprint, request, jsonify
import pymysql.cursors
from db import get_db_connection
from utils.token_utils import generate_token
from utils.password_utils import is_valid_password

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():

    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not is_valid_password(password):
        return jsonify({"message": "Password must be at least 8 characters, contain at least one uppercase letter, one special character, and one number"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            "SELECT * FROM users WHERE email = %s",
            (email,)
        )

        user = cursor.fetchone()

        if not user:
            return jsonify({"message": "User not found"}), 404

        if user["password"] != password:
            return jsonify({"message": "Invalid password"}), 401

        if (user.get("status") or "").lower() != "active":
            return jsonify({"message": "Account is deactivated. Please contact your administrator."}), 403

        token = generate_token(user)

        # Get authorized site IDs and full site objects for multi-site RBAC
        from utils.auth_utils import get_user_site_scope, get_user_authorized_sites
        scope_type, site_ids = get_user_site_scope(user["user_id"], user["role"])
        user["site_ids"] = site_ids if scope_type != "ALL" else "ALL"
        user["sites"] = get_user_authorized_sites(user["user_id"], user["role"])

        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": user
        }), 200

    finally:
        conn.close()


@auth_bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not all([name, email, password]):
        return jsonify({"message": "All fields (name, email, password) are required"}), 400

    if not is_valid_password(password):
        return jsonify({"message": "Password must be at least 8 characters, contain at least one uppercase letter, one special character, and one number"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"message": "Database connection failed"}), 500

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # Check if user already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            return jsonify({"message": "User already exists"}), 409

        # Insert new user with default role 'host'
        cursor.execute(
            "INSERT INTO users (name, email, password, role, department, status) VALUES (%s, %s, %s, %s, %s, %s)",
            (name, email, password, "host", "General", "Active")
        )
        
        user_id = cursor.lastrowid
        cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()

        token = generate_token(user)

        # Assign default site to user_sites
        cursor.execute("INSERT IGNORE INTO user_sites (user_id, site_id) VALUES (%s, 1)", (user_id,))
        conn.commit()

        from utils.auth_utils import get_user_site_scope, get_user_authorized_sites
        scope_type, site_ids = get_user_site_scope(user["user_id"], user["role"])
        user["site_ids"] = site_ids if scope_type != "ALL" else "ALL"
        user["sites"] = get_user_authorized_sites(user["user_id"], user["role"])

        return jsonify({
            "message": "Registration successful",
            "token": token,
            "user": user
        }), 201

    except Exception as e:
        return jsonify({"message": f"Registration failed: {str(e)}"}), 500
    finally:
        conn.close()


@auth_bp.route("/api/auth/poll-remote-login", methods=["POST"])
def poll_remote_login():
    try:
        data = request.get_json() or {}
        email = data.get("email")
        
        if not email:
            return jsonify({"error": "Email is required for polling."}), 400
            
        conn = get_db_connection()
        if not conn:
            return jsonify({"error": "Database connection failed"}), 500
            
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return jsonify({"error": "User not found."}), 404
            
        token = user.get("remote_login_token")
        if token:
            # Clear token immediately so it's a one-time use
            cursor.execute("UPDATE users SET remote_login_token = NULL WHERE user_id = %s", (user["user_id"],))
            conn.commit()
            cursor.close()
            conn.close()
            return jsonify({
                "authorized": True,
                "token": token,
                "user": user
            }), 200
        else:
            cursor.close()
            conn.close()
            return jsonify({"authorized": False}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500