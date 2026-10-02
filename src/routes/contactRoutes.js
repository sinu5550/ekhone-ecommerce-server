// src/routes/contact.routes.js
const express = require('express');
const {
    getContactData,
    createContactData,
    updateContactData,
    deleteContactData
} = require('../controllers/contactController');
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();



router.get('/', getContactData);
router.post('/', authMiddleware, createContactData);
router.put('/:id', authMiddleware, updateContactData);
router.patch('/:id', authMiddleware, updateContactData);
router.delete('/:id', authMiddleware, deleteContactData);

module.exports = router;