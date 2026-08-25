let cachedClients = [];
let selectedClientId = null;
let currentSelectedSite = null;

// Available role permissions matrix configurations matching Client-side
const AVAILABLE_PERMISSIONS = [
  { id: "view_dashboard", label: "View Dashboard" },
  { id: "manage_users", label: "Manage Users" },
  { id: "approve_requests", label: "Approve Requests" },
  { id: "check_in_out", label: "Check-in/Check-out" },
  { id: "manage_licenses", label: "Manage Licenses" },
  { id: "system_settings", label: "System Settings" },
  { id: "data_purging", label: "Data Purging" }
];

const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Tenant Admin",
  host: "Employee (Host)",
  security: "Security Guard"
};

document.addEventListener('DOMContentLoaded', () => {
    fetchClients();

    const licenseForm = document.getElementById('licenseForm');
    if (licenseForm) {
        licenseForm.addEventListener('submit', handleGenerateLicense);
    }

    const searchBox = document.getElementById('searchBox');
    searchBox.addEventListener('input', (e) => {
        filterClients(e.target.value);
    });

    const creatorStartDate = document.getElementById('createStartDate');
    const creatorEndDateInput = document.getElementById('createEndDateInput');
    const creatorGraceDays = document.getElementById('createGraceDays');

    if (creatorStartDate) {
        creatorStartDate.addEventListener('input', updateLicenseCreatorDates);
    }
    if (creatorEndDateInput) {
        creatorEndDateInput.addEventListener('input', updateLicenseCreatorDates);
    }
    if (creatorGraceDays) {
        creatorGraceDays.addEventListener('input', updateLicenseCreatorDates);
    }
    
    // Auto initialize lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

// Fetch all registered clients and render them
async function fetchClients() {
    try {
        const res = await fetch('/api/clients');
        const data = await res.json();
        cachedClients = data;
        
        updateStatsCounters(data);
        populateTenantDropdown(data);
        renderClientsTable(data);
        renderExtensionRequestsBanner(data);
        
        // Auto-select the first client if none selected
        if (!selectedClientId && data.length > 0) {
            setSelectedClient(data[0].id);
        } else if (selectedClientId) {
            // Keep active client state synced
            setSelectedClient(selectedClientId);
        }
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
    } catch (err) {
        console.error('Error fetching clients:', err);
        document.getElementById('clientsList').innerHTML = 
            '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #dc2626; font-weight: bold;">Failed to load subscriptions history.</td></tr>';
    }
}

// Calculate and render stats in top cards
function updateStatsCounters(clients) {
    document.getElementById('statTotalClients').innerText = clients.length;
    
    const active = clients.filter(c => c.status === 'Active').length;
    document.getElementById('statActiveSubs').innerText = active;
    
    const pendingTerms = clients.filter(c => c.will_terminate).length;
    document.getElementById('statPendingTerms').innerText = pendingTerms;
    
    const terminated = clients.filter(c => c.terminated_early || c.status === 'Terminated').length;
    document.getElementById('statTerminated').innerText = terminated;
}

// Fill tenant config dropdown in header
function populateTenantDropdown(clients) {
    const dropdown = document.getElementById('tenantSelect');
    // Keep current selection
    const prevSelection = dropdown.value;
    
    dropdown.innerHTML = '<option value="">Select a client...</option>' + 
        clients.map(c => `<option value="${c.id}">${escapeHtml(c.client_name)}</option>`).join('');
        
    if (prevSelection && clients.some(c => c.id == prevSelection)) {
        dropdown.value = prevSelection;
    } else if (selectedClientId) {
        dropdown.value = selectedClientId;
    }
}

// Set selected client globally and update UI labels
function setSelectedClient(id) {
    selectedClientId = parseInt(id);
    const dropdown = document.getElementById('tenantSelect');
    dropdown.value = selectedClientId;
    
    const activeClient = cachedClients.find(c => c.id === selectedClientId);
    const labels = document.querySelectorAll('.active-client-label');
    labels.forEach(lbl => {
        lbl.innerText = activeClient ? activeClient.client_name : 'None';
    });
}

// Dropdown change trigger
function handleTenantSelectChange(value) {
    if (value) {
        setSelectedClient(value);
    }
}

// Search and filter clients
function filterClients(query) {
    const filtered = cachedClients.filter(c => 
        c.client_name.toLowerCase().includes(query.toLowerCase())
    );
    renderClientsTable(filtered);
}

// Render subscription registry table
function renderClientsTable(clients) {
    const tbody = document.getElementById('clientsList');
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 3rem; color: #627d98;">No licenses issued matching query.</td></tr>';
        return;
    }

    tbody.innerHTML = clients.map(client => {
        const expiryDate = new Date(client.expires_at).toLocaleDateString();
        
        // Expiry notice conditional alerts
        let noticeText = '';
        if (client.will_terminate) {
            noticeText = `<div style="color: #dc2626; font-size: 0.72rem; font-weight: 700; margin-top: 0.25rem;">⚠️ Expiry Warning: Client will not extend contract</div>`;
        }
        
        let remText = '';
        if (client.status === 'In Buffer') {
            remText = `<span style="color: #d97706; font-weight: bold;">Grace: ${client.days_remaining_in_buffer} left</span>`;
        } else if (client.status === 'Active') {
            remText = `${client.days_remaining} left`;
        } else {
            remText = `Expired`;
        }

        let deleteBtn = '';
        if (client.status === 'Terminated') {
            deleteBtn = `
                <button class="sa-btn sa-btn-danger" style="padding: 0.35rem 0.65rem; font-size: 0.75rem; background: #ef4444; color: white;" 
                    onclick="deleteClientLicense(${client.id})">
                    Delete
                </button>
            `;
        }

        return `
            <tr>
                <td>
                    <div style="font-weight: 700; color: #102a43;">${escapeHtml(client.client_name)}</div>
                    <div style="font-size: 0.7rem; color: #829ab1; margin-top: 0.15rem;">HW-Lock: <code>${escapeHtml(client.machine_uuid)}</code></div>
                    ${noticeText}
                </td>
                <td>
                    <span style="font-size: 0.82rem; font-weight: 600; color: #334e68;">
                        Sites: ${client.sites.length} / ${client.max_sites} <br/> Users: ${client.max_users}
                    </span>
                </td>
                <td>
                    <span class="superadmin-status ${client.status.toLowerCase()}">
                        <span class="superadmin-status-dot"></span> ${client.status}
                    </span>
                </td>
                <td>
                    <div style="font-weight: 700; color: #102a43;">${remText}</div>
                    <div style="font-size: 0.7rem; color: #627d98; margin-top: 0.15rem;">Exp: ${expiryDate}</div>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="sa-btn sa-btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" 
                            onclick="selectAndConfigure(${client.id})">
                            Configure
                        </button>
                        <button class="sa-btn sa-btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" 
                            onclick="copyRawKey('${escapeJS(client.license_key)}')">
                            Copy Key
                        </button>
                        ${deleteBtn}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function selectAndConfigure(clientId) {
    setSelectedClient(clientId);
    openConfigModal('licenseManager');
}

// Generate license submission handler
async function handleGenerateLicense(e) {
    e.preventDefault();
    
    const client_name = document.getElementById('clientName').value.trim();
    const max_users = document.getElementById('maxUsers').value;
    const max_sites = document.getElementById('maxSites').value;
    const machine_uuid = document.getElementById('machineUuid').value.trim();
    const expiry_days = document.getElementById('expiryDays').value;

    try {
        const response = await fetch('/api/generate-license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name,
                max_users,
                max_sites,
                machine_uuid,
                expiry_days
            })
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('resultBlock').style.display = 'block';
            document.getElementById('resultToken').value = data.license_key;
            showToast('License Key generated successfully!');
            fetchClients(); // refresh list
        } else {
            alert('Error generating license: ' + data.error);
        }
    } catch (err) {
        alert('Server connection error: ' + err.message);
    }
}

// Copy results key token helper
function copyResultToken() {
    const tokenArea = document.getElementById('resultToken');
    tokenArea.select();
    document.execCommand('copy');
    showToast('License key token copied to clipboard!');
}

function copyActiveToken() {
    const tokenArea = document.getElementById('activeTokenArea');
    tokenArea.select();
    document.execCommand('copy');
    showToast('Active license key token copied to clipboard!');
}

function copyRawKey(key) {
    const tempInput = document.createElement('textarea');
    tempInput.value = key;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast('License key copied to clipboard!');
}

function resetForm() {
    document.getElementById('licenseForm').reset();
    document.getElementById('resultBlock').style.display = 'none';
    document.getElementById('resultToken').value = '';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ==================== CONFIGURATION MODALS LOGIC ====================

// Open modal handler
function openConfigModal(type) {
    if (type === 'licenseCreator') {
        initLicenseCreatorModal();
        document.getElementById('licenseCreatorModal').classList.remove('hidden');
        if (window.lucide) {
            window.lucide.createIcons();
        }
        return;
    }

    if (!selectedClientId) {
        alert('Please select an active configuration client in the navbar dropdown first.');
        return;
    }
    
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    if (type === 'companySite') {
        bindCompanySiteModal(client);
        document.getElementById('companySiteModal').classList.remove('hidden');
    } else if (type === 'rolesPermissions') {
        bindRolesPermissionsModal(client);
        document.getElementById('rolesPermissionsModal').classList.remove('hidden');
    } else if (type === 'licenseManager') {
        bindLicenseManagerModal(client);
        document.getElementById('licenseManagerModal').classList.remove('hidden');
    } else if (type === 'systemSettings') {
        bindSystemSettingsModal(client);
        document.getElementById('systemSettingsModal').classList.remove('hidden');
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// Close modal handler
function closeConfigModal(type) {
    document.getElementById(`${type}Modal`).classList.add('hidden');
}

// Save active configuration helper
async function saveClientConfig() {
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    try {
        const response = await fetch('/api/clients/save-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: client.id,
                sites: client.sites,
                permissions: client.permissions,
                settings: client.settings
            })
        });

        if (response.ok) {
            showToast('Configurations saved successfully!');
            fetchClients(); // reload changes
        } else {
            const data = await response.json();
            alert('Failed to save config: ' + data.error);
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

// ----- Modal Binding Methods -----

// 1. Company & Sites Bindings
function bindCompanySiteModal(client) {
    const container = document.getElementById('sitesContainer');
    document.getElementById('addSiteForm').style.display = 'none';
    currentSelectedSite = null;
    updateGeoPanel();

    if (client.sites.length === 0) {
        container.innerHTML = '<div style="font-size: 0.85rem; color: #829ab1; padding: 1rem; text-align: center;">No sites configured for this client.</div>';
        return;
    }

    container.innerHTML = client.sites.map(site => {
        const isChecked = site.status === 'Active';
        return `
            <div class="sa-site-item" onclick="selectSiteForGeo(${site.id})" style="cursor: pointer;">
                <div class="sa-site-info">
                    <h5 style="margin: 0; font-weight: bold;">${escapeHtml(site.name)}</h5>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.75rem; color: #627d98;">${escapeHtml(site.address)}</p>
                </div>
                <div class="sa-site-actions" onclick="event.stopPropagation()">
                    <span style="font-size: 0.75rem; font-weight: 700; color: ${isChecked ? '#059669' : '#dc2626'}; margin-right: 0.5rem;">
                        ${site.status}
                    </span>
                    <input type="checkbox" class="sa-checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSiteStatus(${site.id}, this.checked)">
                </div>
            </div>
        `;
    }).join('');
}

function toggleAddSiteForm() {
    const form = document.getElementById('addSiteForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function handleAddSiteSubmit(e) {
    e.preventDefault();
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    const name = document.getElementById('newSiteName').value.trim();
    const address = document.getElementById('newSiteAddress').value.trim();
    const lat = parseFloat(document.getElementById('newSiteLat').value) || 18.5204;
    const lng = parseFloat(document.getElementById('newSiteLng').value) || 73.8567;

    const newSiteObj = {
        id: Date.now(),
        name,
        address,
        lat,
        lng,
        status: "Active"
    };

    client.sites.push(newSiteObj);
    saveClientConfig().then(() => {
        bindCompanySiteModal(client);
        document.getElementById('newSiteName').value = '';
        document.getElementById('newSiteAddress').value = '';
        document.getElementById('newSiteLat').value = '';
        document.getElementById('newSiteLng').value = '';
    });
}

function toggleSiteStatus(siteId, isChecked) {
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    const site = client.sites.find(s => s.id === siteId);
    if (site) {
        site.status = isChecked ? "Active" : "Inactive";
        saveClientConfig().then(() => bindCompanySiteModal(client));
    }
}

function selectSiteForGeo(siteId) {
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    const site = client.sites.find(s => s.id === siteId);
    if (site) {
        currentSelectedSite = site;
        updateGeoPanel();
    }
}

function updateGeoPanel() {
    const detailPanel = document.getElementById('geoDetailsPanel');
    const fallbackPanel = document.getElementById('geoFallbackPanel');
    
    if (currentSelectedSite) {
        fallbackPanel.style.display = 'none';
        detailPanel.style.display = 'block';
        
        document.getElementById('geoSiteName').innerText = currentSelectedSite.name;
        document.getElementById('geoSiteAddress').innerText = currentSelectedSite.address;
        document.getElementById('geoSiteLat').innerText = currentSelectedSite.lat.toFixed(5);
        document.getElementById('geoSiteLng').innerText = currentSelectedSite.lng.toFixed(5);
        document.getElementById('geoSiteCoords').innerText = `${currentSelectedSite.lat.toFixed(4)}, ${currentSelectedSite.lng.toFixed(4)}`;
    } else {
        fallbackPanel.style.display = 'flex';
        detailPanel.style.display = 'none';
    }
}

// 2. Roles & Permissions Bindings
function bindRolesPermissionsModal(client) {
    const container = document.getElementById('rolesContainer');
    
    container.innerHTML = Object.keys(ROLE_LABELS).map(role => {
        const rolePermissions = client.permissions[role] || [];
        const isSuperAdmin = role === 'superadmin';
        
        return `
            <div class="sa-permission-row" style="padding: 1.25rem 1rem;">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <span style="font-weight: 700; color: #102a43;">${ROLE_LABELS[role]}</span>
                    <code style="font-size: 0.7rem; color: #627d98; background: rgba(0,0,0,0.03); padding: 0.1rem 0.35rem; width: fit-content; border-radius: 0.25rem;">
                        role: ${role}
                    </code>
                </div>
                <div class="sa-permission-grid">
                    ${AVAILABLE_PERMISSIONS.map(perm => {
                        const isChecked = rolePermissions.includes(perm.id) || isSuperAdmin;
                        const isDisabled = isSuperAdmin ? 'disabled' : '';
                        
                        return `
                            <label class="sa-checkbox-label" title="Toggle permission" style="${isSuperAdmin ? 'opacity: 0.65; cursor: not-allowed;' : ''}">
                                <input type="checkbox" class="sa-checkbox" ${isChecked ? 'checked' : ''} ${isDisabled} 
                                    onchange="handlePermissionToggle('${role}', '${perm.id}', this.checked)">
                                <span style="font-weight: ${isChecked ? '600' : '400'}; color: ${isChecked ? '#2563eb' : '#334e68'};">
                                    ${perm.label}
                                </span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function handlePermissionToggle(role, permissionId, isChecked) {
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    if (!client.permissions[role]) {
        client.permissions[role] = [];
    }

    if (isChecked) {
        if (!client.permissions[role].includes(permissionId)) {
            client.permissions[role].push(permissionId);
        }
    } else {
        client.permissions[role] = client.permissions[role].filter(p => p !== permissionId);
    }
    
    // We update the local UI bold formatting immediately but require user click "Save Matrix" to commit
}

// 3. License Manager Bindings
function bindLicenseManagerModal(client) {
    const createdDate = new Date(client.created_at).toLocaleDateString();
    const expiryDate = new Date(client.expires_at).toLocaleDateString();
    
    document.getElementById('licClientName').innerText = client.client_name;
    document.getElementById('licStartDate').innerText = createdDate;
    document.getElementById('licEndDate').innerText = expiryDate;
    document.getElementById('licUserLimits').innerText = `${client.max_users} Users / ${client.max_sites} Sites`;
    document.getElementById('activeTokenArea').value = client.license_key;
    
    // Extension Request Approval Panel display
    const pendingBlock = document.getElementById('pendingExtensionRequestBlock');
    if (client.extension_request && client.extension_request.status === 'pending') {
        pendingBlock.style.display = 'block';
    } else {
        pendingBlock.style.display = 'none';
    }
    
    // Status Badges
    const badgeContainer = document.getElementById('licStatusBadges');
    badgeContainer.innerHTML = '';
    
    if (client.terminated_early) {
        badgeContainer.innerHTML += `<span class="superadmin-status expired" style="padding: 0.4rem 0.8rem;">Suspended</span>`;
    } else if (client.status === 'In Buffer') {
        badgeContainer.innerHTML += `<span class="superadmin-status expiring" style="padding: 0.4rem 0.8rem;">Grace Period</span>`;
    }
    
    const statusClass = client.status === 'Active' ? 'active' : (client.status === 'In Buffer' ? 'expiring' : 'expired');
    badgeContainer.innerHTML += `
        <span class="superadmin-status ${statusClass}" style="padding: 0.4rem 1rem;">
            <span class="superadmin-status-dot"></span> ${client.status}
        </span>
    `;

    const bufferDays = client.buffer_days || 90;
    const graceLabel = document.getElementById('licGraceBufferLabel');
    if (graceLabel) {
        graceLabel.innerText = `${bufferDays}-Day Grace Buffer`;
    }

    // Remaining calculations
    if (client.status === 'In Buffer') {
        document.getElementById('licDaysRemaining').innerText = '0 Days';
        document.getElementById('licBufferRemaining').innerText = `${client.days_remaining_in_buffer} Days`;
    } else if (client.status === 'Active') {
        document.getElementById('licDaysRemaining').innerText = `${client.days_remaining} Days`;
        document.getElementById('licBufferRemaining').innerText = `${bufferDays} Days`;
    } else {
        document.getElementById('licDaysRemaining').innerText = '0 Days';
        document.getElementById('licBufferRemaining').innerText = '0 Days';
    }

    // Dynamic warning alert banners
    const alertBox = document.getElementById('licenseAlertContainer');
    alertBox.innerHTML = '';
    
    if (client.will_terminate) {
        alertBox.innerHTML += `
            <div class="sa-alert sa-alert-error" style="margin-bottom: 1.25rem;">
                <i data-lucide="alert-triangle"></i>
                <span style="font-weight: 700;">⚠️ CLIENT TERMINATION NOTICE SUBMITTED: The client has notified that they will not extend this contract.</span>
            </div>
        `;
    }
    
    if (client.status === 'In Buffer') {
        alertBox.innerHTML += `
            <div class="sa-alert sa-alert-error" style="margin-bottom: 1.25rem; background: rgba(245, 158, 11, 0.05); color: #d97706; border-color: rgba(245, 158, 11, 0.2);">
                <i data-lucide="clock"></i>
                <span>Grace Period Active: Standard subscription expired on ${expiryDate}. Node is operating in a ${bufferDays}-day grace buffer. (${client.days_remaining_in_buffer} days left).</span>
            </div>
        `;
    }

    const termSectionTitle = document.getElementById('termSectionTitle');
    const termSectionContainer = document.getElementById('termSectionContainer');
    const termSectionDesc = document.getElementById('termSectionDesc');
    const terminateBtn = document.getElementById('terminateLicBtn');

    if (client.terminated_early) {
        termSectionTitle.innerText = 'Resume Suspended Service';
        termSectionTitle.style.color = '#10b981';
        
        termSectionContainer.style.background = 'rgba(16, 185, 129, 0.03)';
        termSectionContainer.style.borderColor = 'rgba(16, 185, 129, 0.1)';
        
        termSectionDesc.innerText = 'Generate a new key to reactivate the service, keeping all client details and expiry unchanged.';
        
        terminateBtn.innerText = 'Resume Service';
        terminateBtn.className = 'sa-btn sa-btn-success';
        terminateBtn.disabled = false;
        terminateBtn.onclick = () => resumeActiveLicense();
    } else {
        termSectionTitle.innerText = 'Early Hard Suspension';
        termSectionTitle.style.color = '#dc2626';
        
        termSectionContainer.style.background = 'rgba(239, 68, 68, 0.03)';
        termSectionContainer.style.borderColor = 'rgba(239, 68, 68, 0.1)';
        
        termSectionDesc.innerText = 'Instantly terminate and invalidate client subscription locks.';
        
        terminateBtn.innerText = 'Terminate License';
        terminateBtn.className = 'sa-btn sa-btn-danger';
        terminateBtn.disabled = false;
        terminateBtn.onclick = () => terminateActiveLicense();
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function extendActiveLicense() {
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    const select = document.getElementById('extendDaysSelect');
    const add_days = parseInt(select.value);

    try {
        const response = await fetch('/api/clients/extend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: client.id,
                add_days: add_days
            })
        });

        if (response.ok) {
            const data = await response.json();
            showToast(`License extended by ${add_days} days!`);
            fetchClients().then(() => {
                const refreshed = cachedClients.find(c => c.id === selectedClientId);
                bindLicenseManagerModal(refreshed);
            });
        } else {
            alert('Failed to extend license.');
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

async function terminateActiveLicense() {
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    if (!window.confirm(`Are you sure you want to voluntarily terminate/suspend ${client.client_name}'s subscription immediately? This will restrict database operations instantly.`)) {
        return;
    }

    try {
        const response = await fetch('/api/clients/terminate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: client.id })
        });

        if (response.ok) {
            showToast('Client subscription terminated.');
            fetchClients().then(() => {
                const refreshed = cachedClients.find(c => c.id === selectedClientId);
                bindLicenseManagerModal(refreshed);
            });
        } else {
            alert('Failed to terminate subscription.');
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

async function resumeActiveLicense() {
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    if (!window.confirm(`Are you sure you want to resume ${client.client_name}'s suspended service? This will generate a new activation key with all existing details and reactivate service.`)) {
        return;
    }

    try {
        const response = await fetch('/api/clients/resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: client.id })
        });

        if (response.ok) {
            const data = await response.json();
            showToast('Client subscription resumed.');
            fetchClients().then(() => {
                const refreshed = cachedClients.find(c => c.id === selectedClientId);
                bindLicenseManagerModal(refreshed);
            });
        } else {
            const data = await response.json();
            alert('Failed to resume subscription: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

async function approveExtensionRequest() {
    if (!selectedClientId) return;
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;
    
    if (!window.confirm(`Are you sure you want to ALLOW and approve the subscription extension request for ${client.client_name}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/clients/approve-extension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: client.id })
        });
        
        if (response.ok) {
            showToast('Extension request approved successfully!');
            fetchClients().then(() => {
                const refreshed = cachedClients.find(c => c.id === selectedClientId);
                bindLicenseManagerModal(refreshed);
            });
        } else {
            const data = await response.json();
            alert('Failed to approve extension: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

async function denyExtensionRequest() {
    if (!selectedClientId) return;
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;
    
    if (!window.confirm(`Are you sure you want to DENY and dismiss the subscription extension request for ${client.client_name}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/clients/deny-extension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: client.id })
        });
        
        if (response.ok) {
            showToast('Extension request denied and cleared.');
            fetchClients().then(() => {
                const refreshed = cachedClients.find(c => c.id === selectedClientId);
                bindLicenseManagerModal(refreshed);
            });
        } else {
            const data = await response.json();
            alert('Failed to deny request: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

function renderExtensionRequestsBanner(clients) {
    const banner = document.getElementById('extensionRequestsBanner');
    const listContainer = document.getElementById('extensionRequestsList');
    
    const requesting = clients.filter(c => c.extension_request && c.extension_request.status === 'pending');
    
    if (requesting.length === 0) {
        banner.style.display = 'none';
        return;
    }
    
    banner.style.display = 'block';
    listContainer.innerHTML = requesting.map(c => `
        <div style="background: white; border: 1px solid #fcd34d; border-radius: 0.5rem; padding: 0.5rem 0.75rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; box-shadow: 0 1px 2px rgba(0,0,0,0.02); height: 38px;">
            <strong style="color: #102a43;">${escapeHtml(c.client_name)}</strong>
            <span style="color: #627d98;">(${c.extension_request.add_days} days)</span>
            <button class="sa-btn sa-btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" onclick="selectAndConfigure(${c.id})">
                Review Request
            </button>
        </div>
    `).join('');
}

// 4. System Settings Bindings
function bindSystemSettingsModal(client) {
    const settings = client.settings || {
        max_visitors: 500,
        session_timeout: 60,
        support_email: "support@sumeetgroup.com",
        enable_sms: true,
        enable_face_recognition: false,
        auto_purge_days: 90
    };

    document.getElementById('settingMaxVisitors').value = settings.max_visitors;
    document.getElementById('settingSessionTimeout').value = settings.session_timeout;
    document.getElementById('settingSupportEmail').value = settings.support_email;
    document.getElementById('settingAutoPurge').value = settings.auto_purge_days;
    document.getElementById('settingEnableSMS').checked = !!settings.enable_sms;
    document.getElementById('settingEnableFace').checked = !!settings.enable_face_recognition;
}

function handleSettingsSubmit(e) {
    e.preventDefault();
    const client = cachedClients.find(c => c.id === selectedClientId);
    if (!client) return;

    client.settings = {
        max_visitors: parseInt(document.getElementById('settingMaxVisitors').value) || 500,
        session_timeout: parseInt(document.getElementById('settingSessionTimeout').value) || 60,
        support_email: document.getElementById('settingSupportEmail').value.trim(),
        auto_purge_days: parseInt(document.getElementById('settingAutoPurge').value) || 90,
        enable_sms: document.getElementById('settingEnableSMS').checked,
        enable_face_recognition: document.getElementById('settingEnableFace').checked
    };

    saveClientConfig().then(() => {
        closeConfigModal('systemSettings');
    });
}

// ==================== HTML CONSOLE HELPERS ====================

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJS(str) {
    if (!str) return '';
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// Global fetch interceptor to redirect to /login on 401 Unauthorized
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    try {
        const response = await originalFetch(...args);
        if (response.status === 401) {
            window.location.href = '/login';
        }
        return response;
    } catch (error) {
        throw error;
    }
};

async function handleLogout() {
    try {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        } else {
            alert('Logout request failed.');
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

async function deleteClientLicense(clientId) {
    if (!confirm('Are you sure you want to delete this terminated license? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/clients/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId })
        });
        
        if (response.ok) {
            showToast('License deleted successfully!');
            if (selectedClientId === clientId) {
                selectedClientId = null;
            }
            fetchClients();
        } else {
            const data = await response.json();
            alert('Failed to delete license: ' + data.error);
        }
    } catch (err) {
        alert('Network connection error: ' + err.message);
    }
}

// ==================== LICENSE CREATOR MODAL FUNCTIONS ====================

function initLicenseCreatorModal() {
    document.getElementById('createClientName').value = '';
    document.getElementById('createMaxUsers').value = '100';
    document.getElementById('createMaxSites').value = '10';
    document.getElementById('createMachineUuid').value = '';
    
    // Set Start Date to today (local YYYY-MM-DD)
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    document.getElementById('createStartDate').value = `${y}-${m}-${d}`;
    
    // Set End Date to 1 year from today
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const ey = oneYearLater.getFullYear();
    const em = String(oneYearLater.getMonth() + 1).padStart(2, '0');
    const ed = String(oneYearLater.getDate()).padStart(2, '0');
    document.getElementById('createEndDateInput').value = `${ey}-${em}-${ed}`;
    
    document.getElementById('createGraceDays').value = '90';
    
    document.getElementById('createConfirmCheckbox').checked = false;
    document.getElementById('createSignBtn').disabled = true;
    
    document.getElementById('createResultBlock').style.display = 'none';
    document.getElementById('createResultToken').value = '';

    updateLicenseCreatorDates();
}

function updateLicenseCreatorDates() {
    const startDateVal = document.getElementById('createStartDate').value;
    const endDateVal = document.getElementById('createEndDateInput').value;
    const graceDays = parseInt(document.getElementById('createGraceDays').value) || 0;

    if (!startDateVal || !endDateVal) {
        document.getElementById('createCalculatedDays').value = '';
        document.getElementById('createGraceStartDate').value = '';
        document.getElementById('createGraceEndDate').value = '';
        return;
    }

    const parseDateStr = (dateStr) => {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
    };

    const startDate = parseDateStr(startDateVal);
    const endDate = parseDateStr(endDateVal);

    // Calculate number of days between start and end date
    const timeDiff = endDate.getTime() - startDate.getTime();
    const numDays = Math.max(0, Math.round(timeDiff / (1000 * 3600 * 24)));

    // Calculate Grace End Date
    const graceEndDate = new Date(endDate.getTime());
    graceEndDate.setDate(graceEndDate.getDate() + graceDays);

    const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dayStr}`;
    };

    const formattedEndDate = formatDate(endDate);
    document.getElementById('createCalculatedDays').value = `${numDays} Days`;
    document.getElementById('createGraceStartDate').value = formattedEndDate;
    document.getElementById('createGraceEndDate').value = formatDate(graceEndDate);
}

function handleCreateConfirmationToggle() {
    const isChecked = document.getElementById('createConfirmCheckbox').checked;
    document.getElementById('createSignBtn').disabled = !isChecked;
}

async function handleCreateLicenseSubmit(e) {
    e.preventDefault();
    
    const client_name = document.getElementById('createClientName').value.trim();
    const max_users = parseInt(document.getElementById('createMaxUsers').value) || 100;
    const max_sites = parseInt(document.getElementById('createMaxSites').value) || 10;
    const machine_uuid = document.getElementById('createMachineUuid').value.trim();
    const start_date = document.getElementById('createStartDate').value;
    const end_date = document.getElementById('createEndDateInput').value;
    const buffer_days = parseInt(document.getElementById('createGraceDays').value) || 90;

    const parseDateStr = (dateStr) => {
        const parts = dateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
    };
    const startDate = parseDateStr(start_date);
    const endDate = parseDateStr(end_date);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const expiry_days = Math.max(0, Math.round(timeDiff / (1000 * 3600 * 24)));

    try {
        const response = await fetch('/api/generate-license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name,
                max_users,
                max_sites,
                machine_uuid,
                start_date,
                expiry_days,
                buffer_days
            })
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('createResultBlock').style.display = 'block';
            document.getElementById('createResultToken').value = data.license_key;
            showToast('License Key generated successfully!');
            fetchClients(); // refresh list
        } else {
            alert('Error generating license: ' + data.error);
        }
    } catch (err) {
        alert('Server connection error: ' + err.message);
    }
}

function copyCreatedResultToken() {
    const tokenArea = document.getElementById('createResultToken');
    tokenArea.select();
    document.execCommand('copy');
    showToast('License key token copied to clipboard!');
}

function resetCreatorForm() {
    document.getElementById('creatorLicenseForm').reset();
    initLicenseCreatorModal();
}

