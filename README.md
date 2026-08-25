# Visitor Management System (VMS)

An enterprise-grade Visitor Management System with role-based access control (Super Admin, Admin, Security, Host), live visitor tracking, instant check-in/out, camera photo capture, ID pass badge printing, emergency muster rolls, and export reporting.

## 🚀 Features

- **Multi-Role Dashboards**:
  - **Super Admin**: License management, site configuration, permissions, system settings.
  - **Admin**: User management, visitor section (Live Visitors, Spot Requests, Expected Visitors, Expired Visits), sites overview, remote auto-login sessions, emergency muster rolls.
  - **Security**: Real-time live check-ins, photo capture via camera modal, spot approvals, badge pass printing, quick checkout/temp checkout.
  - **Host**: Pre-registration, visitor approval workflows, visitor history.
- **Real-Time Visitor Lifecycle**:
  - Check-in, Temporary Out/In, Overstay detection, and Check-out.
  - Interactive hover details card with full form parameters.
  - Full visitor pass modal with view/edit permissions.
  - ID badge card preview with print support.
- **Muster Roll & Exports**:
  - Live premises roll for safety emergencies.
  - CSV / PDF export capabilities.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Lucide Icons, Recharts, Vanilla CSS Design System.
- **Backend**: Python (Flask), PyMySQL, JWT Authentication, Argon2 password hashing.
- **Database**: MySQL / MariaDB.

## 📦 Setup & Installation

### Backend Setup
```bash
cd vms/vms_backend
python -m venv .venv
# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python init_db.py  # Initialize database tables
python app.py      # Run backend API server
```

### Frontend Setup
```bash
cd vms/vms_frontend
npm install
npm run dev        # Run Vite development server
```
