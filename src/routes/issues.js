'use strict';

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireStaff, authenticateAny } = require('../middleware/auth');

// ── Helper: add 15 calendar days to a date string ────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function generateIssueNo(db) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM issues').get().cnt;
  return `ISS-${String(count + 1).padStart(5, '0')}`;
}

// ── Mark overdue issues (called internally before listing) ────────────────────
function markOverdue(db) {
  const todayStr = today();
  db.prepare(`
    UPDATE issues SET status = 'overdue', updated_at = datetime('now')
    WHERE status IN ('active', 'renewed', 'partial')
      AND due_date < ?
  `).run(todayStr);
}

// ── List issues ───────────────────────────────────────────────────────────────
router.get('/', authenticate, requireStaff, (req, res) => {
  const db = getDb();
  markOverdue(db);
  const { student_id, item_id, status, programme, overdue_only } = req.query;
  let sql = `
    SELECT iss.*,
      s.full_name AS student_name, s.enrollment_no, s.programme, s.semester,
      i.name AS item_name, i.item_code, i.item_type,
      a.asset_id AS asset_tag,
      u.full_name AS issued_by_name
    FROM issues iss
    JOIN students s ON iss.student_id = s.id
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN assets a ON iss.asset_id = a.id
    JOIN users u ON iss.issued_by = u.id
    WHERE 1=1
  `;
  const params = [];
  if (student_id)  { sql += ' AND iss.student_id = ?';  params.push(student_id); }
  if (item_id)     { sql += ' AND iss.item_id = ?';     params.push(item_id); }
  if (status)      { sql += ' AND iss.status = ?';      params.push(status); }
  if (programme)   { sql += ' AND s.programme = ?';     params.push(programme); }
  if (overdue_only === 'true') { sql += " AND iss.status = 'overdue'"; }
  sql += ' ORDER BY iss.issue_date DESC';
  const issues = db.prepare(sql).all(...params);

  // Annotate overdue days
  const t = today();
  issues.forEach(iss => {
    if (iss.status === 'overdue') {
      iss.overdue_days = daysBetween(iss.due_date, t);
    }
  });
  res.json({ success: true, data: issues });
});

// ── Get single issue ──────────────────────────────────────────────────────────
router.get('/:id', authenticateAny, (req, res) => {
  const db = getDb();
  markOverdue(db);
  const issue = db.prepare(`
    SELECT iss.*,
      s.full_name AS student_name, s.enrollment_no, s.programme, s.semester,
      i.name AS item_name, i.item_code, i.item_type,
      a.asset_id AS asset_tag,
      u.full_name AS issued_by_name
    FROM issues iss
    JOIN students s ON iss.student_id = s.id
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN assets a ON iss.asset_id = a.id
    JOIN users u ON iss.issued_by = u.id
    WHERE iss.id = ?
  `).get(req.params.id);

  if (!issue) return res.status(404).json({ success: false, message: 'Issue record not found.' });
  if (req.student && req.student.id !== issue.student_id) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  if (issue.status === 'overdue') {
    issue.overdue_days = daysBetween(issue.due_date, today());
  }
  // Fetch returns for this issue
  issue.returns = db.prepare(`
    SELECT r.*, u.full_name AS received_by_name
    FROM returns r JOIN users u ON r.received_by = u.id
    WHERE r.issue_id = ?
    ORDER BY r.return_date
  `).all(req.params.id);
  // Fetch renewals
  issue.renewals = db.prepare(`
    SELECT r.*, u.full_name AS approved_by_name
    FROM renewals r LEFT JOIN users u ON r.approved_by = u.id
    WHERE r.issue_id = ?
    ORDER BY r.created_at
  `).all(req.params.id);
  res.json({ success: true, data: issue });
});

