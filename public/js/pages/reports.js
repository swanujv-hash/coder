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
            <span class="card-title">🔴 Overdue Items Report</span>
            <button class="btn btn-sm btn-outline no-print" onclick="printSection('rpt-overdue')">🖨 Print</button>
          </div>
          <div id="rpt-overdue-body" class="table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
        </div>
      </div>
      <div id="rpt-inventory" style="display:none">
        <div class="card">
          <div class="card-header">
            <span class="card-title">📦 Inventory Summary</span>
            <button class="btn btn-sm btn-outline no-print" onclick="printSection('rpt-inventory')">🖨 Print</button>
          </div>
          <div id="rpt-inventory-body" class="table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
        </div>
      </div>
      <div id="rpt-programme" style="display:none">
        <div class="card">
          <div class="card-header"><span class="card-title">📊 Programme-wise Report</span></div>
          <div id="rpt-programme-body" class="table-wrap"><div class="loading-state"><div class="spinner"></div></div></div>
        </div>
      </div>
      <div id="rpt-stocklog" style="display:none">
        <div class="card">
          <div class="card-header"><span class="card-title">📋 Stock Adjustment Log</span></div>
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
  if (res.data.length === 0) { showEmpty(wrap, '✅ No overdue items! Great job.'); return; }

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
            <td>${o.asset_tag ? escapeHtml(o.asset_tag) : '—'}</td>
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
            <td><small>${i.location_name || '—'}</small></td>
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
