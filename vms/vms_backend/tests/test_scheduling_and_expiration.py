import sys
import os
from datetime import datetime, timedelta, date

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from db import get_db_connection
import pymysql.cursors
from routes.request_routes import auto_expire_past_requests

def test_visit_scheduling_and_auto_expiration():
    conn = get_db_connection()
    assert conn is not None, "Database connection failed"
    
    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        today = date.today()
        yesterday = today - timedelta(days=2)
        future_date = today + timedelta(days=5)

        # 1. Clean up old test entries if any
        cursor.execute("DELETE FROM visitor_requests WHERE purpose LIKE 'TEST_SCHED_%'")
        cursor.execute("DELETE FROM visitors WHERE email LIKE 'test_sched_%@example.com'")
        conn.commit()

        # 2. Insert test visitors
        cursor.execute("""
            INSERT INTO visitors (visitor_name, email, mobile_number, status)
            VALUES ('Today Visitor', 'test_sched_today@example.com', '9999900001', 'active')
        """)
        v_today_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO visitors (visitor_name, email, mobile_number, status)
            VALUES ('Future Visitor', 'test_sched_future@example.com', '9999900002', 'active')
        """)
        v_future_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO visitors (visitor_name, email, mobile_number, status)
            VALUES ('Past Visitor', 'test_sched_past@example.com', '9999900003', 'active')
        """)
        v_past_id = cursor.lastrowid

        # 3. Create visitor requests for Today, Future, and Past
        cursor.execute("""
            INSERT INTO visitor_requests (visitor_id, purpose, scheduled_date, scheduled_time, status, created_at)
            VALUES (%s, 'TEST_SCHED_TODAY', %s, '10:00:00', 'PENDING', NOW())
        """, (v_today_id, today))
        req_today_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO visitor_requests (visitor_id, purpose, scheduled_date, scheduled_time, status, created_at)
            VALUES (%s, 'TEST_SCHED_FUTURE', %s, '10:00:00', 'PENDING', NOW())
        """, (v_future_id, future_date))
        req_future_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO visitor_requests (visitor_id, purpose, scheduled_date, scheduled_time, status, created_at)
            VALUES (%s, 'TEST_SCHED_PAST', %s, '10:00:00', 'PENDING', NOW())
        """, (v_past_id, yesterday))
        req_past_id = cursor.lastrowid

        conn.commit()

        # 4. Run auto_expire_past_requests
        auto_expire_past_requests(cursor)
        conn.commit()

        # 5. Assert status of Past request is EXPIRED
        cursor.execute("SELECT status FROM visitor_requests WHERE request_id = %s", (req_past_id,))
        past_status = cursor.fetchone()["status"]
        assert past_status == "EXPIRED", f"Expected EXPIRED for past request, got {past_status}"

        # 6. Assert status of Today request remains PENDING
        cursor.execute("SELECT status FROM visitor_requests WHERE request_id = %s", (req_today_id,))
        today_status = cursor.fetchone()["status"]
        assert today_status == "PENDING", f"Expected PENDING for today request, got {today_status}"

        # 7. Assert status of Future request remains PENDING
        cursor.execute("SELECT status FROM visitor_requests WHERE request_id = %s", (req_future_id,))
        future_status = cursor.fetchone()["status"]
        assert future_status == "PENDING", f"Expected PENDING for future request, got {future_status}"

        # 8. Assert security pending_requests logic (returns requests where scheduled_date = CURRENT_DATE)
        cursor.execute("""
            SELECT request_id FROM visitor_requests 
            WHERE status = 'PENDING' AND scheduled_date = CURRENT_DATE AND purpose LIKE 'TEST_SCHED_%'
        """)
        pending_today_ids = [r["request_id"] for r in cursor.fetchall()]
        assert req_today_id in pending_today_ids, "Today's request should be in pending_today list"
        assert req_future_id not in pending_today_ids, "Future request should NOT be in today's pending list"

        print("ALL SCHEDULING AND EXPIRED TESTS PASSED SUCCESSFULLY!")

    finally:
        # Cleanup
        cursor.execute("DELETE FROM visitor_requests WHERE purpose LIKE 'TEST_SCHED_%'")
        cursor.execute("DELETE FROM visitors WHERE email LIKE 'test_sched_%@example.com'")
        conn.commit()
        conn.close()

if __name__ == "__main__":
    test_visit_scheduling_and_auto_expiration()
