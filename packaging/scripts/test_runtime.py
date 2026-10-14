import sys
import os

print(f"Python: {sys.version}")

modules = [
    "flask",
    "waitress",
    "flask_cors",
    "flask_limiter",
    "pymysql",
    "dbutils",
    "cryptography",
    "jwt",
    "dotenv",
    "pandas",
    "numpy",
    "xlsxwriter",
    "reportlab",
    "qrcode",
    "requests"
]

all_ok = True
for mod in modules:
    try:
        __import__(mod)
        print(f"  [OK] {mod}")
    except Exception as e:
        print(f"  [FAIL] {mod}: {e}")
        all_ok = False

if all_ok:
    print("SUCCESS: All required runtime modules imported cleanly.")
    sys.exit(0)
else:
    print("FAILURE: Some modules failed to import.")
    sys.exit(1)
