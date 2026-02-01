const { Router } = require("express");
const professorController = require('../controllers/professorController');
const { reviewerOnly } = require('../middleware/rbac');

const professorRoute = Router();

// Protect all professor/HOD routes
professorRoute.use(reviewerOnly);

// Dashboard
professorRoute.get("/dashboard", professorController.reviewerDashboard);

// Review workflow
professorRoute.get("/assignments/:assignmentId/review", professorController.reviewAssignmentGet);

// Approval
professorRoute.post("/assignments/:assignmentId/approve", professorController.approveAssignmentPost);
professorRoute.post("/assignments/:assignmentId/verify-approval-otp", professorController.verifyApprovalOTP);

// Rejection
professorRoute.post("/assignments/:assignmentId/reject", professorController.rejectAssignmentPost);

// Forward
professorRoute.post("/assignments/:assignmentId/forward", professorController.forwardAssignmentPost);

// Review history
professorRoute.get("/review-history", professorController.reviewHistory);

// Notifications
professorRoute.post("/notifications/:notificationId/read", professorController.markNotificationAsRead);

module.exports = professorRoute;
