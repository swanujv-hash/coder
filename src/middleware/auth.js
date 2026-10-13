'use strict';

const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const SECRET = process.env.JWT_SECRET || 'dev_secret_change_in_production';

/**
 * Verify JWT from Authorization header or cookie.
 * Attaches req.user = { id, role, full_name } for staff/coordinator
 * or req.student = { id, enrollment_no, full_name } for students.
 */
function authenticate(req, res, next) {
  const token = _extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.type === 'student') {
      req.student = payload;
    } else {
      req.user = payload;
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/** Only staff/coordinator can access */
function requireStaff(req, res, next) {
  if (!req.user) {
    return res.status(403).json({ success: false, message: 'Staff access required.' });
  }
  next();
}

/** Only coordinator role */
function requireCoordinator(req, res, next) {
  if (!req.user || req.user.role !== 'coordinator') {
    return res.status(403).json({ success: false, message: 'Coordinator access required.' });
  }
  next();
}

/** Either staff or the student themselves */
function authenticateAny(req, res, next) {
  const token = _extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.type === 'student') {
      req.student = payload;
    } else {
      req.user = payload;
    }
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

function _extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.cookies && req.cookies.token ? req.cookies.token : null;
}

function generateToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

module.exports = { authenticate, requireStaff, requireCoordinator, authenticateAny, generateToken };
