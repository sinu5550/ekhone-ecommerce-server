const express = require('express');
const {
    createAdmin,
    getAllAdmin,
    getAdminByEmail,
    updateAdminUserRole,
    deleteAdminUser,
    getAdminProfile, 
    updateAdminStatus} = require("../controllers/adminController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();


router.post('/', authMiddleware, createAdmin);
router.get('/', getAllAdmin);
router.get('/email/:email', getAdminByEmail);
router.patch("/users/:userId/role", authMiddleware, updateAdminUserRole);
router.delete("/users/:userId", authMiddleware, deleteAdminUser);
router.patch("/users/:userId/status", authMiddleware, updateAdminStatus);
router.get("/profile", getAdminProfile);


module.exports = router;



// Rooute is --->  /api/admin-user