# Department Inventory & Item Issue Management System

A secure, full-stack web application for departments to manage item inventory, issue items to students, track returns, and handle renewals — with complete role-based access for coordinators, staff, and students.

---

## Quick Start

### Prerequisites

- **Node.js v18+** — Download from https://nodejs.org (choose LTS)
- After installing Node.js, open a new terminal and verify:
  ```
  node --version
  npm --version
  ```

### 1. Install dependencies

```bash
cd coder
npm install
```

### 2. Configure environment

```bash
copy .env.example .env
```

Edit `.env` and set a strong `JWT_SECRET` (at least 32 random characters):

```
PORT=3000
JWT_SECRET=your_very_long_random_secret_here_change_this
JWT_EXPIRES_IN=8h
NODE_ENV=development
DB_PATH=./data/inventory.db
```

### 3. Seed the database (sample data)

```bash
npm run seed
```

This creates:
- Coordinator login: `coordinator` / `admin@123`
- Staff login: `staff1` / `staff@123`
- 5 students (password: `student@123`)
- 10 development boards (asset-tracked), 20 USB cables, HDMI cables, laptops, USB hubs
- Sample locations

### 4. Start the server

```bash
npm start
```

Open your browser at: **http://localhost:3000**

---

## Default Login Credentials

| Role        | Username / Enrollment | Password     |
|-------------|----------------------|--------------|
| Coordinator | `coordinator`         | `admin@123`  |
| Staff       | `staff1`              | `staff@123`  |
| Student     | `DFIS2024001`         | `student@123`|
| Student     | `DFIS2024002`         | `student@123`|
| Student     | `DFIS2024003`         | `student@123`|
| Student     | `DFIS2024004`         | `student@123`|
| Student     | `MCA2024001`          | `student@123`|

---

## Features

### Coordinator / Staff
- Full inventory management (quantity-based and individually tracked assets)
- Register and manage students
- Issue items with auto-calculated 15-day due dates
- Record complete or partial returns with condition tracking
- Approve/reject renewal requests (each approval extends due date by 15 days)
- View overdue items with exact overdue messages
- Dashboard with upcoming-due alerts
- Reports: overdue, inventory summary, programme-wise, stock log
- Stock adjustments (addition, correction, retirement, condition changes)
- Print/export any table

### Student Portal
- View all issued items and due dates
- Request renewal (does NOT extend due date until approved)
- Track renewal approval/rejection status
- View complete issue history
- Overdue alerts and upcoming-due warnings

### Security
- Passwords hashed with bcrypt (12 rounds)
- JWT-based stateless authentication
- Role-based access control (coordinator, staff, student)
- Rate limiting on all API and auth endpoints
- Helmet.js security headers
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- XSS prevention via proper HTML escaping

---

## Project Structure

```
coder/
├── server.js              # Entry point
├── src/
│   ├── app.js             # Express app, middleware, routes
│   ├── db/
│   │   └── database.js    # SQLite schema + connection
│   ├── middleware/
│   │   └── auth.js        # JWT auth middleware
│   └── routes/
│       ├── auth.js        # Login endpoints
│       ├── inventory.js   # Item CRUD + stock adjustment
│       ├── assets.js      # Individual asset management
│       ├── locations.js   # Storage location management
│       ├── students.js    # Student management
│       ├── issues.js      # Issue, return endpoints
│       ├── renewals.js    # Renewal request/approve
│       └── reports.js     # Dashboard + reports
├── public/
│   ├── index.html         # SPA shell
│   ├── css/style.css      # Complete stylesheet
│   └── js/
│       ├── api.js         # Fetch wrapper + Auth state
│       ├── utils.js       # Helpers, Toast, modal
│       ├── components.js  # Layout, form modal builder
│       ├── router.js      # Client-side routing
│       └── pages/
│           ├── login.js
│           ├── dashboard.js
│           ├── inventory.js
│           ├── assets.js
│           ├── locations.js
│           ├── students.js
│           ├── issues.js
│           ├── renewals.js
│           ├── reports.js
│           └── student-portal.js
├── scripts/
│   └── seed.js            # Sample data seeder
└── data/                  # SQLite database (auto-created)
```

---

## Business Rules Enforced

| Rule | Implementation |
|------|---------------|
| Due date = issue date + 15 days | Calculated server-side in `issues.js` |
| Request alone doesn't extend due date | `renewals.js` — only `POST /:id/decide` with `approved` extends it |
| Each approval extends by 15 days from current due | `addDays(issue.due_date, 15)` |
| Asset cannot be dual-issued | Checked against active issues table |
| Qty cannot exceed available | Stock check before insert |
| Damaged/lost items unavailable | `available_qty` counter keeps them out |
| Partial returns supported | `qty_returned` tracked independently |
| Overdue auto-detection | `markOverdue()` runs on every list/detail call |

---

## Hosting (Free Options)

### Option A — Railway (Recommended, 1-click)
See `HOSTING.md` for step-by-step instructions.

### Option B — Render
See `HOSTING.md`.

### Option C — VPS / Your Own Server
See `HOSTING.md`.
