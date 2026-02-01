const assignmentModel = require('../model/assignment');
const assignmentHistoryModel = require('../model/assignmentHistory');
const userModel = require('../model/user');
const notificationModel = require('../model/notification');
const { sendMessage } = require('../config/nodemailer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ============= STUDENT DASHBOARD =============

module.exports.studentDashboard = async (req, res) => {
    try {
        const studentId = req.session.userId;

        // Get assignment counts by status
        const statusCounts = {
            Draft: await assignmentModel.countDocuments({ studentId, status: 'Draft' }),
            Submitted: await assignmentModel.countDocuments({ studentId, status: 'Submitted' }),
            Approved: await assignmentModel.countDocuments({ studentId, status: 'Approved' }),
            Rejected: await assignmentModel.countDocuments({ studentId, status: 'Rejected' }),
            Forwarded: await assignmentModel.countDocuments({ studentId, status: 'Forwarded' })
        };

        // Get recent submissions (last 5)
        const recentSubmissions = await assignmentModel
            .find({ studentId })
            .sort({ submittedAt: -1 })
            .limit(5)
            .populate('reviewerId', 'name');

        // Get pending notifications
        const notifications = await notificationModel
            .find({ recipientId: studentId, isRead: false })
            .limit(10)
            .sort({ createdAt: -1 });

        res.render('studentDashboard', {
            statusCounts,
            recentSubmissions,
            notifications,
            userName: req.session.email
        });
    } catch (err) {
        console.error("Student dashboard error:", err);
        res.status(500).render('error', { error: "Error loading dashboard" });
    }
};

// ============= ASSIGNMENT CREATION =============

module.exports.assignmentSubmissionGet = (req, res) => {
    try {
        res.render("submitAssignment", { error: null });
    } catch (err) {
        console.error("Assignment submission page error:", err);
        res.status(500).render('error', { error: "Error loading form" });
    }
};

module.exports.assignmentCreationPost = async (req, res) => {
    try {
        const { title, description, category } = req.body;
        const studentId = req.session.userId;
        const departmentId = req.session.departmentId;

        // Validate required fields
        if (!title || !description || !category) {
            return res.render("createAssignment", {
                error: "Title, description, and category are required"
            });
        }

        // Validate category
        if (!['Assignment', 'Thesis', 'Report'].includes(category)) {
            return res.render("createAssignment", {
                error: "Invalid category"
            });
        }

        // Create assignment in Draft status
        const assignment = await assignmentModel.create({
            title: title.trim(),
            description: description.trim(),
            category: category,
            studentId: studentId,
            departmentId: departmentId,
            status: 'Draft',
            files: []
        });

        // Add history entry
        await assignmentHistoryModel.create({
            assignmentId: assignment._id,
            actorId: studentId,
            actorRole: 'Student',
            action: 'create',
            previousStatus: null,
            newStatus: 'Draft',
            timestamp: new Date()
        });

        res.render("createAssignment", {
            error: `Assignment "${assignment.title}" created in Draft status. Assignment ID: ${assignment._id}`
        });
    } catch (err) {
        console.error("Assignment creation error:", err);
        res.render("createAssignment", {
            error: "Error creating assignment"
        });
    }
};

// ============= ASSIGNMENT FILE UPLOAD =============

module.exports.uploadFile = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "No file provided" });
        }

        // Validate file type (PDF only)
        if (file.mimetype !== 'application/pdf') {
            await fs.unlink(file.path);
            return res.status(400).json({ error: "Only PDF files are allowed" });
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024;  // 10MB
        if (file.size > maxSize) {
            await fs.unlink(file.path);
            return res.status(400).json({
                error: `File size exceeds 10MB limit. Uploaded: ${(file.size / 1024 / 1024).toFixed(2)}MB`
            });
        }

        // Get assignment
        const assignment = await assignmentModel.findById(assignmentId);
        if (!assignment) {
            await fs.unlink(file.path);
            return res.status(404).json({ error: "Assignment not found" });
        }

        // Ensure ownership
        if (assignment.studentId.toString() !== req.session.userId.toString()) {
            await fs.unlink(file.path);
            return res.status(403).json({ error: "Not authorized" });
        }

        // Only Draft assignments can have files added
        if (assignment.status !== 'Draft') {
            await fs.unlink(file.path);
            return res.status(400).json({
                error: "Can only upload files to Draft assignments"
            });
        }

        // Add file metadata
        const fileDoc = {
            filename: file.filename,
            originalName: file.originalname,
            fileSize: file.size,
            storagePath: file.path,
            uploadedAt: new Date(),
            version: assignment.files.length + 1
        };

        assignment.files.push(fileDoc);
        await assignment.save();

        res.json({
            success: true,
            message: "File uploaded successfully",
            file: fileDoc
        });
    } catch (err) {
        console.error("File upload error:", err);
        res.status(500).json({ error: "Error uploading file" });
    }
};

