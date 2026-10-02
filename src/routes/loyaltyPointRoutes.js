const express = require('express');
const router = express.Router();
const loyaltyController = require('../controllers/loyaltyController');

// Customer endpoints
router.get('/balance/:id', loyaltyController.getLoyaltyBalance);
router.get('/transactions/:id', loyaltyController.getLoyaltyTransactions);
router.post('/initialize', loyaltyController.initialize);

// Validation endpoint (for checkout)
router.post('/validate', loyaltyController.validateRedemption);

// Order processing endpoints
router.post('/order-paid/:orderId', loyaltyController.processOrderPayment);
router.post('/refund/:orderId', loyaltyController.refundPoints);

module.exports = router;