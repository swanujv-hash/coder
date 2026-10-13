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
  btn.disabled = true; btn.textContent = 'Logging in…';

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
  btn.disabled = true; btn.textContent = 'Logging in…';

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
