# University Assignment Approval System

A role-based academic workflow and audit platform for managing university assignment submissions, reviews, and approvals.

## Overview

This system provides a complete workflow for assignment management in academic institutions, supporting multiple user roles with distinct permissions and responsibilities. The application tracks assignment lifecycle from creation through final approval with comprehensive audit logging.

## Features

- **Role-Based Access Control (RBAC)**: Four distinct user roles with specific permissions
- **Assignment Workflow**: Complete lifecycle management (Draft → Submitted → Review → Approved/Rejected/Forwarded)
- **Audit Trail**: Immutable history tracking all assignment status changes
- **Real-time Notifications**: In-app notifications for workflow events
- **Email Integration**: SMTP-based notifications and password recovery
- **File Management**: PDF upload/download with version control
- **Department Management**: Organize users by academic departments
- **Multi-level Review**: Assignments can be forwarded between reviewers

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose ODM |
| Frontend | EJS Templates, CSS |
| Authentication | bcrypt, express-session |
| File Upload | Multer |
| Email | Nodemailer |

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Admin** | System administrator | Manage departments, create/edit users, view system statistics |
| **Student** | Assignment submitter | Create assignments, upload files, submit for review, resubmit if rejected |
| **Professor** | Assignment reviewer | Review assignments, approve/reject/forward, view review history |
| **HOD** | Head of Department | Same as Professor with additional departmental oversight |

## Assignment Status Flow

```
Draft → Submitted → [Approved | Rejected | Forwarded]
                      ↑           ↓
                      └────── Resubmit
```

## Project Structure

```
university-assignment-approval-system/
├── config/
│   ├── connectDb.js        # MongoDB connection
│   └── nodemailer.js       # Email configuration
├── controllers/
│   ├── adminController.js  # Admin dashboard & CRUD operations
│   ├── authController.js   # Login, logout, password recovery
│   ├── professorController.js # Review workflow
│   └── studentController.js # Assignment submission workflow
├── middleware/
│   └── rbac.js            # Role-based access control
├── model/
│   ├── assignment.js      # Assignment schema
│   ├── assignmentHistory.js # Audit log schema (immutable)
│   ├── department.js      # Department schema
│   ├── notification.js    # Notification schema
│   └── user.js            # User schema
├── routes/
│   ├── admin.js           # Admin routes (/admin/*)
│   ├── auth.js            # Auth routes (/)
│   ├── professor.js       # Professor routes (/professor/*)
│   └── student.js         # Student routes (/student/*)
├── views/                 # EJS templates
├── public/
│   └── css/
│       └── styles.css     # Dark theme stylesheet
├── uploads/
│   └── assignments/       # Uploaded PDF files
├── server.js             # Application entry point
└── package.json
```

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Git

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd university-assignment-approval-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** (optional)

   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=your-secret-key-change-in-production
   MONGODB_URI=mongodb://127.0.0.1:27017/universityDb
   ADMIN_EMAIL=admin@university.edu
   ```

4. **Start MongoDB** (if running locally)
   ```bash
   mongod
   ```

5. **Start the application**

   Development mode:
   ```bash
   npm run dev
   ```

   Production mode:
   ```bash
   npm start
   ```

6. **Access the application**

   Open http://localhost:3000 in your browser

## API Routes

### Authentication Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Login page |
| POST | `/login` | Universal login handler |
| GET | `/user/login` | User login page |
| POST | `/user/login` | User login handler |
| GET | `/forgot-password` | Password recovery page |
| POST | `/forgot-password/otp` | Generate OTP |
| POST | `/forgot-password/verify-otp` | Verify OTP and reset password |
| GET | `/logout` | Logout user |

### Admin Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/admin/dashboard` | Admin dashboard with statistics |
| GET | `/admin/departments/create` | Create department page |
| POST | `/admin/departments/create` | Create department handler |
| GET | `/admin/departments/list` | List all departments |
| POST | `/admin/departments/delete/:id` | Delete department |
| GET | `/admin/departments/edit/:id` | Edit department page |
| POST | `/admin/departments/edit/:id` | Update department |
| GET | `/admin/users/create` | Create user page |
| POST | `/admin/users/create` | Create user handler |
| GET | `/admin/users/list` | List all users |
| POST | `/admin/users/delete/:id` | Delete user |
| GET | `/admin/users/edit/:id` | Edit user page |
| POST | `/admin/users/edit/:id` | Update user |

### Student Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/student/dashboard` | Student dashboard |
| GET | `/student/assignments/create` | Create assignment page |
| POST | `/student/assignments/create` | Create assignment handler |
| GET | `/student/assignments` | List assignments |
| GET | `/student/assignments/:id/details` | View assignment details |
| POST | `/student/assignments/:id/upload` | Upload file (PDF) |
| GET | `/student/assignments/:id/files/:fileId/download` | Download file |
| GET | `/student/assignments/:id/submit` | Submit assignment page |
| POST | `/student/assignments/:id/submit` | Submit assignment handler |
| GET | `/student/assignments/:id/resubmit` | Resubmit assignment page |
| POST | `/student/assignments/:id/resubmit` | Resubmit handler |
| POST | `/student/notifications/:id/read` | Mark notification as read |

