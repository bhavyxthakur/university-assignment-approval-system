const express = require('express');
const session = require('express-session');
const path = require('path');
const { connectMongo } = require('./config/connectDb');

// Routes
const authRoute = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');
const professorRoutes = require('./routes/professor');

const app = express();

// Connect to MongoDB
connectMongo();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// View engine
app.set("view engine", "ejs");
app.set("views", "./views");

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || "university-secret-key-change-in-production",
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000  // 24 hours
    }
}));

// Routes
app.use("/", authRoute);
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);
app.use("/professor", professorRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err);
    res.status(err.status || 500).render('error', {
        error: err.message || "An unexpected error occurred"
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', { error: "Page not found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("server running");
});
