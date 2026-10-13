'use strict';

require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n  Department Inventory System`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Server running at http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Press Ctrl+C to stop\n`);
});