// ============= ASSIGNMENT SUBMISSION =============

module.exports.submitAssignmentGet = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const studentId = req.session.userId;

        // Get assignment
        const assignment = await assignmentModel.findById(assignmentId).populate('studentId');

        // Verify ownership
        if (assignment.studentId._id.toString() !== studentId.toString()) {
            return res.status(403).render('error', { error: "Not authorized" });
        }

        // Can only submit Draft assignments
        if (assignment.status !== 'Draft') {
            return res.status(400).render('error', {
                error: "Only Draft assignments can be submitted"
            });
        }

        // Must have at least one file
        if (assignment.files.length === 0) {
            return res.status(400).render('error', {
                error: "Must upload at least one file before submitting"
            });
        }

        // Get professors and HODs in the same department
        const reviewers = await userModel.find({
            departmentId: assignment.departmentId,
            role: { $in: ['Professor', 'HOD'] },
            status: 'active'
        });

        res.render("submitAssignment", { assignment, reviewers, error: null });
    } catch (err) {
        console.error("Submit assignment get error:", err);
        res.status(500).render('error', { error: "Error loading submission form" });
    }
};

module.exports.submitAssignmentPost = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { reviewerId } = req.body;
        const studentId = req.session.userId;

        // Get assignment
        const assignment = await assignmentModel.findById(assignmentId);

        // Verify ownership and status
        if (assignment.studentId.toString() !== studentId.toString()) {
            return res.status(403).render('error', { error: "Not authorized" });
        }

        if (assignment.status !== 'Draft') {
            return res.status(400).render('error', {
                error: "Only Draft assignments can be submitted"
            });
        }

        // Verify reviewer exists and is in same department
        const reviewer = await userModel.findById(reviewerId);
        if (!reviewer || reviewer.departmentId.toString() !== assignment.departmentId.toString() ||
            !['Professor', 'HOD'].includes(reviewer.role)) {
            return res.status(400).render('error', {
                error: "Invalid reviewer selected"
            });
        }

        // Update assignment
        assignment.status = 'Submitted';
        assignment.submittedAt = new Date();
        assignment.reviewerId = reviewerId;
        await assignment.save();

        // Add history entry
        const historyEntry = await assignmentHistoryModel.create({
            assignmentId: assignment._id,
            actorId: studentId,
            actorRole: 'Student',
            action: 'submit',
            previousStatus: 'Draft',
            newStatus: 'Submitted',
            timestamp: new Date()
        });

        assignment.history.push(historyEntry._id);
        await assignment.save();

        // Create notification for reviewer
        await notificationModel.create({
            recipientId: reviewerId,
            assignmentId: assignment._id,
            type: 'submission',
            title: 'New Assignment Submitted',
            message: `Student has submitted assignment: "${assignment.title}"`,
            triggeredBy: studentId
        });

        // TODO: Send email notification

        res.redirect("/student/assignments");
    } catch (err) {
        console.error("Submit assignment error:", err);
        res.status(500).render('error', { error: "Error submitting assignment" });
    }
};

// ============= ASSIGNMENT LIST & VIEW =============

module.exports.assignmentList = async (req, res) => {
    try {
        const studentId = req.session.userId;
        const filterStatus = req.query.status || null;
        const sortBy = req.query.sort || 'submittedAt';

        let query = { studentId };
        if (filterStatus) {
            query.status = filterStatus;
        }

        const assignments = await assignmentModel
            .find(query)
            .populate('reviewerId', 'name')
            .sort({ [sortBy]: -1 });

        res.render("assignmentList", {
            assignments,
            filterStatus,
            statusOptions: ['Draft', 'Submitted', 'Approved', 'Rejected', 'Forwarded']
        });
    } catch (err) {
        console.error("Assignment list error:", err);
        res.status(500).render('error', { error: "Error loading assignments" });
    }
};

