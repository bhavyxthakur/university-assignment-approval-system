# University Assignment Approval System

## 🚧 Implementation Status

This project is actively under development.

### Completed
- Admin module (departments, users, RBAC, constraints)
- Student module (assignment drafts, uploads, submission, resubmission)
- Core workflow state machine
- Immutable audit logging
- Notification system (in-app + email hooks)

### In Progress
- Professor review workflow
- OTP-based approval verification

### Planned
- HOD escalation workflow
- Forwarding logic & review history

The system architecture and schemas fully support all roles.
Remaining work is focused on controller logic and UI integration.

**Role-Based Academic Workflow & Audit Platform**

A secure, enterprise-grade digital system for managing assignment submissions with multi-level approvals, immutable audit trails, and role-based access control.

---

## 📋 System Architecture Overview

### Core Design Principles

1. **Stateful Workflow Engine**: Assignments move through defined state transitions (Draft → Submitted → Approved/Rejected/Forwarded)
2. **Immutable Audit Trail**: Every action is logged and cannot be modified or deleted
3. **Server-Side RBAC**: Role enforcement happens server-side; client cannot manipulate permissions
4. **Constraint-Aware Operations**: Deletions and state changes respect business rules (no orphaned data)
5. **Non-Repudiation**: OTP-verified approvals provide proof of authorization

---

## 🔑 Core Concepts

### Role Hierarchy

| Role | Authority | Capabilities |
|------|-----------|--------------|
| **Admin** | System owner | Create departments, manage users, view audit logs |
| **Student** | Submitter | Upload assignments, submit for review, resubmit if rejected |
| **Professor** | Reviewer | Review, approve (OTP), reject, forward to other reviewers |
| **HOD** | Senior Reviewer | Same as Professor + authority to handle escalations |

**Key: Roles are immutable after user creation.**

---

## 🗄️ Data Models

**For detailed schema documentation with ERD and sample queries, see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**

### User
```javascript
{
  name: String,
  email: String (unique),
  passwordHash: String (bcrypt),
  phone: String,
  role: Enum['Admin','Student','Professor','HOD'] (immutable),
  departmentId: ObjectId (required for non-admin),
  status: Enum['active','inactive'],
  createdAt: Date,
  updatedAt: Date
}
```

### Department
```javascript
{
  name: String (unique),
  programType: Enum['UG','PG','Research'],
  address: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Assignment (Workflow State Machine)
```javascript
{
  title: String,
  description: String,
  category: Enum['Assignment','Thesis','Report'],
  studentId: ObjectId (ref: User),
  departmentId: ObjectId (ref: Department),
  reviewerId: ObjectId (ref: User, nullable, changes during workflow),
  files: Array[
    {
      filename: String,
      originalName: String,
      fileSize: Number,
      storagePath: String,
      uploadedAt: Date,
      version: Number
    }
  ],
  status: Enum['Draft','Submitted','Approved','Rejected','Forwarded'],
  createdAt: Date,
  submittedAt: Date,
  history: Array[ObjectId] (ref: AssignmentHistory)
}
```

**Status Transition Rules:**
- `Draft` → `Submitted` (student submits)
- `Submitted` → `Approved` (professor approves with OTP)
- `Submitted` → `Rejected` (professor rejects with remarks)
- `Submitted` → `Forwarded` (professor forwards to another reviewer)
- `Forwarded` → `Approved` (new reviewer approves)
- `Forwarded` → `Rejected` (new reviewer rejects)
- `Rejected` → `Submitted` (student resubmits)

### AssignmentHistory (Immutable Append-Only Audit Log)
```javascript
{
  assignmentId: ObjectId,
  actorId: ObjectId (user who performed action),
  actorRole: String,
  action: Enum['create','submit','approve','reject','forward','resubmit'],
  previousStatus: String,
  newStatus: String,
  remarks: String (optional),
  forwardedToId: ObjectId (if action='forward'),
  signature: String (OTP hash for approval),
  timestamp: Date (immutable)
}
```

**Cannot be modified or deleted. Prevents "history rewriting".**

### Notification
```javascript
{
  recipientId: ObjectId,
  assignmentId: ObjectId,
  type: Enum['submission','resubmission','approval','rejection','forwarding'],
  title: String,
  message: String,
  isRead: Boolean,
  readAt: Date,
  emailSent: Boolean,
  emailSentAt: Date,
  triggeredBy: ObjectId,
  createdAt: Date
}
```

---

## 🔐 Authentication & Authorization

### Login Flow

```
POST /admin/login (email + password)
  ↓
