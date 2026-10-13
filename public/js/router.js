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
