// src/routes/testimonials.js
const express = require('express');
const { authMiddleware } = require("../middlewares/authMiddleware");
const { getAllTestimonials, getTestimonialById, createTestimonial, updateTestimonial, deleteTestimonial } = require('../controllers/testimonialsController');
const router = express.Router();


router.get('/', getAllTestimonials);
router.get('/:id', getTestimonialById)
router.post('/', authMiddleware, createTestimonial);
router.patch('/:id', authMiddleware, updateTestimonial);
router.delete('/:id', authMiddleware, deleteTestimonial);

module.exports = router;