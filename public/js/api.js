/* api.js — centralised fetch wrapper */
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
