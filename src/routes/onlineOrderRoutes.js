const express = require('express');
const router = express.Router();
const {
    getAllOrder,
    getOrderById,
    updateOrder,
    deleteOrder,
    createOrder,
    getOrdersWithoutInvoice,
    trackOrderStatus
} = require('../controllers/onlineOrderController');
const { authMiddleware } = require("../middlewares/authMiddleware");


router.get('/track-status/:orderNumber', trackOrderStatus);

router.get('/without-invoice', authMiddleware, getOrdersWithoutInvoice);
router.post('/', createOrder);
router.get('/', authMiddleware, getAllOrder);
router.get('/:id', authMiddleware, getOrderById);
router.patch('/:id', authMiddleware, updateOrder);
router.delete('/:id', authMiddleware, deleteOrder);

module.exports = router;