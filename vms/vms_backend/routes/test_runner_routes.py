# routes/test_runner_routes.py

from flask import Blueprint, jsonify, Response
from tests.system_tests import TEST_CASES, run_test_case

test_runner_bp = Blueprint("test_runner", __name__)

@test_runner_bp.route("/api/test-runner/cases", methods=["GET"])
def get_test_cases():
    """Lists all registered test cases with description metadata."""
    cases = [{
        "id": tc["id"],
        "category": tc["category"],
        "name": tc["name"],
        "description": tc["description"]
    } for tc in TEST_CASES]
    return jsonify(cases), 200

@test_runner_bp.route("/api/test-runner/run/<test_id>", methods=["POST"])
def execute_test(test_id):
    """Executes a single test case and returns results and logs."""
    result = run_test_case(test_id)
    return jsonify(result), 200

@test_runner_bp.route("/test-runner", methods=["GET"])
def get_dashboard():
    """Serves the interactive visual testing console."""
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VMS Automated Testing Console</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #030712;
            --bg-card: #0b1528;
            --bg-terminal: #050a15;
            --border-color: #1e293b;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            
            /* Status Colors */
            --color-pending: #4b5563;
            --color-running: #3b82f6;
            --color-success: #10b981;
            --color-failed: #ef4444;
            --color-warning: #f59e0b;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background-color: var(--bg-base);
            color: var(--text-main);
            font-family: 'Outfit', sans-serif;
            min-height: 100vh;
            padding: 2rem;
            background-image: radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 40%),
                              radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.04), transparent 40%);
            background-attachment: fixed;
        }

        header {
            max-width: 1400px;
            margin: 0 auto 2rem auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
        }

        .brand-container {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .logo-dot {
            width: 12px;
            height: 12px;
            background-color: var(--color-success);
            border-radius: 50%;
            box-shadow: 0 0 10px var(--color-success);
            animation: pulse-glow 2s infinite alternate;
        }

        @keyframes pulse-glow {
            0% { transform: scale(0.9); opacity: 0.6; box-shadow: 0 0 5px var(--color-success); }
            100% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 15px var(--color-success); }
        }

        h1 {
            font-size: 1.75rem;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(to right, #ffffff, #93c5fd);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .version-badge {
            background: rgba(30, 41, 59, 0.7);
            border: 1px solid var(--border-color);
            color: var(--text-muted);
            padding: 0.25rem 0.75rem;
            border-radius: 50px;
            font-size: 0.75rem;
            font-family: 'Fira Code', monospace;
        }

        main {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
        }

        /* ----------------------------------------------------
        METRICS SECTION
        ---------------------------------------------------- */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
        }

        .metric-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .metric-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
            background: transparent;
        }

        .metric-card.total::before { background: var(--color-running); }
        .metric-card.passed::before { background: var(--color-success); }
        .metric-card.failed::before { background: var(--color-failed); }
        .metric-card.rate::before { background: var(--color-warning); }

        .metric-title {
            font-size: 0.875rem;
            color: var(--text-muted);
            font-weight: 500;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .metric-value {
            font-size: 2.25rem;
            font-weight: 700;
            letter-spacing: -1px;
            font-family: 'Outfit', sans-serif;
        }

        .metric-card.passed .metric-value { color: var(--color-success); }
        .metric-card.failed .metric-value { color: var(--color-failed); }

        .metric-sub {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-top: 0.5rem;
        }

        /* ----------------------------------------------------
        CONTROLS SECTION
        ---------------------------------------------------- */
        .controls-panel {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.25rem;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 1.5rem;
        }

        .filter-group {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
            flex-grow: 1;
        }

        .search-wrapper {
            position: relative;
            min-width: 280px;
            flex-grow: 1;
            max-width: 400px;
        }

        .search-input {
            width: 100%;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 0.65rem 1rem 0.65rem 2.5rem;
            color: var(--text-main);
            font-family: inherit;
            font-size: 0.9rem;
            outline: none;
            transition: border-color 0.2s;
        }

        .search-input:focus {
            border-color: var(--color-running);
        }

        .search-icon {
            position: absolute;
            left: 0.85rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            pointer-events: none;
        }

        .filter-select {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 0.65rem 1.25rem;
            color: var(--text-main);
            font-family: inherit;
            font-size: 0.9rem;
            outline: none;
            cursor: pointer;
            transition: border-color 0.2s;
        }

        .filter-select:focus {
            border-color: var(--color-running);
        }

        .actions-group {
            display: flex;
            gap: 1rem;
        }

        .btn {
            font-family: inherit;
            font-weight: 600;
            font-size: 0.9rem;
            padding: 0.65rem 1.5rem;
            border-radius: 10px;
            cursor: pointer;
            outline: none;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            border: 1px solid transparent;
        }

        .btn-primary {
            background: var(--color-running);
            color: white;
            box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
            background: #2563eb;
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            box-shadow: none;
        }

        .btn-secondary {
            background: transparent;
            border-color: var(--border-color);
            color: var(--text-main);
        }

        .btn-secondary:hover:not(:disabled) {
            background: rgba(30, 41, 59, 0.5);
        }

        /* ----------------------------------------------------
        TEST CASES LAYOUT
        ---------------------------------------------------- */
        .test-list-container {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow: hidden;
        }

        .test-header {
            display: grid;
            grid-template-columns: 80px 150px 1fr 120px 140px;
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            font-weight: 600;
            color: var(--text-muted);
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: rgba(15, 23, 42, 0.3);
        }

        .test-row-wrapper {
            border-bottom: 1px solid var(--border-color);
        }

        .test-row-wrapper:last-child {
            border-bottom: none;
        }

        .test-row {
            display: grid;
            grid-template-columns: 80px 150px 1fr 120px 140px;
            padding: 1.15rem 1.5rem;
            align-items: center;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .test-row:hover {
            background: rgba(30, 41, 59, 0.2);
        }

        .test-id {
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--text-muted);
        }

        .test-category {
            font-size: 0.85rem;
            font-weight: 500;
            color: var(--color-running);
            background: rgba(59, 130, 246, 0.08);
            padding: 0.25rem 0.65rem;
            border-radius: 5px;
            width: fit-content;
        }

        .test-info {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .test-name {
            font-weight: 600;
            font-size: 0.95rem;
        }

        .test-desc {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        .test-time {
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            padding: 0.3rem 0.75rem;
            border-radius: 50px;
            width: fit-content;
            letter-spacing: 0.25px;
        }

        .status-badge.pending {
            background: rgba(75, 85, 99, 0.15);
            color: var(--text-muted);
            border: 1px solid rgba(75, 85, 99, 0.3);
        }

        .status-badge.running {
            background: rgba(59, 130, 246, 0.15);
            color: var(--color-running);
            border: 1px solid rgba(59, 130, 246, 0.3);
            animation: pulse-badge 1.5s infinite alternate;
        }

        .status-badge.success {
            background: rgba(16, 185, 129, 0.15);
            color: var(--color-success);
            border: 1px solid rgba(16, 185, 129, 0.3);
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.05);
        }

        .status-badge.failed {
            background: rgba(239, 68, 68, 0.15);
            color: var(--color-failed);
            border: 1px solid rgba(239, 68, 68, 0.3);
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.05);
        }

        @keyframes pulse-badge {
            0% { opacity: 0.7; }
            100% { opacity: 1; }
        }

        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: currentColor;
        }

        /* ----------------------------------------------------
        TEST DETAILS / TERMINAL STYLING
        ---------------------------------------------------- */
        .test-details {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
            background: rgba(5, 10, 21, 0.4);
            border-top: 1px solid transparent;
        }

        .test-details.open {
            max-height: 500px;
            border-top: 1px solid var(--border-color);
            overflow-y: auto;
        }

        .details-inner {
            padding: 1.25rem 1.5rem;
        }

        .terminal-block {
            background: var(--bg-terminal);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            padding: 1.25rem;
            max-height: 380px;
            overflow-y: auto;
            color: #d1d5db;
            line-height: 1.5;
            box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);
        }

        .log-line {
            margin-bottom: 0.35rem;
            word-break: break-all;
            white-space: pre-wrap;
        }

        .log-timestamp {
            color: #6b7280;
        }

        .log-info {
            color: #3b82f6;
        }

        .log-success {
            color: #10b981;
        }

        .log-error {
            color: #ef4444;
            font-weight: 500;
        }

        .log-warning {
            color: #f59e0b;
        }
        
        .no-logs-msg {
            color: var(--text-muted);
            font-style: italic;
        }

        /* Responsive Layout adjustments */
        @media(max-width: 900px) {
            .test-header, .test-row {
                grid-template-columns: 80px 120px 1fr 100px;
            }
            .test-time-col {
                display: none;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="brand-container">
            <div class="logo-dot"></div>
            <div>
                <h1>VMS Test Execution System</h1>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem;">Automated Verification Console</p>
            </div>
        </div>
        <span class="version-badge">v1.1.0-stable</span>
    </header>

    <main>
        <!-- METRICS GRID -->
        <section class="metrics-grid">
            <div class="metric-card total">
                <p class="metric-title">Total Test Cases</p>
                <p class="metric-value" id="count-total">0</p>
                <p class="metric-sub" id="count-running-text">All cases registered</p>
            </div>
            <div class="metric-card passed">
                <p class="metric-title">Passed Cases</p>
                <p class="metric-value" id="count-passed">0</p>
                <p class="metric-sub" id="count-passed-pct">0% success rate</p>
            </div>
            <div class="metric-card failed">
                <p class="metric-title">Failed Cases</p>
                <p class="metric-value" id="count-failed">0</p>
                <p class="metric-sub" id="count-failed-text">0 issues found</p>
            </div>
            <div class="metric-card rate">
                <p class="metric-title">Total Duration</p>
                <p class="metric-value" id="count-duration">0.0s</p>
                <p class="metric-sub" id="count-duration-avg">0ms average per test</p>
            </div>
        </section>

        <!-- CONTROLS PANEL -->
        <section class="controls-panel">
            <div class="filter-group">
                <div class="search-wrapper">
                    <!-- Search Icon (magnifying glass vector) -->
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="search-bar" class="search-input" placeholder="Search test cases by name...">
                </div>
                
                <select id="category-filter" class="filter-select">
                    <option value="all">All Categories</option>
                    <option value="Database">Database</option>
                    <option value="Authentication">Authentication</option>
                    <option value="Licensing">Licensing</option>
                    <option value="Visitor Management">Visitor Management</option>
                    <option value="Administration">Administration</option>
                    <option value="Reports & Audit">Reports & Audit</option>
                    <option value="Frontend Integrity">Frontend Integrity</option>
                </select>

                <select id="status-filter" class="filter-select">
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                </select>
            </div>

            <div class="actions-group">
                <button id="btn-reset" class="btn btn-secondary" onclick="resetSuite()" disabled>Reset</button>
                <button id="btn-run" class="btn btn-primary" onclick="runSuite()">
                    <!-- Play icon -->
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Run Test Suite
                </button>
            </div>
        </section>

        <!-- TEST CASES CONTAINER -->
        <section class="test-list-container">
            <div class="test-header">
                <div>ID</div>
                <div>Category</div>
                <div>Test Case</div>
                <div class="test-time-col">Duration</div>
                <div>Status</div>
            </div>
            
            <div id="test-cases-list">
                <!-- Dynamically populated rows -->
            </div>
        </section>
    </main>

    <script>
        let testCases = [];
        let isRunningSuite = false;

        document.addEventListener("DOMContentLoaded", () => {
            fetchCases();

            // Set up search and filter listeners
            document.getElementById("search-bar").addEventListener("input", renderCases);
            document.getElementById("category-filter").addEventListener("change", renderCases);
            document.getElementById("status-filter").addEventListener("change", renderCases);
        });

        async function fetchCases() {
            try {
                const res = await fetch("/api/test-runner/cases");
                const data = await res.json();
                testCases = data.map(tc => ({
                    ...tc,
                    status: "PENDING",
                    duration: null,
                    logs: [],
                    error: ""
                }));
                updateMetrics();
                renderCases();
            } catch (err) {
                console.error("Failed to fetch cases:", err);
            }
        }

        function updateMetrics() {
            const total = testCases.length;
            const passed = testCases.filter(t => t.status === "SUCCESS").length;
            const failed = testCases.filter(t => t.status === "FAILED").length;
            const executed = testCases.filter(t => t.status !== "PENDING" && t.status !== "RUNNING").length;
            
            // Calculate total time
            const totalTimeMs = testCases.reduce((acc, t) => acc + (t.duration || 0), 0);
            const totalTimeSec = (totalTimeMs / 1000).toFixed(2);
            const avgTime = executed > 0 ? Math.round(totalTimeMs / executed) : 0;
            const rate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

            document.getElementById("count-total").innerText = total;
            document.getElementById("count-passed").innerText = passed;
            document.getElementById("count-passed-pct").innerText = `${rate}% success rate`;
            document.getElementById("count-failed").innerText = failed;
            document.getElementById("count-failed-text").innerText = `${failed} issues found`;
            document.getElementById("count-duration").innerText = `${totalTimeSec}s`;
            document.getElementById("count-duration-avg").innerText = `${avgTime}ms avg per test`;
        }

        function renderCases() {
            const search = document.getElementById("search-bar").value.toLowerCase();
            const cat = document.getElementById("category-filter").value;
            const stat = document.getElementById("status-filter").value;
            const listEl = document.getElementById("test-cases-list");

            listEl.innerHTML = "";

            const filtered = testCases.filter(tc => {
                const matchesSearch = tc.name.toLowerCase().includes(search) || tc.id.toLowerCase().includes(search);
                const matchesCat = (cat === "all" || tc.category === cat);
                const matchesStat = (stat === "all" || tc.status.toLowerCase() === stat);
                return matchesSearch && matchesCat && matchesStat;
            });

            if (filtered.length === 0) {
                listEl.innerHTML = `<div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 0.95rem;">No test cases matches current filters.</div>`;
                return;
            }

            filtered.forEach(tc => {
                const wrapper = document.createElement("div");
                wrapper.className = "test-row-wrapper";
                wrapper.id = `wrapper-${tc.id}`;

                let badgeClass = "pending";
                if (tc.status === "RUNNING") badgeClass = "running";
                if (tc.status === "SUCCESS") badgeClass = "success";
                if (tc.status === "FAILED") badgeClass = "failed";

                const isRunning = tc.status === "RUNNING";
                const isExpanded = document.getElementById(`details-${tc.id}`)?.classList.contains("open");

                wrapper.innerHTML = `
                    <div class="test-row" onclick="toggleDetails('${tc.id}')">
                        <div class="test-id">${tc.id}</div>
                        <div><span class="test-category">${tc.category}</span></div>
                        <div class="test-info">
                            <div class="test-name">${tc.name}</div>
                            <div class="test-desc">${tc.description}</div>
                        </div>
                        <div class="test-time-col test-time">${tc.duration !== null ? `${tc.duration}ms` : "-"}</div>
                        <div>
                            <span class="status-badge ${badgeClass}">
                                ${isRunning ? '<span class="status-dot" style="background-color: white; animation: blink 1s infinite alternate;"></span>' : '<span class="status-dot"></span>'}
                                ${tc.status}
                            </span>
                        </div>
                    </div>
                    <div id="details-${tc.id}" class="test-details ${isExpanded ? 'open' : ''}">
                        <div class="details-inner">
                            <div class="terminal-block" id="logs-${tc.id}">
                                ${formatLogs(tc.logs, tc.error)}
                            </div>
                        </div>
                    </div>
                `;

                listEl.appendChild(wrapper);
            });
        }

        function formatLogs(logs, error) {
            if (!logs || logs.length === 0) {
                return `<div class="no-logs-msg">No logs recorded. Run the test to populate.</div>`;
            }

            return logs.map(line => {
                // Formatting timestamps and levels
                let classType = "";
                if (line.includes("SUCCESS") || line.includes("complete: Success!") || line.includes("verified successfully")) {
                    classType = "log-success";
                } else if (line.includes("ERROR") || line.includes("TEST FAILURE") || line.includes("Exception:") || line.includes("failed")) {
                    classType = "log-error";
                } else if (line.includes("Warning:")) {
                    classType = "log-warning";
                } else if (line.includes("--- Starting") || line.includes("--- Completed")) {
                    classType = "log-info";
                }

                // Split timestamp and content if matched
                const timeMatch = line.match(/^(\\[\\d{2}:\\d{2}:\\d{2}\\.\\d{3}\\])/);
                if (timeMatch) {
                    const ts = timeMatch[1];
                    const content = line.substring(ts.length);
                    return `<div class="log-line"><span class="log-timestamp">${ts}</span><span class="${classType}">${escapeHTML(content)}</span></div>`;
                }

                return `<div class="log-line ${classType}">${escapeHTML(line)}</div>`;
            }).join("");
        }

        function escapeHTML(str) {
            return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        function toggleDetails(id) {
            const el = document.getElementById(`details-${id}`);
            if (el) {
                el.classList.toggle("open");
            }
        }

        function formatLogsWithANSI(logs, error) {
            return logs.join("\\n");
        }

        async function runSuite() {
            if (isRunningSuite) return;
            isRunningSuite = true;
            
            // UI state
            document.getElementById("btn-run").disabled = true;
            document.getElementById("btn-reset").disabled = true;
            
            // Reset state
            testCases.forEach(tc => {
                tc.status = "PENDING";
                tc.duration = null;
                tc.logs = [];
                tc.error = "";
            });
            renderCases();
            updateMetrics();

            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                tc.status = "RUNNING";
                
                // Live UI update for status
                renderCases();
                
                // Auto scroll row into view
                const el = document.getElementById(`wrapper-${tc.id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                try {
                    const res = await fetch(`/api/test-runner/run/${tc.id}`, { method: "POST" });
                    const result = await res.json();
                    
                    tc.status = result.status;
                    tc.duration = result.duration_ms;
                    tc.logs = result.logs;
                    tc.error = result.error;
                    
                    // Automatically open failed test details to expose stack traces
                    if (tc.status === "FAILED") {
                        setTimeout(() => {
                            const details = document.getElementById(`details-${tc.id}`);
                            if (details) details.classList.add("open");
                        }, 50);
                    }
                } catch (err) {
                    tc.status = "FAILED";
                    tc.logs = [`[ERROR] Fetch API Failure during test execution: ${err.message}`];
                    tc.error = err.message;
                }
                
                updateMetrics();
                renderCases();
            }

            isRunningSuite = false;
            document.getElementById("btn-run").disabled = false;
            document.getElementById("btn-reset").disabled = false;
        }

        function resetSuite() {
            testCases.forEach(tc => {
                tc.status = "PENDING";
                tc.duration = null;
                tc.logs = [];
                tc.error = "";
            });
            
            // Clear filters
            document.getElementById("search-bar").value = "";
            document.getElementById("category-filter").value = "all";
            document.getElementById("status-filter").value = "all";
            
            updateMetrics();
            renderCases();
            document.getElementById("btn-reset").disabled = true;
        }
    </script>
</body>
</html>"""
    return Response(html_content, mimetype="text/html")
