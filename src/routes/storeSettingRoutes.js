// src/routes/storeSettingRoutes.js
const express = require('express');
const { getStoreSettings, updateStoreSettings } = require('../controllers/storeSettingController');
const { authMiddleware } = require('../middlewares/authMiddleware');

const router = express.Router();

// Public: for storefront to fetch logo, title, favicon, colors
router.get('/', getStoreSettings);

// Admin: to update settings
router.put('/', authMiddleware, updateStoreSettings);

module.exports = router;
