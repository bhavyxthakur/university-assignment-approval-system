const mongoose = require('mongoose');

const department = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    programType: {
        type: String,
        enum: ['UG', 'PG', 'Research'],
        required: true
    },
    address: {
        type: String,
        required: true
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

const departmentModel = mongoose.model("department", department);

module.exports = departmentModel;
