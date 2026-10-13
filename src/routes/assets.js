'use strict';

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireStaff } = require('../middleware/auth');

router.use(authenticate, requireStaff);

// ── List assets (optionally filtered by item_id) ──────────────────────────────
router.get('/', (req, res) => {
  const db = getDb();
  const { item_id, status, condition } = req.query;
  let sql = `
    SELECT a.*, i.name AS item_name, i.item_code, l.name AS location_name
    FROM assets a
    JOIN items i ON a.item_id = i.id
    LEFT JOIN locations l ON a.location_id = l.id
    WHERE 1=1
  `;
  const params = [];
  if (item_id)   { sql += ' AND a.item_id = ?';   params.push(item_id); }
  if (status)    { sql += ' AND a.status = ?';     params.push(status); }
  if (condition) { sql += ' AND a.condition = ?';  params.push(condition); }
  sql += ' ORDER BY a.asset_id';
  res.json({ success: true, data: db.prepare(sql).all(...params) });
});

// ── Get single asset ──────────────────────────────────────────────────────────
router.get('/:id', param('id').isInt(), (req, res) => {
  const db = getDb();
  const asset = db.prepare(`
    SELECT a.*, i.name AS item_name, i.item_code, l.name AS location_name
    FROM assets a
    JOIN items i ON a.item_id = i.id
    LEFT JOIN locations l ON a.location_id = l.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
  res.json({ success: true, data: asset });
});

// ── Create asset ──────────────────────────────────────────────────────────────
router.post('/',
  body('asset_id').trim().notEmpty(),
  body('item_id').isInt({ min: 1 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const { asset_id, serial_no, item_id, location_id, condition, notes } = req.body;

    const item = db.prepare("SELECT * FROM items WHERE id = ? AND item_type = 'asset' AND is_active = 1").get(item_id);
    if (!item) return res.status(404).json({ success: false, message: 'Asset-type item not found.' });

    const dup = db.prepare('SELECT id FROM assets WHERE asset_id = ?').get(asset_id);
    if (dup) return res.status(409).json({ success: false, message: `Asset ID '${asset_id}' already exists.` });

    const result = db.prepare(`
      INSERT INTO assets (asset_id, serial_no, item_id, location_id, condition, status, notes, created_by)
      VALUES (?, ?, ?, ?, ?, 'available', ?, ?)
    `).run(asset_id, serial_no || null, item_id, location_id || null, condition || 'good', notes || null, req.user.id);

    // Increment total_qty and available_qty of parent item
    db.prepare("UPDATE items SET total_qty = total_qty + 1, available_qty = available_qty + 1, updated_at = datetime('now') WHERE id = ?").run(item_id);

    res.status(201).json({ success: true, message: 'Asset created.', id: result.lastInsertRowid });
  }
);

// ── Update asset condition/location ──────────────────────────────────────────
router.put('/:id',
  param('id').isInt(),
  body('condition').optional().isIn(['good', 'fair', 'damaged', 'lost', 'maintenance']),
  body('status').optional().isIn(['available', 'issued', 'maintenance', 'retired']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    const { condition, status, location_id, notes, serial_no } = req.body;

    // If condition changes to damaged/lost/maintenance — update item qty counters
    if (condition && condition !== asset.condition) {
      const prevUnavailableStates = ['damaged', 'lost', 'maintenance'];
      const item = db.prepare('SELECT * FROM items WHERE id = ?').get(asset.item_id);

      if (!prevUnavailableStates.includes(asset.condition) && prevUnavailableStates.includes(condition)) {
        // Was usable, now unavailable
        const colMap = { damaged: 'damaged_qty', lost: 'lost_qty', maintenance: 'maintenance_qty' };
        db.prepare(`UPDATE items SET ${colMap[condition]} = ${colMap[condition]} + 1, available_qty = CASE WHEN available_qty > 0 THEN available_qty - 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ?`).run(asset.item_id);
      } else if (prevUnavailableStates.includes(asset.condition) && !prevUnavailableStates.includes(condition)) {
        // Was unavailable, now usable
        const colMap = { damaged: 'damaged_qty', lost: 'lost_qty', maintenance: 'maintenance_qty' };
        db.prepare(`UPDATE items SET ${colMap[asset.condition]} = CASE WHEN ${colMap[asset.condition]} > 0 THEN ${colMap[asset.condition]} - 1 ELSE 0 END, available_qty = available_qty + 1, updated_at = datetime('now') WHERE id = ?`).run(asset.item_id);
      }
    }

    db.prepare(`
      UPDATE assets SET
        condition   = COALESCE(?, condition),
        status      = COALESCE(?, status),
        location_id = COALESCE(?, location_id),
        serial_no   = COALESCE(?, serial_no),
        notes       = COALESCE(?, notes),
        updated_at  = datetime('now')
      WHERE id = ?
    `).run(condition || null, status || null, location_id || null, serial_no || null, notes || null, req.params.id);

    res.json({ success: true, message: 'Asset updated.' });
  }
);

module.exports = router;
