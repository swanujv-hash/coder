/* pages/inventory.js */
const PageInventory = (() => {
  let _items = [];

  async function render() {
    const content = `
      <div class="filter-bar no-print">
        <input class="form-input search-input" type="search" id="inv-search" placeholder="Search items…" oninput="filterInventory()">
        <select class="form-select" id="inv-type" onchange="filterInventory()">
          <option value="">All Types</option>
          <option value="quantity">Quantity-based</option>
          <option value="asset">Asset-tracked</option>
        </select>
        <select class="form-select" id="inv-cat" onchange="filterInventory()">
          <option value="">All Categories</option>
        </select>
        <button class="btn btn-primary" onclick="showAddItem()">+ Add Item</button>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title">Inventory Items</span>
          <button class="btn btn-sm btn-outline no-print" onclick="printSection('inv-table-wrap')">🖨 Print</button>
        </div>
        <div id="inv-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Inventory Items', content, 'inventory');
    setTimeout(() => loadItems(), 50);
    return html;
  }

  async function loadItems() {
    const search = qs('#inv-search')?.value || '';
    const type   = qs('#inv-type')?.value   || '';
    const cat    = qs('#inv-cat')?.value    || '';
    let url = '/inventory?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (type)   url += `item_type=${encodeURIComponent(type)}&`;
    if (cat)    url += `category=${encodeURIComponent(cat)}&`;

    const res = await API.get(url);
    if (!res.success) { showError('#inv-table-wrap', res.message); return; }
    _items = res.data;
    renderTable();

    // Load categories
    const catRes = await API.get('/inventory/meta/categories');
    if (catRes.success) {
      const sel = qs('#inv-cat');
      if (sel) {
        const curr = sel.value;
        sel.innerHTML = '<option value="">All Categories</option>' +
          catRes.data.map(c => `<option value="${escapeHtml(c)}" ${curr === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
      }
    }
  }

  function renderTable() {
    const wrap = qs('#inv-table-wrap');
    if (!wrap) return;
    if (_items.length === 0) { showEmpty(wrap, 'No items found. Add your first inventory item.'); return; }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Name</th><th>Category</th><th>Type</th>
            <th>Total</th><th>Available</th><th>Issued</th><th>Damaged</th><th>Lost</th><th>Maintenance</th>
            <th>Location</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${_items.map(it => `
            <tr>
              <td><code>${escapeHtml(it.item_code)}</code></td>
              <td><strong>${escapeHtml(it.name)}</strong>${it.make_model ? `<br><small style="color:var(--text-muted)">${escapeHtml(it.make_model)}</small>` : ''}</td>
              <td>${escapeHtml(it.category)}</td>
              <td>${typeBadge(it.item_type)}</td>
              <td>${it.total_qty}</td>
              <td><strong style="color:var(--success)">${it.available_qty}</strong></td>
              <td>${it.issued_qty}</td>
              <td>${it.damaged_qty > 0 ? `<span style="color:var(--danger)">${it.damaged_qty}</span>` : '0'}</td>
              <td>${it.lost_qty > 0 ? `<span style="color:var(--danger)">${it.lost_qty}</span>` : '0'}</td>
              <td>${it.maintenance_qty}</td>
              <td><small>${it.location_name ? escapeHtml(it.location_name) : '—'}</small></td>
              <td>
                <button class="btn btn-xs btn-outline" onclick="showEditItem(${it.id})">Edit</button>
                <button class="btn btn-xs btn-warning" onclick="showAdjustStock(${it.id})">Adjust</button>
                ${it.item_type === 'asset' ? `<button class="btn btn-xs btn-outline" onclick="Router.navigate('assets',{item_id:${it.id}})">Assets</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return { render };
})();

function filterInventory() {
  clearTimeout(filterInventory._t);
  filterInventory._t = setTimeout(() => {
    const event = { target: {} };
    // Reload with filters
    const search = qs('#inv-search')?.value || '';
    const type   = qs('#inv-type')?.value   || '';
    const cat    = qs('#inv-cat')?.value    || '';
    let url = '/inventory?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (type)   url += `item_type=${encodeURIComponent(type)}&`;
    if (cat)    url += `category=${encodeURIComponent(cat)}&`;
    API.get(url).then(res => {
      if (!res.success) return;
      const wrap = qs('#inv-table-wrap');
      if (!wrap) return;
      if (res.data.length === 0) { showEmpty(wrap, 'No items match the filter.'); return; }
      wrap.querySelector('tbody') && (wrap.querySelector('tbody').innerHTML =
        res.data.map(it => `
          <tr>
            <td><code>${escapeHtml(it.item_code)}</code></td>
            <td><strong>${escapeHtml(it.name)}</strong>${it.make_model ? `<br><small style="color:var(--text-muted)">${escapeHtml(it.make_model)}</small>` : ''}</td>
            <td>${escapeHtml(it.category)}</td>
            <td>${typeBadge(it.item_type)}</td>
            <td>${it.total_qty}</td>
            <td><strong style="color:var(--success)">${it.available_qty}</strong></td>
            <td>${it.issued_qty}</td>
            <td>${it.damaged_qty > 0 ? `<span style="color:var(--danger)">${it.damaged_qty}</span>` : '0'}</td>
            <td>${it.lost_qty > 0 ? `<span style="color:var(--danger)">${it.lost_qty}</span>` : '0'}</td>
            <td>${it.maintenance_qty}</td>
            <td><small>${it.location_name ? escapeHtml(it.location_name) : '—'}</small></td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="showEditItem(${it.id})">Edit</button>
              <button class="btn btn-xs btn-warning" onclick="showAdjustStock(${it.id})">Adjust</button>
            </td>
          </tr>
        `).join(''));
    });
  }, 300);
}

async function showAddItem() {
  const locRes = await API.get('/locations');
  const locs = locRes.success ? locRes.data : [];
  renderFormModal('Add Inventory Item', [
    { name: 'item_code', label: 'Item Code', required: true, placeholder: 'e.g. USB-CABLE-01', hint: 'Unique identifier for this item' },
    { name: 'name', label: 'Item Name', required: true, placeholder: 'e.g. USB-C Cable' },
    { name: 'category', label: 'Category', required: true, placeholder: 'e.g. Accessories, Electronics' },
    { name: 'make_model', label: 'Make / Model', placeholder: 'e.g. Ugreen USB-C 1m' },
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description' },
    { name: 'item_type', label: 'Tracking Type', type: 'select', required: true, options: [
        { value: 'quantity', label: 'Quantity-based (cables, adapters, etc.)' },
        { value: 'asset', label: 'Individually tracked asset (laptop, board, etc.)' },
    ]},
    { name: 'total_qty', label: 'Initial Quantity', type: 'number', required: true, min: 0, placeholder: '0', hint: 'For asset-type items, add individual assets after creation' },
    { name: 'issue_limit', label: 'Issue Limit per Student', type: 'number', min: 1, placeholder: '1' },
    { name: 'renewal_limit', label: 'Renewal Limit', type: 'number', min: 0, placeholder: '2' },
    { name: 'location_id', label: 'Storage Location', type: 'select', options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
  ], async (data) => {
    const res = await API.post('/inventory', data);
    if (res.success) {
      Toast.show('Item added successfully!', 'success');
      closeModal();
      Router.navigate('inventory');
    } else {
      Toast.show(res.message || 'Failed to add item.', 'error');
    }
  }, { submitLabel: 'Add Item' });
}

async function showEditItem(id) {
  const [itemRes, locRes] = await Promise.all([API.get(`/inventory/${id}`), API.get('/locations')]);
  if (!itemRes.success) { Toast.show('Could not load item.', 'error'); return; }
  const it = itemRes.data;
  const locs = locRes.success ? locRes.data : [];

  renderFormModal(`Edit Item: ${it.name}`, [
    { name: 'name', label: 'Item Name', required: true, value: it.name },
    { name: 'category', label: 'Category', required: true, value: it.category },
    { name: 'make_model', label: 'Make / Model', value: it.make_model || '' },
    { name: 'description', label: 'Description', type: 'textarea', value: it.description || '' },
    { name: 'issue_limit', label: 'Issue Limit', type: 'number', min: 1, value: it.issue_limit },
    { name: 'renewal_limit', label: 'Renewal Limit', type: 'number', min: 0, value: it.renewal_limit },
    { name: 'location_id', label: 'Storage Location', type: 'select', value: it.location_id, options: locs.map(l => ({ value: l.id, label: `${l.name} (${l.type})` })) },
  ], async (data) => {
    const res = await API.put(`/inventory/${id}`, data);
    if (res.success) {
      Toast.show('Item updated!', 'success');
      closeModal();
      Router.navigate('inventory');
    } else {
      Toast.show(res.message || 'Update failed.', 'error');
    }
  }, { submitLabel: 'Save Changes' });
}

async function showAdjustStock(id) {
  const res = await API.get(`/inventory/${id}`);
  if (!res.success) { Toast.show('Could not load item.', 'error'); return; }
  const it = res.data;

  renderFormModal(`Adjust Stock: ${it.name}`, [
    { name: 'type', label: 'Adjustment Type', type: 'select', required: true, options: [
        { value: 'addition', label: 'Stock Addition (new items received)' },
        { value: 'correction', label: 'Stock Correction (reconciliation)' },
        { value: 'retirement', label: 'Item Retirement (write-off)' },
        { value: 'condition_change', label: 'Condition Change' },
    ]},
    { name: 'qty_after', label: 'New Total Quantity', type: 'number', required: true, min: 0, value: it.total_qty },
    { name: 'damaged_qty', label: 'Damaged Quantity', type: 'number', min: 0, value: it.damaged_qty },
    { name: 'lost_qty', label: 'Lost Quantity', type: 'number', min: 0, value: it.lost_qty },
    { name: 'maintenance_qty', label: 'Maintenance Quantity', type: 'number', min: 0, value: it.maintenance_qty },
    { name: 'reason', label: 'Reason', type: 'textarea', required: true, placeholder: 'Explain the adjustment…' },
  ], async (data) => {
    const r = await API.post(`/inventory/${id}/adjust-stock`, data);
    if (r.success) {
      Toast.show('Stock adjusted!', 'success');
      closeModal();
      Router.navigate('inventory');
    } else {
      Toast.show(r.message || 'Adjustment failed.', 'error');
    }
  }, {
    submitLabel: 'Apply Adjustment',
    alert: { type: 'info', message: `Current: Total=${it.total_qty}, Available=${it.available_qty}, Issued=${it.issued_qty}, Damaged=${it.damaged_qty}, Lost=${it.lost_qty}, Maintenance=${it.maintenance_qty}` },
  });
}
