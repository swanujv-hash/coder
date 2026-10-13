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
      : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">No overdue items 🎉</td></tr>';

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
            <span class="card-title">🔴 Overdue Items</span>
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
            <span class="card-title">⏰ Due in Next 3 Days</span>
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
            <button class="btn btn-primary" onclick="Router.navigate('issues')">📤 Issue Item</button>
            <button class="btn btn-outline" onclick="Router.navigate('renewals')">🔄 Renewals</button>
            <button class="btn btn-outline" onclick="Router.navigate('inventory')">📦 Inventory</button>
            <button class="btn btn-outline" onclick="Router.navigate('students')">👩‍🎓 Students</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">Pending Renewals</span></div>
          <div class="card-body">
            ${d.pendingRenewals > 0
              ? `<div class="alert alert-warning">⚠ ${d.pendingRenewals} renewal request(s) awaiting your approval. <a href="#" onclick="Router.navigate('renewals');return false">Review now →</a></div>`
              : '<div class="alert alert-success">✓ No pending renewal requests.</div>'
            }
          </div>
        </div>
      </div>
    `;

    return renderLayout('Dashboard', content, 'dashboard');
  }

  return { render };
})();
