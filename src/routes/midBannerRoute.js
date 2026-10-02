// src/routes/midBento.js
const express = require('express');
const {
    getAllMidBanners,
    getMidBannerById,
    createMidBanner,
    updateMidBanner,
    deleteMidBanner } = require('../controllers/midBannerController');
const router = express.Router();


router.get('/', getAllMidBanners);
router.get('/:id', getMidBannerById)
router.post('/',  createMidBanner);
router.patch('/:id',  updateMidBanner);
router.delete('/:id',  deleteMidBanner);

module.exports = router;