// ── Create issue ──────────────────────────────────────────────────────────────
router.post('/', authenticate, requireStaff,
  body('student_id').isInt({ min: 1 }),
  body('item_id').isInt({ min: 1 }),
  body('qty_issued').isInt({ min: 1 }),
  body('issue_date').isISO8601(),
  body('purpose').optional().trim(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const { student_id, item_id, asset_id, qty_issued, purpose, issue_date, notes } = req.body;
    const qty = parseInt(qty_issued);

    // 1. Student must be registered
    const student = db.prepare('SELECT * FROM students WHERE id = ? AND is_active = 1').get(student_id);
    if (!student) return res.status(400).json({ success: false, message: 'Student not found or inactive.' });

    // 2. Item must exist and be active
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(item_id);
    if (!item) return res.status(400).json({ success: false, message: 'Item not found.' });

    // 3. Cannot issue damaged/lost/maintenance items
    if (item.available_qty <= 0) {
      const reason = item.damaged_qty > 0 ? 'all are damaged' : item.lost_qty > 0 ? 'all are lost' : item.maintenance_qty > 0 ? 'all are under maintenance' : 'none available';
      return res.status(400).json({ success: false, message: `Cannot issue '${item.name}': ${reason}.` });
    }

    // 4. Quantity check
    if (qty > item.available_qty) {
      return res.status(400).json({
        success: false,
        message: `${qty} ${item.name}(s) were requested, but only ${item.available_qty} are currently available.`,
      });
    }

    // 5. Issue limit check
    const existingActive = db.prepare(`
      SELECT COALESCE(SUM(qty_issued - qty_returned), 0) as total
      FROM issues WHERE student_id = ? AND item_id = ? AND status IN ('active','overdue','partial','renewed')
    `).get(student_id, item_id);
    if ((existingActive.total + qty) > item.issue_limit) {
      return res.status(400).json({ success: false, message: `Issue limit for '${item.name}' is ${item.issue_limit}. Student already has ${existingActive.total} issued.` });
    }

    // 6. Asset-type: must specify an asset_id and it must be available
    let resolvedAssetId = null;
    if (item.item_type === 'asset') {
      if (!asset_id) return res.status(400).json({ success: false, message: 'Please specify the asset ID for this individually tracked item.' });
      const asset = db.prepare("SELECT * FROM assets WHERE id = ? AND item_id = ? AND status = 'available' AND condition NOT IN ('damaged','lost','maintenance')").get(asset_id, item_id);
      if (!asset) return res.status(400).json({ success: false, message: 'The specified asset is not available.' });

      // Check not already issued
      const assetActive = db.prepare("SELECT id FROM issues WHERE asset_id = ? AND status IN ('active','overdue','partial','renewed')").get(asset_id);
      if (assetActive) return res.status(400).json({ success: false, message: 'This asset is already issued to another student.' });

      resolvedAssetId = asset_id;
    }

    // 7. Calculate due date
    const dueDate = addDays(issue_date, 15);
    const issueNo = generateIssueNo(db);

    const issueResult = db.prepare(`
      INSERT INTO issues (issue_no, student_id, item_id, asset_id, qty_issued, qty_returned, purpose, issue_date, due_date, status, issued_by, notes)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?)
    `).run(issueNo, student_id, item_id, resolvedAssetId, qty, purpose || null, issue_date, dueDate, req.user.id, notes || null);

    // 8. Update stock
    db.prepare("UPDATE items SET available_qty = available_qty - ?, issued_qty = issued_qty + ?, updated_at = datetime('now') WHERE id = ?").run(qty, qty, item_id);
    if (resolvedAssetId) {
      db.prepare("UPDATE assets SET status = 'issued', updated_at = datetime('now') WHERE id = ?").run(resolvedAssetId);
    }

    db.prepare('INSERT INTO audit_log (table_name, record_id, action, performed_by_role, performed_by_id, description) VALUES (?,?,?,?,?,?)')
      .run('issues', issueResult.lastInsertRowid, 'INSERT', req.user.role, req.user.id, `Issued ${qty}x '${item.name}' to ${student.enrollment_no}`);

    res.status(201).json({
      success: true,
      message: 'Item issued successfully.',
      data: {
        issue_no: issueNo,
        issue_id: issueResult.lastInsertRowid,
        student: student.full_name,
        enrollment_no: student.enrollment_no,
        item: item.name,
        qty_issued: qty,
        issue_date,
        due_date: dueDate,
      },
    });
  }
);

