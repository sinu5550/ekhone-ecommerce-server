//authMiddleware.js

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

exports.authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer")) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const token = authHeader.split(" ")[1];

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
        }

        req.user = user;
        req.token = token;

        next();
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Authentication failed",
        });
    }
};





// Optional: Role-based middleware
exports.requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const userRole = req.user.user_metadata?.role || 'user';

        if (!roles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Optional: Email verification check
exports.requireEmailVerified = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized'
        });
    }

    if (!req.user.email_confirmed_at) {
        return res.status(403).json({
            success: false,
            error: 'Email not verified'
        });
    }

    next();
};