Bcrypt comparison
  ↓
Set session: userId, role, email, departmentId
  ↓
Redirect /admin/dashboard (Admin only)

POST /user/login (email + password)
  ↓
Bcrypt comparison
  ↓
Check user.status = 'active'
  ↓
Set session
  ↓
Redirect based on role:
  - Student   → /student/dashboard
  - Professor → /professor/dashboard
  - HOD       → /professor/dashboard
```

### Session Security
- HttpOnly cookies (prevent XSS token theft)
- 24-hour expiration
- HTTPS required in production

### RBAC Middleware

All routes protected by role-based middleware:

```javascript
requireAuth()      // Session required
requireRole(...r)  // Specific role(s)
adminOnly          // Admin only
studentOnly        // Student only
reviewerOnly       // Professor or HOD
```

---

## 📤 Assignment Submission Workflow

### Student Submission Process

1. **Create Assignment (Draft)**
   - Title, description, category
   - Status = "Draft"
   - No reviewer assigned
   - History entry created

2. **Upload File(s) to Draft**
   - PDF only, max 10MB per file
   - Multiple versions tracked
   - Stored with metadata

3. **Submit for Review**
   - Select professor/HOD from same department
   - Status: Draft → Submitted
   - submittedAt timestamp set
   - reviewerId assigned
   - History entry: submit action
   - **Notification sent to reviewer**
   - Assignment becomes immutable until reviewed

### Professor Review Process

1. **View Pending Reviews**
   - Paginated list, oldest first
   - Days pending calculated
   - Shows student name, assignment title

2. **Approve (Non-Repudiation)**
   - Review page shows full assignment + history
   - Professor enters remarks + signature
   - OTP generated and sent to email
   - Professor verifies OTP (10-min expiry)
   - Status: Submitted → Approved
   - History entry with OTP hash
   - **Notification sent to student**

3. **Reject (Mandatory Feedback)**
   - Remarks required (min 10 chars)
   - Status: Submitted → Rejected
   - reviewerId cleared
   - History entry with remarks
   - **Notification sent to student**

4. **Forward (Escalation)**
   - Select another professor/HOD in same department
   - Cannot forward to self
   - Add forwarding note
   - Status: Submitted → Forwarded
   - reviewerId changed to new reviewer
   - History entry with forwardedToId
   - **Notification sent to new reviewer**

### Student Resubmission (After Rejection)

1. **Resubmit Page**
   - Load previous assignment
   - Option: Upload new file OR keep original
   - Can update description
   - Old files preserved in history

2. **Update Status**
   - Status: Rejected → Submitted
   - submittedAt reset
   - Sent back to original reviewer
   - History entry: resubmit action
   - **Notification sent to reviewer**

---

## 🛡️ Security & Constraints

### Deletion Constraints (Prevent Orphaned Data)

**Department Deletion**: Blocked if any users reference it
```
Users exist with departmentId = this.department
→ Return error with user count
→ Admin must reassign/delete users first
```

**User Deletion**: Blocked if user has pending assignments
```
Assignments exist where:
  (studentId = this.user AND status IN [Draft, Submitted, Forwarded])
  OR
  (reviewerId = this.user AND status IN [Submitted, Forwarded])