### Professor Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/professor/dashboard` | Reviewer dashboard |
| GET | `/professor/assignments/:id/review` | Review assignment page |
| GET | `/professor/assignments/:id/view` | View assignment (read-only) |
| GET | `/professor/assignments/:id/files/:fileId/download` | Download file |
| POST | `/professor/assignments/:id/approve` | Initiate approval (sends OTP) |
| POST | `/professor/assignments/:id/verify-approval-otp` | Verify approval OTP |
| POST | `/professor/assignments/:id/reject` | Reject assignment |
| POST | `/professor/assignments/:id/forward` | Forward to another reviewer |
| GET | `/professor/review-history` | View reviewed assignments |
| POST | `/professor/notifications/:id/read` | Mark notification as read |

## Database Schema

### User Schema

```javascript
{
  name: String,
  email: String (unique, lowercase),
  passwordHash: String,
  phone: String,
  role: Enum ['Admin', 'Student', 'Professor', 'HOD'],
  departmentId: ObjectId (ref: 'department'),
  status: Enum ['active', 'inactive'],
  createdAt: Date,
  updatedAt: Date
}
```

### Assignment Schema

```javascript
{
  title: String,
  description: String,
  category: Enum ['Assignment', 'Thesis', 'Report'],
  studentId: ObjectId (ref: 'user'),
  departmentId: ObjectId (ref: 'department'),
  reviewerId: ObjectId (ref: 'user'),
  files: [{
    filename: String,
    originalName: String,
    fileSize: Number,
    storagePath: String,
    uploadedAt: Date,
    version: Number
  }],
  status: Enum ['Draft', 'Submitted', 'Approved', 'Rejected', 'Forwarded'],
  submittedAt: Date,
  history: [ObjectId (ref: 'assignmentHistory')]
}
```

### AssignmentHistory Schema (Immutable)

```javascript
{
  assignmentId: ObjectId (ref: 'assignment'),
  actorId: ObjectId (ref: 'user'),
  actorRole: Enum ['Admin', 'Student', 'Professor', 'HOD'],
  action: Enum ['create', 'submit', 'approve', 'reject', 'forward', 'resubmit'],
  previousStatus: String,
  newStatus: String,
  remarks: String,
  forwardedToId: ObjectId (ref: 'user'),
  signature: String,
  timestamp: Date
}
```

### Department Schema

```javascript
{
  name: String (unique),
  programType: Enum ['UG', 'PG', 'Research'],
  address: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Schema

```javascript
{
  recipientId: ObjectId (ref: 'user'),
  assignmentId: ObjectId (ref: 'assignment'),
  type: Enum ['submission', 'resubmission', 'approval', 'rejection', 'forwarding'],
  title: String,
  message: String,
  isRead: Boolean,
  readAt: Date,
  emailSent: Boolean,
  triggeredBy: ObjectId (ref: 'user'),
  createdAt: Date
}
```

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **Session Management**: httpOnly cookies with configurable expiry
- **Role-Based Access Control**: Middleware-enforced route protection
- **Immutable Audit Log**: Pre-hooks prevent history modification
- **File Type Validation**: Only PDF uploads allowed
- **File Size Limits**: Maximum 10MB per file
- **OTP Verification**: Two-factor approval for assignment approval

## File Upload Specifications

- **Allowed Format**: PDF only
- **Maximum Size**: 10 MB
- **Storage Location**: `uploads/assignments/`
- **Naming Convention**: `{timestamp}-{random}-{originalName}`
- **Version Control**: Automatic versioning on resubmission

## Email Configuration

The system uses Nodemailer with Gmail SMTP:

```javascript
{
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: { user, pass }
}
```

**Email Triggers:**
- Password reset OTP
- Approval OTP (for professors)
- Assignment submission notifications
- Assignment approval/rejection notifications

## Default Credentials

> **Note**: Users must be created by an Admin through the admin dashboard. There is no default user account.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Start | `npm start` | Start production server |
| Dev | `npm run dev` | Start with nodemon (auto-restart) |
| Test | `npm test` | Run tests (not configured) |

## Known Limitations

1. **Email Credentials**: SMTP credentials are hardcoded in `config/nodemailer.js` - should be moved to environment variables
2. **No Client-Side Validation**: Limited form validation before submission
3. **No Pagination**: Some list views may be slow with large datasets
4. **No Search/Filter**: Limited filtering options on list pages
5. **Single Database**: Hardcoded MongoDB URI in `config/connectDb.js`

## Future Enhancements

- [ ] Add comprehensive test suite
- [ ] Implement search and advanced filtering
- [ ] Add export functionality (PDF/Excel reports)
- [ ] Implement email attachments for notifications
- [ ] Add assignment deadline tracking
- [ ] Implement rubric-based evaluation
- [ ] Add comment thread on assignments
- [ ] Mobile-responsive UI improvements
- [ ] API documentation with Swagger
- [ ] Docker containerization

## License

ISC

## Author

Developed for university assignment workflow management.
