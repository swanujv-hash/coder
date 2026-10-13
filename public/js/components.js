/* components.js — reusable UI components */

function renderLayout(pageTitle, content, activePage) {
  const user = Auth.getUser();
  const student = Auth.getStudent();
  const role = Auth.getRole();

  const staffNav = `
    <div class="nav-section">Main</div>
    <div class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" onclick="Router.navigate('dashboard')">
      <span class="nav-icon">🏠</span> Dashboard
    </div>
    <div class="nav-section">Inventory</div>
    <div class="nav-item ${activePage === 'inventory' ? 'active' : ''}" onclick="Router.navigate('inventory')">
      <span class="nav-icon">📦</span> Items
    </div>
    <div class="nav-item ${activePage === 'assets' ? 'active' : ''}" onclick="Router.navigate('assets')">
      <span class="nav-icon">🔖</span> Assets
    </div>
    <div class="nav-item ${activePage === 'locations' ? 'active' : ''}" onclick="Router.navigate('locations')">
      <span class="nav-icon">📍</span> Locations
    </div>
    <div class="nav-section">People</div>
    <div class="nav-item ${activePage === 'students' ? 'active' : ''}" onclick="Router.navigate('students')">
      <span class="nav-icon">👩‍🎓</span> Students
    </div>
    <div class="nav-section">Transactions</div>
    <div class="nav-item ${activePage === 'issues' ? 'active' : ''}" onclick="Router.navigate('issues')">
      <span class="nav-icon">📤</span> Issue Items
    </div>
    <div class="nav-item ${activePage === 'renewals' ? 'active' : ''}" onclick="Router.navigate('renewals')">
      <span class="nav-icon">🔄</span> Renewals <span id="pending-badge" class="nav-badge" style="display:none"></span>
    </div>
    <div class="nav-section">Reports</div>
    <div class="nav-item ${activePage === 'reports' ? 'active' : ''}" onclick="Router.navigate('reports')">
      <span class="nav-icon">📊</span> Reports
    </div>
  `;

  const studentNav = `
    <div class="nav-section">My Account</div>
    <div class="nav-item ${activePage === 'portal-home' ? 'active' : ''}" onclick="Router.navigate('portal-home')">
      <span class="nav-icon">🏠</span> My Dashboard
    </div>
    <div class="nav-item ${activePage === 'portal-issues' ? 'active' : ''}" onclick="Router.navigate('portal-issues')">
      <span class="nav-icon">📋</span> My Issued Items
    </div>
    <div class="nav-item ${activePage === 'portal-renewals' ? 'active' : ''}" onclick="Router.navigate('portal-renewals')">
      <span class="nav-icon">🔄</span> My Renewals
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
          <button class="logout-btn" onclick="Auth.logout()">⏻ Logout</button>
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
      input = `<select class="form-select" name="${f.name}" ${f.required ? 'required' : ''}>${f.required ? '' : '<option value="">Select…</option>'}${options}</select>`;
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
      btn.textContent = 'Saving…';
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
