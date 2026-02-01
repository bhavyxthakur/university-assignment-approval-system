const assignmentModel = require('../model/assignment');
const assignmentHistoryModel = require('../model/assignmentHistory');
const userModel = require('../model/user');
const notificationModel = require('../model/notification');
const { sendMessage } = require('../config/nodemailer');
const crypto = require('crypto');

// ============= PROFESSOR/HOD DASHBOARD =============

module.exports.reviewerDashboard = async (req, res) => {
    try {
        const reviewerId = req.session.userId;
        const departmentId = req.session.departmentId;

        // Get pending reviews (Submitted and Forwarded assignments)
        const pendingReviews = await assignmentModel
            .find({
                reviewerId: reviewerId,
                status: { $in: ['Submitted', 'Forwarded'] }
            })
            .populate('studentId', 'name email')
            .sort({ submittedAt: 1 });  // Oldest first

        // Calculate days pending
        const reviewsWithAge = pendingReviews.map(review => ({
            ...review.toObject(),
            daysPending: Math.floor((Date.now() - review.submittedAt) / (1000 * 60 * 60 * 24))
        }));

        // Get notifications
        const notifications = await notificationModel
            .find({ recipientId: reviewerId, isRead: false })
            .limit(10)
            .sort({ createdAt: -1 });

        const stats = {
            pendingCount: pendingReviews.length,
            totalReviewed: await assignmentModel.countDocuments({
                reviewerId: reviewerId,
                status: { $in: ['Approved', 'Rejected'] }
            })
        };

        res.render('professorDashboard', {
            pendingReviews: reviewsWithAge,
            notifications,
            stats,
            userName: req.session.email
        });
    } catch (err) {
        console.error("Reviewer dashboard error:", err);
        res.status(500).render('error', { error: "Error loading dashboard" });
    }
};

// ============= REVIEW PAGE =============

module.exports.reviewAssignmentGet = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const reviewerId = req.session.userId;

        // Get assignment
        const assignment = await assignmentModel
            .findById(assignmentId)
            .populate('studentId', 'name email')
            .populate({
                path: 'history',
                model: 'assignmentHistory',
                populate: [
                    { path: 'actorId', model: 'user', select: 'name' },
                    { path: 'forwardedToId', model: 'user', select: 'name' }
                ]
            });

        if (!assignment) {
            return res.status(404).render('error', { error: "Assignment not found" });
        }

        // Verify reviewer access
        if (assignment.reviewerId.toString() !== reviewerId.toString()) {
            return res.status(403).render('error', { error: "Not authorized to review this assignment" });
        }

        // Can only review Submitted or Forwarded assignments
        if (!['Submitted', 'Forwarded'].includes(assignment.status)) {
            return res.status(400).render('error', {
                error: "This assignment cannot be reviewed in its current status"
            });
        }

        // Get other reviewers in department (for forwarding)
        const otherReviewers = await userModel.find({
            departmentId: assignment.departmentId,
            role: { $in: ['Professor', 'HOD'] },
            _id: { $ne: reviewerId },
            status: 'active'
        });

        res.render('reviewAssignment', {
            assignment,
            otherReviewers,
            error: null
        });
    } catch (err) {
        console.error("Review assignment get error:", err);
        res.status(500).render('error', { error: "Error loading assignment" });
    }
};

// ============= APPROVE ACTION =============

