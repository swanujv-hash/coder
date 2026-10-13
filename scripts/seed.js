'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('../src/db/database');

const db = getDb();

console.log('Seeding database...');

// ── Users ─────────────────────────────────────────────────────────────────────
const coordHash = bcrypt.hashSync('admin@123', 12);
const staffHash = bcrypt.hashSync('staff@123', 12);

db.prepare(`INSERT OR IGNORE INTO users (username, password_hash, full_name, role, email) VALUES (?,?,?,?,?)`)
  .run('coordinator', coordHash, 'Dr. Priya Sharma', 'coordinator', 'coordinator@dept.edu');
db.prepare(`INSERT OR IGNORE INTO users (username, password_hash, full_name, role, email) VALUES (?,?,?,?,?)`)
  .run('staff1', staffHash, 'Mr. Rajan Mehta', 'staff', 'rajan@dept.edu');

// ── Locations ─────────────────────────────────────────────────────────────────
const locIds = {};
for (const [name, type, desc] of [
  ['Computer Lab A', 'laboratory', 'Main computing lab, Ground Floor'],
  ['Computer Lab B', 'laboratory', 'Secondary computing lab, First Floor'],
  ['Server Room', 'room', 'Server and networking equipment'],
  ['Store Room', 'cupboard', 'Main inventory store'],
  ['DFIS Department', 'department', 'M.Sc. DFIS Department'],
]) {
  const r = db.prepare('INSERT OR IGNORE INTO locations (name, type, description) VALUES (?,?,?)').run(name, type, desc);
  locIds[name] = r.lastInsertRowid || db.prepare('SELECT id FROM locations WHERE name = ?').get(name).id;
}

// ── Items ─────────────────────────────────────────────────────────────────────
const userRow = db.prepare("SELECT id FROM users WHERE username = 'coordinator'").get();
const coordId = userRow.id;

const items = [
  { code: 'DEV-BOARD', name: 'Development Board', cat: 'Electronics', desc: 'Raspberry Pi 4B development board', make: 'Raspberry Pi', type: 'asset', qty: 10, limit: 1, rlimit: 2, loc: 'Computer Lab A' },
  { code: 'USB-CABLE', name: 'USB Cable', cat: 'Accessories', desc: 'USB-A to USB-C cable, 1m', make: 'Generic', type: 'quantity', qty: 20, limit: 3, rlimit: 2, loc: 'Store Room' },
  { code: 'HDMI-CBL', name: 'HDMI Cable', cat: 'Accessories', desc: 'HDMI to HDMI, 2m', make: 'Generic', type: 'quantity', qty: 15, limit: 2, rlimit: 2, loc: 'Store Room' },
  { code: 'LAPTOP-01', name: 'Laptop', cat: 'Computers', desc: 'Dell Inspiron 15 laptop', make: 'Dell Inspiron 15', type: 'asset', qty: 5, limit: 1, rlimit: 1, loc: 'Computer Lab B' },
  { code: 'USB-ADAPTER', name: 'USB Hub/Adapter', cat: 'Accessories', desc: 'USB 3.0 4-port hub', make: 'Ugreen', type: 'quantity', qty: 10, limit: 2, rlimit: 2, loc: 'Store Room' },
];

