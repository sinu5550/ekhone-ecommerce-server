const { createClient } = require("@supabase/supabase-js");
const prisma = require('../utils/db.js');
const { errorResponse, successResponse } = require("../utils/responseHandler.js");


// Initialize Supabase admin client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);


// ************ admin Create ******************
const createAdmin = async (req, res) => {
    try {
        const { name, email, roleId, authId, status } = req.body;

        // Validate required fields
        if (!name || !roleId) {
            return errorResponse(res, "Name and roleId are required", 400);
        }

        // Check duplicate email
        if (email) {
            const existingEmail = await prisma.adminUser.findUnique({
                where: { email }
            });

            if (existingEmail) {
                return errorResponse(res, "Email already exists", 409);
            }
        }

        // Validate role exists
        const roleExists = await prisma.adminRole.findUnique({
            where: { id: roleId }
        });

        if (!roleExists) {
            return errorResponse(res, "Invalid roleId", 400);
        }

        // Create admin user
        const adminUserData = await prisma.adminUser.create({
            data: {
                name,
                email,
                authId: authId || null,
                status: status || "Active",
                roleId
            },
            include: {
                role: true
            }
        });

        return successResponse(res, "Admin created successfully", adminUserData, 201);

    } catch (error) {
        console.error("Create admin error:", error);
        return errorResponse(res, error.message, 400);
    }
};

// ************ Get All admins ******************
const getAllAdmin = async (req, res) => {
    try {
        const adminData = await prisma.adminUser.findMany({
            include: {
                role: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return successResponse(res, adminData);

    } catch (error) {
        console.error("Get all admins error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Get admin By Email ******************
const getAdminByEmail = async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return errorResponse(res, "Email is required", 400);
        }

        const admin = await prisma.adminUser.findUnique({
            where: { email },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });

        if (!admin) {
            return errorResponse(res, "Admin not found", 404);
        }

        return successResponse(res, admin);

    } catch (error) {
        console.error("Get admin by email error:", error);
        return errorResponse(res, error.message, 500);
    }
};


const updateAdminUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { roleId } = req.body;

        if (!roleId) {
            return errorResponse(res, "roleId is required", 400);
        }

        // check user
        const user = await prisma.adminUser.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return errorResponse(res, "User not found", 404);
        }

        // check role
        const role = await prisma.adminRole.findUnique({
            where: { id: roleId }
        });

        if (!role) {
            return errorResponse(res, "Invalid role", 400);
        }

        const updated = await prisma.adminUser.update({
            where: { id: userId },
            data: { roleId },
            include: {
                role: true
            }
        });

        return successResponse(res, "Role updated successfully", updated);

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


const deleteAdminUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await prisma.adminUser.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return errorResponse(res, "User not found", 404);
        }

        await prisma.adminUser.delete({
            where: { id: userId }
        });

        return successResponse(res, "User deleted successfully");

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


// admin profile with role and permission data  Get
const getAdminProfile = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith("Bearer ")) {
            return errorResponse(res, "Unauthorized", 401);
        }

        const token = authHeader.split(" ")[1];

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            return errorResponse(res, "Invalid token", 401);
        }
        
        const admin = await prisma.adminUser.findFirst({
            where: {
                OR: [
                    { authId: user.id },
                    { email: user.email }
                ]
            },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
            },
        });

        if (!admin) {
            return errorResponse(res, "Admin not found", 404);
        }

        const permissions =
            admin?.role?.permissions?.map(
                item => item.permission.slug
            ) || [];

        return successResponse(res, {
            ...admin,
            permissions
        });

    } catch (error) {
        console.error(error);
        return errorResponse(res, error.message, 500);
    }
};

const updateAdminStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        if (!status) {
            return errorResponse(res, "Status is required", 400);
        }

        // check user exists
        const user = await prisma.adminUser.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            return errorResponse(res, "Admin user not found", 404);
        }

        // optional validation
        const allowedStatus = ["Active", "Inactive"];

        if (!allowedStatus.includes(status)) {
            return errorResponse(res, "Invalid status", 400);
        }

        const updatedUser = await prisma.adminUser.update({
            where: {
                id: userId
            },
            data: {
                status
            },
            include: {
                role: true
            }
        });

        return successResponse(
            res,
            "Status updated successfully",
            updatedUser
        );

    } catch (error) {
        console.error(error);
        return errorResponse(res, error.message, 500);
    }
};

module.exports = {
    createAdmin,
    getAllAdmin,
    getAdminByEmail,
    updateAdminUserRole,
    deleteAdminUser,
    getAdminProfile,
    updateAdminStatus
};