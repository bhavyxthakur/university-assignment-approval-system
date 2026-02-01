const { Router } = require("express");
const studentController = require('../controllers/studentController');
const { studentOnly } = require('../middleware/rbac');
const multer = require('multer');
const path = require('path');

const studentRoute = Router();

// Protect all student routes
studentRoute.use(studentOnly);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/assignments/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only PDF files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }  // 10MB
});

// Dashboard
studentRoute.get("/dashboard", studentController.studentDashboard);

// Assignment submission
studentRoute.get("/assignments/submit", studentController.assignmentSubmissionGet);
studentRoute.post("/assignments/create", studentController.assignmentCreationPost);

// Assignment list and details
studentRoute.get("/assignments", studentController.assignmentList);
studentRoute.get("/assignments/:assignmentId/details", studentController.assignmentDetails);

// File upload
studentRoute.post("/assignments/:assignmentId/upload", upload.single('file'), studentController.uploadFile);

// File download
studentRoute.get("/assignments/:assignmentId/files/:fileId/download", studentController.downloadFile);

// Submission workflow
studentRoute.get("/assignments/:assignmentId/submit", studentController.submitAssignmentGet);
studentRoute.post("/assignments/:assignmentId/submit", studentController.submitAssignmentPost);

// Resubmission (for rejected assignments)
studentRoute.get("/assignments/:assignmentId/resubmit", studentController.resubmitAssignmentGet);
studentRoute.post("/assignments/:assignmentId/resubmit", upload.single('file'), studentController.resubmitAssignmentPost);

// Notifications
studentRoute.post("/notifications/:notificationId/read", studentController.markNotificationAsRead);

module.exports = studentRoute;