→ Return error with assignment count
→ Assignments must be resolved first
```

### Immutability Enforcement

**Role**: Cannot be changed after creation (immutable: true)

**History**: Pre/post-save hooks prevent any modification
```javascript
assignmentHistory.pre('findByIdAndUpdate', ...) → Error
assignmentHistory.pre('findByIdAndDelete', ...) → Error
assignmentHistory.pre('updateOne', ...) → Error
```

### Ownership Verification

All file access and submission operations verify:
1. User is authenticated (req.session.userId exists)
2. User is resource owner (studentId OR reviewerId match)
3. User has correct role (student/professor)

### Status Transition Validation

State machine enforced in controller logic:
- Valid transitions checked before update
- Direct status updates prevented (must use workflow endpoints)
- Invalid transitions return 400 error

---

## 📧 Notifications

### Events Triggered

| Event | Recipient | Content |
|-------|-----------|---------|
| Submission | Reviewer | "New assignment submitted by Student Name" |
| Resubmission | Reviewer | "Student resubmitted assignment" |
| Approval | Student | "Your assignment has been approved" |
| Rejection | Student | "Your assignment was rejected: [remarks]" |
| Forwarding | New Reviewer | "Assignment forwarded by Professor: [note]" |

### Delivery Channels

1. **In-App** (Required)
   - Stored in DB
   - Marked as read/unread
   - Displayed in dashboards

2. **Email** (Optional but Implemented)
   - Uses Nodemailer
   - Async (non-blocking)
   - Tracks: emailSent, emailSentAt, emailError

---

## 📁 File Upload & Storage

### Upload Configuration

- **Storage**: Local filesystem (`uploads/assignments/`)
- **Multer Integration**: Disk storage with unique filenames
- **Validation**:
  - MIME type: application/pdf only
  - Size limit: 10MB per file
  - Required before submission

### File Versioning

- Multiple versions tracked
- Each upload increments `version` number
- Old files preserved on resubmission (if "keep original" selected)
- Download endpoint verifies access (student owner OR assigned reviewer)

---

## 🗂️ Project Structure

```
.
├── server.js                          # Main app entry
├── package.json                       # Dependencies
├── config/
│   ├── connectDb.js                   # MongoDB connection
│   └── nodemailer.js                  # Email configuration
├── model/                             # Mongoose schemas
│   ├── user.js
│   ├── department.js
│   ├── assignment.js
│   ├── assignmentHistory.js           # Immutable audit log
│   └── notification.js
├── controllers/                       # Business logic
│   ├── authController.js              # Login, password reset
│   ├── adminController.js             # Dept/user mgmt
│   ├── studentController.js           # Assignment creation/submission
│   └── professorController.js         # Review workflow
├── routes/                            # HTTP endpoints
│   ├── auth.js                        # /
│   ├── admin.js                       # /admin
│   ├── student.js                     # /student
│   └── professor.js                   # /professor
├── middleware/
│   └── rbac.js                        # Role-based access control
├── views/                             # EJS templates
│   ├── login.ejs
│   ├── adminDashboard.ejs
│   ├── studentDashboard.ejs
│   ├── professorDashboard.ejs
│   └── ... (other views)
└── uploads/assignments/               # File storage
```

---

## 🚀 API Endpoints Reference

### Authentication
- `GET /` – Admin login form
- `POST /admin/login` – Admin login
- `GET /forgot-password` – Reset password form
- `POST /forgot-password/otp` – Generate OTP
- `POST /forgot-password/verify-otp` – Verify OTP & reset
- `GET /user/login` – Student/Prof login form
- `POST /user/login` – Student/Prof login
- `GET /logout` – Invalidate session

### Admin Routes (`/admin`, requires adminOnly)
- `GET /dashboard` – System overview
- `GET /departments/create` – Dept creation form
- `POST /departments/create` – Create dept
- `GET /departments/list` – List depts (paginated)
- `GET /departments/edit/:id` – Edit form
- `POST /departments/edit/:id` – Update dept
- `POST /departments/delete/:id` – Delete dept (constraint-checked)
- `GET /users/create` – User creation form
- `POST /users/create` – Create user
- `GET /users/list` – List users (paginated, filterable)
- `GET /users/edit/:id` – Edit form
- `POST /users/edit/:id` – Update user
- `POST /users/delete/:id` – Delete user (constraint-checked)

### Student Routes (`/student`, requires studentOnly)
- `GET /dashboard` – Status counts, recent submissions
- `GET /assignments/create` – Assignment form
- `POST /assignments/create` – Create assignment
- `GET /assignments` – Student's assignments (filtered/sorted)
- `GET /assignments/:id/details` – Full assignment view + history
- `POST /assignments/:id/upload` – Upload file to draft
- `GET /assignments/:id/files/:fileId/download` – Download file
- `GET /assignments/:id/submit` – Submission form (select reviewer)
- `POST /assignments/:id/submit` – Submit for review
- `GET /assignments/:id/resubmit` – Resubmission form
- `POST /assignments/:id/resubmit` – Resubmit rejected assignment
- `POST /notifications/:id/read` – Mark notification as read

### Professor/HOD Routes (`/professor`, requires reviewerOnly)
- `GET /dashboard` – Pending reviews, notifications
- `GET /assignments/:id/review` – Review page (full details + history)
- `POST /assignments/:id/approve` – Initiate approval (send OTP)
- `POST /assignments/:id/verify-approval-otp` – Verify OTP & approve
- `POST /assignments/:id/reject` – Reject (mandatory remarks)
- `POST /assignments/:id/forward` – Forward to another reviewer
- `GET /review-history` – Past reviews by this person
- `POST /notifications/:id/read` – Mark notification as read

---

## 🔍 Audit Trail Example

**Assignment ID: 507f1f77bcf86cd799439011**

```
History Entries (Immutable):

