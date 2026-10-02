//controller/rbacController

const prisma = require("../utils/db");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// ******** CREATE ROLE ********
const createRole = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return errorResponse(res, "Role name is required", 400);
        }

        // check duplicate role
        const existingRole = await prisma.adminRole.findUnique({
            where: { name }
        });

        if (existingRole) {
            return errorResponse(res, "Role already exists", 409);
        }

        const role = await prisma.adminRole.create({
            data: {
                name
            }
        });

        return successResponse(res, "Role created successfully", role, 201);

    } catch (error) {
        console.error(error);
        return errorResponse(res, error.message, 500);
    }
};


const getAllRoles = async (req, res) => {
    try {
        const roles = await prisma.adminRole.findMany({
            // include: {
            //     permissions: {
            //         include: {
            //             permission: true
            //         }
            //     }
            // },
            orderBy: {
                createdAt: "desc"
            }
        });

        return successResponse(res, roles);

    } catch (error) {
        console.error(error);
        return errorResponse(res, error.message, 500);
    }
};


const createPermission = async (req, res) => {
    try {
        const { module, action } = req.body;

        if (!module || !action) {
            return errorResponse(res, "Module and action are required", 400);
        }

        const slug = `${module.trim().toLowerCase()}.${action.trim().toLowerCase()}`;

        const existing = await prisma.permission.findUnique({
            where: { slug }
        });

        if (existing) {
            return errorResponse(res, "Permission already exists", 409);
        }

        const permission = await prisma.permission.create({
            data: {
                module,
                action,
                slug
            }
        });

        return successResponse(res, "Permission created successfully", permission, 201);

    } catch (error) {
        console.error(error);
        return errorResponse(res, error.message, 500);
    }
};


const getAllPermissions = async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany({
            orderBy: {
                createdAt: "desc"
            }
        });

        return successResponse(res, permissions);

    } catch (error) {
        console.error(error);
        return errorResponse(res, error.message, 500);
    }
};


const assignPermissionsToRole = async (req, res) => {
    try {
        const { roleId, permissionIds } = req.body;

        if (!roleId || !permissionIds || !permissionIds.length) {
            return errorResponse(res, "roleId and permissionIds required", 400);
        }

        const role = await prisma.adminRole.findUnique({
            where: { id: roleId }
        });

        if (!role) {
            return errorResponse(res, "Role not found", 404);
        }

        // ✅ ONLY ADD THIS (duplicate safety)
        const uniquePermissionIds = [...new Set(permissionIds)];

        const data = uniquePermissionIds.map(pid => ({
            roleId,
            permissionId: pid
        }));

        await prisma.rolePermission.deleteMany({
            where: { roleId }
        });

        const result = await prisma.rolePermission.createMany({
            data
        });

        return successResponse(res, "Permissions assigned successfully", result);

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};



const getRolePermissions = async (req, res) => {
    try {

        const { roleId } = req.params;

        const role = await prisma.adminRole.findUnique({
            where: {
                id: roleId
            },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        if (!role) {
            return errorResponse(res, "Role not found", 404);
        }

        const permissionIds = role.permissions.map(
            item => item.permissionId
        );

        return successResponse(res, permissionIds);

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


module.exports = {
    createRole,
    getAllRoles,
    createPermission,
    getAllPermissions,
    assignPermissionsToRole,
    getRolePermissions
}