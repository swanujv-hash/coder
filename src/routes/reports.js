'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { authenticate, requireStaff } = require('../middleware/auth');

router.use(authenticate, requireStaff);

function today() { return new Date().toISOString().slice(0, 10); }
function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

// ── Dashboard summary ─────────────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const t = today();

  // Auto-mark overdue
  db.prepare(`UPDATE issues SET status = 'overdue', updated_at = datetime('now') WHERE status IN ('active','renewed','partial') AND due_date < ?`).run(t);

  const totalItems      = db.prepare('SELECT COUNT(*) as cnt FROM items WHERE is_active = 1').get().cnt;
  const totalStudents   = db.prepare('SELECT COUNT(*) as cnt FROM students WHERE is_active = 1').get().cnt;
  const activeIssues    = db.prepare("SELECT COUNT(*) as cnt FROM issues WHERE status IN ('active','renewed','partial')").get().cnt;
  const overdueIssues   = db.prepare("SELECT COUNT(*) as cnt FROM issues WHERE status = 'overdue'").get().cnt;
  const pendingRenewals = db.prepare("SELECT COUNT(*) as cnt FROM renewals WHERE status = 'pending'").get().cnt;

  const upcomingDue = db.prepare(`
    SELECT iss.*, s.full_name AS student_name, s.enrollment_no, i.name AS item_name, i.item_code
    FROM issues iss
    JOIN students s ON iss.student_id = s.id
    JOIN items i ON iss.item_id = i.id
    WHERE iss.status IN ('active','renewed','partial') AND iss.due_date BETWEEN ? AND date(?, '+3 days')
    ORDER BY iss.due_date
  `).all(t, t);

  const overdueList = db.prepare(`
    SELECT iss.*, s.full_name AS student_name, s.enrollment_no, i.name AS item_name, i.item_code, a.asset_id AS asset_tag
    FROM issues iss
    JOIN students s ON iss.student_id = s.id
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN assets a ON iss.asset_id = a.id
    WHERE iss.status = 'overdue'
    ORDER BY iss.due_date
  `).all().map(iss => ({ ...iss, overdue_days: daysBetween(iss.due_date, t) }));

  res.json({
    success: true,
    data: { totalItems, totalStudents, activeIssues, overdueIssues, pendingRenewals, upcomingDue, overdueList },
  });
});

// ── Inventory summary ─────────────────────────────────────────────────────────
router.get('/inventory-summary', (req, res) => {
  const db = getDb();
  const items = db.prepare(`
    SELECT i.*, l.name AS location_name,
      (SELECT COUNT(*) FROM assets a WHERE a.item_id = i.id AND a.status = 'available') AS available_assets
    FROM items i
    LEFT JOIN locations l ON i.location_id = l.id
    WHERE i.is_active = 1
    ORDER BY i.category, i.name
  `).all();
  res.json({ success: true, data: items });
});

// ── Student-wise report ───────────────────────────────────────────────────────
router.get('/student/:id', (req, res) => {
  const db = getDb();
  const t = today();
  db.prepare(`UPDATE issues SET status = 'overdue', updated_at = datetime('now') WHERE status IN ('active','renewed','partial') AND due_date < ?`).run(t);

  const student = db.prepare('SELECT id, enrollment_no, full_name, programme, semester, email, phone FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

  const issues = db.prepare(`
    SELECT iss.*, i.name AS item_name, i.item_code, i.item_type, a.asset_id AS asset_tag
    FROM issues iss
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN assets a ON iss.asset_id = a.id
    WHERE iss.student_id = ?
    ORDER BY iss.issue_date DESC
  `).all(req.params.id);

  issues.forEach(iss => {
    if (iss.status === 'overdue') iss.overdue_days = daysBetween(iss.due_date, t);
  });
  res.json({ success: true, data: { student, issues } });
});

// ── Item-wise history ─────────────────────────────────────────────────────────
router.get('/item/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

  const issues = db.prepare(`
    SELECT iss.*, s.full_name AS student_name, s.enrollment_no, s.programme
    FROM issues iss
    JOIN students s ON iss.student_id = s.id
    WHERE iss.item_id = ?
    ORDER BY iss.issue_date DESC
  `).all(req.params.id);

  const adjustments = db.prepare(`
    SELECT sa.*, u.full_name AS adjusted_by_name
    FROM stock_adjustments sa JOIN users u ON sa.adjusted_by = u.id
    WHERE sa.item_id = ?
    ORDER BY sa.adjusted_at DESC
  `).all(req.params.id);

  res.json({ success: true, data: { item, issues, adjustments } });
});

// ── Programme-wise report ─────────────────────────────────────────────────────
router.get('/programme', (req, res) => {
  const db = getDb();
  const t = today();
  db.prepare(`UPDATE issues SET status = 'overdue', updated_at = datetime('now') WHERE status IN ('active','renewed','partial') AND due_date < ?`).run(t);

  const data = db.prepare(`
    SELECT s.programme, s.semester,
      COUNT(DISTINCT iss.student_id) AS students_with_issues,
      COUNT(iss.id) AS total_issues,
      SUM(CASE WHEN iss.status = 'overdue' THEN 1 ELSE 0 END) AS overdue_count,
      SUM(CASE WHEN iss.status IN ('active','renewed','partial') THEN 1 ELSE 0 END) AS active_count
    FROM issues iss
    JOIN students s ON iss.student_id = s.id
    GROUP BY s.programme, s.semester
    ORDER BY s.programme, s.semester
  `).all();
  res.json({ success: true, data });
});

// ── Overdue report ────────────────────────────────────────────────────────────
router.get('/overdue', (req, res) => {
  const db = getDb();
  const t = today();
  db.prepare(`UPDATE issues SET status = 'overdue', updated_at = datetime('now') WHERE status IN ('active','renewed','partial') AND due_date < ?`).run(t);

  const overdue = db.prepare(`
    SELECT iss.*, s.full_name AS student_name, s.enrollment_no, s.programme, s.semester, s.email, s.phone,
      i.name AS item_name, i.item_code, a.asset_id AS asset_tag
    FROM issues iss
    JOIN students s ON iss.student_id = s.id
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN assets a ON iss.asset_id = a.id
    WHERE iss.status = 'overdue'
    ORDER BY iss.due_date
  `).all().map(iss => ({
    ...iss,
    overdue_days: daysBetween(iss.due_date, t),
    overdue_message: `${iss.item_type === 'asset' && iss.asset_tag ? `Asset ${iss.asset_tag}` : iss.item_name} issued to student ${iss.enrollment_no} was due on ${formatDate(iss.due_date)} and is overdue by ${daysBetween(iss.due_date, t)} day(s).`,
  }));
  res.json({ success: true, data: overdue });
});

// ── Stock adjustments log ─────────────────────────────────────────────────────
router.get('/stock-log', (req, res) => {
  const db = getDb();
  const log = db.prepare(`
    SELECT sa.*, i.name AS item_name, i.item_code, u.full_name AS adjusted_by_name
    FROM stock_adjustments sa
    JOIN items i ON sa.item_id = i.id
    JOIN users u ON sa.adjusted_by = u.id
    ORDER BY sa.adjusted_at DESC
    LIMIT 200
  `).all();
  res.json({ success: true, data: log });
});

// ── Audit log ─────────────────────────────────────────────────────────────────
router.get('/audit-log', (req, res) => {
  const db = getDb();
  const log = db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500').all();
  res.json({ success: true, data: log });
});

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

module.exports = router;
