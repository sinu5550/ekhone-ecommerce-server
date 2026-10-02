// src/routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAnalytics,
    getRealtimeAnalytics,
    getMetricData,
} = require('../controllers/analyticsController');
const { authMiddleware } = require('../middlewares/authMiddleware'); 

// Public routes (যদি authentication প্রয়োজন না হয়)
router.get('/', getAnalytics);
router.get('/realtime', getRealtimeAnalytics);
router.get('/metrics', getMetricData);

// Protected routes (যদি authentication প্রয়োজন হয়)
// router.get('/', authMiddleware, getAnalytics);
// router.get('/realtime', authMiddleware, getRealtimeAnalytics);
// router.get('/metrics', authMiddleware, getMetricData);

module.exports = router;