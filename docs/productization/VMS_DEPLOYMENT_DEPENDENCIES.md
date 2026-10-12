# VMS Deployment Dependencies and Runtime Requirements

## 1. Executive Summary

This document defines the complete technical dependency profile for deploying the Visitor Management System (VMS) as an on-premise, self-hosted commercial product. It specifies the runtime execution environments, persistent services, database engines, network ports, filesystem paths, security contexts, and environment configuration required for reliable installation without cloud hosting.

---

## 2. Runtime and System Dependencies

### 2.1 Backend Runtime
- **Technology**: Python
- **Minimum Version**: Python 3.10+ (Verified active development on Python 3.11.x)
- **Target OS Support**:
  - Windows 10, Windows 11, Windows Server 2016/2019/2022 (x86_64)
  - Linux: Ubuntu 20.04/22.04 LTS, Debian 11/12, RHEL/Rocky Linux 8/9
- **WSGI / Application Server Compatibility**:
  - *Current Docker Setup*: [vms/vms_backend/Dockerfile:L24](file:///z:/Projects/VMS/vms/vms_backend/Dockerfile#L24) utilizes `gunicorn -w 2 -b 0.0.0.0:5000 app:app`. **Gunicorn is strictly POSIX-only** and cannot run natively on Windows due to reliance on `fork()` and `fcntl`.
  - *Required Windows Runtime*: Production deployments on Windows require a native WSGI server such as **Waitress** (`waitress-serve --host=127.0.0.1 --port=5000 app:app`), **Hypercorn**, or compiling the application via **PyInstaller** with an embedded WSGI worker.

### 2.2 Frontend Build & Serving Runtime
- **Build-Time Dependency**: Node.js `v18.0.0`+ or `v20.x` LTS, `npm` `9.x`+ (Required only during package compilation, not on customer machines).
- **Target Customer Runtime**: Pre-compiled static assets (`HTML`, `JS`, `CSS`, SVG/images) in `dist/`.
- **Static File Serving**:
  - Does *not* require Node.js on client servers.
  - Can be served via Nginx, Caddy, Apache, or directly routed via a unified reverse proxy or Flask static file handler.

### 2.3 Database Management System (DBMS)
- **Engine**: MySQL 8.0+ or MariaDB 10.6+
- **Driver**: `pymysql` (Python pure-python MySQL client, version `1.1.2`).
- **Connection Pooling**: `DBUtils` `PooledDB` (Fixed pool size: 20 connections; verified in [vms/vms_backend/config/db.py:L14](file:///z:/Projects/VMS/vms/vms_backend/config/db.py#L14)).
- **Database Engine Dialect Dependencies**:
  The application utilizes explicit MySQL-specific SQL functions and dialect constructs throughout its routing layer:
  - `TIMESTAMPDIFF(MINUTE, ...)` ([vms/vms_backend/routes/analytics_routes.py:L268](file:///z:/Projects/VMS/vms/vms_backend/routes/analytics_routes.py#L268))
  - `DATE_FORMAT(check_in_time, '%Y-%m-%d %H:00:00')` ([vms/vms_backend/routes/analytics_routes.py:L114](file:///z:/Projects/VMS/vms/vms_backend/routes/analytics_routes.py#L114))
  - `SUBSTRING(DAYNAME(check_in_time), 1, 3)` ([vms/vms_backend/routes/analytics_routes.py:L157](file:///z:/Projects/VMS/vms/vms_backend/routes/analytics_routes.py#L157))
  - `DATE_SUB(CURDATE(), INTERVAL 6 DAY)` ([vms/vms_backend/routes/analytics_routes.py:L158](file:///z:/Projects/VMS/vms/vms_backend/routes/analytics_routes.py#L158))
  - `LAST_INSERT_ID()` ([vms/vms_backend/routes/host_routes.py:L69](file:///z:/Projects/VMS/vms/vms_backend/routes/host_routes.py#L69))
  - *Implication*: SQLite cannot be dropped in as a simple replacement without extensive SQL refactoring and dialect abstraction. An embedded or bundled MariaDB/MySQL instance is mandatory.

---

## 3. Python Package Dependencies

The following packages are explicitly imported across the backend codebase ([vms/vms_backend/requirements.txt](file:///z:/Projects/VMS/vms/vms_backend/requirements.txt)):

| Package | Minimum / Locked Version | Purpose | Packaging Criticality |
| :--- | :--- | :--- | :--- |
| `Flask` | `3.1.3` | Core HTTP web framework & routing | Critical |
| `Flask-Cors` | `6.0.2` | Cross-Origin Resource Sharing handling | Critical |
| `PyMySQL` | `1.1.2` | Database driver | Critical |
| `DBUtils` | `3.1.1` | Thread-safe connection pooling | Critical |
| `PyJWT` | `2.11.0` | RS256 license token verification & HS256 sessions | Critical |
| `cryptography` | `46.0.5` | RSA cryptographic signature verification | Critical |
| `python-dotenv`| `1.2.2` | Environment variable loader from `.env` | Critical |
| `bcrypt` | `5.0.0` | Password hashing for authentication | Critical |
| `reportlab` | `4.4.14` | Server-side PDF generation & visitor badges | Optional / Secondary |
| `qrcode` | `8.2` | Server-side QR code image rendering | Operational |
| `requests` | `2.32.5` | Outbound HTTP calls (license ping / webhooks) | Operational |
| `gunicorn` | `23.0.0` | Production WSGI (Linux/Docker only) | Platform-specific |
| `waitress` | *(Required Addition)* | Production WSGI for native Windows packaging | Platform-specific |

---

## 4. Environment Variables Configuration

The backend reads configuration directly from `os.getenv` via `python-dotenv` ([vms/vms_backend/config/db.py](file:///z:/Projects/VMS/vms/vms_backend/config/db.py), [vms/vms_backend/app.py](file:///z:/Projects/VMS/vms/vms_backend/app.py)).

### 4.1 Variable Specification

| Variable Name | Required | Default Value (if unset) | Description & Sensitivity |
| :--- | :--- | :--- | :--- |
| `DB_HOST` | **Yes** | `None` / fails connection | Database hostname or IP (e.g., `127.0.0.1` or `localhost`). |
| `DB_PORT` | No | `3306` | MySQL TCP port. |
| `DB_USER` | **Yes** | `None` / fails connection | Database account username (e.g., `vms_user`). |
| `DB_PASSWORD` | **Yes** | `None` / fails connection | Database password. **Sensitive secret**. |
| `DB_NAME` | **Yes** | `None` / fails connection | Schema name (e.g., `vms_db`). |
| `SECRET_KEY` | **Yes** | `dev_secret_key_change_in_production` | Used for session encryption and signing. **Sensitive secret**. Must be randomly generated on install. |
| `VMS_LICENSE_KEY` | No | Empty string | Injected JWT license token. If unset, backend checks `license_state.json`. |
| `PUBLIC_KEY_PATH` | No | Embedded `public_key.pem` | Path to vendor RSA-2048 public key for license verification. |
| `FLASK_ENV` | No | `production` | Execution mode (`development` / `production`). |
| `PORT` | No | `5000` | Backend listening port. |

### 4.2 Security Rules for Client Installations
1. **No Shared Default Keys**: Installers must automatically generate a cryptographically strong 64-character random string for `SECRET_KEY` during first run.
2. **File Permissions**: The generated `.env` file containing `DB_PASSWORD` and `SECRET_KEY` must have restricted OS permissions (e.g., readable only by the local service account or Administrator).

---

## 5. Storage and Filesystem Requirements

The VMS application stores binary files and stateful operational records on the local filesystem rather than in cloud object storage:

```
[Installation Directory]/
├── vms_backend/
│   ├── uploads/               <-- Stored visitor photos, badge snapshots (local disk)
│   ├── uploads_users/         <-- Stored staff/user profile images (local disk)
│   ├── license_state.json     <-- Local license cache, heartbeat, offline clock counter
│   ├── system_settings.json   <-- Runtime operational settings (custom logo, site names)
│   ├── logs/                  <-- Application error logs & audit records
│   └── keys/
│       └── public_key.pem     <-- RSA-2048 vendor public key
```

### 5.1 Storage Characteristics
- **Read/Write Access**: The backend process user must have recursive read/write/create permissions on `uploads/`, `uploads_users/`, `logs/`, `license_state.json`, and `system_settings.json`.
- **Storage Growth Estimations**:
  - Average webcam capture: ~80 KB to 250 KB per visitor.
  - At 200 visitors/day: ~30 MB/day (~11 GB/year).
  - Installers must place storage on a volume with sufficient free disk space (minimum 10 GB recommended).
- **Data Retention & Backup**:
  - The client backup strategy must back up **both** the MySQL database **and** the `uploads/` directory to preserve visitor photo linkage.

---

## 6. Network and Port Allocations

### 6.1 Port Requirements

| Service | Port | Default Protocol | Scope | Exposure Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web Server** | `80` (HTTP) / `443` (HTTPS) | HTTP/HTTPS | Inbound LAN | Exposed to office local network for receptionist and kiosks. |
| **Backend API (Flask)** | `5000` | HTTP | Internal | Bind to `127.0.0.1` only; reverse-proxied by web server. |
| **Database (MySQL)** | `3306` | MySQL Protocol | Internal | Bind to `127.0.0.1` only. Never expose to public internet or LAN. |

### 6.2 Browser Security Context & Hardware APIs (Crucial Finding)
- **Webcam Visitor Photo Capture**:
  - [vms/vms_frontend/src/pages/security/SecurityPassCreate.jsx:L18](file:///z:/Projects/VMS/vms/vms_frontend/src/pages/security/SecurityPassCreate.jsx#L18) imports `react-webcam`.
  - Modern web browsers (Google Chrome, Microsoft Edge, Firefox, Safari) enforce the **W3C Secure Context** specification for `navigator.mediaDevices.getUserMedia`.
  - **Constraint**: Webcams work seamlessly on `http://localhost:5173` or `http://127.0.0.1`. However, if another office computer accesses the server over LAN via plain HTTP (e.g., `http://192.168.1.100/`), the browser **completely blocks camera access**.
  - **Resolution Requirement**: For commercial multi-computer office deployments, the installer must provide:
    1. A built-in reverse proxy (such as Caddy or Nginx) equipped with a self-signed TLS certificate or local CA (mkcert), OR
    2. Documentation instructing clients to install an internal domain SSL certificate, OR
    3. Running the kiosk/security workstation directly on the host machine (`localhost`).

---

## 7. External Integrations & Offline Capabilities

### 7.1 Internet Connectivity Independence
- **VMS is 100% Offline-Capable at Runtime**:
  - **License Verification**: The licensing engine ([vms/vms_backend/utils/license_verifier.py](file:///z:/Projects/VMS/vms/vms_backend/utils/license_verifier.py)) decrypts and verifies the RS256 signature using the local `public_key.pem`. It does *not* make mandatory outbound calls to activate or validate licenses.
  - **Static Assets**: Frontend dependencies (fonts, icons, styles, Lucide React icons, Tailwind CSS) are fully bundled in the Vite output bundle. No CDN dependencies (Google Fonts, unpkg, cdnjs) are queried during page load.
  - **Air-Gapped Viability**: The software can run inside air-gapped secure facilities without any WAN/Internet connection.

### 7.2 Optional External Services
- **SMTP Email Notifications**: Currently uses local or mock SMTP if configured. Optional for visitor notifications.
- **SMS Gateway**: Optional webhook integration. Not required for core check-in/check-out functionality.
- **Vendor License Heartbeat**: `requests.post` to `VMS_Provider` is optional and non-blocking. If unreachable, the system relies on its local offline validation and cryptographic expiry timestamp.

---

## 8. Summary of Prerequisite Artifacts for Packaging

To build a standalone installer, the build automation must bundle:
1. **Pre-compiled Frontend**: Static bundle generated via `npm run build` in `vms_frontend/dist/`.
2. **Python Runtime**: Python 3.11 standalone embedded environment (`python-embed-amd64` or PyInstaller binary) with all wheels pre-cached.
3. **Database Engine**: Embedded MariaDB/MySQL portable binary with pre-initialized data directory.
4. **Service Runner**: Windows Service wrapper (e.g., NSSM - Non-Sucking Service Manager or WinSW) or unified executable orchestrator.
5. **Reverse Proxy / SSL Engine**: Minimal Caddy or Nginx binary to terminate SSL (for LAN webcam access) and route `/api` to the backend.
