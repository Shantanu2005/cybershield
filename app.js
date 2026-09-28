/* ══════════════════════════════════════════════════════════════
   CYBERSHIELD — FRONTEND APPLICATION
   Sections:
     1. API Client         — all HTTP calls to Express/MongoDB backend
     2. Auth               — login, register, logout
     3. App Init           — app open, nav building, page routing
     4. Page Renderers     — dashboard, cases, submit, users, investigators
     5. Case Submission    — form handling, file upload, submit
     6. Modal              — case detail, admin/inv controls
     7. Helpers            — badges, notifications
     8. Boot               — seed data, startup
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. API CLIENT
   Wraps all fetch() calls to the Express backend.
   Falls back to localStorage if the server is unreachable.
   ══════════════════════════════════════════════════════════════ */
const API_BASE = 'http://localhost:3000/api';

const API = {
  /* ── internal fetch helper (attaches JWT) ── */
  async _req(method, path, body = null) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      // Attach JWT Bearer token if available
      const token = Session.token;
      if (token) opts.headers['Authorization'] = `Bearer ${token}`;
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(API_BASE + path, opts);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Server error' }));
        throw new Error(err.message || 'Request failed');
      }
      return res.json();
    } catch (err) {
      if (err.message.includes('fetch') || err.message.includes('Failed')) {
        throw new Error('Cannot reach server. Is the backend running?');
      }
      throw err;
    }
  },

  /* ── Evidence upload (multipart FormData) ── */
  async uploadEvidence(files) {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    const token = Session.token;
    const res = await fetch(API_BASE + '/evidence/upload', {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(err.message || 'Upload failed');
    }
    return res.json();
  },

  /* ── Auth ── */
  login: (username, password) => API._req('POST', '/auth/login', { username, password }),
  register: (data) => API._req('POST', '/auth/register', data),

  /* ── Cases ── */
  getAllCases: () => API._req('GET', '/cases'),
  getMyCases: (userId) => API._req('GET', `/cases/user/${userId}`),
  submitCase: (data) => API._req('POST', '/cases', data),
  updateCase: (id, data) => API._req('PUT', `/cases/${id}`, data),

  /* ── Users ── */
  getAllUsers: () => API._req('GET', '/users'),
  getInvestigators: () => API._req('GET', '/users/investigators'),
};

/* ══════════════════════════════════════════════════════════════
   SESSION STORE (in-memory, cleared on refresh to force re-login)
   ══════════════════════════════════════════════════════════════ */
const Session = {
  _data: JSON.parse(sessionStorage.getItem('cs_session') || 'null'),
  get currentUser() { return this._data ? this._data.user : null; },
  get token() { return this._data ? this._data.token : null; },
  set(user, token) { this._data = { user, token }; sessionStorage.setItem('cs_session', JSON.stringify({ user, token })); },
  clear() { this._data = null; sessionStorage.removeItem('cs_session'); },
};

/* ══════════════════════════════════════════════════════════════
   2. AUTH
   ══════════════════════════════════════════════════════════════ */

/** Login form submission */
async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.textContent = '';

  if (!username || !password) { err.textContent = 'Please fill in all fields.'; return; }

  setLoading('loginBtn', true);
  try {
    const resp = await API.login(username, password);
    // Server returns { token, user }
    Session.set(resp.user, resp.token);
    openApp(resp.user);
  } catch (e) {
    err.textContent = e.message;
  } finally {
    setLoading('loginBtn', false);
  }
}

/** Register form submission */
async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUsername').value.trim().toLowerCase();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const phone = document.getElementById('regPhone').value.trim();
  const city = document.getElementById('regCity').value.trim();
  const address = document.getElementById('regAddress').value.trim();
  const password = document.getElementById('regPass').value;
  const pass2 = document.getElementById('regPass2').value;
  const err = document.getElementById('regError');
  const succ = document.getElementById('regSuccess');
  err.textContent = ''; succ.textContent = '';

  if (!name || !username || !email || !phone || !address || !password) {
    err.textContent = 'All fields are required.'; return;
  }
  if (password.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }
  if (password !== pass2) { err.textContent = 'Passwords do not match.'; return; }

  setLoading('registerBtn', true);
  try {
    await API.register({ name, username, email, phone, city, address, password });
    succ.textContent = 'Account created! You can now sign in.';
    setTimeout(() => switchTab('login'), 2000);
  } catch (e) {
    err.textContent = e.message;
  } finally {
    setLoading('registerBtn', false);
  }
}

/** Sign out */
function doLogout() {
  Session.clear();
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('loginScreen').classList.add('active');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

/** Toggle login / register tab */
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1))
  );
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}