module.exports.approveAssignmentPost = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { remarks, signature } = req.body;
        const reviewerId = req.session.userId;

        // Get assignment
        const assignment = await assignmentModel.findById(assignmentId);

        if (!assignment) {
            return res.status(404).json({ error: "Assignment not found" });
        }

        // Verify reviewer
        if (assignment.reviewerId.toString() !== reviewerId.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Can only approve Submitted or Forwarded
        if (!['Submitted', 'Forwarded'].includes(assignment.status)) {
            return res.status(400).json({ error: "Assignment cannot be approved in this status" });
        }

        // Send OTP to reviewer email
        const otp = Math.floor(100000 + Math.random() * 900000);
        req.session.approvalOtp = otp;
        req.session.approvalAssignmentId = assignmentId;
        req.session.approvalRemarks = remarks;
        req.session.approvalSignature = signature;
        req.session.otpExpiry = Date.now() + 10 * 60 * 1000;  // 10 minutes

        const reviewer = await userModel.findById(reviewerId);

        console.log(`OTP for approval: ${otp}`);

        // Send OTP email
        await sendMessage({
            email: reviewer.email,
            pass: `Your approval OTP is: ${otp}. Valid for 10 minutes.`,
            role: reviewer.role
        });

        res.json({
            success: true,
            message: "OTP sent to your email. Please verify to complete approval."
        });
    } catch (err) {
        console.error("Approval initiation error:", err);
        res.status(500).json({ error: "Error initiating approval" });
    }
};

module.exports.verifyApprovalOTP = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { otp } = req.body;
        const reviewerId = req.session.userId;

        // Check OTP
        if (!req.session.approvalOtp || !req.session.approvalAssignmentId) {
            return res.status(400).json({ error: "No approval in progress" });
        }

        if (Date.now() > req.session.otpExpiry) {
            delete req.session.approvalOtp;
            return res.status(400).json({ error: "OTP expired" });
        }

        if (parseInt(otp) !== req.session.approvalOtp) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        // OTP verified - proceed with approval
        const assignment = await assignmentModel.findById(assignmentId);

        const previousStatus = assignment.status;
        assignment.status = 'Approved';
        await assignment.save();

        // Add history entry
        const historyEntry = await assignmentHistoryModel.create({
            assignmentId: assignment._id,
            actorId: reviewerId,
            actorRole: req.session.role,
            action: 'approve',
            previousStatus: previousStatus,
            newStatus: 'Approved',
            remarks: req.session.approvalRemarks,
            signature: req.session.approvalSignature,
            timestamp: new Date()
        });

        assignment.history.push(historyEntry._id);
        await assignment.save();

        // Create notification for student
        await notificationModel.create({
            recipientId: assignment.studentId,
            assignmentId: assignment._id,
            type: 'approval',
            title: 'Assignment Approved',
            message: `Your assignment "${assignment.title}" has been approved.`,
            triggeredBy: reviewerId
        });

        // TODO: Send email to student

        // Clear approval session data
        delete req.session.approvalOtp;
        delete req.session.approvalAssignmentId;
        delete req.session.approvalRemarks;
        delete req.session.approvalSignature;

        res.json({
            success: true,
            message: "Assignment approved successfully"
        });
    } catch (err) {
        console.error("Approval verification error:", err);
        res.status(500).json({ error: "Error completing approval" });
    }
};

// ============= REJECT ACTION =============

module.exports.rejectAssignmentPost = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { remarks } = req.body;
        const reviewerId = req.session.userId;

        if (!remarks || remarks.trim().length < 10) {
            return res.status(400).json({
                error: "Rejection remarks must be at least 10 characters"
            });
        }

        // Get assignment
        const assignment = await assignmentModel.findById(assignmentId);

        if (!assignment) {
            return res.status(404).json({ error: "Assignment not found" });
        }

        // Verify reviewer
        if (assignment.reviewerId.toString() !== reviewerId.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Can only reject Submitted or Forwarded
        if (!['Submitted', 'Forwarded'].includes(assignment.status)) {
            return res.status(400).json({ error: "Assignment cannot be rejected in this status" });
        }

        // Update assignment
        const previousStatus = assignment.status;
        assignment.status = 'Rejected';
        assignment.reviewerId = null;  // Clear reviewer
        await assignment.save();

        // Add history entry
        const historyEntry = await assignmentHistoryModel.create({
            assignmentId: assignment._id,
            actorId: reviewerId,
            actorRole: req.session.role,
            action: 'reject',
            previousStatus: previousStatus,
            newStatus: 'Rejected',
            remarks: remarks.trim(),
            timestamp: new Date()
        });

        assignment.history.push(historyEntry._id);
        await assignment.save();

        // Create notification for student
        await notificationModel.create({
            recipientId: assignment.studentId,
            assignmentId: assignment._id,
            type: 'rejection',
            title: 'Assignment Rejected',
            message: `Your assignment "${assignment.title}" was rejected. Feedback: ${remarks}`,
            triggeredBy: reviewerId
        });

        // TODO: Send email to student

        res.json({
            success: true,
            message: "Assignment rejected and student notified"
        });
    } catch (err) {
        console.error("Rejection error:", err);
        res.status(500).json({ error: "Error rejecting assignment" });
    }
};

