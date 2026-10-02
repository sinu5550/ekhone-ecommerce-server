const express = require('express');
const { authMiddleware } = require("../middlewares/authMiddleware");
const { createEnquiryUs, deleteEnquiryUs, getAllEnquiryUs } = require("../controllers/enquiryUsController");
const router = express.Router();

// Enquiry Routes
router.post('/', createEnquiryUs);
router.get('/', authMiddleware, getAllEnquiryUs);
router.delete('/:id', authMiddleware, deleteEnquiryUs);


module.exports = router;



