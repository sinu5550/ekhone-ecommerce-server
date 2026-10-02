const express = require('express');
const router = express.Router();
const {
    createSubCategory,
    getAllSubCategories,
    getSubCategoryById,
    updateSubCategory,
    deleteSubCategory
} = require('../controllers/subCategoryController');
const { authMiddleware } = require("../middlewares/authMiddleware");


router.post('/', createSubCategory);
router.get('/', getAllSubCategories);
router.get('/:id', authMiddleware, getSubCategoryById);
router.patch('/:id', authMiddleware,  updateSubCategory);
router.delete('/:id', authMiddleware,  deleteSubCategory);

module.exports = router;


