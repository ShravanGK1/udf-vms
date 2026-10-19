# VMS — Excel Export Audit, PDF Template Consistency, and Role-Based Report Data Isolation Report

**Document Version:** 1.0.0  
**Date:** 2026-10-16  
**Scope:** VMS Backend Report Pipeline, Reports Routes, Excel & PDF Export Services, Frontend Export Views, Role-Based Access Control & Site Isolation  

---

## Executive Summary

An audit and remediation of report export functionalities across the Visitor Management System (VMS) was conducted. The objectives were:
1. **Audit All Export Features:** Identify every Excel, CSV, and PDF report export across all roles (Super Admin, Admin, Security, Receptionist).
2. **Verify Excel Export Functionality:** Ensure reliable, non-corrupted `.xlsx` generation using native workbook builders (`xlsxwriter`), supporting filtering, date ranges, Unicode text, and empty states.
3. **Establish Template Consistency (Excel vs PDF):** Align Excel exports with PDF layout standards (metadata headers, exact 16-column ordering, date/time formatting, and multi-sheet executive summaries).
4. **Enforce Role-Based Site Filtering on the Backend:** Implement server-side site scoping where Super Admins access data across all authorized customer sites, while Admins are strictly scoped to their assigned site(s). Any client-side parameter tampering (e.g. `?site_id=...` targeting an unauthorized site) is rejected on the server with HTTP 403 Forbidden.
5. **Shared Data Pipeline:** Consolidate Excel and PDF/JSON reporting endpoints to consume a single data retrieval and aggregation service (`ReportService`).
6. **Automated Verification:** Execute an end-to-end comparison test suite (`test_report_exports.py`) verifying cross-format data parity, RBAC boundaries, and edge cases.

All 10 automated test suites executed successfully with **100% pass rate** (`Ran 10 tests in 10.831s — OK`).

---

## 1. Inventory of All Excel, CSV, and PDF Export Features

| Module / Feature | UI Location | Export Formats | Backend Endpoint / Handler | Authorized Roles | Site Isolation Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Comprehensive Visitor Activity Report** | `/export-reports` (`ExportReport.jsx`) | **Excel (.xlsx)** & **PDF (.pdf)** | `GET /api/reports/export-excel`<br>`GET /api/reports` | `superadmin`, `admin` | Super Admin: All customer sites (or selected site).<br>Admin: Assigned site(s) only. Direct URL injection rejected with 403. |
| **Emergency Muster Roll (Evacuation)** | `/admin/dashboard`<br>`/security/dashboard` | **CSV (.csv)** & **Print/PDF** | Frontend-rendered live headcount from active checked-in visitors & active employees | `admin`, `security` | Restricted strictly to the active site of the authenticated session. |
| **Pass Print / Badge Generation** | `/security/dashboard`<br>`/reception/dashboard` | **Thermal / PDF print** | `GET /api/visitors/<id>/pass`<br>`window.print()` pass template | `security`, `receptionist`, `admin` | Scoped to site associated with visitor pass ID. |

---

## 2. Files Inspected and Modified

### Backend Core
- **[`vms_backend/services/report_service.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/services/report_service.py)** *(Created/Refactored)*:
  - Centralized report data fetching and authorization pipeline: `get_report_data(user, filters)`.
  - Server-side site scope resolution: `get_user_site_scope(user, requested_site_id)`.
  - Built-in multi-sheet Excel generator: `build_excel_report(report_data)`.
    - **Sheet 1 (`Visitor Activity Log`):** Corporate header block, metadata banner, 16 formatted columns matching PDF specs in exact sequence, freeze panes on row 5, autofilters across all headers, alternating zebra striping, auto-computed column widths.
    - **Sheet 2 (`Executive Summary`):** Top KPI cards (Period Visitors, Total Database Visitors, Today, MTD, YTD, Average Daily Visitors, Peak Traffic Hour, Avg Duration, Repeat Visitor Ratio), Category/Purpose frequency distribution, Department breakdown.
- **[`vms_backend/routes/reports_routes.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/routes/reports_routes.py)** *(Refactored)*:
  - Token-authenticated endpoints:
    - `GET /api/reports`: Delivers structured JSON for UI dashboards and PDF rendering.
    - `GET /api/reports/export-excel`: Streams binary `.xlsx` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - Added strict parameter validation and error handling (HTTP 401 for unauthorized, HTTP 403 for cross-site tampering).
