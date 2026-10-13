'use strict';

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireStaff } = require('../middleware/auth');

// All inventory routes require staff authentication
router.use(authenticate, requireStaff);

// ── List all items ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const db = getDb();
  const { category, item_type, search } = req.query;
  let sql = `
    SELECT i.*, l.name AS location_name
    FROM items i LEFT JOIN locations l ON i.location_id = l.id
    WHERE i.is_active = 1
  `;
  const params = [];
  if (category) { sql += ' AND i.category = ?'; params.push(category); }
  if (item_type) { sql += ' AND i.item_type = ?'; params.push(item_type); }
  if (search)    { sql += ' AND (i.name LIKE ? OR i.item_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY i.name';
  const items = db.prepare(sql).all(...params);
  res.json({ success: true, data: items });
});

// ── Get single item ───────────────────────────────────────────────────────────
router.get('/:id', param('id').isInt(), (req, res) => {
  const db = getDb();
  const item = db.prepare(`
    SELECT i.*, l.name AS location_name
    FROM items i LEFT JOIN locations l ON i.location_id = l.id
    WHERE i.id = ? AND i.is_active = 1
  `).get(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
  res.json({ success: true, data: item });
});

// ── Create item ───────────────────────────────────────────────────────────────
router.post('/',
  body('item_code').trim().notEmpty(),
  body('name').trim().notEmpty(),
  body('category').trim().notEmpty(),
  body('item_type').isIn(['quantity', 'asset']),
  body('total_qty').isInt({ min: 0 }),
  body('issue_limit').optional().isInt({ min: 1 }),
  body('renewal_limit').optional().isInt({ min: 0 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const { item_code, name, category, description, make_model, item_type, total_qty, issue_limit, renewal_limit, location_id } = req.body;

    // Check duplicate code
    const existing = db.prepare('SELECT id FROM items WHERE item_code = ?').get(item_code);
    if (existing) return res.status(409).json({ success: false, message: `Item code '${item_code}' already exists.` });

    const qty = parseInt(total_qty);
    const result = db.prepare(`
      INSERT INTO items (item_code, name, category, description, make_model, item_type, total_qty, available_qty, issue_limit, renewal_limit, location_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(item_code, name, category, description || null, make_model || null, item_type, qty, qty, issue_limit || 1, renewal_limit !== undefined ? renewal_limit : 2, location_id || null, req.user.id);

    _auditLog(db, 'items', result.lastInsertRowid, 'INSERT', req.user, `Item '${name}' created`);
    res.status(201).json({ success: true, message: 'Item created.', id: result.lastInsertRowid });
  }
);

// ── Update item ───────────────────────────────────────────────────────────────
router.put('/:id',
  param('id').isInt(),
  body('name').optional().trim().notEmpty(),
  body('issue_limit').optional().isInt({ min: 1 }),
  body('renewal_limit').optional().isInt({ min: 0 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    const { name, category, description, make_model, issue_limit, renewal_limit, location_id } = req.body;
    db.prepare(`
      UPDATE items SET
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        make_model = COALESCE(?, make_model),
        issue_limit = COALESCE(?, issue_limit),
        renewal_limit = COALESCE(?, renewal_limit),
        location_id = COALESCE(?, location_id),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name || null, category || null, description || null, make_model || null, issue_limit || null, renewal_limit !== undefined ? renewal_limit : null, location_id || null, req.params.id);

    _auditLog(db, 'items', req.params.id, 'UPDATE', req.user, `Item updated`);
    res.json({ success: true, message: 'Item updated.' });
  }
);

// ── Stock adjustment ──────────────────────────────────────────────────────────
router.post('/:id/adjust-stock',
  param('id').isInt(),
  body('type').isIn(['addition', 'correction', 'retirement', 'condition_change']),
  body('qty_after').isInt({ min: 0 }),
  body('reason').trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

    const { type, qty_after, reason, damaged_qty, lost_qty, maintenance_qty } = req.body;
    const qtyBefore = item.total_qty;
    const newAvailable = parseInt(qty_after) - (parseInt(damaged_qty) || item.damaged_qty) - (parseInt(lost_qty) || item.lost_qty) - (parseInt(maintenance_qty) || item.maintenance_qty) - item.issued_qty;

    if (newAvailable < 0) {
      return res.status(400).json({ success: false, message: 'Adjustment would result in negative available stock.' });
    }

    db.prepare(`
      UPDATE items SET
        total_qty = ?,
        available_qty = ?,
        damaged_qty = COALESCE(?, damaged_qty),
        lost_qty = COALESCE(?, lost_qty),
        maintenance_qty = COALESCE(?, maintenance_qty),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(qty_after, newAvailable, damaged_qty || null, lost_qty || null, maintenance_qty || null, req.params.id);

    db.prepare(`
      INSERT INTO stock_adjustments (item_id, type, qty_before, qty_after, reason, adjusted_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, type, qtyBefore, qty_after, reason, req.user.id);

    _auditLog(db, 'items', req.params.id, 'UPDATE', req.user, `Stock adjusted: ${type}, before=${qtyBefore}, after=${qty_after}`);
    res.json({ success: true, message: 'Stock adjusted.' });
  }
);

// ── Retire item ───────────────────────────────────────────────────────────────
router.delete('/:id', param('id').isInt(), (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM items WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });

  const active = db.prepare("SELECT COUNT(*) as cnt FROM issues WHERE item_id = ? AND status IN ('active','overdue','partial','renewed')").get(req.params.id);
  if (active.cnt > 0) return res.status(400).json({ success: false, message: 'Cannot retire an item with active issues.' });

  db.prepare("UPDATE items SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  _auditLog(db, 'items', req.params.id, 'DELETE', req.user, `Item retired`);
  res.json({ success: true, message: 'Item retired.' });
});

// ── Categories list ───────────────────────────────────────────────────────────
router.get('/meta/categories', (req, res) => {
  const db = getDb();
  const cats = db.prepare('SELECT DISTINCT category FROM items WHERE is_active = 1 ORDER BY category').all();
  res.json({ success: true, data: cats.map(c => c.category) });
});

function _auditLog(db, table, id, action, user, description) {
  db.prepare('INSERT INTO audit_log (table_name, record_id, action, performed_by_role, performed_by_id, description) VALUES (?,?,?,?,?,?)')
    .run(table, id, action, user.role, user.id, description);
}

module.exports = router;
