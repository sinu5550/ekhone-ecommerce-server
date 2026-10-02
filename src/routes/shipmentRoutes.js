const express = require('express');
const router = express.Router();
const {
    createShipment,
    syncShipmentStatus,
    bulkSyncStatus,
    getAllShipments,
    getShipmentOrders,
    getCourierBalance,
    checkFraud,
    handleWebhook,
    markProductDelivered,
    markReturnReceived
} = require('../controllers/shipmentController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// Public Webhook callback endpoint for courier push updates
router.post('/webhook', handleWebhook);

// Admin-protected shipment routes
router.post('/create', authMiddleware, createShipment);
router.post('/sync/:id', authMiddleware, syncShipmentStatus);
router.post('/bulk-sync', authMiddleware, bulkSyncStatus);
router.post('/deliver/:id', authMiddleware, markProductDelivered);
router.post('/return-received/:id', authMiddleware, markReturnReceived);
router.get('/orders', authMiddleware, getShipmentOrders);
router.get('/balance', authMiddleware, getCourierBalance);
router.get('/fraud-check/:phone', authMiddleware, checkFraud);
router.get('/', authMiddleware, getAllShipments);

module.exports = router;