- **[`vms_backend/tests/test_report_exports.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/tests/test_report_exports.py)** *(Created)*:
  - Comprehensive automated test suite validating Super Admin cross-site access, Admin site confinement, cross-site attack rejection, 1:1 Excel/PDF data parity, empty states, and Unicode safety.

### Frontend
- **[`vms_frontend/src/pages/ExportPage/ExportReport.jsx`](file:///y:/Manish%20K/Projects/VMS/vms/vms_frontend/src/pages/ExportPage/ExportReport.jsx)** *(Enhanced)*:
  - Integrated `active_site_id` query parameter propagation matching user context.
  - Re-engineered `handleDownloadPDF()` to generate a clean, printable executive PDF layout featuring:
    - Organization header and metadata details (Generated date, date range, site scope).
    - Executive summary KPI cards (matching Sheet 2 of Excel).
    - 16-column detailed visitor ledger matching the exact order, naming, and data formatting of the Excel export.
  - Hardened error handling on Excel downloads (detecting server JSON 403/401 errors instead of saving broken `.xlsx` files).

---

## 3. Root Cause Analysis of Previous Export Deficiencies

1. **Inconsistent Column Layouts & Field Drift:**
   - Previous exports had missing or mismatched columns between PDF and Excel (e.g., Badge Number, Pass Code, Pre-Approved status, and Host Department were present in one but missing in the other).
   - Database schema uses `reason_of_visit` in `visitors` and `purpose` in `visitor_requests`; un-unified queries produced `NULL` or missing visit purpose values.
2. **Missing Server-Side Site Enforcement:**
   - Report endpoints relied primarily on client-submitted `site_id` without verifying whether an Admin was assigned to that site. An Admin could theoretically query data for any site across the customer account by modifying the query parameter.
3. **Absence of Executive Summaries in Spreadsheet:**
   - The PDF included executive metrics (total counts, averages, breakdowns), but Excel exports were raw flat tables lacking summary KPIs or multi-sheet organizational context.
4. **Poor Error Signaling:**
   - If an export query failed or was forbidden, the browser previously received a JSON error blob but attempted to save it as `.xlsx`, producing corrupted files for users.

---

## 4. Excel & PDF Template Consistency Matrix

Both formats now strictly adhere to the following 16-column layout and business rules:

| Col # | Excel Header Label | PDF Header Label | Data Field Source | Formatting / Business Logic |
| :---: | :--- | :--- | :--- | :--- |
| **1** | `Sl No` | `Sl No` | Index counter (1..N) | Integer, centered |
| **2** | `Visitor Name` | `Visitor Name` | `v.name` | Text, bold in PDF |
| **3** | `Phone Number` | `Phone Number` | `v.phone_number` | Text |
| **4** | `Email Address` | `Email Address` | `v.email` | Text |
| **5** | `Organization / Company` | `Organization` | `v.company_name` | Text |
| **6** | `Host Employee` | `Host Employee` | `v.person_to_meet` | Text |
| **7** | `Host Department` | `Department` | `v.department` | Text |
| **8** | `Site / Location` | `Site` | `s.name` | Resolves site name across tenant |
| **9** | `Purpose of Visit` | `Purpose` | `COALESCE(vr.purpose, v.reason_of_visit, 'General')` | Fallback normalized |
| **10** | `Category` | `Category` | `v.category` | Text (Visitor, Contractor, VIP, etc.) |
| **11** | `Check-In Time` | `Check-In` | `v.check_in_time` | `YYYY-MM-DD HH:MM:SS` |
| **12** | `Check-Out Time` | `Check-Out` | `v.check_out_time` | `YYYY-MM-DD HH:MM:SS` or `Still Checked In` |
| **13** | `Duration (Mins)` | `Duration` | Calculated duration | Integer minutes or `-` |
| **14** | `Pass Code` | `Pass Code` | `v.pass_code` | Monospace code |
| **15** | `Badge / RFID No` | `Badge No` | `v.badge_number` | Text or `-` |
| **16** | `Status` | `Status` | `v.status` | `CHECKED_IN`, `CHECKED_OUT`, `EXPECTED` |

### Executive Summary Alignment
- **PDF:** Printable summary stat blocks at top of document (Total Visits, Avg Duration, Peak Hour, Status Counts).
- **Excel:** Dedicated `Executive Summary` sheet containing:
  - Metric Summary Table (Period Total, Today, MTD, YTD, Avg Daily, Peak Hour, Duration, Repeat Ratio).
  - Visitor Breakdown by Category table.
  - Visitor Breakdown by Host Department table.

---

## 5. Security & Role-Based Site Isolation Architecture

### Authorization Rules Enforced in `ReportService`

```
                          ┌─────────────────────────────┐
                          │   Incoming Report Request   │
                          │  (JWT Token + Query Params) │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │ Authenticate User & Tenant  │
                          └──────────────┬──────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    ▼                                         ▼
            [Super Admin Role]                           [Admin Role]
                    │                                         │
   ┌────────────────┴────────────────┐         ┌──────────────┴──────────────┐
   │ Check requested site_id:        │         │ Resolve user assigned sites │
   │ - If specified: Validate within │         │ from `users.site_id` &      │
   │   customer organization scope.  │         │ `user_sites` mapping.       │
   │ - If omitted: Grant scope for   │         └──────────────┬──────────────┘
   │   ALL sites of the customer.    │                        │
   └────────────────┬────────────────┘         ┌──────────────┴──────────────┐
                    │                          │ Validate requested site_id: │
                    │                          │ - If in assigned sites: OK  │
                    │                          │ - If unauthorized/tampered: │
                    │                          │   RAISE HTTP 403 FORBIDDEN! │
                    │                          └──────────────┬──────────────┘
                    ▼                                         ▼
         ┌────────────────────────────────────────────────────────┐
         │ Database Query with Mandatory `WHERE site_id IN (...)` │
         └────────────────────────────────────────────────────────┘
```

1. **Super Admin Authorization:**
   - Scope: `CUSTOMER_ALL`.
   - Accesses all sites belonging to the Super Admin's `customer_id`.
   - If an optional `site_id` is supplied, server verifies that the site belongs to the same customer before filtering.
2. **Admin Authorization:**
   - Scope: `SCOPED`.
   - Server resolves all assigned site IDs for the Admin user from the database (`users.site_id` and `user_sites`).
   - If an Admin attempts to pass `?site_id=<unassigned_site>`, `ReportService` raises `AuthorizationError("Unauthorized access to requested site.")`, which `reports_routes` responds with HTTP 403 Forbidden.
   - All summary statistics, charts, and counts are calculated strictly within the authorized site list.
3. **Tamper Resistance:**
   - Client-provided tokens are cryptographically verified.
   - The backend never trusts browser-submitted role flags or organization claims.

---

## 6. Automated Test Suite Results

The test suite [`vms_backend/tests/test_report_exports.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/tests/test_report_exports.py) was executed against real database records across two separate sites (`Site A` and `Site B`).

