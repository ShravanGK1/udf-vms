# routes/reports_routes.py
import datetime
from flask import Blueprint, jsonify, request, send_file
from utils.auth_utils import get_current_user_from_request
from services.report_service import (
    get_report_data,
    build_excel_report,
    AuthenticationError,
    AuthorizationError
)

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/api/reports", methods=["GET"])
def get_reports():
    """
    Returns structured JSON report data scoped strictly by the authenticated user's role and assigned site(s).
    """
    user_id, role = get_current_user_from_request(request)
    if not user_id:
        return jsonify({"error": "Unauthorized: Authentication required"}), 401

    period = request.args.get("period", "daily")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    req_site_id = request.args.get("site_id") or request.headers.get("X-Site-ID")

    try:
        data = get_report_data(
            user_id=user_id,
            role=role,
            period=period,
            start_date=start_date,
            end_date=end_date,
            req_site_id=req_site_id
        )
        return jsonify(data), 200
    except AuthenticationError as e:
        return jsonify({"error": str(e)}), 401
    except AuthorizationError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print("[ERROR] get_reports:", e)
        return jsonify({"error": str(e)}), 500


@reports_bp.route("/api/reports/export-excel", methods=["GET"])
def export_excel():
    """
    Generates and downloads an Excel workbook (.xlsx) matching the PDF report format and rules.
    Scoped strictly by the authenticated user's role and assigned site(s).
    """
    user_id, role = get_current_user_from_request(request)
    if not user_id:
        return jsonify({"error": "Unauthorized: Authentication required"}), 401

    period = request.args.get("period", "daily")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    req_site_id = request.args.get("site_id") or request.headers.get("X-Site-ID")

    try:
        report_data = get_report_data(
            user_id=user_id,
            role=role,
            period=period,
            start_date=start_date,
            end_date=end_date,
            req_site_id=req_site_id
        )
        excel_buffer = build_excel_report(report_data)

        period_tag = period or "custom"
        date_tag = datetime.date.today().strftime("%Y%m%d")
        download_filename = f"Visitor_Report_{period_tag}_{date_tag}.xlsx"

        return send_file(
            excel_buffer,
            download_name=download_filename,
            as_attachment=True,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except AuthenticationError as e:
        return jsonify({"error": str(e)}), 401
    except AuthorizationError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print("[ERROR] export_excel:", e)
        return jsonify({"error": str(e)}), 500