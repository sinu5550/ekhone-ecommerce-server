// src/routes/popupBannerRoutes.js
const express = require('express');
const {
  getActivePopupBanner,
  getAllPopupBanners,
  savePopupBanner,
  togglePopupBannerStatus,
  deletePopupBanner
} = require('../controllers/popupBannerController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Public: fetch active popup banner for frontend storefront
router.get('/active', getActivePopupBanner);

// Protected: Admin management
router.get('/', authMiddleware, getAllPopupBanners);
router.post('/', authMiddleware, savePopupBanner);
router.patch('/:id/toggle', authMiddleware, togglePopupBannerStatus);
router.delete('/:id', authMiddleware, deletePopupBanner);

module.exports = router;
