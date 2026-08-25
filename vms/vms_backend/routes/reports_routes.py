from flask import Blueprint, jsonify, request
from db import get_db_connection
from flask import send_file
import pandas as pd
import io

reports_bp = Blueprint("reports", __name__)

def get_period_filter(period, table_alias="vr"):
    col = f"COALESCE({table_alias}.check_in_time, {table_alias}.approved_at, {table_alias}.created_at)"
    if period == "daily":
        return f"DATE({col}) = CURRENT_DATE"
    elif period == "weekly":
        return f"YEARWEEK({col}, 1) = YEARWEEK(CURRENT_DATE, 1)"
    elif period == "quarterly":
        return f"YEAR({col}) = YEAR(CURRENT_DATE) AND QUARTER({col}) = QUARTER(CURRENT_DATE)"
    elif period == "yearly":
        return f"YEAR({col}) = YEAR(CURRENT_DATE)"
    return "1=1"

@reports_bp.route("/api/reports", methods=["GET"])
def get_reports():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor()
        period = request.args.get("period", "daily")

        # ------------------ SUMMARY ------------------

        # TOTAL
        cursor.execute("SELECT COUNT(*) FROM visitor_requests")
        total = cursor.fetchone()[0]

        # TODAY
        cursor.execute("""
            SELECT COUNT(*) FROM visitor_requests
            WHERE DATE(check_in_time) = CURRENT_DATE
        """)
        today = cursor.fetchone()[0]

        # MTD
        cursor.execute("""
            SELECT COUNT(*) FROM visitor_requests
            WHERE DATE_FORMAT(check_in_time, '%Y-%m-01') = DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
        """)
        mtd = cursor.fetchone()[0]

        # YTD
        cursor.execute("""
            SELECT COUNT(*) FROM visitor_requests
            WHERE YEAR(check_in_time) = YEAR(CURRENT_DATE)
        """)
        ytd = cursor.fetchone()[0]

        # PERIOD COUNT (selected period)
        where_clause = get_period_filter(period, "vr")
        cursor.execute(f"SELECT COUNT(*) FROM visitor_requests vr WHERE {where_clause}")
        period_count = cursor.fetchone()[0]

        # AVG DAILY (for the selected period)
        cursor.execute(f"""
        SELECT 
            COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT DATE(vr.check_in_time)), 0)
        FROM visitor_requests vr
        WHERE {where_clause}
         """)
        avg_daily = round(cursor.fetchone()[0] or 0, 2)

        # ------------------ REPEAT VISITORS ------------------

        cursor.execute(f"""
                SELECT COUNT(DISTINCT vr.visitor_id)
                FROM visitor_requests vr
                WHERE {where_clause}
            """)
        unique_visitors = cursor.fetchone()[0]
        
        repeat_ratio = round(period_count / unique_visitors, 2) if unique_visitors else 0
        repeat_percent = round((repeat_ratio - 1) * 100, 2) if unique_visitors else 0
        if repeat_percent < 0:
            repeat_percent = 0.0

        # ------------------ PEAK HOUR ------------------
        cursor.execute(f"""
            SELECT DATE_FORMAT(vr.check_in_time, '%H:00') as hour, COUNT(*)
            FROM visitor_requests vr
            WHERE {where_clause} AND vr.check_in_time IS NOT NULL
            GROUP BY hour
            ORDER BY COUNT(*) DESC
            LIMIT 1
        """)
        peak = cursor.fetchone()
        peak_hour = peak[0] if peak else "N/A"

        # ------------------ CATEGORY SPLIT ------------------
        cursor.execute(f"""
            SELECT vr.purpose, COUNT(*)
            FROM visitor_requests vr
            WHERE {where_clause}
            GROUP BY vr.purpose
        """)
        category_split = [{"name": r[0] or "Other", "value": r[1]} for r in cursor.fetchall()]

        # ------------------ TREND ------------------
        if period == "daily":
            cursor.execute("""
                WITH RECURSIVE hours AS (
                    SELECT 0 AS lvl
                    UNION ALL
                    SELECT lvl + 1 FROM hours WHERE lvl < 23
                ),
                hours_formatted AS (
                    SELECT CONCAT(LPAD(lvl, 2, '0'), ':00') as label FROM hours
                ),
                counts AS (
                    SELECT DATE_FORMAT(check_in_time, '%H:00') as label, COUNT(*) as visitors
                    FROM visitor_requests
                    WHERE DATE(check_in_time) = CURRENT_DATE
                    GROUP BY label
                )
                SELECT h.label, COALESCE(c.visitors, 0) as visitors
                FROM hours_formatted h
                LEFT JOIN counts c ON h.label = c.label
                ORDER BY h.label
            """)
        elif period == "weekly":
            cursor.execute("""
                WITH RECURSIVE days AS (
                    SELECT 0 AS lvl
                    UNION ALL
                    SELECT lvl + 1 FROM days WHERE lvl < 6
                ),
                days_formatted AS (
                    SELECT 
                        DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL (6 - lvl) DAY), '%a') as label,
                        DATE_SUB(CURRENT_DATE, INTERVAL (6 - lvl) DAY) as day_date
                    FROM days
                ),
                counts AS (
                    SELECT DATE_FORMAT(check_in_time, '%a') as label, 
                           DATE(check_in_time) as day_date,
                           COUNT(*) as visitors
                    FROM visitor_requests
                    WHERE check_in_time >= CURRENT_DATE - INTERVAL 6 DAY
                    GROUP BY label, day_date
                )
                SELECT d.label, COALESCE(c.visitors, 0) as visitors
                FROM days_formatted d
                LEFT JOIN counts c ON d.day_date = c.day_date
                ORDER BY d.day_date
            """)
        elif period == "monthly":
            cursor.execute("""
                SELECT CONCAT('Week ', FLOOR((DAY(check_in_time) - 1) / 7) + 1) as label, COUNT(*) as visitors
                FROM visitor_requests
                WHERE check_in_time >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                GROUP BY label
                ORDER BY label
            """)
        elif period == "yearly":
            cursor.execute("""
                WITH RECURSIVE months_cte AS (
                    SELECT 0 AS lvl
                    UNION ALL
                    SELECT lvl + 1 FROM months_cte WHERE lvl < 11
                ),
                months AS (
                    SELECT 
                        DATE_FORMAT(DATE_ADD(DATE_FORMAT(CURRENT_DATE, '%Y-01-01'), INTERVAL lvl MONTH), '%b') as label,
                        DATE_ADD(DATE_FORMAT(CURRENT_DATE, '%Y-01-01'), INTERVAL lvl MONTH) as month_date
                    FROM months_cte
                ),
                counts AS (
                    SELECT DATE_FORMAT(check_in_time, '%b') as label, 
                           DATE_FORMAT(check_in_time, '%Y-%m-01') as month_date,
                           COUNT(*) as visitors
                    FROM visitor_requests
                    WHERE check_in_time >= DATE_FORMAT(CURRENT_DATE, '%Y-01-01')
                    GROUP BY label, month_date
                )
                SELECT m.label, COALESCE(c.visitors, 0) as visitors
                FROM months m
                LEFT JOIN counts c ON m.month_date = c.month_date
                ORDER BY m.month_date
            """)
        else: # Default or Quarterly (last 90 days)
            cursor.execute("""
                WITH RECURSIVE months_cte AS (
                    SELECT 0 AS lvl
                    UNION ALL
                    SELECT lvl + 1 FROM months_cte WHERE lvl < 3
                ),
                months AS (
                    SELECT 
                        DATE_FORMAT(DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL (3 - lvl) MONTH), '%b') as label,
                        DATE_SUB(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL (3 - lvl) MONTH) as month_date
                    FROM months_cte
                ),
                counts AS (
                    SELECT DATE_FORMAT(check_in_time, '%b') as label, 
                           DATE_FORMAT(check_in_time, '%Y-%m-01') as month_date,
                           COUNT(*) as visitors
                    FROM visitor_requests
                    WHERE check_in_time >= CURRENT_DATE - INTERVAL 90 DAY
                    GROUP BY label, month_date
                )
                SELECT m.label, COALESCE(c.visitors, 0) as visitors
                FROM months m
                LEFT JOIN counts c ON m.month_date = c.month_date
                ORDER BY m.month_date
            """)
        
        trend = [{"label": r[0], "visitors": r[1]} for r in cursor.fetchall()]

        # ------------------ TOP DEPARTMENTS ------------------
        cursor.execute(f"""
            SELECT v.department, COUNT(*)
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE {where_clause}
            GROUP BY v.department
            ORDER BY COUNT(*) DESC
            LIMIT 5
        """)
        top_departments = [{"name": r[0] or "Unknown", "count": r[1]} for r in cursor.fetchall()]

        # ------------------ TOP VENDORS ------------------
        cursor.execute(f"""
            SELECT v.company_name, COUNT(*)
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE {where_clause}
            GROUP BY v.company_name
            ORDER BY COUNT(*) DESC
            LIMIT 5
        """)
        top_vendors = [{"name": r[0] or "Unknown", "count": r[1]} for r in cursor.fetchall()]
        
        def format_duration(dur):
            if not dur: return "-"
            if hasattr(dur, "total_seconds"):
                total_seconds = int(dur.total_seconds())
                hours = total_seconds // 3600
                minutes = (total_seconds % 3600) // 60
                return f"{hours:02d}:{minutes:02d}"
            s = str(dur)
            if "days" in s:
                # handle '0 days 05:40:06.283466'
                parts = s.split(",")
                time_part = parts[-1].strip()
                return ":".join(time_part.split(":")[:2])
            return ":".join(s.split(":")[:2])

        # ------------------ VISIT DURATION ------------------
        cursor.execute(f"""
            SELECT AVG(TIMESTAMPDIFF(MINUTE, vr.check_in_time, vr.check_out_time))
            FROM visitor_requests vr
            WHERE {where_clause} AND vr.check_in_time IS NOT NULL AND vr.check_out_time IS NOT NULL
        """)
        avg_duration = cursor.fetchone()[0]
        avg_duration = round(float(avg_duration or 0), 2)
        

        # ------------------ VISITOR LIST ------------------
        cursor.execute(f"""
            SELECT vr.request_id, v.visitor_name, v.email, v.mobile_number,
                   vr.purpose, v.department,
                   vr.check_in_time, vr.check_out_time, 
                   TIMEDIFF(COALESCE(vr.manual_check_out_time, vr.check_out_time), vr.check_in_time) AS time_available,
                   v.company_name, COALESCE(u_host.name, v.person_to_visit) AS person_to_visit,
                   vr.manual_check_out_time,
                   vr.status,
                   u_host.name AS host_name,
                   u_from.name AS transfer_from_host_name
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            LEFT JOIN users u_host ON vr.host_id = u_host.user_id
            LEFT JOIN users u_from ON vr.transfer_from_host_id = u_from.user_id
            WHERE {where_clause}
            ORDER BY vr.created_at DESC
            LIMIT 1000
        """)

        visitors = []
        # 🔄 Robust Clean-up for JSON serialization
        for r in cursor.fetchall():
            checkout_val = r[11] if r[11] else r[7] # Use manual_check_out_time if present, otherwise check_out_time
            row = {
                "visitor_id": r[0],
                "name": r[1],
                "email": r[2],
                "phone": r[3],
                "purpose": r[4],
                "department": r[5],
                "category": r[4],
                "check_in": r[6].strftime("%I:%M %p") if r[6] and hasattr(r[6], "strftime") else (str(r[6]) if r[6] else "-"),
                "check_out": checkout_val.strftime("%I:%M %p") if checkout_val and hasattr(checkout_val, "strftime") else (str(checkout_val) if checkout_val else "-"),
                "manual_check_out": r[11].strftime("%I:%M %p") if r[11] and hasattr(r[11], "strftime") else (str(r[11]) if r[11] else "-"),
                "time_available": format_duration(r[8]),
                "company": r[9] or "-",
                "person_visited": r[10] or "-",
                "date": r[6].strftime("%d %b %Y") if r[6] and hasattr(r[6], "strftime") else "-",
                "status": r[12] or "-",
                "host_name": r[13] or "-",
                "transfer_from_host_name": r[14] or "-"
            }
            # Convert any non-stringable objects to strings
            for key, value in row.items():
                if value is not None and not isinstance(value, (int, float, str, bool)):
                    row[key] = str(value)
            visitors.append(row)

        return jsonify({
            "summary": {
                "todayCount": today,
                "mtdCount": mtd,
                "ytdCount": ytd,
                "periodCount": period_count,
                "avgDaily": avg_daily,
                "deniedPercent": 0,  # optional later
                "peakHour": peak_hour,
                "repeatPercent": repeat_percent  # optional later
            },

            "trend": trend,
            "categorySplit": category_split,
            "denialTracking": [],

            "advancedInsights": {
                "topDepartments": top_departments,
                "topVendors": top_vendors,
                "avgDuration": avg_duration,
                "gateTraffic": [],
                "repeatRatio": repeat_ratio
            },

            "visitors": visitors
        })
    except Exception as e:
        print("[ERROR] get_reports:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
@reports_bp.route("/api/reports/export-excel", methods=["GET"])
def export_excel():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        period = request.args.get("period", "daily")
        where_clause = get_period_filter(period, "vr")
        query = f"""
            SELECT 
                v.visitor_name AS "VISITORS NAME",
                v.mobile_number AS "CONTACT NUMBER",
                v.company_name AS "COMPANY NAME",
                COALESCE(u_host.name, v.person_to_visit) AS "PERSON VISITED",
                u_host.name AS "HOST",
                u_from.name AS "TRANSFER FROM",
                vr.status AS "STATUS",
                v.department AS "DEPARTMENT",
                DATE(COALESCE(vr.check_in_time, vr.approved_at, vr.created_at)) AS "DATE",
                vr.check_in_time AS "IN",
                COALESCE(vr.manual_check_out_time, vr.check_out_time) AS "OUT",
                vr.manual_check_out_time AS "MANUAL OUT",
                TIMEDIFF(COALESCE(vr.manual_check_out_time, vr.check_out_time), vr.check_in_time) AS "TIME AVAILABLE"
            FROM visitor_requests vr
            JOIN visitors v ON vr.visitor_id = v.visitor_id
            LEFT JOIN users u_host ON vr.host_id = u_host.user_id
            LEFT JOIN users u_from ON vr.transfer_from_host_id = u_from.user_id
            WHERE {where_clause}
            ORDER BY vr.created_at DESC
        """

        df = pd.read_sql(query, conn)
        
        # Add SR. NO column at the beginning
        df.insert(0, 'SR. NO', range(1, 1 + len(df)))

        # Format Date Columns for Excel
        for col in ['IN', 'OUT', 'MANUAL OUT']:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col]).dt.strftime('%I:%M %p').replace('NaT', '-')

        # Format the DATE column
        if 'DATE' in df.columns:
            df['DATE'] = pd.to_datetime(df['DATE']).dt.strftime('%d %b %Y').replace('NaT', '-')

        # Convert Time Available to string and format it
        if 'TIME AVAILABLE' in df.columns:
            def clean_dur(val):
                if pd.isna(val) or val is None or str(val) == 'None': return "-"
                s = str(val)
                # handle '0 days 05:40:06.28' or '05:40:06'
                if "days" in s: s = s.split(",")[-1].strip()
                parts = s.split(":")
                if len(parts) >= 2:
                    return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
                return s
            df['TIME AVAILABLE'] = df['TIME AVAILABLE'].apply(clean_dur)

        # Convert to Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            df.to_excel(writer, index=False, sheet_name='Report')
            
            # Auto-adjust columns width
            worksheet = writer.sheets['Report']
            for i, col in enumerate(df.columns):
                column_len = max(df[col].astype(str).str.len().max(), len(col)) + 2
                worksheet.set_column(i, i, column_len)

        output.seek(0)

        return send_file(
            output,
            download_name="Visitor_Report.xlsx",
            as_attachment=True,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        print("[ERROR] export_excel:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()