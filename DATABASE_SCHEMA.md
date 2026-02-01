# Database Schema & Relationships

## Entity Relationship Diagram (Conceptual)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐
│     DEPARTMENT           │
├──────────────────────────┤
│ _id (ObjectId)           │
│ name (String, unique)    │
│ programType (UG/PG/Res)  │
│ address (String)         │
│ createdAt (Date)         │
│ updatedAt (Date)         │
└────────────┬─────────────┘
             │
             │ (1 to Many)
             │
┌────────────▼──────────────────────────┐
│         USER                          │
├───────────────────────────────────────┤
│ _id (ObjectId)                        │
│ name (String)                         │
│ email (String, unique)                │
│ passwordHash (String, bcrypt)         │
│ phone (String)                        │
│ role (Admin/Student/Professor/HOD)    │ ◄─── IMMUTABLE
│ departmentId (ObjectId, ref: Dept)    │
│ status (active/inactive)              │
│ createdAt (Date)                      │
│ updatedAt (Date)                      │
└────────────┬──────────────────────────┘
             │
             │ (Student creates)
             │
┌────────────▼───────────────────────────────┐
│         ASSIGNMENT                         │
├────────────────────────────────────────────┤
│ _id (ObjectId)                             │
│ title (String)                             │
│ description (String)                       │
│ category (Assignment/Thesis/Report)        │
│ studentId (ObjectId, ref: User)            │
│ departmentId (ObjectId, ref: Dept)         │
│ reviewerId (ObjectId, ref: User, nullable) │ ◄─── Changes during workflow
│ files: Array[                              │
│   {                                        │
│     filename, originalName,                │
│     fileSize, storagePath,                 │
│     uploadedAt, version                    │
│   }                                        │
│ ]                                          │
│ status (Draft/Submitted/Approved/          │
│         Rejected/Forwarded)                │
│ createdAt (Date)                           │
│ submittedAt (Date, nullable)               │
│ history: Array[ObjectId] ──────┐           │
│                                 │
└──────────────────────────────────┼──┐
                                   │  │
                    (1 to Many)    │  │
                                   │  │
         ┌─────────────────────────┘  │
         │                            │
         │         ┌──────────────────┘
         │         │
┌────────▼─────────▼──────────────────────────────┐
│      ASSIGNMENT HISTORY (IMMUTABLE)             │
├───────────────────────────────────────────────┤
│ _id (ObjectId)                                │
│ assignmentId (ObjectId, ref: Assignment)      │
│ actorId (ObjectId, ref: User)                 │
│ actorRole (Admin/Student/Professor/HOD)       │
│ action (create/submit/approve/reject/         │
│         forward/resubmit)                     │
│ previousStatus (String)                       │
│ newStatus (String)                            │
│ remarks (String, optional)                    │
│ forwardedToId (ObjectId, ref: User, optional) │
│ signature (String, OTP hash)                  │
│ timestamp (Date, IMMUTABLE)                   │
│                                               │
│ ⚠️  IMMUTABILITY ENFORCED:                     │
│     • Cannot be updated                       │
│     • Cannot be deleted                       │
│     • Append-only audit trail                 │
└───────────────────────────────────────────────┘
         ▲
         │
         │
┌────────┴────────────────────────────┐
│       NOTIFICATION                  │
├─────────────────────────────────────┤
│ _id (ObjectId)                      │
│ recipientId (ObjectId, ref: User)   │
│ assignmentId (ObjectId, ref: Assign)│
│ type (submission/resubmission/      │
│       approval/rejection/forwarding)│
│ title (String)                      │
│ message (String)                    │
│ isRead (Boolean)                    │
│ readAt (Date, nullable)             │
│ emailSent (Boolean)                 │
│ emailSentAt (Date, nullable)        │
│ emailError (String, nullable)       │
│ triggeredBy (ObjectId, ref: User)   │
│ createdAt (Date)                    │
└─────────────────────────────────────┘
```

---

## Collection Statistics

| Collection | Indexed Fields | Constraints |
|------------|---------------|-------------|
| users | email, role, departmentId | Email unique, role immutable |
| departments | name | Name unique |
| assignments | studentId, reviewerId, status, departmentId | References enforced in code |
| assignmentHistory | assignmentId, timestamp | Immutable (hooks prevent updates) |
| notifications | recipientId, isRead, createdAt | Track delivery status |

---

## Sample Data Structure

### Department Document
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  name: "Computer Science",
  programType: "UG",
  address: "Building A, Floor 3",
  createdAt: ISODate("2024-01-15T09:00:00Z"),
  updatedAt: ISODate("2024-01-15T09:00:00Z")
}
```

