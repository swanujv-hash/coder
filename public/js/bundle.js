/* api.js â€” centralised fetch wrapper */
const API = (() => {
  function getToken() {
    return localStorage.getItem('token');
  }

  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({ success: false, message: 'Invalid server response.' }));

    if (res.status === 401) {
      // Session expired
      Auth.logout(true);
      return { success: false, message: 'Session expired. Please log in again.' };
    }
    return data;
  }

  return {
    get:    (path)         => request('GET',    path),
    post:   (path, body)   => request('POST',   path, body),
    put:    (path, body)   => request('PUT',    path, body),
    delete: (path)         => request('DELETE', path),
    patch:  (path, body)   => request('PATCH',  path, body),
  };
})();

/* Auth state */
const Auth = (() => {
  let _user   = null;
  let _student = null;

  function init() {
    const stored = localStorage.getItem('auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.type === 'student') _student = parsed;
        else _user = parsed;
      } catch {}
    }
  }

  function setStaff(user, token) {
    _user = user;
    _student = null;
    localStorage.setItem('token', token);
    localStorage.setItem('auth', JSON.stringify({ ...user, type: 'staff' }));
  }

  function setStudent(student, token) {
    _student = student;
    _user = null;
    localStorage.setItem('token', token);
    localStorage.setItem('auth', JSON.stringify({ ...student, type: 'student' }));
  }

  function logout(silent) {
    _user = null;
    _student = null;
    localStorage.removeItem('token');
    localStorage.removeItem('auth');
    if (!silent) Toast.show('Logged out successfully.', 'info');
    Router.navigate('login');
  }

  function isStaff()      { return !!_user; }
  function isStudent()    { return !!_student; }
  function isLoggedIn()   { return !!_user || !!_student; }
  function getUser()      { return _user; }
  function getStudent()   { return _student; }
  function getRole()      { return _user ? _user.role : 'student'; }
  function getName()      { return _user ? _user.full_name : (_student ? _student.full_name : ''); }

  return { init, setStaff, setStudent, logout, isStaff, isStudent, isLoggedIn, getUser, getStudent, getRole, getName };
})();
/* utils.js â€” shared helpers */

const Toast = (() => {
  function show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'âœ“', error: 'âœ•', warning: 'âš ', info: 'â„¹' };
    toast.innerHTML = `<span style="font-size:15px;flex-shrink:0">${icons[type] || 'â„¹'}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  return { show };
})();

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return 'â€”';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return 'â€”';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function isOverdue(dueDateStr) {
  return dueDateStr && dueDateStr < todayISO();
}

function statusBadge(status) {
  return `<span class="badge badge-${status}">${escapeHtml(status)}</span>`;
}

function conditionBadge(condition) {
  return `<span class="badge badge-${condition}">${escapeHtml(condition)}</span>`;
}

function typeBadge(type) {
  return `<span class="badge badge-${type}">${type === 'asset' ? 'ðŸ”– Asset' : 'ðŸ“¦ Quantity'}</span>`;
}

function openModal(title, bodyHtml, opts = {}) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const box = document.getElementById('modal-box');
  box.className = 'modal-box' + (opts.large ? ' modal-lg' : '');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

// Close modal on backdrop click
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function showLoading(container) {
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p style="margin-top:12px">Loadingâ€¦</p></div>';
}

function showEmpty(container, message = 'No records found.') {
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = `<div class="empty-state"><div class="empty-icon">ðŸ“‚</div><p>${escapeHtml(message)}</p></div>`;
}

function showError(container, message) {
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
}

function setInner(sel, html) {
  const el = document.querySelector(sel);
  if (el) el.innerHTML = html;
}

function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

function serialize(form) {
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });
  return data;
}

function printSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Print</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0}</style></head><body>${el.innerHTML}</body></html>`);
  win.document.close();
  win.print();
}
/* components.js â€” reusable UI components */

function renderLayout(pageTitle, content, activePage) {
  const user = Auth.getUser();
  const student = Auth.getStudent();
  const role = Auth.getRole();

  const staffNav = `
    <div class="nav-section">Main</div>
    <div class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" onclick="Router.navigate('dashboard')">
      <span class="nav-icon">ðŸ </span> Dashboard
    </div>
    <div class="nav-section">Inventory</div>
    <div class="nav-item ${activePage === 'inventory' ? 'active' : ''}" onclick="Router.navigate('inventory')">
      <span class="nav-icon">ðŸ“¦</span> Items
    </div>
    <div class="nav-item ${activePage === 'assets' ? 'active' : ''}" onclick="Router.navigate('assets')">
      <span class="nav-icon">ðŸ”–</span> Assets
    </div>
    <div class="nav-item ${activePage === 'locations' ? 'active' : ''}" onclick="Router.navigate('locations')">
      <span class="nav-icon">ðŸ“</span> Locations
    </div>
    <div class="nav-section">People</div>
    <div class="nav-item ${activePage === 'students' ? 'active' : ''}" onclick="Router.navigate('students')">
      <span class="nav-icon">ðŸ‘©â€ðŸŽ“</span> Students
    </div>
    <div class="nav-section">Transactions</div>
    <div class="nav-item ${activePage === 'issues' ? 'active' : ''}" onclick="Router.navigate('issues')">
      <span class="nav-icon">ðŸ“¤</span> Issue Items
    </div>
    <div class="nav-item ${activePage === 'renewals' ? 'active' : ''}" onclick="Router.navigate('renewals')">
      <span class="nav-icon">ðŸ”„</span> Renewals <span id="pending-badge" class="nav-badge" style="display:none"></span>
    </div>
    <div class="nav-section">Reports</div>
    <div class="nav-item ${activePage === 'reports' ? 'active' : ''}" onclick="Router.navigate('reports')">
      <span class="nav-icon">ðŸ“Š</span> Reports
    </div>
  `;

  const studentNav = `
    <div class="nav-section">My Account</div>
    <div class="nav-item ${activePage === 'portal-home' ? 'active' : ''}" onclick="Router.navigate('portal-home')">
      <span class="nav-icon">ðŸ </span> My Dashboard
    </div>
    <div class="nav-item ${activePage === 'portal-issues' ? 'active' : ''}" onclick="Router.navigate('portal-issues')">
      <span class="nav-icon">ðŸ“‹</span> My Issued Items
    </div>
    <div class="nav-item ${activePage === 'portal-renewals' ? 'active' : ''}" onclick="Router.navigate('portal-renewals')">
      <span class="nav-icon">ðŸ”„</span> My Renewals
    </div>
  `;

  const isStaff = Auth.isStaff();
  const displayName = isStaff ? (user ? user.full_name : '') : (student ? student.full_name : '');
  const displayRole = isStaff ? (user ? user.role : 'staff') : `${student ? student.programme + ', Sem ' + student.semester : 'Student'}`;

  return `
    <div class="layout">
      <nav class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">D</div>
          <div>
            <div class="brand-text">Dept. Inventory</div>
            <div class="brand-sub">Management System</div>
          </div>
        </div>
        <div class="sidebar-user">
          <div class="user-name">${escapeHtml(displayName)}</div>
          <div class="user-role">${escapeHtml(displayRole)}</div>
        </div>
        <nav class="sidebar-nav">
          ${isStaff ? staffNav : studentNav}
        </nav>
        <div class="sidebar-footer">
          <button class="logout-btn" onclick="Auth.logout()">â» Logout</button>
        </div>
      </nav>
      <div class="main-content">
        <div class="topbar">
          <div class="topbar-title">${escapeHtml(pageTitle)}</div>
          <div class="topbar-actions" id="topbar-actions"></div>
        </div>
        <div class="page-content">
          ${content}
        </div>
      </div>
    </div>
  `;
}