// ── Record return ─────────────────────────────────────────────────────────────
router.post('/:id/return', authenticate, requireStaff,
  param('id').isInt(),
  body('qty_returned').isInt({ min: 1 }),
  body('return_date').isISO8601(),
  body('condition').isIn(['good', 'fair', 'damaged', 'lost']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    markOverdue(db);
    const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found.' });

    const allowedStatuses = ['active', 'overdue', 'partial', 'renewed'];
    if (!allowedStatuses.includes(issue.status)) {
      return res.status(400).json({ success: false, message: `Issue is already '${issue.status}', cannot record return.` });
    }

    const { qty_returned, return_date, condition, notes } = req.body;
    const qtyOutstanding = issue.qty_issued - issue.qty_returned;

    if (parseInt(qty_returned) > qtyOutstanding) {
      return res.status(400).json({ success: false, message: `Only ${qtyOutstanding} item(s) outstanding; cannot return ${qty_returned}.` });
    }

    const newQtyReturned = issue.qty_returned + parseInt(qty_returned);
    const newOutstanding = issue.qty_issued - newQtyReturned;
    const newStatus = newOutstanding === 0 ? 'returned' : 'partial';

    // Record the return
    db.prepare(`
      INSERT INTO returns (issue_id, qty_returned, return_date, condition, received_by, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(issue.id, parseInt(qty_returned), return_date, condition, req.user.id, notes || null);

    // Update issue
    db.prepare(`
      UPDATE issues SET qty_returned = ?, status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newQtyReturned, newStatus, issue.id);

    // Update item stock — only usable condition goes back to available
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(issue.item_id);
    const usable = condition === 'good' || condition === 'fair';

    db.prepare(`
      UPDATE items SET
        issued_qty    = issued_qty - ?,
        available_qty = available_qty + ?,
        damaged_qty   = damaged_qty + ?,
        updated_at    = datetime('now')
      WHERE id = ?
    `).run(parseInt(qty_returned), usable ? parseInt(qty_returned) : 0, usable ? 0 : parseInt(qty_returned), issue.item_id);

    // If asset, update asset status
    if (issue.asset_id) {
      db.prepare(`UPDATE assets SET status = ?, condition = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(usable ? 'available' : 'maintenance', condition, issue.asset_id);
    }

    db.prepare('INSERT INTO audit_log (table_name, record_id, action, performed_by_role, performed_by_id, description) VALUES (?,?,?,?,?,?)')
      .run('returns', issue.id, 'INSERT', req.user.role, req.user.id, `Returned ${qty_returned}x condition=${condition}, outstanding=${newOutstanding}`);

    res.json({
      success: true,
      message: usable
        ? `${qty_returned} item(s) returned and added back to available stock.`
        : `${qty_returned} item(s) returned in ${condition} condition and marked unavailable.`,
      data: { new_status: newStatus, outstanding: newOutstanding },
    });
  }
);

// ── Student: view their own issues ────────────────────────────────────────────
router.get('/student/my-issues', authenticate, (req, res) => {
  if (!req.student) return res.status(403).json({ success: false, message: 'Student access only.' });
  const db = getDb();
  markOverdue(db);
  const issues = db.prepare(`
    SELECT iss.*,
      i.name AS item_name, i.item_code, i.item_type,
      a.asset_id AS asset_tag,
      u.full_name AS issued_by_name
    FROM issues iss
    JOIN items i ON iss.item_id = i.id
    LEFT JOIN assets a ON iss.asset_id = a.id
    JOIN users u ON iss.issued_by = u.id
    WHERE iss.student_id = ?
    ORDER BY iss.issue_date DESC
  `).all(req.student.id);

  const t = today();
  issues.forEach(iss => {
    if (iss.status === 'overdue') iss.overdue_days = daysBetween(iss.due_date, t);
    iss.days_until_due = daysBetween(t, iss.due_date);
  });
  res.json({ success: true, data: issues });
});

module.exports = router;
