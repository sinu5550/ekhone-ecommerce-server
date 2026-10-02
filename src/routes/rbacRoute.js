const express = require("express");
const router = express.Router();

const {
    createRole,
    getAllRoles,
    createPermission,
    getAllPermissions,
    assignPermissionsToRole,
    getRolePermissions,
} = require("../controllers/rbacController");
const { authMiddleware } = require("../middlewares/authMiddleware");


router.use(authMiddleware);
// ROLE
router.get("/roles", getAllRoles);
router.post("/roles", createRole);
router.get("/roles/:roleId/permissions", getRolePermissions);
router.post("/roles/assign-permissions", assignPermissionsToRole);

// PERMISSION
router.get("/permissions", getAllPermissions);
router.post("/permissions", createPermission);

module.exports = router;


