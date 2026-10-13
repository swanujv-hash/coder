'use strict';

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireStaff } = require('../middleware/auth');

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Student requests renewal ──────────────────────────────────────────────────
router.post('/request', authenticate, (req, res) => {
  if (!req.student) return res.status(403).json({ success: false, message: 'Student access only.' });

  const { issue_id } = req.body;
  if (!issue_id) return res.status(400).json({ success: false, message: 'issue_id is required.' });

  const db = getDb();
  const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND student_id = ?').get(issue_id, req.student.id);
  if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

  const allowedStatuses = ['active', 'renewed', 'partial'];
  if (!allowedStatuses.includes(issue.status)) {
    return res.status(400).json({ success: false, message: `Cannot request renewal for an issue with status '${issue.status}'.` });
  }

  // Check renewal limit
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(issue.item_id);
  const renewalCount = db.prepare("SELECT COUNT(*) as cnt FROM renewals WHERE issue_id = ? AND status = 'approved'").get(issue_id).cnt;
  if (renewalCount >= item.renewal_limit) {
    return res.status(400).json({ success: false, message: `Renewal limit of ${item.renewal_limit} has been reached for this item.` });
  }

  // No pending renewal already
  const pending = db.prepare("SELECT id FROM renewals WHERE issue_id = ? AND status = 'pending'").get(issue_id);
  if (pending) return res.status(409).json({ success: false, message: 'A renewal request is already pending for this issue.' });

  // NOTE: requesting renewal does NOT extend due date — coordinator approval required
  const result = db.prepare(`
    INSERT INTO renewals (issue_id, request_date, status, old_due_date, requested_by)
    VALUES (?, ?, 'pending', ?, ?)
  `).run(issue_id, today(), issue.due_date, req.student.id);

  res.status(201).json({ success: true, message: 'Renewal request submitted. Awaiting coordinator approval.', id: result.lastInsertRowid });
});

// ── Coordinator: list renewals ────────────────────────────────────────────────
router.get('/', authenticate, requireStaff, (req, res) => {
  const db = getDb();
  const { status, issue_id } = req.query;
  let sql = `
    SELECT r.*,
      s.full_name AS student_name, s.enrollment_no,
      i.name AS item_name, i.item_code,
      iss.qty_issued, iss.qty_returned, iss.due_date AS current_due_date,
      u.full_name AS approved_by_name
    FROM renewals r
    JOIN issues iss ON r.issue_id = iss.id
    JOIN students s ON iss.student_id = s.id
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN users u ON r.approved_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (status)   { sql += ' AND r.status = ?';   params.push(status); }
  if (issue_id) { sql += ' AND r.issue_id = ?'; params.push(issue_id); }
  sql += ' ORDER BY r.created_at DESC';
  res.json({ success: true, data: db.prepare(sql).all(...params) });
});

// ── Student: view their renewals ──────────────────────────────────────────────
router.get('/my-renewals', authenticate, (req, res) => {
  if (!req.student) return res.status(403).json({ success: false, message: 'Student access only.' });
  const db = getDb();
  const renewals = db.prepare(`
    SELECT r.*,
      i.name AS item_name, i.item_code,
      iss.due_date AS current_due_date,
      u.full_name AS approved_by_name
    FROM renewals r
    JOIN issues iss ON r.issue_id = iss.id
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN users u ON r.approved_by = u.id
    WHERE r.requested_by = ?
    ORDER BY r.created_at DESC
  `).all(req.student.id);
  res.json({ success: true, data: renewals });
});

// ── Coordinator: approve or reject ───────────────────────────────────────────
router.post('/:id/decide', authenticate, requireStaff,
  param('id').isInt(),
  body('decision').isIn(['approved', 'rejected']),
  body('remarks').optional().trim(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const renewal = db.prepare("SELECT * FROM renewals WHERE id = ? AND status = 'pending'").get(req.params.id);
    if (!renewal) return res.status(404).json({ success: false, message: 'Pending renewal not found.' });

    const { decision, remarks } = req.body;
    let newDueDate = null;

    if (decision === 'approved') {
      // Extend due date by 15 days from the EXISTING due date (not today)
      const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(renewal.issue_id);
      newDueDate = addDays(issue.due_date, 15);

      // Update issue due date and status
      db.prepare(`
        UPDATE issues SET due_date = ?, status = 'renewed', updated_at = datetime('now') WHERE id = ?
      `).run(newDueDate, renewal.issue_id);
    }

    db.prepare(`
      UPDATE renewals SET
        status       = ?,
        new_due_date = ?,
        approved_by  = ?,
        remarks      = ?,
        updated_at   = datetime('now')
      WHERE id = ?
    `).run(decision, newDueDate, req.user.id, remarks || null, renewal.id);

    db.prepare('INSERT INTO audit_log (table_name, record_id, action, performed_by_role, performed_by_id, description) VALUES (?,?,?,?,?,?)')
      .run('renewals', renewal.id, 'UPDATE', req.user.role, req.user.id, `Renewal ${decision}${newDueDate ? `, new due=${newDueDate}` : ''}`);

    res.json({
      success: true,
      message: decision === 'approved'
        ? `Renewal approved. New due date: ${newDueDate}.`
        : 'Renewal rejected.',
      new_due_date: newDueDate,
    });
  }
);

module.exports = router;
