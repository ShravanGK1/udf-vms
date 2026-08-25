from db import get_db_connection

def renumber_tables():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get visitors
    cursor.execute("SELECT visitor_id FROM visitors ORDER BY visitor_id")
    v_ids = [row[0] for row in cursor.fetchall()]
    v_mapping = {old_id: new_id for new_id, old_id in enumerate(v_ids, 1)}

    # Update visitor_requests.visitor_id
    for old_id, new_id in v_mapping.items():
        cursor.execute("UPDATE visitor_requests SET visitor_id = %s WHERE visitor_id = %s", (new_id, old_id))

    # Update visitors.visitor_id
    for old_id, new_id in v_mapping.items():
        cursor.execute("UPDATE visitors SET visitor_id = %s WHERE visitor_id = %s", (new_id, old_id))

    # Get visitor_requests
    cursor.execute("SELECT request_id FROM visitor_requests ORDER BY request_id")
    r_ids = [row[0] for row in cursor.fetchall()]
    r_mapping = {old_id: new_id for new_id, old_id in enumerate(r_ids, 1)}

    # Update visitor_requests.request_id
    for old_id, new_id in r_mapping.items():
        cursor.execute("UPDATE visitor_requests SET request_id = %s WHERE request_id = %s", (new_id, old_id))

    # Restart sequences
    next_v_id = len(v_ids) + 1
    next_r_id = len(r_ids) + 1
    cursor.execute(f"ALTER SEQUENCE visitors_visitor_id_seq RESTART WITH {next_v_id}")
    cursor.execute(f"ALTER SEQUENCE visitor_requests_request_id_seq RESTART WITH {next_r_id}")

    conn.commit()
    conn.close()
    print(f"Renumbered {len(v_ids)} visitors and {len(r_ids)} requests starting from 1. Sequences restarted.")

if __name__ == "__main__":
    renumber_tables()
