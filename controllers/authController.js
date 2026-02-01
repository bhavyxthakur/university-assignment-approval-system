const { sendMessage } = require("../config/nodemailer");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const userModel = require("../model/user");

// Admin login - hardcoded credentials for system bootstrap
// In production, this should be encrypted or use a secure initialization flow
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@university.edu";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;  // Set via env var

module.exports.loginPageGet = (req, res) => {
    if (req.session.isLoggedIn) {
        // User is already logged in, redirect based on role
        return redirectByRole(req, res);
    }
    res.render("login", { error: null });
};


// Universal login for all roles
module.exports.universalLoginPost = async (req, res) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).render("login", { error: "Email and password are required" });
        }
        // Find user by email
        const user = await userModel.findOne({ email: email.trim() });
        if (!user) {
            return res.status(401).render("login", { error: "Invalid credentials" });
        }
        if (user.status !== 'active') {
            return res.status(403).render("login", { error: "Your account is inactive" });
        }
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(401).render("login", { error: "Invalid credentials" });
        }
        // Set session
        req.session.isLoggedIn = true;
        req.session.userId = user._id;
        req.session.role = user.role;
        req.session.email = user.email;
        req.session.departmentId = user.departmentId;
        // Redirect based on role
        redirectByRole(req, res);
    } catch (err) {
        console.error("Universal login error:", err);
        res.status(500).render("login", { error: "Authentication failed" });
    }
};

module.exports.forgotPasswordGet = (req, res) => {
    res.render("forgotPassword", { error: null });
};

module.exports.forgotPasswordOTPGeneration = async (req, res) => {
    const { email } = req.body;

    try {
        // Find user by email
        const user = await userModel.findOne({ email: email.trim() });

        if (!user) {
            // Don't reveal if email exists
            return res.render("verifyotp", { error: null, masked: true });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000);

        // Store in session (in production, use Redis with expiry)
        req.session.resetOtp = otp;
        req.session.resetEmail = user.email;
        req.session.otpExpiry = Date.now() + 10 * 60 * 1000;  // 10 minutes

        console.log(`OTP for ${email}: ${otp}`);

        // Send OTP via email
        await sendMessage({
            email: user.email,
            pass: `Your password reset OTP is: ${otp}. Valid for 10 minutes.`,
            role: user.role,
        });

        res.render("verifyotp", { error: null, masked: false });
    } catch (err) {
        console.error("OTP generation error:", err);
        res.render("forgotPassword", { error: "Error sending OTP. Please try again." });
    }
};

module.exports.forgotPasswordVerifyOTP = async (req, res) => {
    const { otp } = req.body;

    try {
        // Check OTP validity
        if (!req.session.resetOtp || !req.session.resetEmail) {
            return res.render("verifyotp", { error: "OTP session expired" });
        }

        if (Date.now() > req.session.otpExpiry) {
            delete req.session.resetOtp;
            delete req.session.resetEmail;
            return res.render("verifyotp", { error: "OTP expired. Request a new one." });
        }

        if (parseInt(otp) !== req.session.resetOtp) {
            return res.render("verifyotp", { error: "Invalid OTP" });
        }

        // OTP verified - generate new password
        const newPassword = crypto.randomBytes(10).toString("base64url");
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update user password
        const user = await userModel.findOne({ email: req.session.resetEmail });
        user.passwordHash = passwordHash;
        await user.save();

        // Send new password via email
        await sendMessage({
            email: user.email,
            pass: `Your new password is: ${newPassword}`,
            role: user.role,
        });

        // Clear session
        delete req.session.resetOtp;
        delete req.session.resetEmail;
        delete req.session.otpExpiry;

        res.render("login", { error: "Password reset successful. Check your email for new password." });
    } catch (err) {
        console.error("OTP verification error:", err);
        res.render("verifyotp", { error: "Verification failed. Please try again." });
    }
};

// Unified user login (Student/Professor/HOD)

// Helper function to redirect based on role
const redirectByRole = (req, res) => {
    const role = req.session.role;

    switch (role) {
        case 'Admin':
            return res.redirect("/admin/dashboard");
        case 'Student':
            return res.redirect("/student/dashboard");
        case 'Professor':
        case 'HOD':
            return res.redirect("/professor/dashboard");
        default:
            return res.redirect("/");
    }
};

module.exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Session destruction error:", err);
            return res.status(500).send("Logout failed");
        }
        res.redirect("/");
    });
};

module.exports.redirectByRole = redirectByRole;
