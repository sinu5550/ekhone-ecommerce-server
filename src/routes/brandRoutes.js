const express = require('express');
const router = express.Router();
const {
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand } = require('../controllers/brandController');
const { authMiddleware } = require("../middlewares/authMiddleware");


router.post('/', authMiddleware, createBrand);
router.get('/', getAllBrands);
router.get('/:id', getBrandById);
router.patch('/:id', authMiddleware, updateBrand);
router.delete('/:id', authMiddleware, deleteBrand);


module.exports = router;