module.exports.assignmentDetails = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const studentId = req.session.userId;

        // Get assignment with full history
        const assignment = await assignmentModel
            .findById(assignmentId)
            .populate('studentId', 'name email')
            .populate('reviewerId', 'name email')
            .populate({
                path: 'history',
                model: 'assignmentHistory',
                populate: [
                    { path: 'actorId', model: 'user', select: 'name' },
                    { path: 'forwardedToId', model: 'user', select: 'name' }
                ]
            });

        // Verify ownership or reviewer access
        if (assignment.studentId._id.toString() !== studentId.toString() &&
            assignment.reviewerId._id.toString() !== studentId.toString()) {
            return res.status(403).render('error', { error: "Not authorized" });
        }

        res.render("assignmentDetails", { assignment });
    } catch (err) {
        console.error("Assignment details error:", err);
        res.status(500).render('error', { error: "Error loading assignment details" });
    }
};

// ============= RESUBMISSION FLOW =============

module.exports.resubmitAssignmentGet = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const studentId = req.session.userId;

        const assignment = await assignmentModel.findById(assignmentId);

        // Verify ownership
        if (assignment.studentId.toString() !== studentId.toString()) {
            return res.status(403).render('error', { error: "Not authorized" });
        }

        // Can only resubmit rejected assignments
        if (assignment.status !== 'Rejected') {
            return res.status(400).render('error', {
                error: "Only rejected assignments can be resubmitted"
            });
        }

        res.render("resubmitAssignment", { assignment, error: null });
    } catch (err) {
        console.error("Resubmit assignment get error:", err);
        res.status(500).render('error', { error: "Error loading form" });
    }
};

module.exports.resubmitAssignmentPost = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { description, keepOriginal } = req.body;
        const studentId = req.session.userId;
        const file = req.file;

        const assignment = await assignmentModel.findById(assignmentId);

        // Verify ownership and status
        if (assignment.studentId.toString() !== studentId.toString()) {
            return res.status(403).render('error', { error: "Not authorized" });
        }

        if (assignment.status !== 'Rejected') {
            return res.status(400).render('error', {
                error: "Only rejected assignments can be resubmitted"
            });
        }

        // Update description if provided
        if (description) {
            assignment.description = description.trim();
        }

        // Handle file upload
        if (file) {
            // Validate file
            if (file.mimetype !== 'application/pdf') {
                await fs.unlink(file.path);
                return res.status(400).render('error', { error: "Only PDF files allowed" });
            }

            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                await fs.unlink(file.path);
                return res.status(400).render('error', { error: "File too large" });
            }

            // If not keeping original, archive old files
            if (keepOriginal !== 'true') {
                assignment.files = [];
            }

            // Add new file with incremented version
            const maxVersion = assignment.files.reduce((max, f) => Math.max(max, f.version), 0);
            assignment.files.push({
                filename: file.filename,
                originalName: file.originalname,
                fileSize: file.size,
                storagePath: file.path,
                uploadedAt: new Date(),
                version: maxVersion + 1
            });
        }

        // Reset status to Submitted and keep original reviewer
        assignment.status = 'Submitted';
        assignment.submittedAt = new Date();
        await assignment.save();

        // Add history entry
        const historyEntry = await assignmentHistoryModel.create({
            assignmentId: assignment._id,
            actorId: studentId,
            actorRole: 'Student',
            action: 'resubmit',
            previousStatus: 'Rejected',
            newStatus: 'Submitted',
            remarks: `Resubmitted${file ? ' with new file' : ' with same file'}`,
            timestamp: new Date()
        });

        assignment.history.push(historyEntry._id);
        await assignment.save();

        // Notify reviewer
        await notificationModel.create({
            recipientId: assignment.reviewerId,
            assignmentId: assignment._id,
            type: 'resubmission',
            title: 'Assignment Resubmitted',
            message: `Student resubmitted: "${assignment.title}"`,
            triggeredBy: studentId
        });

        res.redirect("/student/assignments");
    } catch (err) {
        console.error("Resubmit assignment error:", err);
        res.status(500).render('error', { error: "Error resubmitting assignment" });
    }
};

// ============= FILE DOWNLOAD =============

module.exports.downloadFile = async (req, res) => {
    try {
        const { assignmentId, fileId } = req.params;
        const userId = req.session.userId;

        const assignment = await assignmentModel.findById(assignmentId);

        // Verify access: student (owner) or assigned reviewer
        if (assignment.studentId.toString() !== userId.toString() &&
            assignment.reviewerId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Not authorized" });
        }

        // Find file
        const file = assignment.files.find(f => f._id.toString() === fileId);
        if (!file) {
            return res.status(404).json({ error: "File not found" });
        }

        // Send file
        res.download(file.storagePath, file.originalName);
    } catch (err) {
        console.error("File download error:", err);
        res.status(500).json({ error: "Error downloading file" });
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
