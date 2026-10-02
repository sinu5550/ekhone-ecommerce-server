const express = require('express');
const router = express.Router();
const {
    getAllMainCategories,
    getMainCategoryById,
    createMainCategory,
    updateMainCategory,
    deleteMainCategory,
} = require('../controllers/mainCategoryController');
const { authMiddleware } = require("../middlewares/authMiddleware");


router.get('/', getAllMainCategories);
router.get('/:id', getMainCategoryById);
router.post('/', authMiddleware, createMainCategory);
router.patch('/:id', authMiddleware, updateMainCategory);
router.delete('/:id', authMiddleware, deleteMainCategory);

module.exports = router;

