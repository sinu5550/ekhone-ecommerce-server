const express = require('express');
const {
    createBlog,
    getAllBlogs,
    getBlogById,
    updateBlog,
    patchBlog,
    deleteBlog,
    addBlogSection,
    updateBlogSection,
    deleteBlogSection } = require("../controllers/blogController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();

// Blog Routes
router.post('/', authMiddleware, createBlog);
router.get('/', getAllBlogs);
router.get('/:id', getBlogById);
router.put('/:id', authMiddleware, updateBlog);
router.patch('/:id', authMiddleware, patchBlog);
router.delete('/:id', authMiddleware, deleteBlog);

// Section Routes
router.post('/:id/sections', authMiddleware, addBlogSection);
router.patch('/sections/:sectionId', authMiddleware, updateBlogSection);
router.delete('/sections/:sectionId', authMiddleware, deleteBlogSection);

module.exports = router;