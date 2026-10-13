'use strict';

const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireStaff } = require('../middleware/auth');

router.use(authenticate, requireStaff);

router.get('/', (req, res) => {
  const db = getDb();
  res.json({ success: true, data: db.prepare('SELECT * FROM locations ORDER BY name').all() });
});

router.post('/',
  body('name').trim().notEmpty(),
  body('type').isIn(['department', 'laboratory', 'room', 'cupboard', 'other']),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const { name, type, description } = req.body;
    const dup = db.prepare('SELECT id FROM locations WHERE name = ?').get(name);
    if (dup) return res.status(409).json({ success: false, message: 'Location name already exists.' });

    const result = db.prepare('INSERT INTO locations (name, type, description) VALUES (?, ?, ?)').run(name, type, description || null);
    res.status(201).json({ success: true, message: 'Location created.', id: result.lastInsertRowid });
  }
);

router.put('/:id',
  param('id').isInt(),
  (req, res) => {
    const db = getDb();
    const { name, type, description } = req.body;
    db.prepare('UPDATE locations SET name = COALESCE(?, name), type = COALESCE(?, type), description = COALESCE(?, description) WHERE id = ?')
      .run(name || null, type || null, description || null, req.params.id);
    res.json({ success: true, message: 'Location updated.' });
  }
);

router.delete('/:id', param('id').isInt(), (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Location deleted.' });
});

module.exports = router;
