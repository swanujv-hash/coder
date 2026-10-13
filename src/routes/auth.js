'use strict';

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../db/database');
const { generateToken, authenticate } = require('../middleware/auth');

// ── Staff / Coordinator login ─────────────────────────────────────────────────
router.post('/login',
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { username, password } = req.body;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }
    const token = generateToken({ id: user.id, role: user.role, full_name: user.full_name, type: 'staff' });
    res.json({ success: true, token, user: { id: user.id, role: user.role, full_name: user.full_name, username: user.username } });
  }
);

// ── Student login ─────────────────────────────────────────────────────────────
router.post('/student-login',
  body('enrollment_no').trim().notEmpty(),
  body('password').notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { enrollment_no, password } = req.body;
    const db = getDb();
    const student = db.prepare('SELECT * FROM students WHERE enrollment_no = ? AND is_active = 1').get(enrollment_no);
    if (!student || !bcrypt.compareSync(password, student.password_hash)) {
      return res.status(401).json({ success: false, message: 'Invalid enrollment number or password.' });
    }
    const token = generateToken({
      id: student.id,
      enrollment_no: student.enrollment_no,
      full_name: student.full_name,
      type: 'student',
    });
    res.json({ success: true, token, student: { id: student.id, enrollment_no: student.enrollment_no, full_name: student.full_name, programme: student.programme, semester: student.semester } });
  }
);

// ── Who am I ──────────────────────────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  if (req.student) return res.json({ success: true, type: 'student', ...req.student });
  return res.json({ success: true, type: 'staff', ...req.user });
});

// ── Change password (staff) ───────────────────────────────────────────────────
router.post('/change-password', authenticate,
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    if (!req.user) return res.status(403).json({ success: false, message: 'Staff only.' });
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(req.body.current_password, user.password_hash)) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    const hash = bcrypt.hashSync(req.body.new_password, 12);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);
    res.json({ success: true, message: 'Password changed successfully.' });
  }
);

module.exports = router;
