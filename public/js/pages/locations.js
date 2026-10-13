/* pages/assets.js — location management tab-in */
const PageLocations = (() => {
  async function render() {
    const content = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn btn-primary" onclick="showAddLocation()">+ Add Location</button>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Storage Locations</span></div>
        <div id="loc-table-wrap" class="table-wrap">
          <div class="loading-state"><div class="spinner"></div></div>
        </div>
      </div>
    `;
    const html = renderLayout('Storage Locations', content, 'locations');
    setTimeout(loadLocations, 50);
    return html;
  }
  return { render };
})();

async function loadLocations() {
  const wrap = qs('#loc-table-wrap');
  if (!wrap) return;
  const res = await API.get('/locations');
  if (!res.success) { showError(wrap, res.message); return; }
  if (res.data.length === 0) { showEmpty(wrap, 'No locations added yet.'); return; }

  wrap.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Description</th><th>Actions</th></tr></thead>
      <tbody>
        ${res.data.map(l => `
          <tr>
            <td><strong>${escapeHtml(l.name)}</strong></td>
            <td>${statusBadge(l.type)}</td>
            <td>${l.description ? escapeHtml(l.description) : '—'}</td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="showEditLocation(${l.id},'${escapeHtml(l.name)}','${l.type}','${escapeHtml(l.description || '')}')">Edit</button>
              <button class="btn btn-xs btn-danger" onclick="deleteLocation(${l.id})">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showAddLocation() {
  renderFormModal('Add Location', [
    { name: 'name', label: 'Location Name', required: true, placeholder: 'e.g. Computer Lab A' },
    { name: 'type', label: 'Type', type: 'select', required: true, options: [
        { value: 'department', label: 'Department' },
        { value: 'laboratory', label: 'Laboratory' },
        { value: 'room', label: 'Room' },
        { value: 'cupboard', label: 'Cupboard' },
        { value: 'other', label: 'Other' },
    ]},
    { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional details' },
  ], async (data) => {
    const res = await API.post('/locations', data);
    if (res.success) { Toast.show('Location added!', 'success'); closeModal(); loadLocations(); }
    else Toast.show(res.message || 'Failed.', 'error');
  }, { submitLabel: 'Add Location' });
}

function showEditLocation(id, name, type, description) {
  renderFormModal('Edit Location', [
    { name: 'name', label: 'Name', required: true, value: name },
    { name: 'type', label: 'Type', type: 'select', required: true, value: type, options: [
        { value: 'department', label: 'Department' }, { value: 'laboratory', label: 'Laboratory' },
        { value: 'room', label: 'Room' }, { value: 'cupboard', label: 'Cupboard' }, { value: 'other', label: 'Other' },
    ]},
    { name: 'description', label: 'Description', type: 'textarea', value: description },
  ], async (data) => {
    const res = await API.put(`/locations/${id}`, data);
    if (res.success) { Toast.show('Location updated!', 'success'); closeModal(); loadLocations(); }
    else Toast.show(res.message || 'Failed.', 'error');
  }, { submitLabel: 'Save' });
}

async function deleteLocation(id) {
  if (!confirm('Delete this location? Items assigned to it will lose their location.')) return;
  const res = await API.delete(`/locations/${id}`);
  if (res.success) { Toast.show('Location deleted.', 'info'); loadLocations(); }
  else Toast.show(res.message || 'Failed.', 'error');
}
