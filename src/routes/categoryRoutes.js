const express = require('express');
const router = express.Router();
const {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
} = require('../controllers/categoryController');
const { authMiddleware } = require("../middlewares/authMiddleware");


router.post('/', authMiddleware, createCategory);
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.patch('/:id', authMiddleware, updateCategory);
router.delete('/:id', authMiddleware, deleteCategory);

module.exports = router;


