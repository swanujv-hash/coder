/* pages/assets.js */
const PageAssets = (() => {
  async function render(params = {}) {
    const content = `
      <div class="filter-bar no-print">
        <select class="form-select" id="asset-item-filter" onchange="loadAssets()">
          <option value="">All Items</option>
        </select>
        <select class="form-select" id="asset-status-filter" onchange="loadAssets()">
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="issued">Issued</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
        <select class="form-select" id="asset-cond-filter" onchange="loadAssets()">
          <option value="">All Conditions</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="damaged">Damaged</option>
          <option value="lost">Lost</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <button class="btn btn-primary" onclick="showAddAsset()">+ Add Asset</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Individual Assets</span></div>
        <div id="assets-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    const html = renderLayout('Individual Assets', content, 'assets');
    setTimeout(async () => {
      // Load asset-type items for filter
      const itemsRes = await API.get("/inventory?item_type=asset");
      if (itemsRes.success) {
        const sel = qs('#asset-item-filter');
        if (sel) {
          sel.innerHTML = '<option value="">All Items</option>' +
            itemsRes.data.map(i => `<option value="${i.id}" ${params.item_id == i.id ? 'selected' : ''}>${escapeHtml(i.name)} (${escapeHtml(i.item_code)})</option>`).join('');
        }
      }
      loadAssets();
    }, 50);
    return html;
  }

  return { render };
})();

async function loadAssets() {
  const item_id  = qs('#asset-item-filter')?.value   || '';
  const status   = qs('#asset-status-filter')?.value || '';
  const cond     = qs('#asset-cond-filter')?.value   || '';
  let url = '/assets?';
  if (item_id) url += `item_id=${item_id}&`;
  if (status)  url += `status=${status}&`;
  if (cond)    url += `condition=${cond}&`;

  const wrap = qs('#assets-table-wrap');
  if (!wrap) return;
  showLoading(wrap);

  const res = await API.get(url);
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No assets found.'); return; }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Asset ID</th><th>Serial No.</th><th>Item</th><th>Location</th><th>Condition</th><th>Status</th><th>Actions</th></tr>
      </thead>
      <tbody>
        ${res.data.map(a => `
          <tr>
            <td><strong>${escapeHtml(a.asset_id)}</strong></td>
            <td><small>${a.serial_no ? escapeHtml(a.serial_no) : '—'}</small></td>
            <td>${escapeHtml(a.item_name)}<br><small style="color:var(--text-muted)">${escapeHtml(a.item_code)}</small></td>
            <td><small>${a.location_name ? escapeHtml(a.location_name) : '—'}</small></td>
            <td>${conditionBadge(a.condition)}</td>
            <td>${statusBadge(a.status)}</td>
            <td><button class="btn btn-xs btn-outline" onclick="showEditAsset(${a.id})">Edit</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function showAddAsset() {
  const [itemsRes, locsRes] = await Promise.all([API.get('/inventory?item_type=asset'), API.get('/locations')]);
  const items = itemsRes.success ? itemsRes.data : [];
  const locs  = locsRes.success  ? locsRes.data  : [];

  renderFormModal('Add Individual Asset', [
    { name: 'asset_id', label: 'Asset ID', required: true, placeholder: 'e.g. DB-011' },
    { name: 'serial_no', label: 'Serial Number', placeholder: 'e.g. SN-RPI-1011' },
    { name: 'item_id', label: 'Parent Item', type: 'select', required: true, options: items.map(i => ({ value: i.id, label: `${i.name} (${i.item_code})` })) },
    { name: 'location_id', label: 'Storage Location', type: 'select', options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
    { name: 'condition', label: 'Condition', type: 'select', required: true, value: 'good', options: [
        { value: 'good', label: 'Good' },
        { value: 'fair', label: 'Fair' },
        { value: 'damaged', label: 'Damaged' },
        { value: 'maintenance', label: 'Maintenance' },
    ]},
    { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Any remarks…' },
  ], async (data) => {
    const res = await API.post('/assets', data);
    if (res.success) {
      Toast.show('Asset added!', 'success');
      closeModal();
      loadAssets();
    } else {
      Toast.show(res.message || 'Failed to add asset.', 'error');
    }
  }, { submitLabel: 'Add Asset' });
}

async function showEditAsset(id) {
  const [res, locsRes] = await Promise.all([API.get(`/assets/${id}`), API.get('/locations')]);
  if (!res.success) { Toast.show('Could not load asset.', 'error'); return; }
  const a = res.data;
  const locs = locsRes.success ? locsRes.data : [];

  renderFormModal(`Edit Asset: ${a.asset_id}`, [
    { name: 'serial_no', label: 'Serial Number', value: a.serial_no || '' },
    { name: 'location_id', label: 'Storage Location', type: 'select', value: a.location_id, options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
    { name: 'condition', label: 'Condition', type: 'select', required: true, value: a.condition, options: [
        { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' },
        { value: 'damaged', label: 'Damaged' }, { value: 'lost', label: 'Lost' },
        { value: 'maintenance', label: 'Under Maintenance' },
    ]},
    { name: 'status', label: 'Status', type: 'select', required: true, value: a.status, options: [
        { value: 'available', label: 'Available' }, { value: 'maintenance', label: 'Maintenance' },
        { value: 'retired', label: 'Retired' },
    ]},
    { name: 'notes', label: 'Notes', type: 'textarea', value: a.notes || '' },
  ], async (data) => {
    const r = await API.put(`/assets/${id}`, data);
    if (r.success) {
      Toast.show('Asset updated!', 'success');
      closeModal();
      loadAssets();
    } else {
      Toast.show(r.message || 'Update failed.', 'error');
    }
  }, { submitLabel: 'Save Changes' });
}
