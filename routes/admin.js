const { Router } = require("express");
const adminController = require('../controllers/adminController');
const { adminOnly } = require('../middleware/rbac');

const adminRoutes = Router();

// Protect all admin routes
adminRoutes.use(adminOnly);

// Dashboard
adminRoutes.get("/dashboard", adminController.adminDashboard);

// Department routes
adminRoutes.get("/departments/create", adminController.departmentCreationGet);
adminRoutes.post("/departments/create", adminController.departmentCreationPost);
adminRoutes.get("/departments/list", adminController.departmentListGet);
adminRoutes.post("/departments/delete/:id", adminController.departmentDeleteGet);
adminRoutes.get("/departments/edit/:id", adminController.departmentEditGet);
adminRoutes.post("/departments/edit/:id", adminController.departmentEditPost);

// User routes
adminRoutes.get("/users/create", adminController.userCreationGet);
adminRoutes.post("/users/create", adminController.userCreationPost);
adminRoutes.get("/users/list", adminController.userListGet);
adminRoutes.post("/users/delete/:id", adminController.userDeletePost);
adminRoutes.get("/users/edit/:id", adminController.userEditGet);
adminRoutes.post("/users/edit/:id", adminController.userEditPost);

module.exports = adminRoutes;