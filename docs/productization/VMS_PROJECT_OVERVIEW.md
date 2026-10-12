# VMS Project Overview

## 1. Executive System Summary

The **Visitor Management System (VMS)** is an enterprise on-premise/self-hosted web application engineered for physical facility security, visitor check-in workflows, digital badge issuance, camera photo capture, role-based governance, and emergency premises roll-calls. 

The software operates on a multi-tiered architecture:
- **Client Presentation Layer:** Single-Page Application (SPA) built with React 19 and Vite.
- **Application Server Layer:** Python Flask REST API utilizing connection-pooled database access, Argon2 password hashing, and cryptographic RS256 licensing verification.
- **Data Persistence Layer:** MySQL 8.0 relational database with relational foreign key cascades and local disk storage for biometric and identity media.
- **Licensing Authority (Vendor Component):** Out-of-band licensing provider tool (`VMS_Provider`) used exclusively by the software vendor to mint signed RSA-256 software contracts.

---

## 2. Repository & File System Structure

```
z:\Projects\VMS\
├── .git/                                 # Git version control repository
├── .gitignore                            # Root ignore file
├── README.md                             # High-level developer documentation
├── docs/                                 # Documentation directory
│   └── productization/                   # Product packaging audit reports
└── vms/                                  # Primary project root
    ├── .gitignore                        # VMS sub-tree git ignore rules
    ├── docker-compose.yml                # Multi-container orchestration specification
    ├── licensing_explanation.txt         # Mathematical & logical spec of RS256 licensing
    ├── mysql_schema.sql                  # Primary DDL & database seed script
    ├── vms.mwb                           # MySQL Workbench data model diagram
    ├── VMS_Project_Overview.pdf          # Legacy system overview documentation
    ├── uploads/                          # Legacy/fallback asset upload root
    ├── VMS_Provider/                     # Vendor Licensing Authority Tool (Out-of-band)
    │   ├── app.py                        # Flask server for issuing licenses (Port 5050/5001)
    │   ├── generated_licenses.json       # Audit ledger of issued customer licenses
    │   ├── scratch/                      # Scratch files
    │   └── static/                       # Vendor UI styling and scripts
    ├── vms_backend/                      # Flask Backend Application
    │   ├── Dockerfile                    # Container build file (Python 3.11-slim)
    │   ├── app.py                        # Application entry point & WSGI factory
    │   ├── config.py                     # Environment loader & DB/JWT config constants
    │   ├── db.py                         # Thread-safe PooledDB database connection manager
    │   ├── init_db.py                    # Database creation & mysql_schema.sql executor
    │   ├── init_superadmin_db.py         # Superadmin settings & audit tables initializer
    │   ├── migrate_multisite_schema.py   # Multi-site customer/sites migration script
    │   ├── migrate_license.py            # License table migration script
    │   ├── migrate_signature.py          # Signature columns migration script
    │   ├── migrate_vehicle_photos.py     # Vehicle photo columns migration script
    │   ├── requirements.txt              # Python PIP dependency manifest
    │   ├── companies_sites.json          # Fallback company/site hierarchy file
    │   ├── system_settings.json          # System settings & default role credentials
    │   ├── update_db.sql                 # Fragmentary PostgreSQL-syntax update script
    │   ├── uploads/                      # Runtime visitor photos, signatures, vehicle media
    │   ├── uploads_users/                # Runtime user profile photographs
    │   ├── routes/                       # Flask Modular Blueprints
    │   │   ├── admin_routes.py           # Site management, user CRUD, stats, charts, settings
    │   │   ├── auth_routes.py            # User authentication, registration, remote session polling
    │   │   ├── reports_routes.py         # Export generation (CSV, Excel)
    │   │   ├── request_routes.py         # Visitor requests lifecycle, check-in, check-out, transfers
    │   │   ├── security_routes.py        # Security desk, badge printing, emergency muster
    │   │   ├── test_runner_routes.py     # In-browser test runner UI and execution endpoints
    │   │   └── visitor_routes.py         # Visitor identity registration & lookup
    │   ├── utils/                        # Core Utilities & Security Libraries
    │   │   ├── auth_utils.py             # Multi-site RBAC, scope resolution, JWT extraction
    │   │   ├── license_verifier.py       # Monotonic clock check, RS256 signature verifier
    │   │   ├── license_state.json        # Anti-tamper clock high-watermark hash cache
    │   │   ├── password_utils.py         # Argon2id hashing, complexity validator, auto-migrator
    │   │   ├── signature_utils.py        # Base64 canvas signature decoder & storage helper
    │   │   └── token_utils.py            # JWT token generator with password hash embedding
    │   └── tests/                        # Automated Verification Test Suites
    │       ├── system_tests.py           # 34 automated regression & security test cases
    │       ├── test_host_selection.py    # Host assignment isolation test
    │       ├── test_multi_customer_isolation.py # Cross-tenant & cross-site boundary tests
    │       ├── test_scheduling_and_expiration.py # Auto-expiration & scheduler tests
    │       └── test_vitthal_lifecycle.py # End-to-end visitor lifecycle test
    └── vms_frontend/                     # React 19 Frontend Application
        ├── Dockerfile                    # Multi-stage container build (Node 20 -> Nginx)
        ├── index.html                    # HTML5 root document
        ├── nginx.conf                    # Production reverse proxy and static server config
        ├── package.json                  # NPM dependencies and script commands
        ├── package-lock.json             # Pinned dependency lockfile
        ├── postcss.config.js             # PostCSS processing configuration
        ├── tailwind.config.js            # Tailwind styling tokens
        ├── vite.config.js                # Vite dev server & proxy configuration
        ├── dist/                         # Production build static artifacts output
        └── src/
            ├── main.jsx                  # React application bootstrap
            ├── App.jsx                   # Root React component
            ├── index.css                 # Master design system tokens & theme styles
            ├── app/                      # State & API Client
            │   ├── apiClient.js          # Axios client with JWT & X-Site-ID interceptors
            │   └── store.js              # Redux central store configuration
            ├── auth/                     # Authentication components & Redux slice
            ├── components/               # Reusable UI widgets, Modals, Forms, Navbar
            ├── layouts/                  # Role-based layouts (Admin, Host, Security)
            ├── pages/                    # Core Dashboard & Functional Views
            └── routes/                   # App routing table & ProtectedRoute guards
```