/* ══════════════════════════════════════════════════════════════
   3. APP INIT — nav, routing
   ══════════════════════════════════════════════════════════════ */

/** Show the main application shell */
function openApp(user) {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');

  document.getElementById('avatarText').textContent = user.name[0].toUpperCase();
  document.getElementById('sidebarName').textContent = user.name;
  document.getElementById('sidebarEmail').textContent = user.email;

  const badge = document.getElementById('roleBadge');
  badge.className = 'role-badge';
  if (user.role === 'admin') { badge.classList.add('role-admin'); badge.textContent = 'Administrator'; }
  else if (user.role === 'investigator') { badge.classList.add('role-investigator'); badge.textContent = 'Investigator'; }
  else { badge.classList.add('role-user'); badge.textContent = 'Citizen'; }

  buildNav(user.role);
}

/** Build sidebar navigation per role */
function buildNav(role) {
  const nav = document.getElementById('navItems');
  let items = [];
  if (role === 'user')
    items = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'myCases', icon: '📁', label: 'My Cases' },
      { id: 'submitCase', icon: '✏️', label: 'Report Crime' },
    ];
  else if (role === 'admin')
    items = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'allCases', icon: '📁', label: 'All Cases' },
      { id: 'users', icon: '👥', label: 'Citizens' },
      { id: 'investigators', icon: '🔍', label: 'Investigators' },
    ];
  else
    items = [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'myCases', icon: '📁', label: 'My Cases' },
    ];

  nav.innerHTML = items
    .map(i => `<div class="nav-item" id="nav_${i.id}" onclick="showPage('${i.id}')">
                  <span class="icon">${i.icon}</span>${i.label}
                </div>`)
    .join('');

  showPage('dashboard');
}

/** Route + render a page */
async function showPage(id) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav_' + id);
  if (navEl) navEl.classList.add('active');

  const user = Session.currentUser;
  const mc = document.getElementById('mainContent');

  mc.innerHTML = loadingHTML();   // show spinner while fetching

  try {
    switch (id) {
      case 'dashboard': mc.innerHTML = await renderDashboard(user); break;
      case 'myCases': mc.innerHTML = await renderMyCases(user); break;
      case 'submitCase': mc.innerHTML = renderSubmitCase(); break;
      case 'allCases': mc.innerHTML = await renderAllCases(); break;
      case 'users': mc.innerHTML = await renderUsers(); break;
      case 'investigators': mc.innerHTML = await renderInvestigators(); break;
      default: mc.innerHTML = '';
    }
  } catch (e) {
    mc.innerHTML = errorHTML(e.message);
  }
}

/* ══════════════════════════════════════════════════════════════
   4. PAGE RENDERERS
   ══════════════════════════════════════════════════════════════ */