### User Document (Student)
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439012"),
  name: "John Doe",
  email: "john.doe@university.edu",
  passwordHash: "$2b$10$NQqvrmHveYvMvw...",  // bcrypt hash
  phone: "9876543210",
  role: "Student",
  departmentId: ObjectId("507f1f77bcf86cd799439011"),
  status: "active",
  createdAt: ISODate("2024-01-15T10:00:00Z"),
  updatedAt: ISODate("2024-01-15T10:00:00Z")
}
```

### User Document (Professor)
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439013"),
  name: "Dr. Sarah Smith",
  email: "sarah.smith@university.edu",
  passwordHash: "$2b$10$QRgvrmHveYvMvw...",  // bcrypt hash
  phone: "8765432109",
  role: "Professor",
  departmentId: ObjectId("507f1f77bcf86cd799439011"),
  status: "active",
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z")
}
```

### Assignment Document
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439014"),
  title: "Data Structures Implementation",
  description: "Implement binary search tree with traversal methods",
  category: "Assignment",
  studentId: ObjectId("507f1f77bcf86cd799439012"),  // John Doe
  departmentId: ObjectId("507f1f77bcf86cd799439011"),
  reviewerId: ObjectId("507f1f77bcf86cd799439013"),  // Dr. Sarah Smith
  files: [
    {
      _id: ObjectId("507f1f77bcf86cd799439015"),
      filename: "1673794800000-assignment.pdf",
      originalName: "DataStructures_Assignment.pdf",
      fileSize: 2048576,
      storagePath: "uploads/assignments/1673794800000-assignment.pdf",
      uploadedAt: ISODate("2024-01-15T09:15:00Z"),
      version: 1
    }
  ],
  status: "Submitted",
  createdAt: ISODate("2024-01-15T09:00:00Z"),
  submittedAt: ISODate("2024-01-15T09:20:00Z"),
  history: [
    ObjectId("507f1f77bcf86cd799439016"),
    ObjectId("507f1f77bcf86cd799439017")
  ]
}
```

### AssignmentHistory Documents (Immutable)
```javascript
// Entry 1: Creation
{
  _id: ObjectId("507f1f77bcf86cd799439016"),
  assignmentId: ObjectId("507f1f77bcf86cd799439014"),
  actorId: ObjectId("507f1f77bcf86cd799439012"),  // John (Student)
  actorRole: "Student",
  action: "create",
  previousStatus: null,
  newStatus: "Draft",
  remarks: null,
  forwardedToId: null,
  signature: null,
  timestamp: ISODate("2024-01-15T09:00:00Z")
}

// Entry 2: Submission
{
  _id: ObjectId("507f1f77bcf86cd799439017"),
  assignmentId: ObjectId("507f1f77bcf86cd799439014"),
  actorId: ObjectId("507f1f77bcf86cd799439012"),  // John (Student)
  actorRole: "Student",
  action: "submit",
  previousStatus: "Draft",
  newStatus: "Submitted",
  remarks: null,
  forwardedToId: null,
  signature: null,
  timestamp: ISODate("2024-01-15T09:20:00Z")
}
```

### Notification Document
```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439018"),
  recipientId: ObjectId("507f1f77bcf86cd799439013"),  // Dr. Sarah Smith
  assignmentId: ObjectId("507f1f77bcf86cd799439014"),
  type: "submission",
  title: "New Assignment Submitted",
  message: "John Doe submitted: Data Structures Implementation",
  isRead: false,
  readAt: null,
  emailSent: true,
  emailSentAt: ISODate("2024-01-15T09:20:30Z"),
  emailError: null,
  triggeredBy: ObjectId("507f1f77bcf86cd799439012"),  // John
  createdAt: ISODate("2024-01-15T09:20:15Z")
}
```

---

## Data Integrity Rules

### Constraints Enforced in Code

#### User Deletion
```
Cannot delete if:
  - User is student with pending assignments (Draft/Submitted/Forwarded)
  - User is reviewer with pending assignments (Submitted/Forwarded)
```

#### Department Deletion
```
Cannot delete if:
  - Any users exist with departmentId = this.department
