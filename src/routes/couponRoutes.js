const express = require('express');
const router = express.Router();
const {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    validateCoupon,
    getCouponByCode,
} = require('../controllers/couponController');
const { authMiddleware } = require("../middlewares/authMiddleware");


// route /api/coupon
router.get('/', getAllCoupons);
router.post('/validate', validateCoupon);
router.get('/code/:code', getCouponByCode);
router.get('/:id', getCouponById);
router.post('/', authMiddleware, createCoupon);
// PUT/PATCH update coupon
router.put('/:id', authMiddleware, updateCoupon);
router.patch('/:id', authMiddleware, updateCoupon);
router.patch('/:id/status', authMiddleware, toggleCouponStatus);
router.delete('/:id', authMiddleware, deleteCoupon);




module.exports = router;