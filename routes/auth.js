const { Router } = require("express");
const authController = require('../controllers/authController');

const authRoute = Router();

// Public routes
authRoute.get("/", authController.loginPageGet);
authRoute.get("/forgot-password", authController.forgotPasswordGet);
authRoute.post("/forgot-password/otp", authController.forgotPasswordOTPGeneration);
authRoute.post("/forgot-password/verify-otp", authController.forgotPasswordVerifyOTP);
authRoute.post("/login", authController.universalLoginPost);

// Logout (protected)
authRoute.get("/logout", authController.logout);
module.exports = authRoute;