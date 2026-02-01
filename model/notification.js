const mongoose = require('mongoose');

const notification = new mongoose.Schema({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'assignment',
        required: true
    },
    type: {
        type: String,
        enum: ['submission', 'resubmission', 'approval', 'rejection', 'forwarding'],
        required: true
    },
    title: String,
    message: String,
    // In-app notification delivery
    isRead: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    // Email delivery status
    emailSent: {
        type: Boolean,
        default: false
    },
    emailSentAt: {
        type: Date,
        default: null
    },
    emailError: String,
    // Actor who triggered this notification
    triggeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const notificationModel = mongoose.model("notification", notification);

module.exports = notificationModel;