const itemIds = {};
for (const it of items) {
  const locId = locIds[it.loc];
  const existing = db.prepare('SELECT id FROM items WHERE item_code = ?').get(it.code);
  if (existing) { itemIds[it.code] = existing.id; continue; }
  const r = db.prepare(`
    INSERT INTO items (item_code, name, category, description, make_model, item_type, total_qty, available_qty, issue_limit, renewal_limit, location_id, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(it.code, it.name, it.cat, it.desc, it.make, it.type, it.qty, it.qty, it.limit, it.rlimit, locId, coordId);
  itemIds[it.code] = r.lastInsertRowid;
}

// ── Assets for development boards ─────────────────────────────────────────────
const devBoardItemId = itemIds['DEV-BOARD'];
// Reset total_qty since we'll add individually
db.prepare('UPDATE items SET total_qty = 0, available_qty = 0 WHERE id = ?').run(devBoardItemId);

for (let i = 1; i <= 10; i++) {
  const aid = `DB-${String(i).padStart(3, '0')}`;
  const existing = db.prepare('SELECT id FROM assets WHERE asset_id = ?').get(aid);
  if (!existing) {
    db.prepare(`INSERT INTO assets (asset_id, serial_no, item_id, location_id, condition, status, created_by) VALUES (?,?,?,?,?,?,?)`)
      .run(aid, `SN-RPI-${1000 + i}`, devBoardItemId, locIds['Computer Lab A'], 'good', 'available', coordId);
    db.prepare("UPDATE items SET total_qty = total_qty + 1, available_qty = available_qty + 1 WHERE id = ?").run(devBoardItemId);
  }
}

// ── Assets for laptops ────────────────────────────────────────────────────────
const laptopItemId = itemIds['LAPTOP-01'];
db.prepare('UPDATE items SET total_qty = 0, available_qty = 0 WHERE id = ?').run(laptopItemId);

for (let i = 1; i <= 5; i++) {
  const aid = `LT-${String(i).padStart(3, '0')}`;
  const existing = db.prepare('SELECT id FROM assets WHERE asset_id = ?').get(aid);
  if (!existing) {
    db.prepare(`INSERT INTO assets (asset_id, serial_no, item_id, location_id, condition, status, created_by) VALUES (?,?,?,?,?,?,?)`)
      .run(aid, `SN-DELL-${2000 + i}`, laptopItemId, locIds['Computer Lab B'], 'good', 'available', coordId);
    db.prepare("UPDATE items SET total_qty = total_qty + 1, available_qty = available_qty + 1 WHERE id = ?").run(laptopItemId);
  }
}

// ── Students ──────────────────────────────────────────────────────────────────
const students = [
  { enr: 'DFIS2024001', name: 'Amit Patel',    prog: 'M.Sc. DFIS', sem: 1, email: 'amit@student.edu',    phone: '9876543210', pass: 'student@123' },
  { enr: 'DFIS2024002', name: 'Sneha Verma',   prog: 'M.Sc. DFIS', sem: 1, email: 'sneha@student.edu',   phone: '9876543211', pass: 'student@123' },
  { enr: 'DFIS2024003', name: 'Rohit Sharma',  prog: 'M.Sc. DFIS', sem: 1, email: 'rohit@student.edu',   phone: '9876543212', pass: 'student@123' },
  { enr: 'DFIS2024004', name: 'Priya Nair',    prog: 'M.Sc. DFIS', sem: 2, email: 'priya@student.edu',   phone: '9876543213', pass: 'student@123' },
  { enr: 'MCA2024001',  name: 'Arjun Singh',   prog: 'MCA',         sem: 3, email: 'arjun@student.edu',   phone: '9876543214', pass: 'student@123' },
];

for (const s of students) {
  const existing = db.prepare('SELECT id FROM students WHERE enrollment_no = ?').get(s.enr);
  if (!existing) {
    const hash = bcrypt.hashSync(s.pass, 12);
    db.prepare('INSERT INTO students (enrollment_no, full_name, programme, semester, email, phone, password_hash) VALUES (?,?,?,?,?,?,?)')
      .run(s.enr, s.name, s.prog, s.sem, s.email, s.phone, hash);
  }
}

console.log('\n✅ Database seeded successfully!\n');
console.log('─────────────────────────────────────────────────────');
console.log('  STAFF LOGINS:');
console.log('    Coordinator:  username=coordinator  password=admin@123');
console.log('    Staff:        username=staff1       password=staff@123');
console.log('');
console.log('  STUDENT LOGINS (all use password: student@123)');
console.log('    Enrollment: DFIS2024001  (Amit Patel)');
console.log('    Enrollment: DFIS2024002  (Sneha Verma)');
console.log('    Enrollment: DFIS2024003  (Rohit Sharma)');
console.log('    Enrollment: DFIS2024004  (Priya Nair)');
console.log('    Enrollment: MCA2024001   (Arjun Singh)');
console.log('─────────────────────────────────────────────────────\n');