/* ── Dashboard ── */
async function renderDashboard(user) {
  /* USER dashboard */
  if (user.role === 'user') {
    const mine = await API.getMyCases(user._id || user.id);
    const stats = {
      total: mine.length,
      submitted: mine.filter(c => c.status === 'Submitted').length,
      active: mine.filter(c => ['Under Review', 'Investigation'].includes(c.status)).length,
      resolved: mine.filter(c => c.status === 'Resolved').length,
    };
    return `<div class="page active">
      <div class="page-header">
        <div class="page-title">Welcome, ${user.name.split(' ')[0]} 👋</div>
        <div class="page-sub">Here's an overview of your reported cases</div>
      </div>
      <div class="stats-grid">
        <div class="stat-card blue"><div class="stat-icon">📋</div><div class="stat-num">${stats.total}</div><div class="stat-label">Total Cases</div></div>
        <div class="stat-card warn"><div class="stat-icon">⏳</div><div class="stat-num">${stats.submitted}</div><div class="stat-label">Pending Review</div></div>
        <div class="stat-card blue"><div class="stat-icon">🔍</div><div class="stat-num">${stats.active}</div><div class="stat-label">Under Investigation</div></div>
        <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-num">${stats.resolved}</div><div class="stat-label">Resolved</div></div>
      </div>
      ${mine.length
        ? `<div class="card">
             <div class="card-header"><div class="card-title">Recent Cases</div></div>
             <div class="table-wrap"><table>
               <thead><tr><th>Case No.</th><th>Type</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
               <tbody>${mine.slice(0, 5).map(c => `
                 <tr>
                   <td><strong>#${c.caseNum}</strong></td>
                   <td>${typeBadge(c.type)}</td>
                   <td>${c.submittedAt ? c.submittedAt.slice(0, 10) : ''}</td>
                   <td>${statusBadge(c.status)}</td>
                   <td><div class="actions"><button class="btn btn-secondary" onclick='openCaseModal("${c._id || c.id}","user")'>View</button></div></td>
                 </tr>`).join('')}
               </tbody>
             </table></div>
           </div>`
        : `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No cases yet. <a href="#" onclick="showPage('submitCase')" style="color:var(--accent)">Report a cybercrime</a></div></div>`
      }
    </div>`;
  }

  /* ADMIN dashboard */
  if (user.role === 'admin') {
    const [cases, allUsers] = await Promise.all([API.getAllCases(), API.getAllUsers()]);
    const stats = {
      total: cases.length,
      submitted: cases.filter(c => c.status === 'Submitted').length,
      active: cases.filter(c => ['Under Review', 'Investigation'].includes(c.status)).length,
      resolved: cases.filter(c => c.status === 'Resolved').length,
    };
    const citizens = allUsers.filter(u => u.role === 'user').length;
    const invs = allUsers.filter(u => u.role === 'investigator').length;
    return `<div class="page active">
      <div class="page-header"><div class="page-title">Admin Dashboard 🛡️</div><div class="page-sub">System overview and management</div></div>
      <div class="stats-grid">
        <div class="stat-card blue"><div class="stat-icon">📋</div><div class="stat-num">${stats.total}</div><div class="stat-label">Total Cases</div></div>
        <div class="stat-card warn"><div class="stat-icon">⏳</div><div class="stat-num">${stats.submitted}</div><div class="stat-label">Awaiting Assignment</div></div>
        <div class="stat-card blue"><div class="stat-icon">🔍</div><div class="stat-num">${stats.active}</div><div class="stat-label">Active Cases</div></div>
        <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-num">${stats.resolved}</div><div class="stat-label">Resolved</div></div>
        <div class="stat-card blue"><div class="stat-icon">👥</div><div class="stat-num">${citizens}</div><div class="stat-label">Citizens</div></div>
        <div class="stat-card green"><div class="stat-icon">🔎</div><div class="stat-num">${invs}</div><div class="stat-label">Investigators</div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Recent Cases</div><button class="btn btn-secondary" onclick="showPage('allCases')">View All →</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Case No.</th><th>Citizen</th><th>Type</th><th>Status</th><th>Assigned To</th><th>Action</th></tr></thead>
          <tbody>${cases.slice(-5).reverse().map(c => `
            <tr>
              <td><strong>#${c.caseNum}</strong></td>
              <td>${c.userName}</td>
              <td>${typeBadge(c.type)}</td>
              <td>${statusBadge(c.status)}</td>
              <td>${c.assignedName || '<span style="color:var(--muted)">Unassigned</span>'}</td>
              <td><button class="btn btn-secondary" onclick='openCaseModal("${c._id || c.id}","admin")'>Manage</button></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </div>`;
  }

  /* INVESTIGATOR dashboard */
  if (user.role === 'investigator') {
    const mine = await API.getMyCases(user._id || user.id);
    const stats = {
      total: mine.length,
      active: mine.filter(c => c.status === 'Investigation').length,
      review: mine.filter(c => c.status === 'Under Review').length,
      resolved: mine.filter(c => c.status === 'Resolved').length,
    };
    return `<div class="page active">
      <div class="page-header"><div class="page-title">Investigator Dashboard 🔍</div><div class="page-sub">Your assigned cases overview</div></div>
      <div class="stats-grid">
        <div class="stat-card blue"><div class="stat-icon">📋</div><div class="stat-num">${stats.total}</div><div class="stat-label">Total Assigned</div></div>
        <div class="stat-card warn"><div class="stat-icon">📝</div><div class="stat-num">${stats.review}</div><div class="stat-label">Under Review</div></div>
        <div class="stat-card blue"><div class="stat-icon">🔍</div><div class="stat-num">${stats.active}</div><div class="stat-label">Investigating</div></div>
        <div class="stat-card green"><div class="stat-icon">✅</div><div class="stat-num">${stats.resolved}</div><div class="stat-label">Resolved</div></div>
      </div>
      ${mine.length
        ? `<div class="card"><div class="table-wrap"><table>
             <thead><tr><th>Case No.</th><th>Citizen</th><th>Type</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
             <tbody>${mine.map(c => `
               <tr>
                 <td><strong>#${c.caseNum}</strong></td>
                 <td>${c.userName}</td>
                 <td>${typeBadge(c.type)}</td>
                 <td>${statusBadge(c.status)}</td>
                 <td>${c.submittedAt ? c.submittedAt.slice(0, 10) : ''}</td>
                 <td><button class="btn btn-secondary" onclick='openCaseModal("${c._id || c.id}","investigator")'>Update</button></td>
               </tr>`).join('')}
             </tbody>
           </table></div></div>`
        : `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No cases assigned to you yet.</div></div>`
      }
    </div>`;
  }
}

/* ── My Cases ── */
async function renderMyCases(user) {
  const cases = user.role === 'investigator'
    ? await API.getMyCases(user._id || user.id)
    : await API.getMyCases(user._id || user.id);
  const viewMode = user.role === 'investigator' ? 'investigator' : 'user';
  return `<div class="page active">
    <div class="page-header">
      <div class="page-title">My Cases</div>
      <div class="page-sub">${user.role === 'investigator' ? 'Cases assigned to you' : 'Your submitted cases'}</div>
    </div>
    ${cases.length
      ? `<div class="card"><div class="table-wrap"><table>
           <thead><tr><th>Case No.</th><th>Type</th><th>Location</th><th>Submitted</th><th>Status</th><th>Investigator</th><th>Action</th></tr></thead>
           <tbody>${cases.map(c => `
             <tr>
               <td><strong>#${c.caseNum}</strong></td>
               <td>${typeBadge(c.type)}</td>
               <td>${c.location}</td>
               <td>${c.submittedAt ? c.submittedAt.slice(0, 10) : ''}</td>
               <td>${statusBadge(c.status)}</td>
               <td>${c.assignedName || '<span style="color:var(--muted)">Pending</span>'}</td>
               <td><button class="btn btn-secondary" onclick='openCaseModal("${c._id || c.id}","${viewMode}")'>View</button></td>
             </tr>`).join('')}
           </tbody>
         </table></div></div>`
      : `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No cases found. <a href="#" onclick="showPage('submitCase')" style="color:var(--accent)">Submit your first case →</a></div></div>`
    }
  </div>`;
}

/* ── All Cases (admin) ── */
async function renderAllCases() {
  const cases = await API.getAllCases();
  // Store globally for filtering
  window._allCasesCache = cases;
  return `<div class="page active">
    <div class="page-header"><div class="page-title">All Cases</div><div class="page-sub">Manage and monitor all cybercrime reports</div></div>
    <div class="search-bar">
      <input type="text" id="caseSearch" placeholder="🔍  Search by case no., citizen, type..." oninput="filterCases(this.value)"/>
      <select onchange="filterCaseStatus(this.value)">
        <option value="">All Statuses</option>
        <option>Submitted</option><option>Under Review</option><option>Investigation</option><option>Resolved</option>
      </select>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Case No.</th><th>Citizen</th><th>Type</th><th>Location</th><th>Date</th><th>Status</th><th>Assigned</th><th>Action</th></tr></thead>
      <tbody id="casesTableBody">${renderCasesRows(cases)}</tbody>
    </table></div></div>
  </div>`;
}

function renderCasesRows(cases) {
  return cases.map(c => `
    <tr data-caseid="${c._id || c.id}">
      <td><strong>#${c.caseNum}</strong></td>
      <td>${c.userName}</td>
      <td>${typeBadge(c.type)}</td>
      <td>${c.location}</td>
      <td>${c.submittedAt ? c.submittedAt.slice(0, 10) : ''}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.assignedName || '<span style="color:var(--muted)">Unassigned</span>'}</td>
      <td><button class="btn btn-secondary" onclick='openCaseModal("${c._id || c.id}","admin")'>Manage</button></td>
    </tr>`).join('');
}

function filterCases(q) {
  const filtered = (window._allCasesCache || []).filter(c =>
    c.caseNum.toString().includes(q) ||
    c.userName.toLowerCase().includes(q.toLowerCase()) ||
    c.type.toLowerCase().includes(q.toLowerCase())
  );
  document.getElementById('casesTableBody').innerHTML = renderCasesRows(filtered);
}

function filterCaseStatus(status) {
  const filtered = status
    ? (window._allCasesCache || []).filter(c => c.status === status)
    : (window._allCasesCache || []);
  document.getElementById('casesTableBody').innerHTML = renderCasesRows(filtered);
}

/* ── Citizens (admin) ── */
async function renderUsers() {
  const [users, cases] = await Promise.all([API.getAllUsers(), API.getAllCases()]);
  const citizens = users.filter(u => u.role === 'user');
  return `<div class="page active">
    <div class="page-header"><div class="page-title">Citizens</div><div class="page-sub">Registered citizen accounts</div></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>City</th><th>Joined</th><th>Cases</th></tr></thead>
      <tbody>${citizens.map(u => {
    const cnt = cases.filter(c => c.userId === (u._id || u.id)).length;
    return `<tr>
          <td>${u.name}</td><td>${u.username}</td><td>${u.email}</td>
          <td>${u.phone}</td><td>${u.city || '-'}</td>
          <td>${u.createdAt ? u.createdAt.slice(0, 10) : ''}</td>
          <td><span class="badge badge-submitted">${cnt} case${cnt !== 1 ? 's' : ''}</span></td>
        </tr>`;
  }).join('')}</tbody>
    </table></div></div>
  </div>`;
}

/* ── Investigators (admin) ── */
async function renderInvestigators() {
  const [users, cases] = await Promise.all([API.getAllUsers(), API.getAllCases()]);
  const invs = users.filter(u => u.role === 'investigator');
  return `<div class="page active">
    <div class="page-header"><div class="page-title">Investigators</div><div class="page-sub">Active investigation officers</div></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Username</th><th>Department</th><th>Email</th><th>Phone</th><th>Active Cases</th></tr></thead>
      <tbody>${invs.map(u => {
    const cnt = cases.filter(c => c.assignedTo === (u._id || u.id) && c.status !== 'Resolved').length;
    return `<tr>
          <td>${u.name}</td><td>${u.username}</td><td>${u.department || '-'}</td>
          <td>${u.email}</td><td>${u.phone}</td>
          <td><span class="badge badge-investigation">${cnt} active</span></td>
        </tr>`;
  }).join('')}</tbody>
    </table></div></div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════
   5. CASE SUBMISSION
   ══════════════════════════════════════════════════════════════ */
let pendingFiles = [];

function renderSubmitCase() {
  pendingFiles = [];
  return `<div class="page active">
    <div class="page-header">
      <div class="page-title">Report a Cybercrime ✏️</div>
      <div class="page-sub">Provide complete details to help investigators resolve your case faster</div>
    </div>

    <!-- Section 1: Incident Information -->
    <section class="form-section" aria-labelledby="sec-incident">
      <div class="form-section-title" id="sec-incident">📋 Incident Information</div>
      <div class="row-2">
        <div class="form-group">
          <label>Type of Cybercrime</label>
          <select id="cType">
            <option value="">Select type...</option>
            <option>Financial Fraud</option><option>Phishing</option><option>Cyberbullying</option>
            <option>Identity Theft</option><option>Hacking</option><option>Online Scam</option>
            <option>Data Breach</option><option>Ransomware</option><option>Other</option>
          </select>
        </div>
        <div class="form-group">
          <label>Location of Incident</label>
          <input type="text" id="cLocation" placeholder="City, State"/>
        </div>
      </div>
      <div class="row-2">
        <div class="form-group"><label>Date of Incident</label><input type="date" id="cDate"/></div>
        <div class="form-group"><label>Approximate Time</label><input type="time" id="cTime"/></div>
      </div>
      <div class="form-group">
        <label>Detailed Description</label>
        <textarea id="cDesc" rows="5" placeholder="Describe what happened in detail — how the crime occurred, who contacted you, what happened to your data or money..."></textarea>
      </div>
    </section>

    <!-- Section 2: Financial & Technical Details -->
    <section class="form-section" aria-labelledby="sec-financial">
      <div class="form-section-title" id="sec-financial">💰 Financial &amp; Technical Details <span style="color:var(--muted);font-size:0.75rem;font-weight:400">(if applicable)</span></div>
      <div class="row-2">
        <div class="form-group"><label>Amount Lost (₹)</label><input type="number" id="cAmount" placeholder="0"/></div>
        <div class="form-group"><label>Transaction ID</label><input type="text" id="cTxn" placeholder="TXN..."/></div>
      </div>
      <div class="row-2">
        <div class="form-group"><label>Bank / App Name</label><input type="text" id="cBank" placeholder="SBI, Paytm, PhonePe..."/></div>
        <div class="form-group"><label>Suspect IP Address</label><input type="text" id="cIp" placeholder="192.168.x.x"/></div>
      </div>
      <div class="row-2">
        <div class="form-group"><label>Suspect Website / URL</label><input type="text" id="cUrl" placeholder="http://..."/></div>
        <div class="form-group"><label>Device / Platform Used</label><input type="text" id="cDevice" placeholder="iPhone, Windows, Android..."/></div>
      </div>
    </section>

    <!-- Section 3: Evidence -->
    <section class="form-section" aria-labelledby="sec-evidence">
      <div class="form-section-title" id="sec-evidence">📎 Supporting Evidence</div>
      <div class="file-upload-area" onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" multiple accept="image/*,.pdf,.doc,.docx,.txt,.xlsx" onchange="handleFiles(this.files)"/>
        <div style="font-size:2rem;margin-bottom:0.5rem">📁</div>
        <div style="font-weight:600;margin-bottom:0.3rem">Click to upload files</div>
        <div style="font-size:0.8rem">Screenshots, PDFs, Chat Logs, Bank Statements — max 10 files</div>
      </div>
      <div class="file-list" id="fileList"></div>
    </section>

    <div id="submitCaseError" class="error-msg" style="margin-bottom:1rem"></div>
    <button id="submitCaseBtn" class="btn btn-primary" onclick="submitCase()" style="max-width:300px">Submit Case Report →</button>
  </div>`;
}

function handleFiles(files) {
  // Store actual File objects (not just names) for real upload
  for (let f of files) { if (pendingFiles.length < 10) pendingFiles.push(f); }
  renderFileList();
}
function removeFile(i) {
  pendingFiles.splice(i, 1);
  document.getElementById('fileInput').value = '';
  renderFileList();
}
function renderFileList() {
  document.getElementById('fileList').innerHTML =
    pendingFiles.map((f, i) => `<div class="file-item"><span>📄 ${f.name} <span style="color:var(--muted);font-size:0.75rem">(${(f.size / 1024).toFixed(1)} KB)</span></span><span style="color:var(--muted);cursor:pointer" onclick="removeFile(${i})">✕</span></div>`).join('');
}

async function submitCase() {
  const err = document.getElementById('submitCaseError');
  const type = document.getElementById('cType').value;
  const loc = document.getElementById('cLocation').value.trim();
  const date = document.getElementById('cDate').value;
  const desc = document.getElementById('cDesc').value.trim();
  if (!type || !loc || !date || !desc) {
    err.textContent = 'Please fill in all required fields (type, location, date, description).';
    return;
  }
  err.textContent = '';

  setLoading('submitCaseBtn', true);
  try {
    // Step 1: Upload evidence files to get SHA-256 hashes
    let evidenceFiles = [];
    if (pendingFiles.length > 0) {
      showNotif('⏳', 'Uploading evidence files...', 'success');
      const uploaded = await API.uploadEvidence(pendingFiles);
      evidenceFiles = uploaded;
    }

    // Step 2: Submit case with evidence metadata (server fills userId from JWT)
    const payload = {
      type, location: loc, incidentDate: date,
      incidentTime: document.getElementById('cTime').value,
      description: desc,
      amount: document.getElementById('cAmount').value,
      transactionId: document.getElementById('cTxn').value.trim(),
      bankName: document.getElementById('cBank').value.trim(),
      ipAddress: document.getElementById('cIp').value.trim(),
      websiteUrl: document.getElementById('cUrl').value.trim(),
      deviceInfo: document.getElementById('cDevice').value.trim(),
      evidenceFiles,
    };

    const newCase = await API.submitCase(payload);
    showNotif('✅', `Case #${newCase.caseNum} submitted successfully!`, 'success');
    showPage('myCases');
  } catch (e) {
    err.textContent = e.message;
  } finally {
    setLoading('submitCaseBtn', false);
  }
}

/* ══════════════════════════════════════════════════════════════
   6. MODAL — Case Detail
   ══════════════════════════════════════════════════════════════ */
async function openCaseModal(caseId, viewMode) {
  // Fetch fresh from server
  const cases = viewMode === 'admin'
    ? await API.getAllCases()
    : await API.getMyCases(Session.currentUser._id || Session.currentUser.id);
  const c = cases.find(x => (x._id || x.id) === caseId);
  if (!c) return;

  const phases = ['Submitted', 'Under Review', 'Investigation', 'Resolved'];
  const phaseIdx = phases.indexOf(c.status);

  /* Admin controls */
  let adminControls = '';
  if (viewMode === 'admin') {
    const invs = await API.getInvestigators();
    adminControls = `
      <div style="border-top:1px solid var(--border);padding-top:1.5rem;margin-top:1.5rem">
        <div style="font-family:var(--heading);font-weight:700;margin-bottom:1rem">⚙️ Admin Controls</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0;flex:2">
            <label>Assign Investigator</label>
            <select id="invSelect">
              <option value="">Unassigned</option>
              ${invs.map(i => `<option value="${i._id || i.id}" ${c.assignedTo === (i._id || i.id) ? 'selected' : ''}>${i.name} — ${i.department || 'General'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1">
            <label>Update Status</label>
            <select id="statusSelect">
              ${phases.map(p => `<option ${c.status === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:1rem">
          <label>Note / Update</label>
          <textarea id="adminNote" rows="2" placeholder="Add a note about this status update..."></textarea>
        </div>
        <div style="display:flex;gap:0.8rem;margin-top:1rem">
          <button class="btn btn-primary" style="width:auto;padding:0.7rem 1.5rem" onclick="saveAdminUpdate('${caseId}')">Save Changes</button>
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </div>`;
  }

  /* Investigator controls */
  let invControls = '';
  if (viewMode === 'investigator') {
    const phases2 = phases.filter(p => p !== 'Submitted');
    invControls = `
      <div style="border-top:1px solid var(--border);padding-top:1.5rem;margin-top:1.5rem">
        <div style="font-family:var(--heading);font-weight:700;margin-bottom:1rem">🔍 Update Case Status</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0;flex:1">
            <label>New Status</label>
            <select id="invStatusSelect">
              ${phases2.map(p => `<option ${c.status === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" style="margin-top:1rem">
          <label>Investigation Note (visible to citizen)</label>
          <textarea id="invNote" rows="3" placeholder="Describe your findings, actions taken, or current progress..."></textarea>
        </div>
        <div style="display:flex;gap:0.8rem;margin-top:1rem">
          <button class="btn btn-success" style="width:auto;padding:0.7rem 1.5rem" onclick="saveInvUpdate('${caseId}')">Update Status</button>
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        </div>
      </div>`;
  }

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header">
      <div>
        <div class="modal-title">Case #${c.caseNum}</div>
        <div style="color:var(--muted);font-size:0.85rem;margin-top:0.2rem">${c.type} · ${c.submittedAt ? c.submittedAt.slice(0, 10) : ''}</div>
      </div>
      <button class="btn-close" onclick="closeModal()">✕</button>
    </div>
    <div style="margin-bottom:1.5rem">${statusBadge(c.status)} ${typeBadge(c.type)}</div>

    <!-- Phase tracker -->
    <div style="margin-bottom:1.5rem">
      <div style="font-size:0.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:0.8rem">Investigation Progress</div>
      <div class="phase-tracker">
        ${phases.map((p, i) => `
          <div class="phase-step">
            <div class="phase-circle ${i < phaseIdx ? 'done' : i === phaseIdx ? 'active-phase' : ''}">${i < phaseIdx ? '✓' : i + 1}</div>
            <div class="phase-label ${i === phaseIdx ? 'active-lbl' : ''}">${p}</div>
          </div>
          ${i < phases.length - 1 ? `<div class="phase-line ${i < phaseIdx ? 'done' : ''}"></div>` : ''}`).join('')}
      </div>
    </div>

    <!-- Case details grid -->
    <div class="detail-grid">
      <div class="detail-item"><label>Citizen</label><p>${c.userName}</p></div>
      <div class="detail-item"><label>Contact</label><p>${c.userPhone || '-'}</p></div>
      <div class="detail-item"><label>Location</label><p>${c.location}</p></div>
      <div class="detail-item"><label>Incident Date</label><p>${c.incidentDate ? c.incidentDate.slice(0, 10) : '-'}${c.incidentTime ? ' at ' + c.incidentTime : ''}</p></div>
      ${c.amount ? `<div class="detail-item"><label>Amount Lost</label><p style="color:var(--accent3);font-weight:700">₹${parseInt(c.amount).toLocaleString()}</p></div>` : ''}
      ${c.bankName ? `<div class="detail-item"><label>Bank / App</label><p>${c.bankName}</p></div>` : ''}
      ${c.transactionId ? `<div class="detail-item"><label>Transaction ID</label><p>${c.transactionId}</p></div>` : ''}
      ${c.ipAddress ? `<div class="detail-item"><label>IP Address</label><p style="font-family:monospace">${c.ipAddress}</p></div>` : ''}
      ${c.websiteUrl ? `<div class="detail-item detail-full"><label>Suspect URL</label><p style="font-family:monospace;font-size:0.82rem;word-break:break-all;color:var(--accent3)">${c.websiteUrl}</p></div>` : ''}
      ${c.deviceInfo ? `<div class="detail-item"><label>Device</label><p>${c.deviceInfo}</p></div>` : ''}
      <div class="detail-item"><label>Assigned To</label><p>${c.assignedName || 'Not yet assigned'}</p></div>
      <div class="detail-item detail-full"><label>Description</label><p style="line-height:1.6;color:var(--muted)">${c.description}</p></div>
      ${c.evidenceFiles && c.evidenceFiles.length ? `
        <div class="detail-item detail-full">
          <label>Evidence Files (${c.evidenceFiles.length}) — SHA-256 Verified</label>
          <p>${c.evidenceFiles.map(f => {
    const name = typeof f === 'object' ? f.originalName : f;
    const hash = typeof f === 'object' && f.sha256 ? f.sha256 : null;
    const url = typeof f === 'object' && f.storedName ? '/uploads/' + f.storedName : null;
    const link = url ? `<a href="${url}" target="_blank" style="color:var(--accent);text-decoration:none">📎 ${name}</a>` : `📎 ${name}`;
    const hashTag = hash ? `<span style="font-family:monospace;font-size:0.68rem;color:var(--muted);display:block;margin-top:1px">SHA-256: ${hash.slice(0, 16)}…</span>` : '';
    return `<span style="display:inline-block;padding:4px 10px;background:var(--surface2);border-radius:6px;font-size:0.78rem;margin:2px;vertical-align:top">${link}${hashTag}</span>`;
  }).join('')}</p>
        </div>` : ''}
    </div>

    <!-- Timeline -->
    <div style="margin-top:1.5rem">
      <div style="font-size:0.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:0.8rem">Case Timeline</div>
      <div class="timeline">
        ${(c.statusHistory || []).map((h, i, arr) => `
          <div class="timeline-item ${i === arr.length - 1 ? 'active-step' : 'done'}">
            <div class="timeline-stage">${h.status}</div>
            <div class="timeline-date">${h.date ? h.date.slice(0, 10) : ''}</div>
            ${h.note ? `<div style="color:var(--muted);font-size:0.82rem;margin-top:0.2rem">${h.note}</div>` : ''}
          </div>`).join('')}
      </div>
    </div>
    ${adminControls}${invControls}`;

  document.getElementById('modalOverlay').classList.add('open');
}

async function saveAdminUpdate(caseId) {
  const invId = document.getElementById('invSelect').value;
  const status = document.getElementById('statusSelect').value;
  const note = document.getElementById('adminNote').value.trim();

  try {
    await API.updateCase(caseId, { invId, status, note, updatedBy: 'admin' });
    closeModal();
    showNotif('✅', 'Case updated successfully!', 'success');
    showPage('allCases');
  } catch (e) {
    showNotif('❌', e.message, 'error');
  }
}

async function saveInvUpdate(caseId) {
  const status = document.getElementById('invStatusSelect').value;
  const note = document.getElementById('invNote').value.trim();
  if (!note) { showNotif('⚠️', 'Please add a note before updating.', 'error'); return; }

  try {
    await API.updateCase(caseId, { status, note, updatedBy: 'investigator' });
    closeModal();
    showNotif('✅', 'Status updated! Citizen has been notified.', 'success');
    showPage('myCases');
  } catch (e) {
    showNotif('❌', e.message, 'error');
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

/* ══════════════════════════════════════════════════════════════
   7. HELPERS
   ══════════════════════════════════════════════════════════════ */
function statusBadge(s) {
  const map = { 'Submitted': 'submitted', 'Under Review': 'review', 'Investigation': 'investigation', 'Resolved': 'resolved' };
  return `<span class="badge badge-${map[s] || 'submitted'}">${s}</span>`;
}

function typeBadge(t) {
  const map = { 'Financial Fraud': 'fraud', 'Phishing': 'phishing', 'Cyberbullying': 'cyberbullying', 'Identity Theft': 'identity', 'Hacking': 'hacking' };
  const key = Object.keys(map).find(k => t && t.includes(k.split(' ')[0])) || 'other';
  return `<span class="badge badge-${map[key] || 'other'}">${t}</span>`;
}

function showNotif(icon, msg, type) {
  const el = document.getElementById('notif');
  document.getElementById('notifIcon').textContent = icon;
  document.getElementById('notifMsg').textContent = msg;
  el.className = `notif notif-${type}`;
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function loadingHTML() {
  return `<div class="loading-wrap"><div class="spinner"></div><span style="color:var(--muted)">Loading...</span></div>`;
}

function errorHTML(msg) {
  return `<div class="empty"><div class="empty-icon">⚠️</div><div class="empty-text" style="color:var(--accent3)">${msg}</div></div>`;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait...' : btn.dataset.label || btn.textContent;
  if (!btn.dataset.label && !loading) return;
  if (loading) btn.dataset.label = btn.textContent;
}

/* ══════════════════════════════════════════════════════════════
   8. BOOT
   ══════════════════════════════════════════════════════════════ */
document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// Restore session if user refreshed
const existing = Session.currentUser;
if (existing) openApp(existing);
