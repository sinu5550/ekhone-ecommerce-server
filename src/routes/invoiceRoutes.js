const express = require('express');
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
    createInvoice,
    getAllInvoices,
    getInvoiceById,
    updateInvoicePaymentStatus,
    deleteInvoice,
    getInvoicesByOrderNumber
} = require('../controllers/invoiceController');



router.use(authMiddleware);
// Invoice Routes
router.post('/', createInvoice);
router.get('/', getAllInvoices);
router.get('/:id', getInvoiceById);
router.patch('/:id', updateInvoicePaymentStatus);
router.delete('/:id', deleteInvoice);
router.get('/order/:orderNumber', getInvoicesByOrderNumber);

module.exports = router;


