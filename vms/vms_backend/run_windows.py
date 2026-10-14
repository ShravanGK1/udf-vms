# run_windows.py
"""
VMS Windows Production Server Entry Point
Enterprise Visitor Management System

Launches the Flask application using Waitress WSGI server:
- Binds to loopback (127.0.0.1) by default to prevent unauthorized direct LAN access.
- Reverse-proxied by Caddy/Nginx on HTTP port 8089 / HTTPS port 8009.
- Multithreaded request handling.
- Graceful error logging and process management.
"""

import os
import sys
import logging

# Ensure backend root is on sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Configure production logging
log_dir = os.environ.get("VMS_LOG_DIR", os.path.join(current_dir, "logs"))
os.makedirs(log_dir, exist_ok=True)

log_file = os.path.join(log_dir, "backend_production.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(threadName)s) %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8")
    ]
)
logger = logging.getLogger("vms.production")

try:
    from waitress import serve
except ImportError:
    logger.error("Waitress WSGI server is not installed. Please install waitress: pip install waitress")
    sys.exit(1)

# Import the existing Flask application
try:
    from app import app
    logger.info("Successfully imported VMS Flask application.")
except Exception as e:
    logger.critical(f"Failed to import VMS Flask application: {e}", exc_info=True)
    sys.exit(1)

def run_production_server():
    # Read network configuration from environment
    host = os.environ.get("VMS_BACKEND_HOST", "127.0.0.1")  # Loopback by default
    port = int(os.environ.get("VMS_BACKEND_PORT", 5000))
    threads = int(os.environ.get("VMS_BACKEND_THREADS", 8))
    connection_limit = int(os.environ.get("VMS_CONNECTION_LIMIT", 100))

    logger.info("==================================================")
    logger.info("  VMS Windows Production Server (Waitress WSGI)")
    logger.info("==================================================")
    logger.info(f"  Listening Interface : http://{host}:{port}")
    logger.info(f"  Worker Threads      : {threads}")
    logger.info(f"  Connection Limit    : {connection_limit}")
    logger.info(f"  Log File            : {log_file}")
    logger.info("--------------------------------------------------")

    try:
        serve(
            app,
            host=host,
            port=port,
            threads=threads,
            connection_limit=connection_limit,
            channel_timeout=60,
            cleanup_interval=30,
            ident="VMS-Server/1.0"
        )
    except Exception as e:
        logger.critical(f"Fatal error running Waitress server: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    run_production_server()
