// src/routes/hero-slider.routes.js
const express = require('express');
const {
    getAllHeroSliders,
    getHeroSliderById,
    createHeroSlider,
    updateHeroSlider,
    deleteHeroSlider
} = require('../controllers/heroSliderController');
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();



router.get('/', getAllHeroSliders);
router.get('/:id', getHeroSliderById);
router.post('/', authMiddleware, createHeroSlider);
router.patch('/:id', authMiddleware, updateHeroSlider);
router.delete('/:id', authMiddleware, deleteHeroSlider);

module.exports = router;
