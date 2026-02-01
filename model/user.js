const mongoose = require('mongoose');

const user = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Admin', 'Student', 'Professor', 'HOD'],
        required: true,
        immutable: true  // Role cannot be changed after creation
    },
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'department',
        required: function() {
            // Admin doesn't need department
            return this.role !== 'Admin';
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const userModel = mongoose.model("user", user);

module.exports = userModel;