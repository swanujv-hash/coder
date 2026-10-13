/* pages/students.js */
const PageStudents = (() => {
  async function render() {
    const content = `
      <div class="filter-bar no-print">
        <input class="form-input search-input" type="search" id="stu-search" placeholder="Search by name or enrollment…" oninput="filterStudents()">
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
            <td>${s.email ? escapeHtml(s.email) : '—'}</td>
            <td>${s.phone ? escapeHtml(s.phone) : '—'}</td>
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
