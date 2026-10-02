const express = require('express');
const router = express.Router();
const { sendEmail, sendBulkEmail, getEmailStatus, sendOrderConfirmation} = require('../controllers/emailController');

// POST /api/emails - Send email (main endpoint for verification, welcome, etc.)
router.post('/', sendEmail);


router.post('/order-confirmation', sendOrderConfirmation);

// POST /api/emails/bulk - Send bulk emails
router.post('/bulk', sendBulkEmail);

// GET /api/emails/:id/status - Check email status
router.get('/:id/status', getEmailStatus);

module.exports = router;