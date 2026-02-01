/**
 * RBAC Middleware - Role-Based Access Control
 * 
 * All role checks are server-side and enforced through middleware.
 * Client cannot manipulate role or permissions.
 */

// Require authentication (session or JWT must be established)
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).redirect('/');  // Redirect to login
    }
    next();
};

// Require specific role(s)
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId || !req.session.role) {
            return res.status(401).render('login', { error: 'Authentication required' });
        }

        if (!roles.includes(req.session.role)) {
            return res.status(403).render('forbidden', { 
                error: `Access denied. Required role: ${roles.join(' or ')}` 
            });
        }

        next();
    };
};

// Admin-only access
const adminOnly = requireRole('Admin');

// Student-only access
const studentOnly = requireRole('Student');

// Professor or HOD access (reviewers)
const reviewerOnly = requireRole('Professor', 'HOD');

// All authenticated roles except explicitly excluded
const protectedRoute = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).redirect('/');
    }
    next();
};

module.exports = {
    requireAuth,
    requireRole,
    adminOnly,
    studentOnly,
    reviewerOnly,
    protectedRoute
};
