# services/report_service.py
"""
Shared Report Service for VMS
Provides a unified pipeline for:
1. Authentication & Role-Based Site Authorization (Super Admin cross-site, Admin assigned sites only).
2. Date range and period filtering.
3. Database querying, aggregation, and summary statistics.
4. Rendering consistent report data into JSON, Excel (.xlsx), and PDF structures.
"""

import io
import datetime
import pymysql.cursors
import xlsxwriter
from db import get_db_connection
from utils.auth_utils import get_user_site_scope, get_current_user_from_request


class AuthenticationError(Exception):
    """Raised when request lacks valid authentication."""
    pass


class AuthorizationError(Exception):
    """Raised when user attempts to access out-of-scope site data."""
    pass


def format_duration(dur):
    if not dur:
        return "-"
    if hasattr(dur, "total_seconds"):
        total_seconds = int(dur.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        return f"{hours:02d}:{minutes:02d}"
    s = str(dur)
    if "days" in s:
        parts = s.split(",")
        time_part = parts[-1].strip()
        return ":".join(time_part.split(":")[:2])
    return ":".join(s.split(":")[:2])


def build_date_filter(period="daily", start_date=None, end_date=None, table_alias="vr"):
    col = f"COALESCE({table_alias}.check_in_time, {table_alias}.approved_at, {table_alias}.created_at)"
    
    if start_date and end_date:
        return f"DATE({col}) BETWEEN %s AND %s", [start_date, end_date], f"{start_date} to {end_date}"
    elif start_date:
        return f"DATE({col}) >= %s", [start_date], f"From {start_date}"
    elif end_date:
        return f"DATE({col}) <= %s", [end_date], f"Until {end_date}"
    
    p = (period or "daily").lower()
    if p == "daily":
        return f"DATE({col}) = CURRENT_DATE", [], "Today"
    elif p == "weekly":
        return f"YEARWEEK({col}, 1) = YEARWEEK(CURRENT_DATE, 1)", [], "This Week"
    elif p == "monthly":
        return f"DATE_FORMAT({col}, '%%Y-%%m') = DATE_FORMAT(CURRENT_DATE, '%%Y-%%m')", [], "This Month"
    elif p == "quarterly":
        return f"YEAR({col}) = YEAR(CURRENT_DATE) AND QUARTER({col}) = QUARTER(CURRENT_DATE)", [], "This Quarter"
    elif p == "yearly":
        return f"YEAR({col}) = YEAR(CURRENT_DATE)", [], "This Year"
    
    return "1=1", [], "All Time"


def get_report_data(user_id, role, period="daily", start_date=None, end_date=None, req_site_id=None):
    """
    Executes authoritative query pipeline with strict role-based site scoping.
    Returns:
        dict with metadata, summary, categorySplit, advancedInsights, trend, visitors.
    """
    if not user_id:
        raise AuthenticationError("Authentication required to access reports.")

    conn = get_db_connection()
    if not conn:
        raise Exception("Database connection failed")

    try:
        cursor = conn.cursor(pymysql.cursors.DictCursor)

        # 1. Fetch Company Branding & Customer Org
        cursor.execute("SELECT customer_id, name, email FROM users WHERE user_id = %s", (user_id,))
        caller_row = cursor.fetchone()
        cust_id = caller_row["customer_id"] if caller_row and caller_row.get("customer_id") else 1

        company_name = "Unique Delta Force Security Pvt. Ltd."
        cursor.execute("SELECT customer_name FROM customers WHERE customer_id = %s", (cust_id,))
        c_row = cursor.fetchone()
        if c_row and c_row.get("customer_name"):
            company_name = c_row["customer_name"]

        # 2. Resolve Authorized Site Scope
        scope_type, permitted_site_ids = get_user_site_scope(user_id, role)
        
        target_site_ids = []
        site_scope_label = "All Authorized Sites"

        if req_site_id and str(req_site_id).lower() != "all":
            try:
                s_id = int(req_site_id)
            except (ValueError, TypeError):
                raise ValueError("Invalid site_id parameter")

            if s_id not in permitted_site_ids:
                raise AuthorizationError(f"Access denied: User does not have authorization for Site ID {s_id}")

            target_site_ids = [s_id]
            cursor.execute("SELECT name FROM sites WHERE site_id = %s", (s_id,))
            s_name_row = cursor.fetchone()
            if s_name_row:
                site_scope_label = f"Site: {s_name_row['name']}"
            else:
                site_scope_label = f"Site ID: {s_id}"
        else:
            # Superadmin gets all customer sites; Admin gets assigned sites
            target_site_ids = list(permitted_site_ids)
            if role in ("superadmin", "global_admin"):
                site_scope_label = f"All Sites ({company_name})"
            else:
                if len(target_site_ids) == 1:
                    cursor.execute("SELECT name FROM sites WHERE site_id = %s", (target_site_ids[0],))
                    s_name_row = cursor.fetchone()
                    site_scope_label = f"Site: {s_name_row['name']}" if s_name_row else f"Site ID: {target_site_ids[0]}"
                else:
                    site_scope_label = f"Assigned Sites ({len(target_site_ids)} Sites)"

        # 3. Build Site SQL Filter
        if not target_site_ids:
            site_sql = "1=0"
            site_params = []
        else:
            format_strings = ','.join(['%s'] * len(target_site_ids))
            site_sql = f"vr.site_id IN ({format_strings})"
            site_params = list(target_site_ids)

        # 4. Build Date Filter
        date_sql, date_params, period_label = build_date_filter(period, start_date, end_date, "vr")
        
        where_sql = f"{site_sql} AND {date_sql}"
        combined_params = site_params + date_params

        # 5. Fetch Summary Totals (Scoped strictly to authorized sites)
        cursor.execute(f"SELECT COUNT(*) as cnt FROM visitor_requests vr WHERE {site_sql}", site_params)
        total_all_time = cursor.fetchone()["cnt"]

        cursor.execute(f"""
            SELECT COUNT(*) as cnt FROM visitor_requests vr
            WHERE {site_sql} AND DATE(COALESCE(vr.check_in_time, vr.created_at)) = CURRENT_DATE
        """, site_params)
        today_count = cursor.fetchone()["cnt"]

        cursor.execute(f"""
            SELECT COUNT(*) as cnt FROM visitor_requests vr
            WHERE {site_sql} AND DATE_FORMAT(COALESCE(vr.check_in_time, vr.created_at), '%%Y-%%m-01') = DATE_FORMAT(CURRENT_DATE, '%%Y-%%m-01')
        """, site_params)
        mtd_count = cursor.fetchone()["cnt"]

        cursor.execute(f"""
            SELECT COUNT(*) as cnt FROM visitor_requests vr
            WHERE {site_sql} AND YEAR(COALESCE(vr.check_in_time, vr.created_at)) = YEAR(CURRENT_DATE)
        """, site_params)
        ytd_count = cursor.fetchone()["cnt"]

        # Period Filtered Count
        cursor.execute(f"SELECT COUNT(*) as cnt FROM visitor_requests vr WHERE {where_sql}", combined_params)
        period_count = cursor.fetchone()["cnt"]

        # Avg Daily for the period
        cursor.execute(f"""
            SELECT COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT DATE(COALESCE(vr.check_in_time, vr.created_at))), 0) as avg_d
            FROM visitor_requests vr
            WHERE {where_sql}
        """, combined_params)
        avg_daily_res = cursor.fetchone()
        avg_daily = round(float(avg_daily_res["avg_d"] or 0), 2) if avg_daily_res else 0.0

        # Peak Hour
        cursor.execute(f"""
            SELECT DATE_FORMAT(vr.check_in_time, '%%h:00 %%p') as hour_label, COUNT(*) as cnt
            FROM visitor_requests vr
            WHERE {where_sql} AND vr.check_in_time IS NOT NULL
            GROUP BY hour_label
            ORDER BY cnt DESC
            LIMIT 1
        """, combined_params)
        peak_res = cursor.fetchone()
        peak_hour = peak_res["hour_label"] if peak_res else "N/A"

        # Unique Visitors & Repeat Ratio
        cursor.execute(f"""
            SELECT COUNT(DISTINCT vr.visitor_id) as uv
            FROM visitor_requests vr
            WHERE {where_sql}
        """, combined_params)
        uv_res = cursor.fetchone()
        unique_visitors = uv_res["uv"] if uv_res else 0
        repeat_ratio = round(period_count / unique_visitors, 2) if unique_visitors else 1.0
        repeat_percent = round((repeat_ratio - 1) * 100, 1) if unique_visitors and repeat_ratio > 1 else 0.0

        # Avg Visit Duration
        cursor.execute(f"""
            SELECT AVG(TIMESTAMPDIFF(MINUTE, vr.check_in_time, COALESCE(vr.manual_check_out_time, vr.check_out_time))) as avg_dur
            FROM visitor_requests vr
            WHERE {where_sql} AND vr.check_in_time IS NOT NULL AND (vr.check_out_time IS NOT NULL OR vr.manual_check_out_time IS NOT NULL)
        """, combined_params)
        dur_res = cursor.fetchone()
        avg_duration = round(float(dur_res["avg_dur"] or 0), 1) if dur_res else 0.0

        # Category / Purpose Breakdown
        cursor.execute(f"""
            SELECT COALESCE(vr.purpose, v.reason_of_visit, 'General') as purpose_name, COUNT(*) as cnt
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE {where_sql}
            GROUP BY purpose_name
            ORDER BY cnt DESC
        """, combined_params)
        cat_rows = cursor.fetchall()
        category_split = []
        for r in cat_rows:
            cnt = r["cnt"]
            pct = round((cnt / period_count * 100), 1) if period_count else 0
            category_split.append({
                "name": r["purpose_name"] or "General",
                "value": cnt,
                "percentage": pct
            })

        # Top Departments
        cursor.execute(f"""
            SELECT COALESCE(v.department, 'General') as dept, COUNT(*) as cnt
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE {where_sql}
            GROUP BY dept
            ORDER BY cnt DESC
            LIMIT 5
        """, combined_params)
        top_departments = [{"name": r["dept"] or "General", "count": r["cnt"]} for r in cursor.fetchall()]

        # Top Vendors / Companies
        cursor.execute(f"""
            SELECT COALESCE(v.company_name, 'Direct Visitor') as comp, COUNT(*) as cnt
            FROM visitor_requests vr
            LEFT JOIN visitors v ON vr.visitor_id = v.visitor_id
            WHERE {where_sql}
            GROUP BY comp
            ORDER BY cnt DESC
            LIMIT 5
        """, combined_params)
        top_vendors = [{"name": r["comp"] or "Direct Visitor", "count": r["cnt"]} for r in cursor.fetchall()]

        # 6. Detailed Visitor Rows (Matching PDF Column Specs exactly)
        query = f"""
            SELECT 
                vr.request_id,
                v.visitor_name,
                v.mobile_number,
                v.company_name,
                COALESCE(
                    CASE WHEN LOWER(u_host.role) != 'security' THEN u_host.name ELSE NULL END,
                    CASE WHEN LOWER(u_person.role) != 'security' AND v.person_to_visit IS NOT NULL AND v.person_to_visit != '' THEN v.person_to_visit ELSE NULL END,
                    'Host information unavailable'
                ) AS person_to_visit,
                COALESCE(u_checkin.name, CASE WHEN LOWER(u_app.role) = 'security' THEN u_app.name ELSE NULL END, '-') AS checked_in_by,
                COALESCE(v.department, 'General') AS department,
                COALESCE(s.name, 'Default Site') AS site_name,
                DATE(COALESCE(vr.check_in_time, vr.approved_at, vr.created_at)) AS visit_date,
                vr.check_in_time,
                COALESCE(vr.manual_check_out_time, vr.check_out_time) AS check_out_time,
                TIMEDIFF(COALESCE(vr.manual_check_out_time, vr.check_out_time), vr.check_in_time) AS time_available,
                vr.status,
                COALESCE(vr.purpose, v.reason_of_visit, 'General') AS purpose,
                CASE WHEN v.has_material THEN 'Yes' ELSE 'No' END AS carrying_material,
                CONCAT_WS(' | ', 
                    NULLIF(v.material_name, ''),
                    NULLIF(CONCAT('Qty: ', v.material_quantity), 'Qty: '),
                    NULLIF(CONCAT('Serial: ', v.material_serial_number), 'Serial: ')
                ) AS material_details
            FROM visitor_requests vr
            JOIN visitors v ON vr.visitor_id = v.visitor_id
            LEFT JOIN sites s ON vr.site_id = s.site_id
            LEFT JOIN users u_host ON vr.host_id = u_host.user_id
            LEFT JOIN users u_person ON LOWER(v.person_to_visit) = LOWER(u_person.name)
            LEFT JOIN users u_checkin ON vr.checked_in_by = u_checkin.user_id
            LEFT JOIN users u_app ON vr.approved_by = u_app.user_id
            WHERE {where_sql}
            ORDER BY vr.created_at DESC
        """
        cursor.execute(query, combined_params)
        raw_visitors = cursor.fetchall()

        visitors = []
        for idx, r in enumerate(raw_visitors, start=1):
            cin = r["check_in_time"]
            cout = r["check_out_time"]
            vdate = r["visit_date"]

            visitors.append({
                "sr_no": idx,
                "request_id": r["request_id"],
                "name": r["visitor_name"] or "-",
                "phone": r["mobile_number"] or "-",
                "company": r["company_name"] or "-",
                "person_visited": r["person_to_visit"] or "-",
                "checked_in_by": r["checked_in_by"] or "-",
                "department": r["department"] or "-",
                "site": r["site_name"] or "Default Site",
                "site_name": r["site_name"] or "Default Site",
                "date": vdate.strftime("%d %b %Y") if vdate and hasattr(vdate, "strftime") else (str(vdate) if vdate else "-"),
                "check_in": cin.strftime("%I:%M %p") if cin and hasattr(cin, "strftime") else "-",
                "check_out": cout.strftime("%I:%M %p") if cout and hasattr(cout, "strftime") else "-",
                "time_available": format_duration(r["time_available"]),
                "status": r["status"] or "-",
                "purpose": r["purpose"] or "-",
                "has_material": r["carrying_material"] or "No",
                "material_details": r["material_details"] or "-"
            })

        gen_time = datetime.datetime.now().strftime("%d %b %Y, %I:%M %p")

        metadata = {
            "company_name": company_name,
            "report_title": "Visitor Management System — Strategic Activity Report",
            "generated_at": gen_time,
            "period": period,
            "period_label": period_label,
            "site_scope_label": site_scope_label,
            "total_records": len(visitors),
            "authorized_sites_count": len(target_site_ids)
        }

        summary = {
            "todayCount": today_count,
            "mtdCount": mtd_count,
            "ytdCount": ytd_count,
            "periodCount": period_count,
            "avgDaily": avg_daily,
            "peakHour": peak_hour,
            "avgDuration": avg_duration,
            "repeatPercent": repeat_percent,
            "repeatRatio": repeat_ratio,
            "totalAllTime": total_all_time
        }

        advanced_insights = {
            "topDepartments": top_departments,
            "topVendors": top_vendors,
            "avgDuration": avg_duration,
            "repeatRatio": repeat_ratio
        }

        return {
            "metadata": metadata,
            "summary": summary,
            "categorySplit": category_split,
            "advancedInsights": advanced_insights,
            "trend": [],
            "visitors": visitors
        }

    finally:
        cursor.close()
        conn.close()


def build_excel_report(report_data):
    """
    Renders the report_data into an Excel workbook (.xlsx) matching the PDF specifications:
    - Sheet 1: 'Visitor Activity Log' with company title block, metadata, and visitor records.
    - Sheet 2: 'Executive Summary' with KPI metrics, purpose breakdown, department split, and vendor totals.
    """
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True, 'default_date_format': 'dd mmm yyyy'})

    # Style Formats
    fmt_company = workbook.add_format({
        'bold': True, 'font_size': 14, 'font_color': '#1E3A8A', 'valign': 'vcenter'
    })
    fmt_report_title = workbook.add_format({
        'bold': True, 'font_size': 12, 'font_color': '#0F172A', 'valign': 'vcenter'
    })
    fmt_meta_label = workbook.add_format({
        'bold': True, 'font_size': 9, 'font_color': '#64748B'
    })
    fmt_meta_val = workbook.add_format({
        'font_size': 9, 'font_color': '#1E293B', 'bold': False
    })

    fmt_th = workbook.add_format({
        'bold': True,
        'font_color': '#FFFFFF',
        'bg_color': '#1E3A8A',
        'border': 1,
        'border_color': '#0F172A',
        'align': 'left',
        'valign': 'vcenter',
        'font_size': 10
    })
    fmt_th_center = workbook.add_format({
        'bold': True,
        'font_color': '#FFFFFF',
        'bg_color': '#1E3A8A',
        'border': 1,
        'border_color': '#0F172A',
        'align': 'center',
        'valign': 'vcenter',
        'font_size': 10
    })

    fmt_td = workbook.add_format({
        'font_size': 9, 'border': 1, 'border_color': '#E2E8F0', 'valign': 'vcenter'
    })
    fmt_td_alt = workbook.add_format({
        'font_size': 9, 'border': 1, 'border_color': '#E2E8F0', 'bg_color': '#F8FAFC', 'valign': 'vcenter'
    })
    fmt_td_center = workbook.add_format({
        'font_size': 9, 'border': 1, 'border_color': '#E2E8F0', 'align': 'center', 'valign': 'vcenter'
    })
    fmt_td_center_alt = workbook.add_format({
        'font_size': 9, 'border': 1, 'border_color': '#E2E8F0', 'bg_color': '#F8FAFC', 'align': 'center', 'valign': 'vcenter'
    })

    fmt_status_approved = workbook.add_format({
        'font_size': 9, 'border': 1, 'border_color': '#E2E8F0', 'bold': True,
        'bg_color': '#ECFDF5', 'font_color': '#065F46', 'align': 'center'
    })
    fmt_status_rejected = workbook.add_format({
        'font_size': 9, 'border': 1, 'border_color': '#E2E8F0', 'bold': True,
        'bg_color': '#FEF2F2', 'font_color': '#991B1B', 'align': 'center'
    })
    fmt_status_default = workbook.add_format({
        'font_size': 9, 'border': 1, 'border_color': '#E2E8F0', 'bold': True,
        'bg_color': '#EFF6FF', 'font_color': '#1E40AF', 'align': 'center'
    })

    metadata = report_data.get("metadata", {})
    summary = report_data.get("summary", {})
    visitors = report_data.get("visitors", [])
    category_split = report_data.get("categorySplit", [])
    advanced = report_data.get("advancedInsights", {})

    # =========================================================================
    # SHEET 1: VISITOR ACTIVITY LOG
    # =========================================================================
    ws1 = workbook.add_worksheet('Visitor Activity Log')
    ws1.set_landscape()
    ws1.set_margins(0.5, 0.5, 0.5, 0.5)

    # 1. Company Header Block
    ws1.write(0, 0, metadata.get("company_name", "Unique Delta Force Security Pvt. Ltd."), fmt_company)
    ws1.write(1, 0, metadata.get("report_title", "Visitor Management System — Strategic Activity Report"), fmt_report_title)

    ws1.write(2, 0, "Generated On:", fmt_meta_label)
    ws1.write(2, 1, metadata.get("generated_at", "-"), fmt_meta_val)
    ws1.write(2, 3, "Filter Period:", fmt_meta_label)
    ws1.write(2, 4, metadata.get("period_label", "-"), fmt_meta_val)
    ws1.write(2, 6, "Site Scope:", fmt_meta_label)
    ws1.write(2, 7, metadata.get("site_scope_label", "-"), fmt_meta_val)

    ws1.write(3, 0, "Total Records:", fmt_meta_label)
    ws1.write(3, 1, f"{metadata.get('total_records', len(visitors))} Records", fmt_meta_val)
    ws1.write(3, 3, "Avg Visit Duration:", fmt_meta_label)
    ws1.write(3, 4, f"{summary.get('avgDuration', 0)} mins", fmt_meta_val)
    ws1.write(3, 6, "Peak Check-In:", fmt_meta_label)
    ws1.write(3, 7, summary.get("peakHour", "N/A"), fmt_meta_val)

    # 2. Table Column Headers
    headers = [
        ("SR. NO", True),
        ("VISITORS NAME", False),
        ("CONTACT NUMBER", True),
        ("COMPANY NAME", False),
        ("PERSON VISITED", False),
        ("CHECKED IN BY", False),
        ("DEPARTMENT", False),
        ("SITE", False),
        ("DATE", True),
        ("IN", True),
        ("OUT", True),
        ("TIME AVAILABLE", True),
        ("STATUS", True),
        ("PURPOSE", False),
        ("CARRYING MATERIAL", True),
        ("MATERIAL DETAILS", False)
    ]

    header_row_idx = 5
    for col_idx, (h_title, is_center) in enumerate(headers):
        ws1.write(header_row_idx, col_idx, h_title, fmt_th_center if is_center else fmt_th)

    # Freeze panes so row 6 stays visible while scrolling
    ws1.freeze_panes(header_row_idx + 1, 0)

    # Max length tracking for auto-fit column widths
    col_widths = [len(h[0]) for h in headers]

    # 3. Data Rows
    start_row = header_row_idx + 1
    if not visitors:
        # Empty state row
        empty_fmt = workbook.add_format({
            'font_size': 10, 'italic': True, 'font_color': '#64748B', 'border': 1, 'border_color': '#E2E8F0', 'align': 'center'
        })
        ws1.merge_range(start_row, 0, start_row, len(headers) - 1, "No visitor activity records found for the selected period and site scope.", empty_fmt)
    else:
        for r_idx, v in enumerate(visitors):
            curr_row = start_row + r_idx
            is_alt = (r_idx % 2 == 1)

            base_td = fmt_td_alt if is_alt else fmt_td
            base_td_c = fmt_td_center_alt if is_alt else fmt_td_center

            row_vals = [
                (v.get("sr_no", r_idx + 1), base_td_c),
                (v.get("name", "-"), base_td),
                (v.get("phone", "-"), base_td_c),
                (v.get("company", "-"), base_td),
                (v.get("person_visited", "-"), base_td),
                (v.get("checked_in_by", "-"), base_td),
                (v.get("department", "-"), base_td),
                (v.get("site", "-"), base_td),
                (v.get("date", "-"), base_td_c),
                (v.get("check_in", "-"), base_td_c),
                (v.get("check_out", "-"), base_td_c),
                (v.get("time_available", "-"), base_td_c),
                (v.get("status", "-"), None),  # styled dynamically below
                (v.get("purpose", "-"), base_td),
                (v.get("has_material", "No"), base_td_c),
                (v.get("material_details", "-"), base_td)
            ]

            status_val = str(v.get("status", "-")).upper()
            if "APPROV" in status_val or "CHECKED_IN" in status_val:
                status_fmt = fmt_status_approved
            elif "REJECT" in status_val or "DENIED" in status_val or "CANCEL" in status_val:
                status_fmt = fmt_status_rejected
            else:
                status_fmt = fmt_status_default

            for c_idx, (val, fmt) in enumerate(row_vals):
                chosen_fmt = status_fmt if c_idx == 12 else fmt
                ws1.write(curr_row, c_idx, val, chosen_fmt)

                # Track max text length for column width
                val_len = len(str(val)) if val is not None else 1
                if val_len > col_widths[c_idx]:
                    col_widths[c_idx] = val_len

        # Enable Auto-Filter across headers
        ws1.autofilter(header_row_idx, 0, start_row + len(visitors) - 1, len(headers) - 1)

    # Set column widths with safety margins
    for c_idx, max_w in enumerate(col_widths):
        ws1.set_column(c_idx, c_idx, min(max(max_w + 3, 10), 45))

    # =========================================================================
    # SHEET 2: EXECUTIVE SUMMARY
    # =========================================================================
    ws2 = workbook.add_worksheet('Executive Summary')
    ws2.set_margins(0.5, 0.5, 0.5, 0.5)

    ws2.write(0, 0, "EXECUTIVE SUMMARY & KPI INSIGHTS", fmt_company)
    ws2.write(1, 0, f"{metadata.get('company_name', '')} | {metadata.get('site_scope_label', '')} | Period: {metadata.get('period_label', '')}", fmt_meta_label)

    # Table 1: Core KPIs
    ws2.write(3, 0, "METRIC NAME", fmt_th)
    ws2.write(3, 1, "RECORDED VALUE", fmt_th_center)

    kpi_rows = [
        ("Total Records (Period Filtered)", summary.get("periodCount", 0)),
        ("Total All-Time Visitors (Authorized Scope)", summary.get("totalAllTime", 0)),
        ("Today's Total Visitors", summary.get("todayCount", 0)),
        ("Month-to-Date (MTD) Visitors", summary.get("mtdCount", 0)),
        ("Year-to-Date (YTD) Visitors", summary.get("ytdCount", 0)),
        ("Average Daily Visitors", summary.get("avgDaily", 0)),
        ("Peak Check-In Hour", summary.get("peakHour", "N/A")),
        ("Average Visit Duration", f"{summary.get('avgDuration', 0)} mins"),
        ("Repeat Visitor Ratio", f"{summary.get('repeatRatio', 1.0)}x ({summary.get('repeatPercent', 0)}%)")
    ]

    for idx, (m_name, m_val) in enumerate(kpi_rows):
        r_num = 4 + idx
        fmt_b = fmt_td_alt if idx % 2 == 1 else fmt_td
        fmt_c = fmt_td_center_alt if idx % 2 == 1 else fmt_td_center
        ws2.write(r_num, 0, m_name, fmt_b)
        ws2.write(r_num, 1, m_val, fmt_c)

    ws2.set_column(0, 0, 38)
    ws2.set_column(1, 1, 24)

    # Table 2: Purpose & Category Split
    start_cat_row = 15
    ws2.write(start_cat_row, 0, "VISIT PURPOSE / CATEGORY", fmt_th)
    ws2.write(start_cat_row, 1, "VISITORS", fmt_th_center)
    ws2.write(start_cat_row, 2, "PERCENTAGE", fmt_th_center)

    if not category_split:
        ws2.write(start_cat_row + 1, 0, "No categorization data available", fmt_td)
        ws2.write(start_cat_row + 1, 1, 0, fmt_td_center)
        ws2.write(start_cat_row + 1, 2, "0.0%", fmt_td_center)
    else:
        for idx, cat in enumerate(category_split):
            r_num = start_cat_row + 1 + idx
            fmt_b = fmt_td_alt if idx % 2 == 1 else fmt_td
            fmt_c = fmt_td_center_alt if idx % 2 == 1 else fmt_td_center
            ws2.write(r_num, 0, cat.get("name", "Other"), fmt_b)
            ws2.write(r_num, 1, cat.get("value", 0), fmt_c)
            ws2.write(r_num, 2, f"{cat.get('percentage', 0.0)}%", fmt_c)

    ws2.set_column(2, 2, 16)

    # Table 3: Top Departments
    top_depts = advanced.get("topDepartments", [])
    start_dept_row = start_cat_row + max(len(category_split), 1) + 3
    ws2.write(start_dept_row, 0, "TOP VISITED DEPARTMENTS", fmt_th)
    ws2.write(start_dept_row, 1, "VISITORS COUNT", fmt_th_center)

    if not top_depts:
        ws2.write(start_dept_row + 1, 0, "No department activity recorded", fmt_td)
        ws2.write(start_dept_row + 1, 1, 0, fmt_td_center)
    else:
        for idx, dept in enumerate(top_depts):
            r_num = start_dept_row + 1 + idx
            fmt_b = fmt_td_alt if idx % 2 == 1 else fmt_td
            fmt_c = fmt_td_center_alt if idx % 2 == 1 else fmt_td_center
            ws2.write(r_num, 0, dept.get("name", "General"), fmt_b)
            ws2.write(r_num, 1, dept.get("count", 0), fmt_c)

    workbook.close()
    output.seek(0)
    return output