// ============= FORWARD ACTION =============

module.exports.forwardAssignmentPost = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { forwardedToId, forwardingNote } = req.body;
        const reviewerId = req.session.userId;

        // Get assignment
        const assignment = await assignmentModel.findById(assignmentId);

        if (!assignment) {
            return res.status(404).json({ error: "Assignment not found" });
        }

        // Verify current reviewer
        if (assignment.reviewerId.toString() !== reviewerId.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Can only forward Submitted or Forwarded
        if (!['Submitted', 'Forwarded'].includes(assignment.status)) {
            return res.status(400).json({ error: "Assignment cannot be forwarded in this status" });
        }

        // Verify new reviewer
        const newReviewer = await userModel.findById(forwardedToId);

        if (!newReviewer || newReviewer.departmentId.toString() !== assignment.departmentId.toString() ||
            !['Professor', 'HOD'].includes(newReviewer.role) || newReviewer.status !== 'active') {
            return res.status(400).json({ error: "Invalid reviewer selected" });
        }

        // Cannot forward to same person
        if (forwardedToId === reviewerId) {
            return res.status(400).json({ error: "Cannot forward to same reviewer" });
        }

        // Update assignment
        const previousStatus = assignment.status;
        assignment.status = 'Forwarded';
        assignment.reviewerId = forwardedToId;
        await assignment.save();

        // Add history entry
        const historyEntry = await assignmentHistoryModel.create({
            assignmentId: assignment._id,
            actorId: reviewerId,
            actorRole: req.session.role,
            action: 'forward',
            previousStatus: previousStatus,
            newStatus: 'Forwarded',
            remarks: forwardingNote || 'Forwarded for review',
            forwardedToId: forwardedToId,
            timestamp: new Date()
        });

        assignment.history.push(historyEntry._id);
        await assignment.save();

        // Create notification for new reviewer
        await notificationModel.create({
            recipientId: forwardedToId,
            assignmentId: assignment._id,
            type: 'forwarding',
            title: 'Assignment Forwarded',
            message: `Assignment "${assignment.title}" forwarded by ${(await userModel.findById(reviewerId)).name}. Note: ${forwardingNote}`,
            triggeredBy: reviewerId
        });

        // TODO: Send email to new reviewer

        res.json({
            success: true,
            message: "Assignment forwarded successfully"
        });
    } catch (err) {
        console.error("Forwarding error:", err);
        res.status(500).json({ error: "Error forwarding assignment" });
    }
};

// ============= REVIEW HISTORY =============

module.exports.reviewHistory = async (req, res) => {
    try {
        const reviewerId = req.session.userId;

        // Get all assignments reviewed by this person
        const reviewed = await assignmentModel
            .find({
                reviewerId: reviewerId,
                status: { $in: ['Approved', 'Rejected'] }
            })
            .populate('studentId', 'name email')
            .sort({ submittedAt: -1 })
            .limit(50);

        res.render('reviewHistory', { reviewed });
    } catch (err) {
        console.error("Review history error:", err);
        res.status(500).render('error', { error: "Error loading history" });
    }
};

module.exports.markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        await notificationModel.findByIdAndUpdate(notificationId, {
            isRead: true,
            readAt: new Date()
        });

        res.json({ success: true });
    } catch (err) {
        console.error("Mark notification error:", err);
        res.status(500).json({ error: "Error updating notification" });
    }
};