1. Actor: Student (ID: ...) | 2024-01-15 09:00:00
   Action: create
   Status: null → Draft
   
2. Actor: Student (ID: ...) | 2024-01-15 09:15:00
   Action: submit
   Status: Draft → Submitted
   Reviewer: Prof. Smith
   Notification: Sent to Prof. Smith
   
3. Actor: Prof. Smith (ID: ...) | 2024-01-15 14:30:00
   Action: reject
   Status: Submitted → Rejected
   Remarks: "Please clarify methodology in section 2"
   Signature: hash(otp)
   Notification: Sent to Student
   
4. Actor: Student (ID: ...) | 2024-01-16 10:00:00
   Action: resubmit
   Status: Rejected → Submitted
   Remarks: "Resubmitted with new file"
   Notification: Sent to Prof. Smith
   
5. Actor: Prof. Smith (ID: ...) | 2024-01-16 15:00:00
   Action: approve
   Status: Submitted → Approved
   Remarks: "Excellent work"
   Signature: hash(otp)
   Notification: Sent to Student
```

**Complete chain of custody. Immutable. Non-repudiable.**

---

## 🧪 Testing Workflows

### Admin Workflow
1. Login: `/admin/login` (email + password)
2. Create department
3. Create student, professor, HOD (assign to dept)
4. View dashboard (stats)

### Student Workflow
1. Login: `/user/login`
2. Create assignment (Draft)
3. Upload PDF file
4. Submit to professor (→ Submitted)
5. Receive rejection notification
6. Resubmit with new file (→ Submitted again)

### Professor Workflow
1. Login: `/user/login`
2. View dashboard (pending reviews)
3. Review assignment (full history visible)
4. Reject with remarks (→ Rejected)
5. Later: Review resubmission
6. Approve (OTP flow: email → verify → approve)

---

## 🔧 Environment Setup

### Prerequisites
- Node.js 14+
- MongoDB 4.4+
- Nodemailer config (for emails)

### Installation

```bash
# Install dependencies
npm install

# Create uploads directory
mkdir -p uploads/assignments

# Set environment variables
export SESSION_SECRET="your-secret-key"
export ADMIN_EMAIL="admin@university.edu"
export ADMIN_PASSWORD_HASH="bcrypt-hash-here"

# Start server
npm run dev    # With nodemon
npm start      # Production
```

### First Run

1. Server starts and connects to MongoDB
2. Admin must be created in DB (with Admin role, Admin role is immutable)
3. Admin login at `/admin/login` to access control panel
4. Admin creates departments, then creates users

---

## 📝 Future Enhancements

1. **Batch Operations**: Bulk user creation from CSV
2. **Advanced Filtering**: Department-wise dashboards
3. **Analytics**: Approval rates, review times, bottleneck detection
4. **API Layer**: REST API with JWT (separate from web app)
5. **Cloud Storage**: S3 integration for file uploads
6. **Automated Escalation**: Reminder emails for pending reviews
7. **Compliance Reports**: GDPR/audit export functionality
8. **Dashboard Widgets**: Charts, trend analysis
9. **Role-Based Views**: Dynamic UI based on permissions
10. **Database Backups**: Automated audit trail backups

---

