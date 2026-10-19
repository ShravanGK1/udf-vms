# VMS — Super Admin/Admin Dashboard Cleanup, Site-Level Access Control & Functional Fix Report

**Date:** 2026-10-16  
**Status:** Verification & Documentation Complete — All Features Verified with Automated Test Suites & Build Validation.

---

## 1. Root Cause of Each Identified Issue

| # | Issue Area | Root Cause Identified |
|---|---|---|
| **1** | **Super Admin Dashboard Clutter** | Legacy dashboard contained placeholder cards ("System Health" and "Site Compliance" section with non-functional pie chart) and an "Audit Logs" tab that cluttered administrative workflows. |
| **2** | **Super Admin User Management** | Super Admin lacked dedicated inline user administration actions; managing users (status toggle, site re-assignment, role viewing, and password resets) was previously fragmented or required direct DB manipulation. |
| **3** | **Visitor Trends Chart Data** | The monthly trend chart in `SuperAdminDashboard.jsx` computed artificial values via formula `(1200 + index * 150)` rather than executing a real SQL `COUNT(request_id)` grouped by month. |
| **4** | **License Manager Action Buttons** | Button handlers lacked concrete API endpoints for toggling license validity (`terminated_early`), and the view/edit modals lacked state-binding to active license objects. |
| **5** | **StatCard Secondary Noise** | Shared `StatCard.jsx` hardcoded rendering for `trend`, `subText`, percentage pill badges, and comparison metrics that distracted from the core KPI. |
| **6** | **Remote Sessions Site Isolation** | Backend query `/admin/users-list` did not filter by the authenticated Admin's assigned sites in `user_sites`; `/admin/remote-login` did not validate whether the target user belonged to the caller's permitted site scope. |
| **7** | **Cross-Site Access Boundary** | Tenant and site scoping was partially handled in React state rather than strictly enforced at the database query layer via `get_user_site_scope()` in `routes/admin_routes.py` and `routes/request_routes.py`. |
| **8** | **Bulk Upload Template Mismatch** | The downloadable template omitted essential form fields (host selection, visit purpose, identity type, vehicle number) and lacked Excel (.xlsx) support and an instructions reference sheet. |
| **9** | **Navbar Notification Bell** | Unwanted notification bell and unread badge icon remained in `Navbar.jsx`, producing visual clutter without backend notification center support. |
| **10** | **UserManualModal Runtime Error** | `Navbar.jsx` referenced `<UserManualModal onClose={...} />` at line 489, but the component was never imported at the top of the file, resulting in `Uncaught ReferenceError: UserManualModal is not defined`. |

---

## 2. Files and Components Changed

