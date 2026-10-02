const express = require('express');
const router = express.Router();
const {
    getAllBundles,
    getBundleBySlug,
    getBundleById,
    createBundle,
    updateBundle,
    deleteBundle,
    toggleBundleStatus,
    toggleFeaturedStatus } = require("../controllers/bundleController");
const { authMiddleware } = require("../middlewares/authMiddleware");




// Bundle routes
router.get('/', getAllBundles);
router.get('/:slug', getBundleBySlug);
router.get('/:id', getBundleById);
router.post('/', authMiddleware, createBundle);
router.put('/:id', authMiddleware, updateBundle);
router.delete('/:id', authMiddleware, deleteBundle);
router.patch('/:id/status', authMiddleware, toggleBundleStatus);
router.patch('/:id/featured', authMiddleware, toggleFeaturedStatus);

module.exports = router; 