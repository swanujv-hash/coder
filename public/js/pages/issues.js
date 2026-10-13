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
        <button class="btn btn-primary" onclick="showIssueItem()">📤 Issue Item</button>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Issue Transactions</span>
          <button class="btn btn-sm btn-outline no-print" onclick="printSection('iss-table-wrap')">🖨 Print</button>
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
            <td>${iss.overdue_days ? `<span style="color:var(--danger);font-weight:700">${iss.overdue_days}d</span>` : '—'}</td>
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
            <option value="">Select student…</option>
            ${students.map(s => `<option value="${s.id}">${escapeHtml(s.full_name)} (${escapeHtml(s.enrollment_no)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Item <span class="required">*</span></label>
          <select class="form-select" name="item_id" id="issue-item" required onchange="onIssueItemChange()">
            <option value="">Select item…</option>
            ${items.map(i => `<option value="${i.id}" data-type="${i.item_type}" data-avail="${i.available_qty}">${escapeHtml(i.name)} — Available: ${i.available_qty}</option>`).join('')}
          </select>
        </div>
      </div>

      <div id="asset-select-row" style="display:none" class="form-group">
        <label class="form-label">Select Asset <span class="required">*</span></label>
        <select class="form-select" name="asset_id" id="issue-asset">
          <option value="">— Choose asset first —</option>
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
    assetSel.innerHTML = '<option value="">Loading…</option>';
    const res = await API.get(`/assets?item_id=${itemId}&status=available`);
    if (res.success && res.data.length > 0) {
      assetSel.innerHTML = '<option value="">Select asset…</option>' +
        res.data.map(a => `<option value="${a.id}">${escapeHtml(a.asset_id)}${a.serial_no ? ` — ${escapeHtml(a.serial_no)}` : ''} (${escapeHtml(a.condition)})</option>`).join('');
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
    summary.innerHTML = `📅 <strong>Due Date:</strong> ${formatDate(dueDate)} (15 days from issue date)${qty > 1 ? ` &bull; Quantity: <strong>${qty}</strong>` : ''}`;
  } else {
    summary.style.display = 'none';
  }
}

async function submitIssue(e) {
  e.preventDefault();
  const btn = qs('#issue-submit-btn');
  const errEl = qs('#issue-error');
  errEl.style.display = 'none';
  btn.disabled = true; btn.textContent = 'Issuing…';

  const form = e.target;
  const data = serialize(form);

  const res = await API.post('/issues', data);
  btn.disabled = false; btn.textContent = 'Issue Item';

  if (res.success) {
    const d = res.data;
    // Show acknowledgment
    openModal('✅ Issue Acknowledgement', `
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
        <button class="btn btn-outline" onclick="window.print()">🖨 Print</button>
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
    ? iss.returns.map(r => `<tr><td>${formatDate(r.return_date)}</td><td>${r.qty_returned}</td><td>${conditionBadge(r.condition)}</td><td>${escapeHtml(r.received_by_name)}</td><td>${r.notes || '—'}</td></tr>`).join('')
    : '<tr><td colspan="5" style="color:var(--text-muted)">No returns yet</td></tr>';

  const renewalRows = iss.renewals.length > 0
    ? iss.renewals.map(r => `<tr><td>${formatDate(r.request_date)}</td><td>${statusBadge(r.status)}</td><td>${formatDate(r.old_due_date)}</td><td>${r.new_due_date ? formatDate(r.new_due_date) : '—'}</td><td>${r.remarks || '—'}</td></tr>`).join('')
    : '<tr><td colspan="5" style="color:var(--text-muted)">No renewals</td></tr>';

  openModal(`Issue Detail: ${iss.issue_no}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px">
      <div><strong>Student:</strong> ${escapeHtml(iss.student_name)}<br><small>${escapeHtml(iss.enrollment_no)}</small></div>
      <div><strong>Item:</strong> ${escapeHtml(iss.item_name)}${iss.asset_tag ? ` (${escapeHtml(iss.asset_tag)})` : ''}</div>
      <div><strong>Qty Issued:</strong> ${iss.qty_issued} &bull; <strong>Returned:</strong> ${iss.qty_returned} &bull; <strong>Outstanding:</strong> ${iss.qty_issued - iss.qty_returned}</div>
      <div><strong>Status:</strong> ${statusBadge(iss.status)}${iss.overdue_days ? ` <span style="color:var(--danger)">${iss.overdue_days}d overdue</span>` : ''}</div>
      <div><strong>Issue Date:</strong> ${formatDate(iss.issue_date)}</div>
      <div><strong>Due Date:</strong> <strong>${formatDate(iss.due_date)}</strong></div>
      <div><strong>Purpose:</strong> ${iss.purpose || '—'}</div>
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
        { value: 'good', label: 'Good — usable, return to stock' },
        { value: 'fair', label: 'Fair — minor wear, still usable' },
        { value: 'damaged', label: 'Damaged — cannot be reissued' },
        { value: 'lost', label: 'Lost — not physically returned' },
    ]},
    { name: 'notes', label: 'Remarks', type: 'textarea', placeholder: 'Any observations…' },
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
    alert: { type: 'info', message: `${iss.item_name}${iss.asset_tag ? ` (${iss.asset_tag})` : ''} — Student: ${iss.student_name} — Outstanding: ${outstanding}` },
  });
}
