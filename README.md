# University Assignment Approval System

![Node.js](https://img.shields.io/badge/Node.js-Express.js-6DA55F?style=flat-square&logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-4ea94b?style=flat-square&logo=mongodb&logoColor=white)
![EJS](https://img.shields.io/badge/Frontend-EJS%20Templates-B4CA65?style=flat-square)
![Auth](https://img.shields.io/badge/Auth-Session%20%2B%20OTP-orange?style=flat-square)
![License](https://img.shields.io/badge/License-ISC-yellow?style=flat-square)

A role-based academic workflow and audit platform for managing university assignment submissions, multi-level reviews, and approvals — with an immutable audit trail on every action.

> **Students** submit assignments → **Professors/HOD** review & approve/reject/forward → **Admins** manage users & departments

---

## ✨ Features

- **Role-Based Access Control (RBAC)** — Four roles (Admin, Student, Professor, HOD) with middleware-enforced route protection
- **Assignment Lifecycle State Machine** — `Draft → Submitted → Approved / Rejected / Forwarded`
- **Immutable Audit Trail** — Every status change is logged with actor, timestamp, and remarks; pre-hooks prevent history modification
- **OTP-Verified Approvals** — Professors confirm approvals via email OTP for accountability
- **Email Integration** — SMTP notifications for submissions, approvals, rejections, and password recovery
- **PDF File Management** — Upload/download with automatic versioning on resubmission
- **In-App Notifications** — Real-time workflow event notifications per role
- **Department Management** — Users organized by academic departments (UG / PG / Research)
- **Multi-level Review** — Assignments can be forwarded between reviewers before final decision

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose ODM |
| Frontend | EJS Templates, CSS (Dark theme) |
| Auth & Security | bcrypt, express-session, OTP via email |
| File Handling | Multer (PDF only, max 10MB) |
| Email | Nodemailer + Gmail SMTP |

---

## 👥 User Roles

| Role | Who | Key Permissions |
|------|-----|-----------------|
| **Admin** | System administrator | Manage departments, create/edit users, view system stats |
| **Student** | Assignment submitter | Create, upload, submit, resubmit assignments |
| **Professor** | Reviewer | Approve / reject / forward assignments, view history |
| **HOD** | Head of Department | Same as Professor + departmental oversight |

---

## 🔄 Assignment Lifecycle

```
                    ┌─────────────┐
                    │    Draft    │  ← Student creates
                    └──────┬──────┘
                           │ submit
                    ┌──────▼──────┐
                    │  Submitted  │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐  ┌─────▼──────┐  ┌────▼───────┐
    │  Approved   │  │  Rejected  │  │ Forwarded  │
    └─────────────┘  └─────┬──────┘  └────────────┘
                           │ resubmit
                    ┌──────▼──────┐
                    │  Submitted  │  ← back to review
                    └─────────────┘
```

---

## 🔐 Security Features

- Password hashing with **bcrypt** + salt rounds
- **httpOnly session cookies** with configurable expiry
- RBAC middleware enforced on every protected route
- **Immutable audit log** — Mongoose pre-hooks block history modification
- **OTP verification** before assignment approval is finalized
- PDF-only file uploads with 10MB size cap

---

## 📡 API Routes

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/login` | Universal login |
| GET/POST | `/forgot-password` | Password recovery + OTP flow |
| GET | `/logout` | Session destroy |

### Admin — `/admin`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Stats overview |
| GET/POST | `/departments/create` | Create department |
| GET | `/departments/list` | List departments |
| GET/POST | `/users/create` | Create user |
| GET | `/users/list` | List all users |

### Student — `/student`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Student dashboard |
| GET/POST | `/assignments/create` | Create assignment |
| POST | `/assignments/:id/upload` | Upload PDF |
| POST | `/assignments/:id/submit` | Submit for review |
| POST | `/assignments/:id/resubmit` | Resubmit after rejection |

### Professor — `/professor`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Reviewer dashboard |
| POST | `/assignments/:id/approve` | Initiate approval (sends OTP) |
| POST | `/assignments/:id/verify-approval-otp` | Confirm approval |
| POST | `/assignments/:id/reject` | Reject with remarks |
| POST | `/assignments/:id/forward` | Forward to another reviewer |
| GET | `/review-history` | Past reviewed assignments |

---

## 🗃️ Database Schema Highlights

### AssignmentHistory — Immutable Audit Log
```javascript
{
  assignmentId, actorId, actorRole,
  action,          // create | submit | approve | reject | forward | resubmit
  previousStatus, newStatus,
  remarks, signature,
  timestamp        // auto, never editable
}
```

### Assignment
```javascript
{
  title, description,
  category,        // Assignment | Thesis | Report
  status,          // Draft | Submitted | Approved | Rejected | Forwarded
  files: [{ filename, version, uploadedAt }],
  history: [ref: AssignmentHistory]
}
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v14+
- MongoDB (local or Atlas)

### Setup

```bash
git clone https://github.com/bhavyxthakur/university-assignment-approval-system.git
cd university-assignment-approval-system
npm install
```

Create `.env` in root:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-secret-key
MONGODB_URI=mongodb://127.0.0.1:27017/universityDb
ADMIN_EMAIL=admin@university.edu
```

```bash
npm run dev       # development (nodemon)
npm start         # production
```

Open http://localhost:3000 — Admin creates all users via the dashboard (no default accounts).

---

## ⚠️ Known Limitations

1. SMTP credentials hardcoded in `config/nodemailer.js` — move to `.env`
2. MongoDB URI hardcoded in `config/connectDb.js` — move to `.env`
3. No client-side form validation
4. No pagination on list views
5. No search or filter on assignment lists

---

## 🗺️ Roadmap

- [ ] Move all credentials to environment variables
- [ ] Comprehensive test suite (Jest + Supertest)
- [ ] Search and advanced filtering on list pages
- [ ] PDF/Excel export for reports
- [ ] Assignment deadline tracking
- [ ] Rubric-based evaluation system
- [ ] Comment threads on assignments
- [ ] Swagger API documentation
- [ ] Docker containerization
- [ ] Mobile-responsive UI

---

## 👤 Author

**Bhavya** · [GitHub](https://github.com/bhavyxthakur) · [LinkedIn](https://www.linkedin.com/in/bhavyxthakur/)