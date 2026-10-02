// src/routes/promo.routes.js
const express = require('express');
const {
    getAllPromos,
    getPromoById,
    createPromo,
    updatePromo,
    deletePromo
} = require('../controllers/promoCMSController');
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();


router.get('/', getAllPromos);
router.get('/:id', getPromoById);
router.post('/', authMiddleware, createPromo);
router.patch('/:id', authMiddleware, updatePromo);
router.delete('/:id', authMiddleware, deletePromo);

module.exports = router;