---

## 3. Technology Stack Breakdown

| Layer | Component | Version / Specification | Verified Notes |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `19.2.0` | Client-side DOM rendering |
| **Routing** | React Router DOM | `7.11.0` | Client-side SPA routing with nested layouts |
| **State Management** | Redux Toolkit | `2.11.2` | Global auth and user session state |
| **Build Tool** | Vite | `7.2.4` / `7.3.5` | Bundler with Fast Refresh and ES modules |
| **Styling** | Tailwind CSS / Vanilla CSS | `4.2.2` | Hybrid CSS variables design system |
| **Icons & Charts** | Lucide React / Recharts | `0.563.0` / `3.7.0` | Dashboard analytics & iconography |
| **Hardware Access** | React-Webcam | `7.2.0` | HTML5 `getUserMedia` photo capture |
| **Document Export** | html2pdf.js / Native Print | `0.14.0` | Client-side badge pass generation |
| **Backend Runtime** | Python | `>= 3.11` (Host: `3.14`) | CPython runtime |
| **Web Framework** | Flask | `3.1.3` | WSGI microframework |
| **Concurrency / Pool** | DBUtils (PooledDB) | `3.1.0` | 20-connection thread-safe pool |
| **Database Driver** | PyMySQL | `1.1.0` | Pure-Python MySQL 8 client |
| **Security & Tokens** | PyJWT / Cryptography | `2.12.1` / `>= 42.0.0` | RS256 license verifier & HS256 auth |
| **Password Security** | Argon2 / hashlib | Standard library fallback | Memory-hard password hashing |
| **Rate Limiting** | Flask-Limiter | `4.1.1` | In-memory IP rate limiting |
| **Database Server** | MySQL Community Server | `8.0` (Docker default) | Relational SQL engine with Foreign Keys |
| **Production Server** | Gunicorn (Linux) / Nginx | `20.1+` / `stable-alpine` | Containerized reverse proxy + WSGI |

