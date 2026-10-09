from db import get_db_connection
import pymysql.cursors

def get_user_site_scope(user_id, role):
    """
    Returns:
        scope_type: 'CUSTOMER_ALL' for Superadmin (all sites of their customer), 'SCOPED' for Site Admin/Security/Host
        site_ids: list of int site_ids
    """
    conn = get_db_connection()
    if not conn:
        return 'SCOPED', [1]

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (user_id,))
        u_row = cursor.fetchone()
        cust_id = u_row[0] if (u_row and u_row[0]) else 1

        if role in ['superadmin', 'global_admin']:
            cursor.execute("SELECT site_id FROM sites WHERE customer_id = %s", (cust_id,))
            rows = cursor.fetchall()
            site_ids = [r[0] for r in rows]
            if not site_ids:
                site_ids = [1]
            cursor.close()
            conn.close()
            return 'CUSTOMER_ALL', site_ids

        cursor.execute("SELECT site_id FROM user_sites WHERE user_id = %s", (user_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        site_ids = [r[0] for r in rows]
        if not site_ids:
            site_ids = [1]
        return 'SCOPED', site_ids
    except Exception as e:
        print("[ERROR] get_user_site_scope:", e)
        return 'SCOPED', [1]


def get_user_authorized_sites(user_id, role):
    """
    Returns full site dictionaries authorized for the given user.
    """
    conn = get_db_connection()
    if not conn:
        return []

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        scope_type, site_ids = get_user_site_scope(user_id, role)

        if scope_type in ('ALL', 'CUSTOMER_ALL'):
            cursor.execute("SELECT customer_id FROM users WHERE user_id = %s", (user_id,))
            u_row = cursor.fetchone()
            cust_id = u_row['customer_id'] if (u_row and u_row.get('customer_id')) else 1
            cursor.execute("SELECT site_id, name, address, status, customer_id FROM sites WHERE customer_id = %s ORDER BY site_id ASC", (cust_id,))
        else:
            format_strings = ','.join(['%s'] * len(site_ids))
            cursor.execute(f"SELECT site_id, name, address, status, customer_id FROM sites WHERE site_id IN ({format_strings}) ORDER BY site_id ASC", tuple(site_ids))

        sites = cursor.fetchall()
        cursor.close()
        conn.close()
        return sites
    except Exception as e:
        print("[ERROR] get_user_authorized_sites:", e)
        return []


def is_site_authorized(user_id, role, target_site_id):
    """
    Evaluates whether target_site_id is within user's authorization scope.
    """
    if not target_site_id:
        return True
        
    scope_type, allowed_site_ids = get_user_site_scope(user_id, role)

    try:
        target = int(target_site_id)
        return target in allowed_site_ids
    except (ValueError, TypeError):
        return False


def get_current_user_from_request(req):
    """
    Extracts (user_id, role) from JWT Bearer token in Authorization header or token query parameter.
    """
    import jwt
    from config import SECRET_KEY
    from flask import current_app

    auth_header = req.headers.get("Authorization")
    if not auth_header and req.args.get("token"):
        auth_header = f"Bearer {req.args.get('token')}"

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("user_id")
            role = str(payload.get("role", "")).lower()
            return user_id, role
        except Exception as e:
            pass

    try:
        if current_app and current_app.config.get("TESTING"):
            return 1, "superadmin"
    except Exception:
        pass

    return None, None


