# packaging/scripts/check_services.py
"""
VMS Runtime Health Check & Diagnostics Utility
Enterprise Visitor Management System

Audits the live runtime environment:
- Database connectivity (127.0.0.1:3307)
- Waitress WSGI loopback response (127.0.0.1:5000/api/setup/status)
- Web/Reverse proxy listeners (HTTP Port 8089 / HTTPS Port 8009)
- Filesystem write permissions for uploads and logs
- Reports diagnostics for support troubleshooting.
"""

import sys
import os
import socket
import json
import urllib.request
import urllib.error
import ssl
import time

def check_port(host, port, timeout=2.0, max_retries=6, retry_interval=1.0):
    """Check if a TCP socket is open and listening with bounded retry."""
    last_err = None
    for attempt in range(max_retries):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        try:
            s.connect((host, port))
            s.close()
            return True, f"Port {port} is OPEN on {host}"
        except Exception as e:
            last_err = e
            s.close()
            if attempt < max_retries - 1:
                time.sleep(retry_interval)
    return False, f"Port {port} on {host} is UNREACHABLE ({last_err})"

def check_backend_api(host="127.0.0.1", port=5000, max_retries=6, retry_interval=1.0):
    """Query the backend /api/setup/status endpoint directly with bounded retry."""
    url = f"http://{host}:{port}/api/setup/status"
    last_err = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "VMS-Diagnostic/1.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return True, f"Backend API returned HTTP {resp.status}: setup_required={data.get('setup_required')}"
        except Exception as e:
            last_err = e
            if attempt < max_retries - 1:
                time.sleep(retry_interval)
    return False, f"Backend API request failed: {last_err}"

def check_web_proxy(host="127.0.0.1", port=8089, scheme="http", max_retries=6, retry_interval=1.0):
    """Query the web server/reverse proxy with bounded retry over HTTP or HTTPS."""
    url = f"{scheme}://{host}:{port}/"
    last_err = None

    context = None
    if scheme == "https":
        # Caddy uses an internal certificate; permit diagnostic loopback validation
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE

    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "VMS-Diagnostic/1.0"})
            with urllib.request.urlopen(req, timeout=3.0, context=context) as resp:
                if resp.status in (200, 301, 302, 304):
                    return True, f"Web Proxy {scheme.upper()} returned HTTP {resp.status} on port {port}"
                return False, f"Web Proxy {scheme.upper()} returned unexpected status HTTP {resp.status}"
        except urllib.error.HTTPError as e:
            if e.code in (200, 301, 302, 304):
                return True, f"Web Proxy {scheme.upper()} returned HTTP {e.code} on port {port}"
            last_err = f"HTTP Error {e.code}: {e.reason}"
        except Exception as e:
            last_err = e

        if attempt < max_retries - 1:
            time.sleep(retry_interval)
    return False, f"Web Proxy {scheme.upper()} request failed on port {port}: {last_err}"

def check_storage_permissions(data_dir=None):
    """Test filesystem write capability in the persistent storage directories."""
    if not data_dir:
        data_dir = os.environ.get("VMS_DATA_DIR", "C:\\ProgramData\\VMS")
    
    subdirs = ["uploads", "uploads_users", "logs"]
    results = {}
    for sub in subdirs:
        path = os.path.join(data_dir, sub)
        try:
            os.makedirs(path, exist_ok=True)
            test_file = os.path.join(path, ".perm_test")
            with open(test_file, "w") as f:
                f.write("ok")
            os.remove(test_file)
            results[sub] = True
        except Exception as e:
            results[sub] = str(e)
    return results

def run_diagnostics():
    print("==================================================", flush=True)
    print("  VMS Runtime Diagnostic & Health Check", flush=True)
    print("==================================================", flush=True)

    # 1. Database Check (Port 3307)
    db_port = int(os.environ.get("DB_PORT", 3307))
    db_host = os.environ.get("DB_HOST", "127.0.0.1")
    db_ok, db_msg = check_port(db_host, db_port)
    print(f"[{'PASS' if db_ok else 'FAIL'}] Database Socket ({db_port})    : {db_msg}", flush=True)

    # 2. Backend WSGI Check (Port 5000)
    be_port_ok, be_port_msg = check_port("127.0.0.1", 5000)
    print(f"[{'PASS' if be_port_ok else 'FAIL'}] Backend Port 5000 (TCP)  : {be_port_msg}", flush=True)

    if be_port_ok:
        be_api_ok, be_api_msg = check_backend_api("127.0.0.1", 5000)
    else:
        be_api_ok, be_api_msg = False, "Skipped (TCP Port 5000 is unreachable)"
    print(f"[{'PASS' if be_api_ok else 'FAIL'}] Backend API Status (HTTP) : {be_api_msg}", flush=True)

    # 3. Web Proxy HTTP Check (Port 8089)
    http_port_ok, http_port_msg = check_port("127.0.0.1", 8089)
    print(f"[{'PASS' if http_port_ok else 'FAIL'}] Web Proxy Port 8089 (TCP) : {http_port_msg}", flush=True)

    if http_port_ok:
        http_req_ok, http_req_msg = check_web_proxy("127.0.0.1", 8089, scheme="http")
    else:
        http_req_ok, http_req_msg = False, "Skipped (TCP Port 8089 is unreachable)"
    print(f"[{'PASS' if http_req_ok else 'FAIL'}] Web Proxy Port 8089 (HTTP): {http_req_msg}", flush=True)
    proxy_http_ok = http_port_ok and http_req_ok

    # 4. Web Proxy HTTPS Check (Port 8009)
    https_port_ok, https_port_msg = check_port("127.0.0.1", 8009)
    print(f"[{'PASS' if https_port_ok else 'FAIL'}] Web Proxy Port 8009 (TCP) : {https_port_msg}", flush=True)

    if https_port_ok:
        https_req_ok, https_req_msg = check_web_proxy("localhost", 8009, scheme="https")
        if not https_req_ok:
            https_req_ok, https_req_msg = check_web_proxy("127.0.0.1", 8009, scheme="https")
    else:
        https_req_ok, https_req_msg = False, "Skipped (TCP Port 8009 is unreachable)"
    print(f"[{'PASS' if https_req_ok else 'FAIL'}] Web Proxy Port 8009 (TLS) : {https_req_msg}", flush=True)
    proxy_https_ok = https_port_ok and https_req_ok

    # 5. Storage Permissions
    perm_results = check_storage_permissions()
    all_perm_ok = all(v is True for v in perm_results.values())
    print(f"[{'PASS' if all_perm_ok else 'WARN'}] Persistent Storage         : {perm_results}", flush=True)

    print("==================================================", flush=True)
    all_ok = db_ok and be_api_ok and proxy_http_ok and proxy_https_ok
    if all_ok:
        print(">>> VMS System Runtime is HEALTHY and OPERATIONAL. <<<", flush=True)
    else:
        print(">>> VMS System Runtime reported WARNINGS/ERRORS. Check service logs. <<<", flush=True)
    print("==================================================", flush=True)
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(run_diagnostics())