---

## 4. Application Entry Points & Startup Mechanisms

### 4.1 Development Startup (Current Environment)
- **Backend API:**
  ```powershell
  cd z:\Projects\VMS\vms\vms_backend
  python app.py
  ```
  *Behavior:* Runs Flask development server on `http://0.0.0.0:5000` with `debug=True`. Spawns a background thread in `utils/license_verifier.py` to monitor clock integrity every 60 seconds. Runs `migrate_existing_passwords()` on startup.
- **Frontend SPA:**
  ```powershell
  cd z:\Projects\VMS\vms\vms_frontend
  npm run dev
  ```
  *Behavior:* Starts Vite development server on `http://localhost:5173`. Proxies `/api`, `/uploads`, and `/uploads_users` requests to `http://localhost:5000`.

### 4.2 Docker Compose Startup
- **Command:**
  ```bash
  cd z:\Projects\VMS\vms
  docker compose up -d
  ```
- **Service Dependency Hierarchy:**
  1. `vms_db`: Starts MySQL 8.0 on container port 3306 (exposed to host on port 3307). Executes `mysql_schema.sql` on first launch via `/docker-entrypoint-initdb.d/`. Health check tests `mysqladmin ping`.
  2. `vms_backend`: Waits for `vms_db` healthy status. Starts 3 Gunicorn workers on port 5000 (`gunicorn --workers 3 --timeout 120 --bind 0.0.0.0:5000 app:app`).
  3. `vms_frontend`: Waits for `vms_backend`. Starts Nginx on port 80. Serves static files from `dist/` and reverse proxies `/api` to `backend:5000`.

---

## 5. Storage, Media & Runtime File Generation

1. **Visitor Badges & Photos:**
   - Destination: `vms/vms_backend/uploads/`
   - Formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.jfif`, `.avif`.
   - Ingestion: Webcam photo capture via `CameraModal.jsx` and file uploads via `VisitorRegistration.jsx` / `VisitorPassForm.jsx`.
2. **User Profiles:**
   - Destination: `vms/vms_backend/uploads_users/`
   - Stored with timestamp-prefixed filenames (e.g. `1773921436_Admin.jfif`).
3. **Digital Signatures:**
   - Saved as PNG files in `vms/vms_backend/uploads/` via `utils/signature_utils.py`.
4. **License State Cache:**
   - `vms/vms_backend/utils/license_state.json`: Updated periodically with UTC timestamps, accumulated execution minutes, and SHA-256 tamper-proof hashes.
5. **Configuration Overrides:**
   - `vms/vms_backend/system_settings.json`: Read/written at runtime by Super Admin for branding logo, company title, and purge days.
   - `vms/vms_backend/companies_sites.json`: Read/written at runtime by Super Admin for sites hierarchy.

---

## 6. Background Jobs & Services Audit

- **Clock Tamper & Uptime Daemon:**
  - Located at [`vms_backend/utils/license_verifier.py:L77-L91`](file:///z:/Projects/VMS/vms/vms_backend/utils/license_verifier.py#L77-L91).
  - Runs in a background `threading.Thread(daemon=True)`. Wakes up every 60 seconds to increment runtime meters and detect if the host clock was rewound.
- **Visitor Request Auto-Expiration:**
  - Invoked inline upon API access inside [`request_routes.py:L167`](file:///z:/Projects/VMS/vms/vms_backend/routes/request_routes.py#L167) (`auto_expire_past_requests(cursor)`). Marks requests from previous dates as `EXPIRED`.
- **WebSockets / Message Brokers:**
  - **None.** The application does not use Socket.io, Redis, RabbitMQ, or Celery. All live updates (visitor counts, remote login approvals) use HTTP polling intervals (e.g. 3-second polling interval in `Auth.jsx`).
