'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, param, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { authenticate, requireStaff, authenticateAny } = require('../middleware/auth');

// ── List students (staff only) ────────────────────────────────────────────────
router.get('/', authenticate, requireStaff, (req, res) => {
  const db = getDb();
  const { programme, semester, search } = req.query;
  let sql = 'SELECT id, enrollment_no, full_name, programme, semester, email, phone, is_active, created_at FROM students WHERE is_active = 1';
  const params = [];
  if (programme) { sql += ' AND programme = ?'; params.push(programme); }
  if (semester)  { sql += ' AND semester = ?';  params.push(semester); }
  if (search)    { sql += ' AND (full_name LIKE ? OR enrollment_no LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY full_name';
  res.json({ success: true, data: db.prepare(sql).all(...params) });
});

// ── Get single student ────────────────────────────────────────────────────────
router.get('/:id', authenticateAny, (req, res) => {
  const db = getDb();
  // Students can only view themselves
  if (req.student && req.student.id !== parseInt(req.params.id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  const student = db.prepare('SELECT id, enrollment_no, full_name, programme, semester, email, phone, is_active, created_at FROM students WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
  res.json({ success: true, data: student });
});

// ── Create student (staff only) ───────────────────────────────────────────────
router.post('/', authenticate, requireStaff,
  body('enrollment_no').trim().notEmpty(),
  body('full_name').trim().notEmpty(),
  body('programme').trim().notEmpty(),
  body('semester').isInt({ min: 1, max: 12 }),
  body('password').isLength({ min: 6 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const { enrollment_no, full_name, programme, semester, email, phone, password } = req.body;

    const dup = db.prepare('SELECT id FROM students WHERE enrollment_no = ?').get(enrollment_no);
    if (dup) return res.status(409).json({ success: false, message: 'Enrollment number already exists.' });

    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(`
      INSERT INTO students (enrollment_no, full_name, programme, semester, email, phone, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(enrollment_no, full_name, programme, parseInt(semester), email || null, phone || null, hash);

    res.status(201).json({ success: true, message: 'Student registered.', id: result.lastInsertRowid });
  }
);

// ── Update student ────────────────────────────────────────────────────────────
router.put('/:id', authenticate, requireStaff, param('id').isInt(), (req, res) => {
  const db = getDb();
  const { full_name, programme, semester, email, phone } = req.body;
  db.prepare(`
    UPDATE students SET
      full_name  = COALESCE(?, full_name),
      programme  = COALESCE(?, programme),
      semester   = COALESCE(?, semester),
      email      = COALESCE(?, email),
      phone      = COALESCE(?, phone),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(full_name || null, programme || null, semester ? parseInt(semester) : null, email || null, phone || null, req.params.id);
  res.json({ success: true, message: 'Student updated.' });
});

// ── Reset student password (staff only) ───────────────────────────────────────
router.post('/:id/reset-password', authenticate, requireStaff,
  body('new_password').isLength({ min: 6 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const db = getDb();
    const hash = bcrypt.hashSync(req.body.new_password, 12);
    db.prepare("UPDATE students SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.params.id);
    res.json({ success: true, message: 'Password reset successfully.' });
  }
);

// ── Get programmes list ───────────────────────────────────────────────────────
router.get('/meta/programmes', authenticate, requireStaff, (req, res) => {
  const db = getDb();
  const progs = db.prepare('SELECT DISTINCT programme FROM students WHERE is_active = 1 ORDER BY programme').all();
  res.json({ success: true, data: progs.map(p => p.programme) });
});

module.exports = router;
