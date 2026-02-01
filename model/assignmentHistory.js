const mongoose = require('mongoose');

// Immutable append-only audit log for assignments
const assignmentHistory = new mongoose.Schema({
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'assignment',
        required: true
    },
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    actorRole: {
        type: String,
        enum: ['Admin', 'Student', 'Professor', 'HOD'],
        required: true
    },
    action: {
        type: String,
        enum: ['create', 'submit', 'approve', 'reject', 'forward', 'resubmit'],
        required: true
    },
    previousStatus: String,
    newStatus: String,
    remarks: String,  // Optional notes/feedback
    // Forwarding metadata (if action is 'forward')
    forwardedToId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        default: null
    },
    // Digital signature (hash or text)
    signature: {
        type: String,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now,
        immutable: true
    }
});

// Prevent any updates or deletions on history records
assignmentHistory.pre('findByIdAndUpdate', function(next) {
    return next(new Error('Assignment history is immutable and cannot be modified'));
});

assignmentHistory.pre('findByIdAndDelete', function(next) {
    return next(new Error('Assignment history is immutable and cannot be deleted'));
});

assignmentHistory.pre('updateOne', function(next) {
    return next(new Error('Assignment history is immutable and cannot be modified'));
});

const assignmentHistoryModel = mongoose.model("assignmentHistory", assignmentHistory);

module.exports = assignmentHistoryModel;