```

#### Assignment Status Transitions
```
Draft     → Submitted (only)
Submitted → Approved / Rejected / Forwarded (only)
Rejected  → Submitted (only, via resubmit)
Approved  → (terminal, no transitions)
Forwarded → Approved / Rejected / Forwarded (only)
```

#### File Operations
```
Upload:    Can only upload to Draft assignments
Download:  Only student (owner) or current reviewerId
Delete:    Cannot delete (files archived in history)
```

---

## Cascade & Reference Handling

| Delete Action | Behavior | Reason |
|---------------|----------|--------|
| Delete Department | Blocked if users exist | Prevent orphaned users |
| Delete User | Blocked if assignments pending | Preserve audit trail |
| Delete Assignment | Allowed, history preserved | History is separate table |
| Delete Assignment File | Not exposed (archived) | Maintain version history |
| Delete History Entry | Blocked by pre-hook | Immutability enforcement |

---

## Query Patterns

### Get Assignment with Full History
```javascript
Assignment.findById(assignmentId)
  .populate('history')
  .then(assignment => {
    // assignment.history is array of AssignmentHistory docs
    // Shows complete audit trail
  })
```

### Find Pending Reviews for Professor
```javascript
Assignment.find({
  reviewerId: professorId,
  status: { $in: ['Submitted', 'Forwarded'] }
})
.sort({ submittedAt: 1 })  // Oldest first
```

### Get All Assignments by Student
```javascript
Assignment.find({
  studentId: studentId
})
.populate('reviewerId', 'name email')
```

### Check Deletion Constraints
```javascript
// Before deleting user
const pendingAssignments = Assignment.countDocuments({
  $or: [
    { studentId: userId, status: { $in: ['Draft', 'Submitted', 'Forwarded'] } },
    { reviewerId: userId, status: { $in: ['Submitted', 'Forwarded'] } }
  ]
})
```

---

## Indexing Strategy

### Recommended Indexes

```javascript
// Users collection
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ role: 1 })
db.users.createIndex({ departmentId: 1 })
db.users.createIndex({ status: 1 })

// Departments collection
db.departments.createIndex({ name: 1 }, { unique: true })

// Assignments collection
db.assignments.createIndex({ studentId: 1 })
db.assignments.createIndex({ reviewerId: 1 })
db.assignments.createIndex({ departmentId: 1 })
db.assignments.createIndex({ status: 1 })
db.assignments.createIndex({ submittedAt: 1 })
db.assignments.createIndex({ 
  status: 1, 
  reviewerId: 1, 
  submittedAt: 1 
})  // Compound: for finding pending reviews

// AssignmentHistory collection
db.assignmentHistory.createIndex({ assignmentId: 1 })
db.assignmentHistory.createIndex({ timestamp: -1 })  // Latest first

// Notifications collection
db.notifications.createIndex({ recipientId: 1 })
db.notifications.createIndex({ isRead: 1 })
db.notifications.createIndex({ createdAt: -1 })
db.notifications.createIndex({ 
  recipientId: 1, 
  isRead: 1 
})  // Unread notifications by user
```

---

## Audit Trail Example Query

```javascript
// Get complete audit trail for an assignment
db.assignments.findOne({ _id: ObjectId(...) })
  .then(assignment => {
    return db.assignmentHistory.find({
      _id: { $in: assignment.history }
    }).sort({ timestamp: 1 })
  })
  .then(history => {
    // Displays chronological audit trail
    history.forEach(entry => {
      console.log(`${entry.timestamp}: ${entry.actorRole} ${entry.action} (${entry.previousStatus} → ${entry.newStatus})`)
    })
  })
```

---

## Summary

### Core Features
✅ Relational integrity (references maintained)
✅ Immutable audit trail (cannot be modified)
✅ Constraint-aware deletion (no orphaned data)
✅ Status state machine (strict transitions)
✅ Non-repudiation (OTP-signed approvals)
✅ Full accountability (every action logged)

### Collections
- **Users**: 4 immutable roles
- **Departments**: Parent entity for users
- **Assignments**: Workflow state machine
- **AssignmentHistory**: Append-only audit log
- **Notifications**: Event-driven messaging

### Integrity Level
**Enterprise-Grade**: All constraints enforced, immutability guaranteed, audit trail protected.

---

This schema design demonstrates:
- Professional database modeling
- Referential integrity
- Audit compliance
- State machine implementation
- Immutability enforcement
- Constraint satisfaction