function renderFormModal(title, fields, onSubmit, opts = {}) {
  const fieldsHtml = fields.map(f => {
    if (f.type === 'hidden') return `<input type="hidden" name="${f.name}" value="${escapeHtml(f.value || '')}">`;
    const req = f.required ? '<span class="required">*</span>' : '';
    let input = '';
    if (f.type === 'select') {
      const options = (f.options || []).map(o =>
        `<option value="${escapeHtml(o.value)}" ${f.value == o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
      ).join('');
      input = `<select class="form-select" name="${f.name}" ${f.required ? 'required' : ''}>${f.required ? '' : '<option value="">Selectâ€¦</option>'}${options}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea class="form-textarea" name="${f.name}" placeholder="${escapeHtml(f.placeholder || '')}" ${f.required ? 'required' : ''}>${escapeHtml(f.value || '')}</textarea>`;
    } else {
      input = `<input class="form-input" type="${f.type || 'text'}" name="${f.name}" value="${escapeHtml(f.value || '')}" placeholder="${escapeHtml(f.placeholder || '')}" ${f.required ? 'required' : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''}>`;
    }
    return `
      <div class="form-group">
        <label class="form-label">${escapeHtml(f.label)}${req}</label>
        ${input}
        ${f.hint ? `<div class="form-hint">${escapeHtml(f.hint)}</div>` : ''}
      </div>
    `;
  }).join('');

  const html = `
    <form id="modal-form" onsubmit="event.preventDefault()">
      ${opts.alert ? `<div class="alert alert-${opts.alert.type || 'info'}">${opts.alert.message}</div>` : ''}
      ${fieldsHtml}
      <div class="modal-footer" style="padding:0;margin-top:20px">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="modal-submit-btn">${opts.submitLabel || 'Save'}</button>
      </div>
    </form>
  `;
  openModal(title, html, opts);

  setTimeout(() => {
    const form = document.getElementById('modal-form');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('modal-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Savingâ€¦';
      try {
        await onSubmit(serialize(form));
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = opts.submitLabel || 'Save'; }
      }
    });
  }, 50);
}

async function loadPendingBadge() {
  if (!Auth.isStaff()) return;
  const res = await API.get('/renewals?status=pending');
  const badge = document.getElementById('pending-badge');
  if (badge && res.success && res.data.length > 0) {
    badge.textContent = res.data.length;
    badge.style.display = '';
  } else if (badge) {
    badge.style.display = 'none';
  }
}
/* pages/login.js */
const PageLogin = (() => {
  function render() {
    const html = `
      <div class="login-page">
        <div class="login-card">
          <div class="login-logo">
            <div class="logo-icon">D</div>
            <h1>Department Inventory</h1>
            <p>Item Issue Management System</p>
          </div>
          <div class="login-tabs">
            <button class="login-tab active" id="tab-staff" onclick="switchTab('staff')">Staff / Coordinator</button>
            <button class="login-tab" id="tab-student" onclick="switchTab('student')">Student</button>
          </div>

          <!-- Staff login -->
          <form id="staff-form" onsubmit="handleStaffLogin(event)">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input class="form-input" type="text" id="staff-username" placeholder="Enter username" required autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input class="form-input" type="password" id="staff-password" placeholder="Enter password" required autocomplete="current-password">
            </div>
            <div id="staff-error" class="alert alert-danger" style="display:none"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center" id="staff-btn">Login</button>
          </form>

          <!-- Student login -->
          <form id="student-form" style="display:none" onsubmit="handleStudentLogin(event)">
            <div class="form-group">
              <label class="form-label">Enrollment Number</label>
              <input class="form-input" type="text" id="student-enr" placeholder="e.g. DFIS2024001" required autocomplete="username">
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input class="form-input" type="password" id="student-password" placeholder="Enter password" required autocomplete="current-password">
            </div>
            <div id="student-error" class="alert alert-danger" style="display:none"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center" id="student-btn">Login</button>
          </form>

          <p style="text-align:center;margin-top:20px;font-size:12px;color:var(--text-muted)">
            Department Inventory &amp; Item Issue Management System
          </p>
        </div>
      </div>
    `;
    document.getElementById('app').innerHTML = html;
    return null; // already set
  }

  return { render };
})();

function switchTab(type) {
  document.getElementById('tab-staff').classList.toggle('active', type === 'staff');
  document.getElementById('tab-student').classList.toggle('active', type === 'student');
  document.getElementById('staff-form').style.display   = type === 'staff'   ? '' : 'none';
  document.getElementById('student-form').style.display = type === 'student' ? '' : 'none';
}

async function handleStaffLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('staff-btn');
  const errEl = document.getElementById('staff-error');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Logging inâ€¦';

  const res = await API.post('/auth/login', {
    username: document.getElementById('staff-username').value.trim(),
    password: document.getElementById('staff-password').value,
  });

  btn.disabled = false; btn.textContent = 'Login';
  if (res.success) {
    Auth.setStaff(res.user, res.token);
    Toast.show(`Welcome, ${res.user.full_name}!`, 'success');
    Router.navigate('dashboard');
  } else {
    errEl.textContent = res.message || 'Login failed.';
    errEl.style.display = '';
  }
}

async function handleStudentLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('student-btn');
  const errEl = document.getElementById('student-error');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Logging inâ€¦';

  const res = await API.post('/auth/student-login', {
    enrollment_no: document.getElementById('student-enr').value.trim(),
    password: document.getElementById('student-password').value,
  });

  btn.disabled = false; btn.textContent = 'Login';
  if (res.success) {
    Auth.setStudent(res.student, res.token);
    Toast.show(`Welcome, ${res.student.full_name}!`, 'success');
    Router.navigate('portal-home');
  } else {
    errEl.textContent = res.message || 'Login failed.';
    errEl.style.display = '';
  }
}
/* pages/dashboard.js */
const PageDashboard = (() => {
  async function render() {
    const res = await API.get('/reports/dashboard');
    if (!res.success) return renderLayout('Dashboard', `<div class="alert alert-danger">${escapeHtml(res.message)}</div>`, 'dashboard');

    const d = res.data;

    const overdueRows = d.overdueList.length > 0
      ? d.overdueList.map(o => `
          <tr class="overdue-row">
            <td><strong>${escapeHtml(o.enrollment_no)}</strong></td>
            <td>${escapeHtml(o.student_name)}</td>
            <td>${escapeHtml(o.item_name)}${o.asset_tag ? ` <span class="badge badge-asset">${escapeHtml(o.asset_tag)}</span>` : ''}</td>
            <td>${formatDate(o.due_date)}</td>
            <td><span style="color:var(--danger);font-weight:700">${o.overdue_days} day(s)</span></td>
            <td>${o.qty_issued - o.qty_returned} item(s)</td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="Router.navigate('issues')">View</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">No overdue items ðŸŽ‰</td></tr>';

    const upcomingRows = d.upcomingDue.length > 0
      ? d.upcomingDue.map(u => `
          <tr>
            <td>${escapeHtml(u.enrollment_no)}</td>
            <td>${escapeHtml(u.student_name)}</td>
            <td>${escapeHtml(u.item_name)}</td>
            <td>${formatDate(u.due_date)}</td>
            <td>${escapeHtml(u.status)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">No upcoming due items</td></tr>';

    const content = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Items</div>
          <div class="stat-value">${d.totalItems}</div>
          <div class="stat-sub">Inventory items</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Students</div>
          <div class="stat-value">${d.totalStudents}</div>
          <div class="stat-sub">Registered</div>
        </div>
        <div class="stat-card info">
          <div class="stat-label">Active Issues</div>
          <div class="stat-value">${d.activeIssues}</div>
          <div class="stat-sub">Currently issued</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Overdue</div>
          <div class="stat-value">${d.overdueIssues}</div>
          <div class="stat-sub">Past due date</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Pending Renewals</div>
          <div class="stat-value">${d.pendingRenewals}</div>
          <div class="stat-sub">Awaiting approval</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">ðŸ”´ Overdue Items</span>
            <button class="btn btn-sm btn-outline" onclick="Router.navigate('reports')">Full Report</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Enrollment</th><th>Student</th><th>Item</th><th>Due Date</th><th>Overdue By</th><th>Outstanding</th><th></th></tr></thead>
              <tbody>${overdueRows}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">â° Due in Next 3 Days</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Enrollment</th><th>Student</th><th>Item</th><th>Due Date</th><th>Status</th></tr></thead>
              <tbody>${upcomingRows}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="card-header"><span class="card-title">Quick Actions</span></div>
          <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <button class="btn btn-primary" onclick="Router.navigate('issues')">ðŸ“¤ Issue Item</button>
            <button class="btn btn-outline" onclick="Router.navigate('renewals')">ðŸ”„ Renewals</button>
            <button class="btn btn-outline" onclick="Router.navigate('inventory')">ðŸ“¦ Inventory</button>
            <button class="btn btn-outline" onclick="Router.navigate('students')">ðŸ‘©â€ðŸŽ“ Students</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Pending Renewals</span></div>
          <div class="card-body">
            ${d.pendingRenewals > 0
              ? `<div class="alert alert-warning">âš  ${d.pendingRenewals} renewal request(s) awaiting your approval. <a href="#" onclick="Router.navigate('renewals');return false">Review now â†’</a></div>`
              : '<div class="alert alert-success">âœ“ No pending renewal requests.</div>'
            }
          </div>
        </div>
      </div>
    `;

    return renderLayout('Dashboard', content, 'dashboard');
  }

  return { render };
})();
/* pages/inventory.js */
const PageInventory = (() => {
  let _items = [];

  async function render() {
    const content = `
      <div class="filter-bar no-print">
        <input class="form-input search-input" type="search" id="inv-search" placeholder="Search itemsâ€¦" oninput="filterInventory()">
        <select class="form-select" id="inv-type" onchange="filterInventory()">
          <option value="">All Types</option>
          <option value="quantity">Quantity-based</option>
          <option value="asset">Asset-tracked</option>
        </select>
        <select class="form-select" id="inv-cat" onchange="filterInventory()">
          <option value="">All Categories</option>
        </select>
        <button class="btn btn-primary" onclick="showAddItem()">+ Add Item</button>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Inventory Items</span>
          <button class="btn btn-sm btn-outline no-print" onclick="printSection('inv-table-wrap')">ðŸ–¨ Print</button>
        </div>
        <div id="inv-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Inventory Items', content, 'inventory');
    setTimeout(() => loadItems(), 50);
    return html;
  }

  async function loadItems() {
    const search = qs('#inv-search')?.value || '';
    const type   = qs('#inv-type')?.value   || '';
    const cat    = qs('#inv-cat')?.value    || '';
    let url = '/inventory?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (type)   url += `item_type=${encodeURIComponent(type)}&`;
    if (cat)    url += `category=${encodeURIComponent(cat)}&`;

    const res = await API.get(url);
    if (!res.success) { showError('#inv-table-wrap', res.message); return; }
    _items = res.data;
    renderTable();

    // Load categories
    const catRes = await API.get('/inventory/meta/categories');
    if (catRes.success) {
      const sel = qs('#inv-cat');
      if (sel) {
        const curr = sel.value;
        sel.innerHTML = '<option value="">All Categories</option>' +
          catRes.data.map(c => `<option value="${escapeHtml(c)}" ${curr === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      }
    }
  }

  function renderTable() {
    const wrap = qs('#inv-table-wrap');
    if (!wrap) return;
    if (_items.length === 0) { showEmpty(wrap, 'No items found. Add your first inventory item.'); return; }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Category</th><th>Type</th>
            <th>Total</th><th>Available</th><th>Issued</th><th>Damaged</th><th>Lost</th><th>Maintenance</th>
            <th>Location</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${_items.map(it => `
            <tr>
              <td><code>${escapeHtml(it.item_code)}</code></td>
              <td><strong>${escapeHtml(it.name)}</strong>${it.make_model ? `<br><small style="color:var(--text-muted)">${escapeHtml(it.make_model)}</small>` : ''}</td>
              <td>${escapeHtml(it.category)}</td>
              <td>${typeBadge(it.item_type)}</td>
              <td>${it.total_qty}</td>
              <td><strong style="color:var(--success)">${it.available_qty}</strong></td>
              <td>${it.issued_qty}</td>
              <td>${it.damaged_qty > 0 ? `<span style="color:var(--danger)">${it.damaged_qty}</span>` : '0'}</td>
              <td>${it.lost_qty > 0 ? `<span style="color:var(--danger)">${it.lost_qty}</span>` : '0'}</td>
              <td>${it.maintenance_qty}</td>
              <td><small>${it.location_name ? escapeHtml(it.location_name) : 'â€”'}</small></td>
              <td>
                <button class="btn btn-xs btn-outline" onclick="showEditItem(${it.id})">Edit</button>
                <button class="btn btn-xs btn-warning" onclick="showAdjustStock(${it.id})">Adjust</button>
                ${it.item_type === 'asset' ? `<button class="btn btn-xs btn-outline" onclick="Router.navigate('assets',{item_id:${it.id}})">Assets</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return { render };
})();

function filterInventory() {
  clearTimeout(filterInventory._t);
  filterInventory._t = setTimeout(() => {
    const event = { target: {} };
    // Reload with filters
    const search = qs('#inv-search')?.value || '';
    const type   = qs('#inv-type')?.value   || '';
    const cat    = qs('#inv-cat')?.value    || '';
    let url = '/inventory?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (type)   url += `item_type=${encodeURIComponent(type)}&`;
    if (cat)    url += `category=${encodeURIComponent(cat)}&`;
    API.get(url).then(res => {
      if (!res.success) return;
      const wrap = qs('#inv-table-wrap');
      if (!wrap) return;
      if (res.data.length === 0) { showEmpty(wrap, 'No items match the filter.'); return; }
      wrap.querySelector('tbody') && (wrap.querySelector('tbody').innerHTML =
        res.data.map(it => `
          <tr>
            <td><code>${escapeHtml(it.item_code)}</code></td>
            <td><strong>${escapeHtml(it.name)}</strong>${it.make_model ? `<br><small style="color:var(--text-muted)">${escapeHtml(it.make_model)}</small>` : ''}</td>
            <td>${escapeHtml(it.category)}</td>
            <td>${typeBadge(it.item_type)}</td>
            <td>${it.total_qty}</td>
            <td><strong style="color:var(--success)">${it.available_qty}</strong></td>
            <td>${it.issued_qty}</td>
            <td>${it.damaged_qty > 0 ? `<span style="color:var(--danger)">${it.damaged_qty}</span>` : '0'}</td>
            <td>${it.lost_qty > 0 ? `<span style="color:var(--danger)">${it.lost_qty}</span>` : '0'}</td>
            <td>${it.maintenance_qty}</td>
            <td><small>${it.location_name ? escapeHtml(it.location_name) : 'â€”'}</small></td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="showEditItem(${it.id})">Edit</button>
              <button class="btn btn-xs btn-warning" onclick="showAdjustStock(${it.id})">Adjust</button>
            </td>
          </tr>
        `).join(''));
    });
  }, 300);
}

async function showAddItem() {
  const locRes = await API.get('/locations');
  const locs = locRes.success ? locRes.data : [];
  renderFormModal('Add Inventory Item', [
    { name: 'item_code', label: 'Item Code', required: true, placeholder: 'e.g. USB-CABLE-01', hint: 'Unique identifier for this item' },
    { name: 'name', label: 'Item Name', required: true, placeholder: 'e.g. USB-C Cable' },
    { name: 'category', label: 'Category', required: true, placeholder: 'e.g. Accessories, Electronics' },
    { name: 'make_model', label: 'Make / Model', placeholder: 'e.g. Ugreen USB-C 1m' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description' },
    { name: 'item_type', label: 'Tracking Type', type: 'select', required: true, options: [
        { value: 'quantity', label: 'Quantity-based (cables, adapters, etc.)' },
        { value: 'asset', label: 'Individually tracked asset (laptop, board, etc.)' },
    ]},
    { name: 'total_qty', label: 'Initial Quantity', type: 'number', required: true, min: 0, placeholder: '0', hint: 'For asset-type items, add individual assets after creation' },
    { name: 'issue_limit', label: 'Issue Limit per Student', type: 'number', min: 1, placeholder: '1' },
    { name: 'renewal_limit', label: 'Renewal Limit', type: 'number', min: 0, placeholder: '2' },
    { name: 'location_id', label: 'Storage Location', type: 'select', options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
  ], async (data) => {
    const res = await API.post('/inventory', data);
    if (res.success) {
      Toast.show('Item added successfully!', 'success');
      closeModal();
      Router.navigate('inventory');
    } else {
      Toast.show(res.message || 'Failed to add item.', 'error');
    }
  }, { submitLabel: 'Add Item' });
}

async function showEditItem(id) {
  const [itemRes, locRes] = await Promise.all([API.get(`/inventory/${id}`), API.get('/locations')]);
  if (!itemRes.success) { Toast.show('Could not load item.', 'error'); return; }
  const it = itemRes.data;
  const locs = locRes.success ? locRes.data : [];

  renderFormModal(`Edit Item: ${it.name}`, [
    { name: 'name', label: 'Item Name', required: true, value: it.name },
    { name: 'category', label: 'Category', required: true, value: it.category },
    { name: 'make_model', label: 'Make / Model', value: it.make_model || '' },
    { name: 'description', label: 'Description', type: 'textarea', value: it.description || '' },
    { name: 'issue_limit', label: 'Issue Limit', type: 'number', min: 1, value: it.issue_limit },
    { name: 'renewal_limit', label: 'Renewal Limit', type: 'number', min: 0, value: it.renewal_limit },
    { name: 'location_id', label: 'Storage Location', type: 'select', value: it.location_id, options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
  ], async (data) => {
    const res = await API.put(`/inventory/${id}`, data);
    if (res.success) {
      Toast.show('Item updated!', 'success');
      closeModal();
      Router.navigate('inventory');
    } else {
      Toast.show(res.message || 'Update failed.', 'error');
    }
  }, { submitLabel: 'Save Changes' });
}

async function showAdjustStock(id) {
  const res = await API.get(`/inventory/${id}`);
  if (!res.success) { Toast.show('Could not load item.', 'error'); return; }
  const it = res.data;

  renderFormModal(`Adjust Stock: ${it.name}`, [
    { name: 'type', label: 'Adjustment Type', type: 'select', required: true, options: [
        { value: 'addition', label: 'Stock Addition (new items received)' },
        { value: 'correction', label: 'Stock Correction (reconciliation)' },
        { value: 'retirement', label: 'Item Retirement (write-off)' },
        { value: 'condition_change', label: 'Condition Change' },
    ]},
    { name: 'qty_after', label: 'New Total Quantity', type: 'number', required: true, min: 0, value: it.total_qty },
    { name: 'damaged_qty', label: 'Damaged Quantity', type: 'number', min: 0, value: it.damaged_qty },
    { name: 'lost_qty', label: 'Lost Quantity', type: 'number', min: 0, value: it.lost_qty },
    { name: 'maintenance_qty', label: 'Maintenance Quantity', type: 'number', min: 0, value: it.maintenance_qty },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Explain the adjustmentâ€¦' },
  ], async (data) => {
    const r = await API.post(`/inventory/${id}/adjust-stock`, data);
    if (r.success) {
      Toast.show('Stock adjusted!', 'success');
      closeModal();
      Router.navigate('inventory');
    } else {
      Toast.show(r.message || 'Adjustment failed.', 'error');
    }
  }, {
    submitLabel: 'Apply Adjustment',
    alert: { type: 'info', message: `Current: Total=${it.total_qty}, Available=${it.available_qty}, Issued=${it.issued_qty}, Damaged=${it.damaged_qty}, Lost=${it.lost_qty}, Maintenance=${it.maintenance_qty}` },
  });
}
/* pages/assets.js */
const PageAssets = (() => {
  async function render(params = {}) {
    const content = `
      <div class="filter-bar no-print">
        <select class="form-select" id="asset-item-filter" onchange="loadAssets()">
          <option value="">All Items</option>
        </select>
        <select class="form-select" id="asset-status-filter" onchange="loadAssets()">
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="issued">Issued</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
        <select class="form-select" id="asset-cond-filter" onchange="loadAssets()">
          <option value="">All Conditions</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="damaged">Damaged</option>
          <option value="lost">Lost</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <button class="btn btn-primary" onclick="showAddAsset()">+ Add Asset</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Individual Assets</span></div>
        <div id="assets-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    const html = renderLayout('Individual Assets', content, 'assets');
    setTimeout(async () => {
      // Load asset-type items for filter
      const itemsRes = await API.get("/inventory?item_type=asset");
      if (itemsRes.success) {
        const sel = qs('#asset-item-filter');
        if (sel) {
          sel.innerHTML = '<option value="">All Items</option>' +
            itemsRes.data.map(i => `<option value="${i.id}" ${params.item_id == i.id ? 'selected' : ''}>${escapeHtml(i.name)} (${escapeHtml(i.item_code)})</option>`).join('');
        }
      }
      loadAssets();
    }, 50);
    return html;
  }

  return { render };
})();

async function loadAssets() {
  const item_id  = qs('#asset-item-filter')?.value   || '';
  const status   = qs('#asset-status-filter')?.value || '';
  const cond     = qs('#asset-cond-filter')?.value   || '';
  let url = '/assets?';
  if (item_id) url += `item_id=${item_id}&`;
  if (status)  url += `status=${status}&`;
  if (cond)    url += `condition=${cond}&`;

  const wrap = qs('#assets-table-wrap');
  if (!wrap) return;
  showLoading(wrap);

  const res = await API.get(url);
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No assets found.'); return; }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Asset ID</th><th>Serial No.</th><th>Item</th><th>Location</th><th>Condition</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${res.data.map(a => `
          <tr>
            <td><strong>${escapeHtml(a.asset_id)}</strong></td>
            <td><small>${a.serial_no ? escapeHtml(a.serial_no) : 'â€”'}</small></td>
            <td>${escapeHtml(a.item_name)}<br><small style="color:var(--text-muted)">${escapeHtml(a.item_code)}</small></td>
            <td><small>${a.location_name ? escapeHtml(a.location_name) : 'â€”'}</small></td>
            <td>${conditionBadge(a.condition)}</td>
            <td>${statusBadge(a.status)}</td>
            <td><button class="btn btn-xs btn-outline" onclick="showEditAsset(${a.id})">Edit</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function showAddAsset() {
  const [itemsRes, locsRes] = await Promise.all([API.get('/inventory?item_type=asset'), API.get('/locations')]);
  const items = itemsRes.success ? itemsRes.data : [];
  const locs  = locsRes.success  ? locsRes.data  : [];

  renderFormModal('Add Individual Asset', [
    { name: 'asset_id', label: 'Asset ID', required: true, placeholder: 'e.g. DB-011' },
    { name: 'serial_no', label: 'Serial Number', placeholder: 'e.g. SN-RPI-1011' },
    { name: 'item_id', label: 'Parent Item', type: 'select', required: true, options: items.map(i => ({ value: i.id, label: `${i.name} (${i.item_code})` })) },
    { name: 'location_id', label: 'Storage Location', type: 'select', options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
    { name: 'condition', label: 'Condition', type: 'select', required: true, value: 'good', options: [
        { value: 'good', label: 'Good' },
        { value: 'fair', label: 'Fair' },
        { value: 'damaged', label: 'Damaged' },
        { value: 'maintenance', label: 'Maintenance' },
    ]},
    { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any remarksâ€¦' },
  ], async (data) => {
    const res = await API.post('/assets', data);
    if (res.success) {
      Toast.show('Asset added!', 'success');
      closeModal();
      loadAssets();
    } else {
      Toast.show(res.message || 'Failed to add asset.', 'error');
    }
  }, { submitLabel: 'Add Asset' });
}

async function showEditAsset(id) {
  const [res, locsRes] = await Promise.all([API.get(`/assets/${id}`), API.get('/locations')]);
  if (!res.success) { Toast.show('Could not load asset.', 'error'); return; }
  const a = res.data;
  const locs = locsRes.success ? locsRes.data : [];

  renderFormModal(`Edit Asset: ${a.asset_id}`, [
    { name: 'serial_no', label: 'Serial Number', value: a.serial_no || '' },
    { name: 'location_id', label: 'Storage Location', type: 'select', value: a.location_id, options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
    { name: 'condition', label: 'Condition', type: 'select', required: true, value: a.condition, options: [
        { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' },
        { value: 'damaged', label: 'Damaged' }, { value: 'lost', label: 'Lost' },
        { value: 'maintenance', label: 'Under Maintenance' },
    ]},
    { name: 'status', label: 'Status', type: 'select', required: true, value: a.status, options: [
        { value: 'available', label: 'Available' }, { value: 'maintenance', label: 'Maintenance' },
        { value: 'retired', label: 'Retired' },
    ]},
    { name: 'notes', label: 'Notes', type: 'textarea', value: a.notes || '' },
  ], async (data) => {
    const r = await API.put(`/assets/${id}`, data);
    if (r.success) {
      Toast.show('Asset updated!', 'success');
      closeModal();
      loadAssets();
    } else {
      Toast.show(r.message || 'Update failed.', 'error');
    }
  }, { submitLabel: 'Save Changes' });
}
/* pages/assets.js â€” location management tab-in */
const PageLocations = (() => {
  async function render() {
    const content = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddLocation()">+ Add Location</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Storage Locations</span></div>
        <div id="loc-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Storage Locations', content, 'locations');
    setTimeout(loadLocations, 50);
    return html;
  }
  return { render };
})();

async function loadLocations() {
  const wrap = qs('#loc-table-wrap');
  if (!wrap) return;
  const res = await API.get('/locations');
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No locations added yet.'); return; }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Description</th><th>Actions</th></tr></thead>
      <tbody>
        ${res.data.map(l => `
          <tr>
            <td><strong>${escapeHtml(l.name)}</strong></td>
            <td>${statusBadge(l.type)}</td>
            <td>${l.description ? escapeHtml(l.description) : 'â€”'}</td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="showEditLocation(${l.id},'${escapeHtml(l.name)}','${l.type}','${escapeHtml(l.description || '')}')">Edit</button>
              <button class="btn btn-xs btn-danger" onclick="deleteLocation(${l.id})">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showAddLocation() {
  renderFormModal('Add Location', [
    { name: 'name', label: 'Location Name', required: true, placeholder: 'e.g. Computer Lab A' },
    { name: 'type', label: 'Type', type: 'select', required: true, options: [
        { value: 'department', label: 'Department' },
        { value: 'laboratory', label: 'Laboratory' },
        { value: 'room', label: 'Room' },
        { value: 'cupboard', label: 'Cupboard' },
        { value: 'other', label: 'Other' },
    ]},
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional details' },
  ], async (data) => {
    const res = await API.post('/locations', data);
    if (res.success) { Toast.show('Location added!', 'success'); closeModal(); loadLocations(); }
    else Toast.show(res.message || 'Failed.', 'error');
  }, { submitLabel: 'Add Location' });
}

function showEditLocation(id, name, type, description) {
  renderFormModal('Edit Location', [
    { name: 'name', label: 'Name', required: true, value: name },
    { name: 'type', label: 'Type', type: 'select', required: true, value: type, options: [
        { value: 'department', label: 'Department' }, { value: 'laboratory', label: 'Laboratory' },
        { value: 'room', label: 'Room' }, { value: 'cupboard', label: 'Cupboard' }, { value: 'other', label: 'Other' },
    ]},
    { name: 'description', label: 'Description', type: 'textarea', value: description },
  ], async (data) => {
    const res = await API.put(`/locations/${id}`, data);
    if (res.success) { Toast.show('Location updated!', 'success'); closeModal(); loadLocations(); }
    else Toast.show(res.message || 'Failed.', 'error');
  }, { submitLabel: 'Save' });
}

async function deleteLocation(id) {
  if (!confirm('Delete this location? Items assigned to it will lose their location.')) return;
  const res = await API.delete(`/locations/${id}`);
  if (res.success) { Toast.show('Location deleted.', 'info'); loadLocations(); }
  else Toast.show(res.message || 'Failed.', 'error');
}
/* pages/students.js */
const PageStudents = (() => {
  async function render() {
    const content = `
      <div class="filter-bar no-print">
        <input class="form-input search-input" type="search" id="stu-search" placeholder="Search by name or enrollmentâ€¦" oninput="filterStudents()">
        <select class="form-select" id="stu-prog" onchange="filterStudents()">
          <option value="">All Programmes</option>
        </select>
        <select class="form-select" id="stu-sem" onchange="filterStudents()">
          <option value="">All Semesters</option>
          ${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}">Semester ${s}</option>`).join('')}
        </select>
        <button class="btn btn-primary" onclick="showAddStudent()">+ Register Student</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Registered Students</span></div>
        <div id="stu-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Students', content, 'students');
    setTimeout(loadStudents, 50);
    return html;
  }
  return { render };
})();

async function loadStudents() {
  const search = qs('#stu-search')?.value   || '';
  const prog   = qs('#stu-prog')?.value     || '';
  const sem    = qs('#stu-sem')?.value      || '';
  let url = '/students?';
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (prog)   url += `programme=${encodeURIComponent(prog)}&`;
  if (sem)    url += `semester=${sem}&`;

  const wrap = qs('#stu-table-wrap');
  if (!wrap) return;
  const res = await API.get(url);
  if (!res.success) { showError(wrap, res.message); return; }

  // Load programmes
  const progRes = await API.get('/students/meta/programmes');
  if (progRes.success) {
    const sel = qs('#stu-prog');
    if (sel) {
      const curr = sel.value;
      sel.innerHTML = '<option value="">All Programmes</option>' +
        progRes.data.map(p => `<option value="${escapeHtml(p)}" ${curr === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
    }
  }

  if (res.data.length === 0) { showEmpty(wrap, 'No students found.'); return; }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Enrollment No.</th><th>Name</th><th>Programme</th><th>Semester</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
      <tbody>
        ${res.data.map(s => `
          <tr>
            <td><strong>${escapeHtml(s.enrollment_no)}</strong></td>
            <td>${escapeHtml(s.full_name)}</td>
            <td>${escapeHtml(s.programme)}</td>
            <td>${s.semester}</td>
            <td>${s.email ? escapeHtml(s.email) : 'â€”'}</td>
            <td>${s.phone ? escapeHtml(s.phone) : 'â€”'}</td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="showEditStudent(${s.id})">Edit</button>
              <button class="btn btn-xs btn-outline" onclick="showStudentHistory(${s.id})">History</button>
              <button class="btn btn-xs btn-warning" onclick="showResetPassword(${s.id})">Reset Pwd</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterStudents() {
  clearTimeout(filterStudents._t);
  filterStudents._t = setTimeout(loadStudents, 300);
}

function showAddStudent() {
  renderFormModal('Register Student', [
    { name: 'enrollment_no', label: 'Enrollment Number', required: true, placeholder: 'e.g. DFIS2024005' },
    { name: 'full_name', label: 'Full Name', required: true, placeholder: 'Student full name' },
    { name: 'programme', label: 'Programme', required: true, placeholder: 'e.g. M.Sc. DFIS' },
    { name: 'semester', label: 'Semester', type: 'number', required: true, min: 1, max: 12, placeholder: '1' },
    { name: 'email', label: 'Email', type: 'email', placeholder: 'student@edu' },
    { name: 'phone', label: 'Phone', placeholder: '9876543210' },
    { name: 'password', label: 'Initial Password', type: 'password', required: true, placeholder: 'Min 6 chars' },
  ], async (data) => {
    const res = await API.post('/students', data);
    if (res.success) { Toast.show('Student registered!', 'success'); closeModal(); loadStudents(); }
    else Toast.show(res.message || 'Failed.', 'error');
  }, { submitLabel: 'Register' });
}

async function showEditStudent(id) {
  const res = await API.get(`/students/${id}`);
  if (!res.success) { Toast.show('Could not load student.', 'error'); return; }
  const s = res.data;
  renderFormModal(`Edit Student: ${s.full_name}`, [
    { name: 'full_name', label: 'Full Name', required: true, value: s.full_name },
    { name: 'programme', label: 'Programme', required: true, value: s.programme },
    { name: 'semester', label: 'Semester', type: 'number', min: 1, max: 12, value: s.semester },
    { name: 'email', label: 'Email', type: 'email', value: s.email || '' },
    { name: 'phone', label: 'Phone', value: s.phone || '' },
  ], async (data) => {
    const r = await API.put(`/students/${id}`, data);
    if (r.success) { Toast.show('Student updated!', 'success'); closeModal(); loadStudents(); }
    else Toast.show(r.message || 'Failed.', 'error');
  }, { submitLabel: 'Save Changes' });
}

function showResetPassword(id) {
  renderFormModal('Reset Student Password', [
    { name: 'new_password', label: 'New Password', type: 'password', required: true, placeholder: 'Min 6 characters' },
  ], async (data) => {
    const res = await API.post(`/students/${id}/reset-password`, data);
    if (res.success) { Toast.show('Password reset!', 'success'); closeModal(); }
    else Toast.show(res.message || 'Failed.', 'error');
  }, { submitLabel: 'Reset Password' });
}

async function showStudentHistory(id) {
  const res = await API.get(`/reports/student/${id}`);
  if (!res.success) { Toast.show('Could not load history.', 'error'); return; }
  const { student, issues } = res.data;

  const rows = issues.length > 0
    ? issues.map(iss => `
        <tr class="${iss.status === 'overdue' ? 'overdue-row' : ''}">
          <td>${escapeHtml(iss.issue_no)}</td>
          <td>${escapeHtml(iss.item_name)}</td>
          <td>${formatDate(iss.issue_date)}</td>
          <td>${formatDate(iss.due_date)}</td>
          <td>${statusBadge(iss.status)}</td>
          <td>${iss.qty_issued - iss.qty_returned} / ${iss.qty_issued}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No issue history</td></tr>';

  openModal(`Issue History: ${student.full_name}`, `
    <div style="margin-bottom:12px">
      <strong>${escapeHtml(student.enrollment_no)}</strong> &bull; ${escapeHtml(student.programme)}, Semester ${student.semester}
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Issue No.</th><th>Item</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Outstanding/Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `, { large: true });
}
/* pages/issues.js */
const PageIssues = (() => {
  async function render() {
    const content = `
      <div class="filter-bar no-print">
        <select class="form-select" id="iss-status" onchange="loadIssues()">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="overdue">Overdue</option>
          <option value="partial">Partial Return</option>
          <option value="renewed">Renewed</option>
          <option value="returned">Returned</option>
        </select>
        <select class="form-select" id="iss-prog" onchange="loadIssues()">
          <option value="">All Programmes</option>
        </select>
        <button class="btn btn-primary" onclick="showIssueItem()">ðŸ“¤ Issue Item</button>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Issue Transactions</span>
          <button class="btn btn-sm btn-outline no-print" onclick="printSection('iss-table-wrap')">ðŸ–¨ Print</button>
        </div>
        <div id="iss-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Issue Transactions', content, 'issues');
    setTimeout(async () => {
      // Load programmes for filter
      const progRes = await API.get('/students/meta/programmes');
      if (progRes.success) {
        const sel = qs('#iss-prog');
        if (sel) sel.innerHTML = '<option value="">All Programmes</option>' +
          progRes.data.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
      }
      loadIssues();
    }, 50);
    return html;
  }
  return { render };
})();

async function loadIssues() {
  const status = qs('#iss-status')?.value || '';
  const prog   = qs('#iss-prog')?.value   || '';
  let url = '/issues?';
  if (status) url += `status=${status}&`;
  if (prog)   url += `programme=${encodeURIComponent(prog)}&`;

  const wrap = qs('#iss-table-wrap');
  if (!wrap) return;

  const res = await API.get(url);
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No issue records found.'); return; }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Issue No.</th><th>Student</th><th>Item</th><th>Qty</th>
          <th>Issue Date</th><th>Due Date</th><th>Status</th><th>Overdue</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${res.data.map(iss => `
          <tr class="${iss.status === 'overdue' ? 'overdue-row' : ''}">
            <td><code>${escapeHtml(iss.issue_no)}</code></td>
            <td>
              <strong>${escapeHtml(iss.student_name)}</strong><br>
              <small style="color:var(--text-muted)">${escapeHtml(iss.enrollment_no)} &bull; ${escapeHtml(iss.programme)}</small>
            </td>
            <td>
              ${escapeHtml(iss.item_name)}
              ${iss.asset_tag ? `<br><span class="badge badge-asset">${escapeHtml(iss.asset_tag)}</span>` : ''}
            </td>
            <td>${iss.qty_issued - iss.qty_returned} / ${iss.qty_issued}</td>
            <td>${formatDate(iss.issue_date)}</td>
            <td><strong>${formatDate(iss.due_date)}</strong></td>
            <td>${statusBadge(iss.status)}</td>
            <td>${iss.overdue_days ? `<span style="color:var(--danger);font-weight:700">${iss.overdue_days}d</span>` : 'â€”'}</td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="showIssueDetail(${iss.id})">View</button>
              ${['active','overdue','partial','renewed'].includes(iss.status) ? `
                <button class="btn btn-xs btn-success" onclick="showRecordReturn(${iss.id})">Return</button>
              ` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function showIssueItem() {
  const [stuRes, itemRes] = await Promise.all([API.get('/students'), API.get('/inventory')]);
  const students = stuRes.success ? stuRes.data : [];
  const items    = itemRes.success ? itemRes.data.filter(i => i.available_qty > 0) : [];

  const formHtml = `
    <form id="issue-form" onsubmit="submitIssue(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Student <span class="required">*</span></label>
          <select class="form-select" name="student_id" id="issue-student" required onchange="updateIssueSummary()">
            <option value="">Select studentâ€¦</option>
            ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.enrollment_no)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Item <span class="required">*</span></label>
          <select class="form-select" name="item_id" id="issue-item" required onchange="onIssueItemChange()">
            <option value="">Select itemâ€¦</option>
            ${items.map(i => `<option value="${i.id}" data-type="${i.item_type}" data-avail="${i.available_qty}">${escapeHtml(i.name)} â€” Available: ${i.available_qty}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="asset-select-row" style="display:none" class="form-group">
        <label class="form-label">Select Asset <span class="required">*</span></label>
        <select class="form-select" name="asset_id" id="issue-asset">
          <option value="">â€” Choose asset first â€”</option>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Quantity <span class="required">*</span></label>
          <input class="form-input" type="number" name="qty_issued" id="issue-qty" min="1" value="1" required oninput="updateIssueSummary()">
        </div>
        <div class="form-group">
          <label class="form-label">Issue Date <span class="required">*</span></label>
          <input class="form-input" type="date" name="issue_date" id="issue-date" value="${todayISO()}" required oninput="updateIssueSummary()">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Purpose</label>
        <input class="form-input" type="text" name="purpose" placeholder="e.g. Lab project, coursework">
      </div>
      <div class="form-group">
        <label class="form-label">Issuing Staff</label>
        <input class="form-input" type="text" value="${escapeHtml(Auth.getUser()?.full_name || '')}" readonly style="background:var(--surface2)">
      </div>

      <div id="issue-summary" class="alert alert-info" style="display:none"></div>
      <div id="issue-error" class="alert alert-danger" style="display:none"></div>

      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary" id="issue-submit-btn">Issue Item</button>
      </div>
    </form>
  `;
  openModal('Issue Item to Student', formHtml, { large: true });
  setTimeout(() => updateIssueSummary(), 50);
}

async function onIssueItemChange() {
  const sel = qs('#issue-item');
  const opt = sel.options[sel.selectedIndex];
  const type = opt?.dataset?.type;
  const assetRow = qs('#asset-select-row');
  const qtyInput = qs('#issue-qty');

  if (type === 'asset') {
    assetRow.style.display = '';
    qtyInput.value = '1';
    qtyInput.readOnly = true;
    qtyInput.style.background = 'var(--surface2)';

    // Load available assets
    const itemId = sel.value;
    const assetSel = qs('#issue-asset');
    assetSel.innerHTML = '<option value="">Loadingâ€¦</option>';
    const res = await API.get(`/assets?item_id=${itemId}&status=available`);
    if (res.success && res.data.length > 0) {
      assetSel.innerHTML = '<option value="">Select assetâ€¦</option>' +
        res.data.map(a => `<option value="${a.id}">${escapeHtml(a.asset_id)}${a.serial_no ? ` â€” ${escapeHtml(a.serial_no)}` : ''} (${escapeHtml(a.condition)})</option>`).join('');
    } else {
      assetSel.innerHTML = '<option value="">No available assets</option>';
    }
  } else {
    assetRow.style.display = 'none';
    qtyInput.readOnly = false;
    qtyInput.style.background = '';
  }
  updateIssueSummary();
}

function updateIssueSummary() {
  const dateInput = qs('#issue-date');
  const qtyInput  = qs('#issue-qty');
  const summary   = qs('#issue-summary');
  if (!dateInput || !summary) return;

  const issueDate = dateInput.value;
  const qty = parseInt(qtyInput?.value || 1);
  if (issueDate) {
    const d = new Date(issueDate);
    d.setDate(d.getDate() + 15);
    const dueDate = d.toISOString().slice(0, 10);
    summary.style.display = '';
    summary.innerHTML = `ðŸ“… <strong>Due Date:</strong> ${formatDate(dueDate)} (15 days from issue date)${qty > 1 ? ` &bull; Quantity: <strong>${qty}</strong>` : ''}`;
  } else {
    summary.style.display = 'none';
  }
}

async function submitIssue(e) {
  e.preventDefault();
  const btn = qs('#issue-submit-btn');
  const errEl = qs('#issue-error');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Issuingâ€¦';

  const form = e.target;
  const data = serialize(form);

  const res = await API.post('/issues', data);
  btn.disabled = false; btn.textContent = 'Issue Item';

  if (res.success) {
    const d = res.data;
    // Show acknowledgment
    openModal('âœ… Issue Acknowledgement', `
      <div class="receipt">
        <h3>Issue Acknowledgement</h3>
        <div class="receipt-row"><span class="label">Issue No.</span><span class="value">${escapeHtml(d.issue_no)}</span></div>
        <div class="receipt-row"><span class="label">Student</span><span class="value">${escapeHtml(d.student)} (${escapeHtml(d.enrollment_no)})</span></div>
        <div class="receipt-row"><span class="label">Item</span><span class="value">${escapeHtml(d.item)}</span></div>
        <div class="receipt-row"><span class="label">Quantity Issued</span><span class="value">${d.qty_issued}</span></div>
        <div class="receipt-row"><span class="label">Issue Date</span><span class="value">${formatDate(d.issue_date)}</span></div>
        <div class="due-highlight">Due Date: ${formatDate(d.due_date)}</div>
        <p style="margin-top:12px;font-size:12px;color:var(--text-muted);text-align:center">Items must be returned or renewal approved by the due date.</p>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-outline" onclick="window.print()">ðŸ–¨ Print</button>
        <button class="btn btn-primary" onclick="closeModal();loadIssues()">Done</button>
      </div>
    `);
    Toast.show('Item issued successfully!', 'success');
  } else {
    errEl.textContent = res.message || 'Failed to issue item.';
    errEl.style.display = '';
  }
}

async function showIssueDetail(id) {
  const res = await API.get(`/issues/${id}`);
  if (!res.success) { Toast.show('Could not load issue.', 'error'); return; }
  const iss = res.data;

  const returnRows = iss.returns.length > 0
    ? iss.returns.map(r => `<tr><td>${formatDate(r.return_date)}</td><td>${r.qty_returned}</td><td>${conditionBadge(r.condition)}</td><td>${escapeHtml(r.received_by_name)}</td><td>${r.notes || 'â€”'}</td></tr>`).join('')
    : '<tr><td colspan="5" style="color:var(--text-muted)">No returns yet</td></tr>';

  const renewalRows = iss.renewals.length > 0
    ? iss.renewals.map(r => `<tr><td>${formatDate(r.request_date)}</td><td>${statusBadge(r.status)}</td><td>${formatDate(r.old_due_date)}</td><td>${r.new_due_date ? formatDate(r.new_due_date) : 'â€”'}</td><td>${r.remarks || 'â€”'}</td></tr>`).join('')
    : '<tr><td colspan="5" style="color:var(--text-muted)">No renewals</td></tr>';

  openModal(`Issue Detail: ${iss.issue_no}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px">
      <div><strong>Student:</strong> ${escapeHtml(iss.student_name)}<br><small>${escapeHtml(iss.enrollment_no)}</small></div>
      <div><strong>Item:</strong> ${escapeHtml(iss.item_name)}${iss.asset_tag ? ` (${escapeHtml(iss.asset_tag)})` : ''}</div>
      <div><strong>Qty Issued:</strong> ${iss.qty_issued} &bull; <strong>Returned:</strong> ${iss.qty_returned} &bull; <strong>Outstanding:</strong> ${iss.qty_issued - iss.qty_returned}</div>
      <div><strong>Status:</strong> ${statusBadge(iss.status)}${iss.overdue_days ? ` <span style="color:var(--danger)">${iss.overdue_days}d overdue</span>` : ''}</div>
      <div><strong>Issue Date:</strong> ${formatDate(iss.issue_date)}</div>
      <div><strong>Due Date:</strong> <strong>${formatDate(iss.due_date)}</strong></div>
      <div><strong>Purpose:</strong> ${iss.purpose || 'â€”'}</div>
      <div><strong>Issued By:</strong> ${escapeHtml(iss.issued_by_name)}</div>
    </div>
    <div class="tabs" style="margin-bottom:0">
      <button class="tab-btn active" onclick="switchDetailTab(this,'detail-returns')">Returns</button>
      <button class="tab-btn" onclick="switchDetailTab(this,'detail-renewals')">Renewals</button>
    </div>
    <div id="detail-returns" style="margin-top:12px">
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Qty</th><th>Condition</th><th>Received By</th><th>Notes</th></tr></thead><tbody>${returnRows}</tbody></table></div>
    </div>
    <div id="detail-renewals" style="display:none;margin-top:12px">
      <div class="table-wrap"><table><thead><tr><th>Requested</th><th>Status</th><th>Old Due</th><th>New Due</th><th>Remarks</th></tr></thead><tbody>${renewalRows}</tbody></table></div>
    </div>
  `, { large: true });
}

function switchDetailTab(btn, showId) {
  qsa('.tab-btn', btn.closest('.modal-body')).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  qsa('[id^="detail-"]', btn.closest('.modal-body')).forEach(el => el.style.display = 'none');
  qs('#' + showId)?.style && (qs('#' + showId).style.display = '');
}

async function showRecordReturn(id) {
  const res = await API.get(`/issues/${id}`);
  if (!res.success) { Toast.show('Could not load issue.', 'error'); return; }
  const iss = res.data;
  const outstanding = iss.qty_issued - iss.qty_returned;

  renderFormModal(`Record Return: ${iss.issue_no}`, [
    { name: 'qty_returned', label: 'Quantity Returned', type: 'number', required: true, min: 1, max: outstanding, value: outstanding, hint: `Outstanding: ${outstanding}` },
    { name: 'return_date', label: 'Return Date', type: 'date', required: true, value: todayISO() },
    { name: 'condition', label: 'Condition on Return', type: 'select', required: true, value: 'good', options: [
        { value: 'good', label: 'Good â€” usable, return to stock' },
        { value: 'fair', label: 'Fair â€” minor wear, still usable' },
        { value: 'damaged', label: 'Damaged â€” cannot be reissued' },
        { value: 'lost', label: 'Lost â€” not physically returned' },
    ]},
    { name: 'notes', label: 'Remarks', type: 'textarea', placeholder: 'Any observationsâ€¦' },
  ], async (data) => {
    const r = await API.post(`/issues/${id}/return`, data);
    if (r.success) {
      Toast.show(r.message, 'success');
      closeModal();
      loadIssues();
    } else {
      Toast.show(r.message || 'Return failed.', 'error');
    }
  }, {
    submitLabel: 'Record Return',
    alert: { type: 'info', message: `${iss.item_name}${iss.asset_tag ? ` (${iss.asset_tag})` : ''} â€” Student: ${iss.student_name} â€” Outstanding: ${outstanding}` },
  });
}
/* pages/renewals.js */
const PageRenewals = (() => {
  async function render() {
    const content = `
      <div class="filter-bar no-print">
        <select class="form-select" id="ren-status" onchange="loadRenewals()">
          <option value="">All Statuses</option>
          <option value="pending" selected>Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <div class="alert alert-info" style="margin:0;padding:8px 14px;font-size:12px">
          â„¹ Renewal requests only extend the due date after coordinator <strong>approval</strong>.
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Renewal Requests</span></div>
        <div id="ren-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Renewal Requests', content, 'renewals');
    setTimeout(loadRenewals, 50);
    return html;
  }
  return { render };
})();

async function loadRenewals() {
  const status = qs('#ren-status')?.value || '';
  let url = '/renewals?';
  if (status) url += `status=${status}&`;

  const wrap = qs('#ren-table-wrap');
  if (!wrap) return;

  const res = await API.get(url);
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No renewal requests found.'); return; }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Student</th><th>Item</th><th>Requested On</th>
          <th>Current Due Date</th><th>Status</th><th>Approved By</th><th>Remarks</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${res.data.map(r => `
          <tr>
            <td>
              <strong>${escapeHtml(r.student_name)}</strong><br>
              <small style="color:var(--text-muted)">${escapeHtml(r.enrollment_no)}</small>
            </td>
            <td>${escapeHtml(r.item_name)}<br><small>${escapeHtml(r.item_code)}</small></td>
            <td>${formatDate(r.request_date)}</td>
            <td><strong>${formatDate(r.old_due_date)}</strong></td>
            <td>${statusBadge(r.status)}${r.new_due_date ? `<br><small style="color:var(--success)">â†’ ${formatDate(r.new_due_date)}</small>` : ''}</td>
            <td>${r.approved_by_name ? escapeHtml(r.approved_by_name) : 'â€”'}</td>
            <td><small>${r.remarks ? escapeHtml(r.remarks) : 'â€”'}</small></td>
            <td>
              ${r.status === 'pending' ? `
                <button class="btn btn-xs btn-success" onclick="decideRenewal(${r.id},'approved')">Approve</button>
                <button class="btn btn-xs btn-danger"  onclick="decideRenewal(${r.id},'rejected')">Reject</button>
              ` : 'â€”'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function decideRenewal(id, decision) {
  const label = decision === 'approved' ? 'Approve' : 'Reject';
  const clr   = decision === 'approved' ? 'success' : 'danger';

  renderFormModal(`${label} Renewal`, [
    { type: 'hidden', name: 'decision', value: decision },
    { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: `Reason for ${decision}â€¦` },
  ], async (data) => {
    const res = await API.post(`/renewals/${id}/decide`, data);
    if (res.success) {
      Toast.show(res.message, 'success');
      closeModal();
      loadRenewals();
      loadPendingBadge();
    } else {
      Toast.show(res.message || 'Failed.', 'error');
    }
  }, { submitLabel: label, alert: decision === 'approved' ? { type: 'info', message: 'Approval will extend the due date by 15 calendar days from the current due date.' } : undefined });
}
/* pages/reports.js */
const PageReports = (() => {
  async function render() {
    const content = `
      <div class="tabs">
        <button class="tab-btn active" onclick="switchReportTab(this,'rpt-overdue')">Overdue Items</button>
        <button class="tab-btn" onclick="switchReportTab(this,'rpt-inventory')">Inventory Summary</button>
        <button class="tab-btn" onclick="switchReportTab(this,'rpt-programme')">Programme-wise</button>
        <button class="tab-btn" onclick="switchReportTab(this,'rpt-stocklog')">Stock Log</button>
      </div>
      <div id="rpt-overdue">
        <div class="card">
          <div class="card-header">
            <span class="card-title">ðŸ”´ Overdue Items Report</span>
            <button class="btn btn-sm btn-outline no-print" onclick="printSection('rpt-overdue')">ðŸ–¨ Print</button>
          </div>
          <div id="rpt-overdue-body" class="table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
        </div>
      </div>
      <div id="rpt-inventory" style="display:none">
        <div class="card">
          <div class="card-header">
            <span class="card-title">ðŸ“¦ Inventory Summary</span>
            <button class="btn btn-sm btn-outline no-print" onclick="printSection('rpt-inventory')">ðŸ–¨ Print</button>
          </div>
          <div id="rpt-inventory-body" class="table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
        </div>
      </div>
      <div id="rpt-programme" style="display:none">
        <div class="card">
          <div class="card-header"><span class="card-title">ðŸ“Š Programme-wise Report</span></div>
          <div id="rpt-programme-body" class="table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
        </div>
      </div>
      <div id="rpt-stocklog" style="display:none">
        <div class="card">
          <div class="card-header"><span class="card-title">ðŸ“‹ Stock Adjustment Log</span></div>
          <div id="rpt-stocklog-body" class="table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Reports', content, 'reports');
    setTimeout(loadOverdueReport, 50);
    return html;
  }
  return { render };
})();

function switchReportTab(btn, showId) {
  qsa('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  qsa('[id^="rpt-"]').forEach(el => {
    if (!el.id.endsWith('-body')) el.style.display = 'none';
  });
  qs('#' + showId).style.display = '';

  // Lazy-load tab content
  const loaders = {
    'rpt-inventory':  loadInventoryReport,
    'rpt-programme':  loadProgrammeReport,
    'rpt-stocklog':   loadStockLog,
  };
  if (loaders[showId]) loaders[showId]();
}

async function loadOverdueReport() {
  const wrap = qs('#rpt-overdue-body');
  if (!wrap) return;
  const res = await API.get('/reports/overdue');
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'âœ… No overdue items! Great job.'); return; }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Enrollment</th><th>Student</th><th>Programme</th><th>Item</th>
          <th>Asset ID</th><th>Qty Outstanding</th><th>Due Date</th><th>Overdue Days</th><th>Message</th>
        </tr>
      </thead>
      <tbody>
        ${res.data.map(o => `
          <tr class="overdue-row">
            <td><strong>${escapeHtml(o.enrollment_no)}</strong></td>
            <td>${escapeHtml(o.student_name)}</td>
            <td>${escapeHtml(o.programme)}</td>
            <td>${escapeHtml(o.item_name)}</td>
            <td>${o.asset_tag ? escapeHtml(o.asset_tag) : 'â€”'}</td>
            <td>${o.qty_issued - o.qty_returned}</td>
            <td>${formatDate(o.due_date)}</td>
            <td><span style="color:var(--danger);font-weight:700">${o.overdue_days} day(s)</span></td>
            <td style="font-size:12px;color:var(--text-muted)">${escapeHtml(o.overdue_message)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadInventoryReport() {
  const wrap = qs('#rpt-inventory-body');
  if (!wrap || wrap.querySelector('table')) return;
  const res = await API.get('/reports/inventory-summary');
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No inventory items.'); return; }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Code</th><th>Name</th><th>Category</th><th>Type</th><th>Total</th><th>Available</th><th>Issued</th><th>Damaged</th><th>Lost</th><th>Maintenance</th><th>Location</th></tr>
      </thead>
      <tbody>
        ${res.data.map(i => `
          <tr>
            <td><code>${escapeHtml(i.item_code)}</code></td>
            <td><strong>${escapeHtml(i.name)}</strong>${i.make_model ? `<br><small style="color:var(--text-muted)">${escapeHtml(i.make_model)}</small>` : ''}</td>
            <td>${escapeHtml(i.category)}</td>
            <td>${typeBadge(i.item_type)}</td>
            <td>${i.total_qty}</td>
            <td><strong style="color:var(--success)">${i.available_qty}</strong></td>
            <td>${i.issued_qty}</td>
            <td>${i.damaged_qty > 0 ? `<span style="color:var(--danger)">${i.damaged_qty}</span>` : '0'}</td>
            <td>${i.lost_qty > 0 ? `<span style="color:var(--danger)">${i.lost_qty}</span>` : '0'}</td>
            <td>${i.maintenance_qty}</td>
            <td><small>${i.location_name || 'â€”'}</small></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadProgrammeReport() {
  const wrap = qs('#rpt-programme-body');
  if (!wrap || wrap.querySelector('table')) return;
  const res = await API.get('/reports/programme');
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No data.'); return; }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Programme</th><th>Semester</th><th>Students with Issues</th><th>Total Issues</th><th>Active</th><th>Overdue</th></tr></thead>
      <tbody>
        ${res.data.map(r => `
          <tr ${r.overdue_count > 0 ? 'class="overdue-row"' : ''}>
            <td>${escapeHtml(r.programme)}</td>
            <td>${r.semester}</td>
            <td>${r.students_with_issues}</td>
            <td>${r.total_issues}</td>
            <td>${r.active_count}</td>
            <td>${r.overdue_count > 0 ? `<span style="color:var(--danger);font-weight:700">${r.overdue_count}</span>` : '0'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadStockLog() {
  const wrap = qs('#rpt-stocklog-body');
  if (!wrap || wrap.querySelector('table')) return;
  const res = await API.get('/reports/stock-log');
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No stock adjustments recorded.'); return; }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Before</th><th>After</th><th>Reason</th><th>Adjusted By</th></tr></thead>
      <tbody>
        ${res.data.map(r => `
          <tr>
            <td>${formatDateTime(r.adjusted_at)}</td>
            <td>${escapeHtml(r.item_name)}<br><small>${escapeHtml(r.item_code)}</small></td>
            <td>${statusBadge(r.type)}</td>
            <td>${r.qty_before}</td>
            <td>${r.qty_after}</td>
            <td><small>${escapeHtml(r.reason)}</small></td>
            <td>${escapeHtml(r.adjusted_by_name)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
/* pages/student-portal.js */
const PageStudentPortal = (() => {

  async function renderHome() {
    const [issuesRes, renewalsRes] = await Promise.all([
      API.get('/issues/student/my-issues'),
      API.get('/renewals/my-renewals'),
    ]);

    const student = Auth.getStudent();
    const issues  = issuesRes.success ? issuesRes.data : [];
    const renewals = renewalsRes.success ? renewalsRes.data : [];

    const activeIssues   = issues.filter(i => ['active','renewed','partial'].includes(i.status));
    const overdueIssues  = issues.filter(i => i.status === 'overdue');
    const pendingRenewals = renewals.filter(r => r.status === 'pending');
    const dueSoon        = activeIssues.filter(i => i.days_until_due >= 0 && i.days_until_due <= 3);

    const overdueAlert = overdueIssues.length > 0
      ? `<div class="alert alert-danger">
          âš  You have <strong>${overdueIssues.length} overdue item(s)</strong>. Please return or request renewal immediately.
        </div>`
      : '';

    const dueSoonAlert = dueSoon.length > 0
      ? `<div class="alert alert-warning">
          â° <strong>${dueSoon.length} item(s)</strong> are due within 3 days. Request renewal if needed.
        </div>`
      : '';

    const activeRows = activeIssues.length > 0
      ? activeIssues.map(iss => `
          <tr>
            <td>${escapeHtml(iss.item_name)}${iss.asset_tag ? ` <span class="badge badge-asset">${escapeHtml(iss.asset_tag)}</span>` : ''}</td>
            <td>${iss.qty_issued - iss.qty_returned}</td>
            <td>${formatDate(iss.issue_date)}</td>
            <td><strong ${iss.days_until_due <= 3 ? 'style="color:var(--warning)"' : ''}>${formatDate(iss.due_date)}</strong>
              ${iss.days_until_due >= 0 ? `<br><small style="color:var(--text-muted)">${iss.days_until_due} day(s) left</small>` : ''}
            </td>
            <td>${statusBadge(iss.status)}</td>
            <td>
              <button class="btn btn-xs btn-primary" onclick="requestRenewal(${iss.id},'${escapeHtml(iss.item_name)}')">Request Renewal</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No active issues</td></tr>';

    const overdueRows = overdueIssues.length > 0
      ? overdueIssues.map(iss => `
          <tr class="overdue-row">
            <td>${escapeHtml(iss.item_name)}${iss.asset_tag ? ` <span class="badge badge-asset">${escapeHtml(iss.asset_tag)}</span>` : ''}</td>
            <td>${iss.qty_issued - iss.qty_returned}</td>
            <td>${formatDate(iss.due_date)}</td>
            <td><span style="color:var(--danger);font-weight:700">${iss.overdue_days} day(s)</span></td>
            <td>
              <button class="btn btn-xs btn-warning" onclick="requestRenewal(${iss.id},'${escapeHtml(iss.item_name)}')">Request Renewal</button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">No overdue items ðŸŽ‰</td></tr>';

    const content = `
      ${overdueAlert}
      ${dueSoonAlert}

      <div class="stats-grid">
        <div class="stat-card info">
          <div class="stat-label">Active Issues</div>
          <div class="stat-value">${activeIssues.length}</div>
          <div class="stat-sub">Currently borrowed</div>
        </div>
        <div class="stat-card danger">
          <div class="stat-label">Overdue</div>
          <div class="stat-value">${overdueIssues.length}</div>
          <div class="stat-sub">Past due date</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Pending Renewals</div>
          <div class="stat-value">${pendingRenewals.length}</div>
          <div class="stat-sub">Awaiting approval</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Issues</div>
          <div class="stat-value">${issues.length}</div>
          <div class="stat-sub">All time</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">ðŸ“‹ Active Issues</span>
            <button class="btn btn-sm btn-outline" onclick="Router.navigate('portal-issues')">View All</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th></th></tr></thead>
              <tbody>${activeRows}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">ðŸ”´ Overdue Items</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Qty</th><th>Due Date</th><th>Overdue By</th><th></th></tr></thead>
              <tbody>${overdueRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    return renderLayout('My Dashboard', content, 'portal-home');
  }

  async function renderIssues() {
    const res = await API.get('/issues/student/my-issues');
    const issues = res.success ? res.data : [];

    const rows = issues.length > 0
      ? issues.map(iss => `
          <tr class="${iss.status === 'overdue' ? 'overdue-row' : ''}">
            <td><code>${escapeHtml(iss.issue_no)}</code></td>
            <td>${escapeHtml(iss.item_name)}${iss.asset_tag ? `<br><span class="badge badge-asset">${escapeHtml(iss.asset_tag)}</span>` : ''}</td>
            <td>${iss.qty_issued - iss.qty_returned} / ${iss.qty_issued}</td>
            <td>${formatDate(iss.issue_date)}</td>
            <td><strong>${formatDate(iss.due_date)}</strong></td>
            <td>${statusBadge(iss.status)}${iss.overdue_days ? `<br><small style="color:var(--danger)">${iss.overdue_days}d overdue</small>` : ''}</td>
            <td>
              ${['active','renewed','partial'].includes(iss.status) ?
                `<button class="btn btn-xs btn-primary" onclick="requestRenewal(${iss.id},'${escapeHtml(iss.item_name)}')">Renew</button>` : ''}
              ${iss.status === 'overdue' ?
                `<button class="btn btn-xs btn-warning" onclick="requestRenewal(${iss.id},'${escapeHtml(iss.item_name)}')">Request Renewal</button>` : ''}
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">No issue records yet</td></tr>';

    const content = `
      <div class="card">
        <div class="card-header"><span class="card-title">My Issue History</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Issue No.</th><th>Item</th><th>Outstanding/Total</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    return renderLayout('My Issued Items', content, 'portal-issues');
  }

  async function renderRenewals() {
    const res = await API.get('/renewals/my-renewals');
    const renewals = res.success ? res.data : [];

    const rows = renewals.length > 0
      ? renewals.map(r => `
          <tr>
            <td>${escapeHtml(r.item_name)}<br><small>${escapeHtml(r.item_code)}</small></td>
            <td>${formatDate(r.request_date)}</td>
            <td>${formatDate(r.old_due_date)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${r.new_due_date ? `<strong style="color:var(--success)">${formatDate(r.new_due_date)}</strong>` : 'â€”'}</td>
            <td>${r.remarks ? escapeHtml(r.remarks) : 'â€”'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">No renewal requests yet</td></tr>';

    const content = `
      <div class="alert alert-info">â„¹ Submitting a renewal request alone does <strong>not</strong> extend the due date. The coordinator must approve it.</div>
      <div class="card">
        <div class="card-header"><span class="card-title">My Renewal History</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Requested On</th><th>Old Due Date</th><th>Status</th><th>New Due Date</th><th>Remarks</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
    return renderLayout('My Renewals', content, 'portal-renewals');
  }

  return { renderHome, renderIssues, renderRenewals };
})();

async function requestRenewal(issueId, itemName) {
  // Check for pending renewal
  const check = await API.get(`/renewals?issue_id=${issueId}`);
  if (check.success) {
    const pending = check.data.find(r => r.status === 'pending');
    if (pending) {
      Toast.show('A renewal request is already pending for this issue. Please wait for coordinator approval.', 'warning');
      return;
    }
  }

  if (!confirm(`Request renewal for: ${itemName}?\n\nNote: The due date will only be extended after coordinator approval.`)) return;

  const res = await API.post('/renewals/request', { issue_id: issueId });
  if (res.success) {
    Toast.show('Renewal request submitted! Due date will be extended only after coordinator approval.', 'success');
    Router.navigate(Router.getCurrent());
  } else {
    Toast.show(res.message || 'Failed to request renewal.', 'error');
  }
}
/* router.js */
const Router = (() => {
  const routes = {
    login:          PageLogin.render,
    dashboard:      PageDashboard.render,
    inventory:      PageInventory.render,
    assets:         PageAssets.render,
    locations:      PageLocations.render,
    students:       PageStudents.render,
    issues:         PageIssues.render,
    renewals:       PageRenewals.render,
    reports:        PageReports.render,
    'portal-home':     PageStudentPortal.renderHome,
    'portal-issues':   PageStudentPortal.renderIssues,
    'portal-renewals': PageStudentPortal.renderRenewals,
  };

  let _current = null;

  function navigate(page, params = {}) {
    // Auth guards
    if (page !== 'login') {
      if (!Auth.isLoggedIn()) { navigate('login'); return; }
      const staffPages = ['dashboard','inventory','assets','locations','students','issues','renewals','reports'];
      const studentPages = ['portal-home','portal-issues','portal-renewals'];
      if (staffPages.includes(page) && !Auth.isStaff()) { navigate('portal-home'); return; }
      if (studentPages.includes(page) && !Auth.isStudent() && !Auth.isStaff()) { navigate('dashboard'); return; }
    } else if (Auth.isLoggedIn()) {
      navigate(Auth.isStaff() ? 'dashboard' : 'portal-home');
      return;
    }

    _current = page;
    const app = document.getElementById('app');
    app.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    const handler = routes[page];
    if (handler) {
      Promise.resolve(handler(params)).then(html => {
        if (html) app.innerHTML = html;
        if (Auth.isStaff()) loadPendingBadge();
      }).catch(err => {
        console.error(err);
        app.innerHTML = `<div style="padding:40px;text-align:center;color:red">Error loading page: ${escapeHtml(err.message)}</div>`;
      });
    } else {
      navigate('dashboard');
    }
    window.scrollTo(0, 0);
  }

  function getCurrent() { return _current; }

  return { navigate, getCurrent };
})();

// Boot
Auth.init();
if (Auth.isLoggedIn()) {
  Router.navigate(Auth.isStaff() ? 'dashboard' : 'portal-home');
} else {
  Router.navigate('login');
}