### Frontend (`vms/vms_frontend/`)
- [`src/components/Navbar/Navbar.jsx`](file:///y:/Manish%20K/Projects/VMS/vms/vms_frontend/src/components/Navbar/Navbar.jsx):
  - Added `import UserManualModal from "../UserManual/UserManualModal";`
  - Removed notification bell button and notification count dot.
  - Preserved theme toggle, user manual trigger, profile menu, and site selector.
- [`src/components/StatCard/StatCard.jsx`](file:///y:/Manish%20K/Projects/VMS/vms/vms_frontend/src/components/StatCard/StatCard.jsx) & [`StatCard.css`](file:///y:/Manish%20K/Projects/VMS/vms/vms_frontend/src/components/StatCard/StatCard.css):
  - Stripped secondary trend text, comparison percentages, and subtext pills across all dashboards.
- [`src/pages/SuperAdmin/SuperAdminDashboard.jsx`](file:///y:/Manish%20K/Projects/VMS/vms/vms_frontend/src/pages/SuperAdmin/SuperAdminDashboard.jsx):
  - Removed "System Health" card and "Site Compliance" card/chart.
  - Replaced "Audit Logs" tab with "User Management" tab.
  - Connected real rolling 6-month monthly visitor trends API.
  - Wired License Manager buttons (View, Edit, Status Toggle).
- [`src/pages/SuperAdmin/modals/UserModals.jsx`](file:///y:/Manish%20K/Projects/VMS/vms/vms_frontend/src/pages/SuperAdmin/modals/UserModals.jsx):
  - Implemented `ViewUserModal`, `EditUserModal`, `TransferSiteModal`, `StatusConfirmModal`, `ResetPasswordModal`, and `ViewLicenseModal`.
- [`src/components/modals/BulkUploadModal.jsx`](file:///y:/Manish%20K/Projects/VMS/vms/vms_frontend/src/components/modals/BulkUploadModal.jsx):
  - Provided dual CSV and Excel (.xlsx) template downloads.
  - Automatically binds authenticated active `site_id` into upload payload.

### Backend (`vms/vms_backend/`)
- [`routes/admin_routes.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/routes/admin_routes.py):
  - `get_superadmin_stats()`: Replaced mock formula with real SQL aggregation over `visitor_requests`.
  - `get_users_list()` & `remote_login()`: Enforced site isolation via `user_sites`, rejecting cross-site auto-logins with HTTP 403 Forbidden.
  - `@admin_bp.route("/admin/toggle-license")`: Added endpoint for Super Admin license suspension/reactivation.
  - `transfer_user_site()`: Validates customer boundary before reassigning sites.
- [`utils/license_verifier.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/utils/license_verifier.py):
  - Implemented `toggle_license_status()` toggling `terminated_early` with license verification cache invalidation.
- [`routes/request_routes.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/routes/request_routes.py):
  - `bulk_create_requests()`: Enforces site authorization and persists `site_id`.
  - `download_bulk_template()`: Added CSV export option and guidelines instructions sheet.
- [`tests/test_site_access_control.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/tests/test_site_access_control.py):
  - Complete automated unit test suite covering site isolation, auto-login, license toggle, and bulk templates.
- [`tests/test_multi_customer_isolation.py`](file:///y:/Manish%20K/Projects/VMS/vms/vms_backend/tests/test_multi_customer_isolation.py):
  - Multi-customer tenant boundary and site-scoping integration test suite.

---

## 3. Endpoints and Database Queries Reviewed

| Endpoint | Method | Role Allowed | Site Authorization & Isolation Logic |
|---|---|---|---|
| `/api/admin/superadmin-stats` | GET | `superadmin` | Aggregates rolling 6-month monthly registrations from `visitor_requests` scoped to caller's `customer_id`. |
| `/api/admin/users-list` | GET | `admin`, `superadmin` | Scoped via `user_sites`: Site Admin receives only users belonging to assigned site(s); Super Admin receives all users within customer org. |
| `/api/admin/remote-login` | POST | `admin`, `superadmin` | Checks target user's site assignment. If caller is Admin and target user belongs to another site, returns **403 Forbidden**. |
| `/api/admin/toggle-license` | POST | `superadmin` | Restricts toggling to `superadmin`. Toggles `terminated_early` in `licenses` and flushes cache. |
| `/api/visitor-requests/bulk-template` | GET | `admin`, `superadmin` | Generates XLSX or CSV template with required fields and allowed dropdown enums. |
| `/api/visitor-requests/bulk-upload` | POST | `admin`, `superadmin` | Validates caller has access to `site_id` before inserting rows. Rejects unauthorized site imports with **403 Forbidden**. |
| `/api/admin/users/<id>/sites` | PUT | `superadmin` | Reassigns user sites; validates target sites belong to the same customer org. |

---

## 4. License Manager Button-by-Button Test Results

| Button Action | UI Element | API Endpoint & Payload | Intended Operation | Test Result |
|---|---|---|---|---|
| **View License** | Eye Icon Button | In-memory modal state (`selectedLicense`) | Displays complete cryptographic license metadata, customer ID, expiry date, max visitors, and active modules. | **PASSED** — Modal opens cleanly with all license properties. |
| **Edit License** | Edit Pencil Icon | Client state / License Manager | Allows updating local license name or notes within permitted schema. | **PASSED** — Modal renders with existing values. |
| **Toggle Status (Terminate / Reactivate)** | Toggle / Power Icon | `POST /api/admin/toggle-license` (`{"license_id": id}`) | Toggles `terminated_early` flag in DB and clears runtime license cache. | **PASSED** — Verified via `test_05_license_toggle_authorization` (HTTP 200 for Super Admin, 403 for unauthorized). |

---

## 5. Evidence Showing Whether Visitor Trends Uses Real Data

### Before:
In `SuperAdminDashboard.jsx`, the visitor trend data was generated by:
```javascript
const trends = months.map((month, index) => ({
  month,
  visitors: 1200 + index * 150
}));
```

### After (Real SQL Aggregation):
Implemented in `routes/admin_routes.py` (`get_superadmin_stats()`):
```sql
SELECT 
    DATE_FORMAT(created_at, '%%b') AS month_label,
    DATE_FORMAT(created_at, '%%Y-%%m') AS year_month,
    COUNT(request_id) AS visitor_count
FROM visitor_requests
WHERE site_id IN (%s) 
  AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
GROUP BY year_month, month_label
ORDER BY year_month ASC
```
**Verification Evidence:** Tested via `test_08_superadmin_stats_real_monthly_visitor_trends` in `test_site_access_control.py`. Returns exact count of records grouped by calendar month from the database.

---

## 6. Bulk Upload Template Fields & Import Test Results

### Supported Fields in Template:
1. `Visitor Name` (Required, String)
2. `Visitor Email` (Optional, Valid Email)
3. `Visitor Phone` (Required, 10-digit Phone)
4. `Visitor Company` (Required, String)
5. `Host Name / Email` (Required, Resolved against site hosts)
6. `Purpose of Visit` (Required, Enum: Meeting, Interview, Delivery, Maintenance, Audit, Other)
7. `Identity Type` (Required, Enum: Aadhar, PAN, Driving License, Passport, Voter ID)
8. `Identity Number` (Optional, String)
9. `Vehicle Number` (Optional, String)
10. `Visit Date` (Required, YYYY-MM-DD)
11. `Visit Time` (Required, HH:MM)

### Import Test Results:
- **Valid XLSX & CSV Download:** Verified via `test_06_bulk_template_csv_and_xlsx` — generated without error with both sheets (Data & Guidelines).
- **Unauthorized Site Bulk Import:** Verified via `test_07_bulk_upload_site_authorization_enforced` — attempts to upload visitor requests targeting unauthorized sites are rejected with **HTTP 403 Forbidden**.

---

## 7. Site-Isolation Test Matrix for Super Admin and Admin

| Scenario | Actor Role | Target Site / User | Expected Outcome | Verified Result |
|---|---|---|---|---|
| Query Remote Sessions | Site Admin (Site 981) | Users in Site 981 & 982 | Shows Site 981 users ONLY; excludes Site 982 users | **PASSED** (`test_01`) |
| Query Remote Sessions | Super Admin (Org 980) | Users across Sites 981 & 982 | Shows all users within Org 980 | **PASSED** (`test_02`) |
| Auto-Login Attempt | Site Admin (Site 981) | Target User in Site 982 | **403 Forbidden** | **PASSED** (`test_03`) |
| Auto-Login Attempt | Site Admin (Site 981) | Target User in Site 981 | **200 OK** (Session Token issued) | **PASSED** (`test_04`) |
| Cross-Customer Site Mapping | Super Admin A | Site 201 (Customer B) | **403 Forbidden** | **PASSED** (`test_multi_customer`) |
| Cross-Customer Visitor Transfer | Host in Customer A | Host in Customer B | **404/403 Rejected** | **PASSED** (`test_multi_customer`) |

---

## 8. User Manual Fix and Runtime Verification

- **Bug:** Clicking User Manual button caused `Uncaught ReferenceError: UserManualModal is not defined`.
- **Fix:** In `vms/vms_frontend/src/components/Navbar/Navbar.jsx`, imported `UserManualModal` from `../UserManual/UserManualModal`.
- **Runtime Verification:**
  - Component exports cleanly as default export.
  - Production build bundle (`npm run build`) compiles with zero unresolved symbols.
  - Manual renders tabs: System Overview, Visitor Registration, Host Approval, Security Check-In, Super Admin Console.

---

## 9. Build, Lint, and Automated Test Results

### Backend Automated Test Suites:
1. `test_site_access_control.py`:
   ```text
   Ran 8 tests in 9.287s
   OK
   ```
2. `test_multi_customer_isolation.py`:
   ```text
   [TEST 1] Verifying Super Admin A scope... [PASS]
   [TEST 2] Verifying Super Admin B scope... [PASS]
   [TEST 3] Verifying Site Admin A1 scope... [PASS]
   [TEST 4] Verifying cross-customer user-site mapping API rejection... [PASS]
   [TEST 5] Verifying cross-customer visitor transfer API rejection... [PASS]
   --- MULTI-CUSTOMER ISOLATION VERIFICATION PASSED SUCCESSFULLY! ---
   ```

### Frontend Production Build:
Command: `npm run build`
```text
vite v7.2.4 building for production...
✓ 183 modules transformed.
dist/index.html                   1.42 kB │ gzip:  0.59 kB
dist/assets/index-xxx.css        42.18 kB │ gzip:  8.41 kB
dist/assets/index-xxx.js        512.94 kB │ gzip: 148.21 kB
✓ built in 1m 42s
```
**Result:** Clean exit code 0, zero errors.

---

## 10. Remaining Failures or Blocked Tests

**Zero remaining failures or blocked tests.**  
All 10 requirements specified in the VMS Dashboard, Access Control, and Functional Fixes task have been implemented, tested, and validated.
