/* utils.js — shared helpers */

const Toast = (() => {
  function show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `<span style="font-size:15px;flex-shrink:0">${icons[type] || 'ℹ'}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity .3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
  return { show };
})();

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function isOverdue(dueDateStr) {
  return dueDateStr && dueDateStr < todayISO();
}

function statusBadge(status) {
  return `<span class="badge badge-${status}">${escapeHtml(status)}</span>`;
}

function conditionBadge(condition) {
  return `<span class="badge badge-${condition}">${escapeHtml(condition)}</span>`;
}

function typeBadge(type) {
  return `<span class="badge badge-${type}">${type === 'asset' ? '🔖 Asset' : '📦 Quantity'}</span>`;
}

function openModal(title, bodyHtml, opts = {}) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const box = document.getElementById('modal-box');
  box.className = 'modal-box' + (opts.large ? ' modal-lg' : '');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

// Close modal on backdrop click
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

function showLoading(container) {
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p style="margin-top:12px">Loading…</p></div>';
}

function showEmpty(container, message = 'No records found.') {
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>${escapeHtml(message)}</p></div>`;
}

function showError(container, message) {
  if (typeof container === 'string') container = document.querySelector(container);
  if (container) container.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
}

function setInner(sel, html) {
  const el = document.querySelector(sel);
  if (el) el.innerHTML = html;
}

function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
function qsa(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

function serialize(form) {
  const data = {};
  new FormData(form).forEach((v, k) => { data[k] = v; });
  return data;
}

function printSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Print</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0}</style></head><body>${el.innerHTML}</body></html>`);
  win.document.close();
  win.print();
}
