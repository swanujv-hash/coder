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
          ⚠ You have <strong>${overdueIssues.length} overdue item(s)</strong>. Please return or request renewal immediately.
        </div>`
      : '';

    const dueSoonAlert = dueSoon.length > 0
      ? `<div class="alert alert-warning">
          ⏰ <strong>${dueSoon.length} item(s)</strong> are due within 3 days. Request renewal if needed.
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
      : '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--text-muted)">No overdue items 🎉</td></tr>';

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
            <span class="card-title">📋 Active Issues</span>
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
          <div class="card-header"><span class="card-title">🔴 Overdue Items</span></div>
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
            <td>${r.new_due_date ? `<strong style="color:var(--success)">${formatDate(r.new_due_date)}</strong>` : '—'}</td>
            <td>${r.remarks ? escapeHtml(r.remarks) : '—'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">No renewal requests yet</td></tr>';

    const content = `
      <div class="alert alert-info">ℹ Submitting a renewal request alone does <strong>not</strong> extend the due date. The coordinator must approve it.</div>
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
