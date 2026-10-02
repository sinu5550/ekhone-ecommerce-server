// routes/dashboardSummaryRoutes.js
const express = require('express');
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { getDashboardSummary } = require('../controllers/dashboardSummaryController');


router.get('/summary', getDashboardSummary);

module.exports = router;