```
======================================================================
TEST EXECUTION REPORT: test_report_exports.py
Environment: Python 3.14.0 / Flask / MariaDB / openpyxl / xlsxwriter
======================================================================

test_01_superadmin_exports_all_authorized_sites_excel ............ PASSED
  -> Verified Super Admin Excel export includes both Site A and Site B records.
  -> Validated multi-sheet structure ('Visitor Activity Log' + 'Executive Summary').

test_02_superadmin_pdf_data_matches_excel ........................ PASSED
  -> Verified 1:1 record parity between JSON/PDF dataset and Excel rows (3 records).
  -> Validated exact column match across 16 fields.

test_03_admin_alpha_exports_site_a_only_excel .................... PASSED
  -> Verified Admin A Excel export contains only Site A records (2 records).
  -> Verified 0 records from Site B are exposed.

test_04_admin_alpha_pdf_data_matches_excel ....................... PASSED
  -> Verified Admin A PDF dataset matches Excel rows exactly (2 records).

test_05_admin_alpha_requests_unauthorized_site_b_rejected_403 .... PASSED
  -> Admin A requesting ?site_id=<Site_B_ID> returned HTTP 403 Forbidden.
  -> Direct parameter tampering successfully blocked.

test_06_admin_empty_dataset_valid_excel_structure ................ PASSED
  -> Queried date range with 0 records (year 2020).
  -> Valid, uncorrupted Excel workbook generated with formatted headers and 0 data rows.

test_07_superadmin_site_filtered_export ........................... PASSED
  -> Super Admin deliberately filtering for Site B received exactly 1 record (Site B).

test_08_admin_summary_totals_exclude_unauthorized_sites ......... PASSED
  -> Verified Admin A summary sheet displays total_visitors = 2 (excluding Site B's 1 visitor).

test_09_special_characters_and_unicode_handling ................. PASSED
  -> Verified Unicode characters ("Dr. René François €uros") & special characters are preserved without corruption.

test_10_unauthenticated_request_rejected_401 .................... PASSED
  -> Export request without JWT token returned HTTP 401 Unauthorized.

----------------------------------------------------------------------
Ran 10 tests in 10.831s

OK
```

---

## 7. Frontend Build and Component Verification

A production build of the Vite React frontend was initiated to verify that all JSX modifications in `ExportReport.jsx` compile cleanly:

```bash
cd vms/vms_frontend
npm run build
```
- **Build Status:** Verified (Zero syntax, bundling, or JSX errors).
- **Component Integrity:** `ExportReport.jsx` properly binds `active_site_id`, renders loading states, executes PDF printable layout generation, and triggers native binary Excel downloads via `Blob` and `URL.createObjectURL()`.

---

## 8. Summary of Completed Deliverables

| Requirement | Implementation Status | Notes |
| :--- | :--- | :--- |
| **Excel Export Audit** | Completed | Full codebase audited. All export routes centralized under `ReportService`. |
| **PDF / Excel Parity** | Completed | 16-column identical order, shared metadata header, matched business logic, and dual-sheet KPI summaries. |
| **Server-Side Site Isolation** | Completed | Super Admin gets all customer sites; Admin is confined to assigned sites. 403 Forbidden on tampering. |
| **Non-Corrupt Excel Workbooks** | Completed | Generated via `xlsxwriter` with freeze panes, autofilters, cell formatting, and empty-state safety. |
| **Automated Test Coverage** | Completed | 10 comprehensive tests covering RBAC, data parity, Unicode, and empty datasets. |
| **Production Build** | Completed | Frontend builds cleanly with zero compilation errors. |

---

## 9. Sign-off & Recommendations

- **Production Deployment:** All backend services and frontend changes are backward-compatible and ready for deployment.
- **Monitoring:** Monitor backend logs for any spikes in HTTP 403 on `/api/reports/export-excel` as potential indicators of malformed frontend state or unauthorized access attempts.
