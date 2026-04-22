const { Router } = require("express");
const authController = require('../controllers/authController');

const authRoute = Router();

// Public routes - Admin login
authRoute.get("/", authController.loginPageGet);
authRoute.post("/login", authController.universalLoginPost);

// Public routes - Student/Professor/HOD login
authRoute.get("/user/login", (req, res) => {
    if (req.session.isLoggedIn) {
        return res.redirect("/student/dashboard");
    }
    res.render("userLogin", { error: null });
});
authRoute.post("/user/login", authController.universalLoginPost);

// Password reset
authRoute.get("/forgot-password", authController.forgotPasswordGet);
authRoute.post("/forgot-password/otp", authController.forgotPasswordOTPGeneration);
authRoute.post("/forgot-password/verify-otp", authController.forgotPasswordVerifyOTP);

// Logout (protected)
authRoute.get("/logout", authController.logout);

module.exports = authRoute;