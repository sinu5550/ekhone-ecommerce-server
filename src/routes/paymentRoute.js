const express = require('express');
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();
const {
    createPayment,
    getAllPayments,
    getPaymentById,
    getPaymentsByOrder,
    updatePayment,
    getPaymentStatistics
} = require("../controllers/paymentController");


router.post('/', authMiddleware, createPayment);
router.get('/', authMiddleware, getAllPayments);
router.get('/statistics', getPaymentStatistics);
router.get('/order/:orderId', getPaymentsByOrder);
router.get('/:id', getPaymentById);
router.put('/:id', authMiddleware, updatePayment);

module.exports = router;