'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Route imports
const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const assetRoutes = require('./routes/assets');
const locationRoutes = require('./routes/locations');
const studentRoutes = require('./routes/students');
const issueRoutes = require('./routes/issues');
const renewalRoutes = require('./routes/renewals');
const reportRoutes = require('./routes/reports');

// Init DB on startup
require('./db/database');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

// ── General middleware ────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Static files (frontend) ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: false,
  maxAge: 0,
  etag: false,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  },
}));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/inventory', apiLimiter, inventoryRoutes);
app.use('/api/assets', apiLimiter, assetRoutes);
app.use('/api/locations', apiLimiter, locationRoutes);
app.use('/api/students', apiLimiter, studentRoutes);
app.use('/api/issues', apiLimiter, issueRoutes);
app.use('/api/renewals', apiLimiter, renewalRoutes);
app.use('/api/reports', apiLimiter, reportRoutes);

// ── SPA fallback for all non-API routes ───────────────────────────────────────
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message,
  });
});

module.exports = app;
