const mongoose = require('mongoose');

const assignment = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Assignment', 'Thesis', 'Report'],
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'department',
        required: true
    },
    // Current reviewer (professor or HOD)
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    // File metadata
    files: [
        {
            filename: String,
            originalName: String,
            fileSize: Number,
            uploadedAt: {
                type: Date,
                default: Date.now
            },
            storagePath: String,  // local path or S3 key
            version: {
                type: Number,
                default: 1
            }
        }
    ],
    // Workflow state machine
    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Forwarded'],
        default: 'Draft'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    submittedAt: {
        type: Date,
        default: null
    },
    // Immutable audit reference - stores all state changes
    history: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'assignmentHistory'
        }
    ]
});

// Ensure immutability of status transitions through hooks
assignment.pre('findByIdAndUpdate', function(next) {
    // Status changes must go through dedicated workflow endpoints, not direct updates
    if (this._update && this._update.status && this._update.status !== 'Draft') {
        return next(new Error('Status transitions must use workflow endpoints'));
    }
    next();
});

const assignmentModel = mongoose.model("assignment", assignment);

module.exports = assignmentModel;
