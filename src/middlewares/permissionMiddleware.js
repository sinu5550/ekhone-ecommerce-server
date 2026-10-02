const prisma = require("../utils/db");

exports.hasPermission = (permissionSlug) => {
    return async (req, res, next) => {
        try {
            const admin = await prisma.adminUser.findFirst({
                where: {
                    authId: req.user.id,
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
                return res.status(403).json({
                    success: false,
                    message: "Admin not found",
                });
            }

            const permissions = admin.role.permissions.map(
                (item) => item.permission.slug
            );

            if (!permissions.includes(permissionSlug)) {
                return res.status(403).json({
                    success: false,
                    message: "Permission denied",
                });
            }

            next();
        } catch (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: err.message,
            });
        }
    };
};



// For used example in route 
// router.patch("/:id", authMiddleware, hasPermission("order.update"), updateOrder);