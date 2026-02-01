const departmentModel = require('../model/department');
const userModel = require('../model/user');
const assignmentModel = require('../model/assignment');
const bcrypt = require('bcrypt');

// ============= DEPARTMENT MANAGEMENT =============

module.exports.departmentCreationGet = (req, res) => {
    res.render("createDepartment", { error: null });
};

module.exports.departmentCreationPost = async (req, res) => {
    console.log(req.body);
    try {
        const { name, type, address } = req.body;

        // Validate required fields
        if (!name || !type || !address) {
            return res.render("createDepartment", { error: "All fields are required" });
        }

        // Check if department already exists (by name)
        const depFound = await departmentModel.findOne({ name: name.trim() });
        if (depFound) {
            return res.render("createDepartment", { error: "Department already exists" });
        }

        // Validate program type
        if (!['UG', 'PG', 'Research'].includes(type)) {
            return res.render("createDepartment", { error: "Invalid program type" });
        }

        // Create department
        await departmentModel.create({
            name: name.trim(),
            programType: type,
            address: address.trim()
        });

        res.render("createDepartment", { error: "Department created successfully" });
    } catch (err) {
        console.error("Department creation error:", err);
        res.render("createDepartment", { error: "Error creating department" });
    }
};

module.exports.departmentListGet = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalDocs = await departmentModel.countDocuments();
        const departments = await departmentModel.find().skip(skip).limit(limit);

        res.render('departmentList', {
            departments: departments,
            currentPage: page,
            totalPages: Math.ceil(totalDocs / limit)
        });
    } catch (err) {
        console.error("Department list error:", err);
        res.status(500).render('error', { error: "Error fetching departments" });
    }
};

module.exports.departmentDeleteGet = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if department has users
        const userCount = await userModel.countDocuments({ departmentId: id });
        if (userCount > 0) {
            return res.status(400).render('error', {
                error: `Cannot delete department. ${userCount} user(s) are assigned to it.`
            });
        }

        // Delete department
        await departmentModel.findByIdAndDelete(id);
        res.redirect("/admin/departments/list?page=1");
    } catch (err) {
        console.error("Department deletion error:", err);
        res.status(500).render('error', { error: "Error deleting department" });
    }
};

module.exports.departmentEditGet = async (req, res) => {
    try {
        const dept = await departmentModel.findById(req.params.id);
        if (!dept) {
            return res.status(404).render('error', { error: "Department not found" });
        }
        res.render("editDepartment", { dept });
    } catch (err) {
        console.error("Department edit get error:", err);
        res.status(500).render('error', { error: "Error fetching department" });
    }
};

module.exports.departmentEditPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, programType, address } = req.body;

        // Validate fields
        if (!name || !programType || !address) {
            const dept = await departmentModel.findById(id);
            return res.render("editDepartment", { dept, error: "All fields are required" });
        }

        // Check for duplicate name
        const existing = await departmentModel.findOne({
            name: name.trim(),
            _id: { $ne: id }
        });

        if (existing) {
            const dept = await departmentModel.findById(id);
            return res.render("editDepartment", { dept, error: "Department name already exists" });
        }

        // Update department
        await departmentModel.findByIdAndUpdate(id, {
            name: name.trim(),
            programType: programType,
            address: address.trim()
        });

        res.redirect("/admin/departments/list?page=1");
    } catch (err) {
        console.error("Department edit error:", err);
        res.status(500).render('error', { error: "Error updating department" });
    }
};

// ============= USER MANAGEMENT =============

module.exports.userCreationGet = async (req, res) => {
    try {
        const departments = await departmentModel.find();
        res.render("createUser", { error: null, departments });
    } catch (err) {
        console.error("User creation page error:", err);
        res.status(500).render('error', { error: "Error loading user creation page" });
    }
};

