const express = require('express');
const router = express.Router();
const { getMissingOrders } = require('../controllers/missingOrdersController');

// GET /api/missing-orders
router.get('/', getMissingOrders);

module.exports = router;
