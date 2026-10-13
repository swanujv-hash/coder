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
          ℹ Renewal requests only extend the due date after coordinator <strong>approval</strong>.
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
            <td>${statusBadge(r.status)}${r.new_due_date ? `<br><small style="color:var(--success)">→ ${formatDate(r.new_due_date)}</small>` : ''}</td>
            <td>${r.approved_by_name ? escapeHtml(r.approved_by_name) : '—'}</td>
            <td><small>${r.remarks ? escapeHtml(r.remarks) : '—'}</small></td>
            <td>
              ${r.status === 'pending' ? `
                <button class="btn btn-xs btn-success" onclick="decideRenewal(${r.id},'approved')">Approve</button>
                <button class="btn btn-xs btn-danger"  onclick="decideRenewal(${r.id},'rejected')">Reject</button>
              ` : '—'}
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
    { name: 'remarks', label: 'Remarks', type: 'textarea', placeholder: `Reason for ${decision}…` },
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