module.exports.userCreationPost = async (req, res) => {
    try {
        const { name, email, phone, role, departmentId, password } = req.body;

        // Validate required fields
        if (!name || !email || !phone || !role) {
            const departments = await departmentModel.find();
            return res.render("createUser", {
                error: "All fields are required",
                departments
            });
        }

        // Validate role
        const validRoles = ['Admin', 'Student', 'Professor', 'HOD'];
        if (!validRoles.includes(role)) {
            const departments = await departmentModel.find();
            return res.render("createUser", {
                error: "Invalid role",
                departments
            });
        }

        // Department is required for non-admin users
        if (role !== 'Admin' && !departmentId) {
            const departments = await departmentModel.find();
            return res.render("createUser", {
                error: "Department is required for this role",
                departments
            });
        }

        // Check if user already exists
        const userFound = await userModel.findOne({ email: email.trim() });
        if (userFound) {
            const departments = await departmentModel.find();
            return res.render("createUser", {
                error: "Email already exists",
                departments
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        await userModel.create({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            role: role,
            departmentId: role !== 'Admin' ? departmentId : null,
            passwordHash: passwordHash,
            status: 'active'
        });

        // TODO: Send welcome email with credentials

        const departments = await departmentModel.find();
        res.render("createUser", {
            error: "User created successfully",
            departments
        });
    } catch (err) {
        console.error("User creation error:", err);
        const departments = await departmentModel.find();
        res.render("createUser", {
            error: "Error creating user",
            departments
        });
    }
};

module.exports.userListGet = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const filterRole = req.query.role || null;

        let query = {};
        if (filterRole) {
            query.role = filterRole;
        }

        const totalDocs = await userModel.countDocuments(query);
        const users = await userModel.find(query).populate('departmentId').skip(skip).limit(limit);

        res.render('userList', {
            users: users,
            currentPage: page,
            totalPages: Math.ceil(totalDocs / limit),
            filterRole: filterRole
        });
    } catch (err) {
        console.error("User list error:", err);
        res.status(500).render('error', { error: "Error fetching users" });
    }
};

module.exports.userDeletePost = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user has pending assignments
        const pendingAssignments = await assignmentModel.countDocuments({
            $or: [
                { studentId: id, status: { $in: ['Draft', 'Submitted', 'Forwarded'] } },
                { reviewerId: id, status: { $in: ['Submitted', 'Forwarded'] } }
            ]
        });

        if (pendingAssignments > 0) {
            return res.status(400).render('error', {
                error: `Cannot delete user. ${pendingAssignments} pending assignment(s) exist.`
            });
        }

        // Delete user
        await userModel.findByIdAndDelete(id);
        res.redirect("/admin/users/list?page=1");
    } catch (err) {
        console.error("User deletion error:", err);
        res.status(500).render('error', { error: "Error deleting user" });
    }
};

module.exports.userEditGet = async (req, res) => {
    try {
        const user = await userModel.findById(req.params.id).populate('departmentId');
        const departments = await departmentModel.find();

        if (!user) {
            return res.status(404).render('error', { error: "User not found" });
        }

        res.render("editUser", { user, departments });
    } catch (err) {
        console.error("User edit get error:", err);
        res.status(500).render('error', { error: "Error fetching user" });
    }
};


module.exports.userEditPost = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, departmentId, status } = req.body;

        // Validate required fields
        if (!name || !email || !phone) {
            const user = await userModel.findById(id).populate('departmentId');
            const departments = await departmentModel.find();

            return res.render("editUser", {
                user,
                departments,
                error: "All required fields must be filled"
            });
        }

        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).render('error', { error: "User not found" });
        }

        // Check email uniqueness
        if (email.trim().toLowerCase() !== user.email) {
            const existing = await userModel.findOne({
                email: email.trim().toLowerCase()
            });

            if (existing) {
                const departments = await departmentModel.find();
                return res.render("editUser", {
                    user,
                    departments,
                    error: "Email already exists"
                });
            }
        }

        // 🔥 IMPORTANT PART — NO .save()
        const updateData = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            status: status || 'active'
        };

        if (user.role !== 'Admin') {
            updateData.departmentId = departmentId;
        }

        await userModel.findByIdAndUpdate(id, updateData);

        res.redirect("/admin/users/list?page=1");

    } catch (err) {
        console.error("User edit error:", err);

        const user = await userModel.findById(req.params.id).populate('departmentId');
        const departments = await departmentModel.find();

        res.render("editUser", {
            user,
            departments,
            error: "Error updating user"
        });
    }
};

// ============= ADMIN DASHBOARD =============

module.exports.adminDashboard = async (req, res) => {
    try {
        const stats = {
            totalDepartments: await departmentModel.countDocuments(),
            totalUsers: await userModel.countDocuments(),
            usersByRole: {
                Admin: await userModel.countDocuments({ role: 'Admin' }),
                Student: await userModel.countDocuments({ role: 'Student' }),
                Professor: await userModel.countDocuments({ role: 'Professor' }),
                HOD: await userModel.countDocuments({ role: 'HOD' })
            },
            totalAssignments: await assignmentModel.countDocuments(),
            pendingReviews: await assignmentModel.countDocuments({ status: 'Submitted' })
        };

        res.render("adminDashboard", { stats });
    } catch (err) {
        console.error("Admin dashboard error:", err);
        res.status(500).render('error', { error: "Error loading dashboard" });
    }
};
