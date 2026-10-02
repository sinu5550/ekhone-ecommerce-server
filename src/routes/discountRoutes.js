const express = require('express');
const router = express.Router();
const {
    createDiscountCampaign,
    getAllDiscountCampaigns,
    getActiveCampaigns,
    getCampaignById,
    updateDiscountCampaign,
    deleteCampaign,
    toggleCampaignStatus,
    getCategoryDiscountProducts,
    getDiscountProductBySlug } = require("../controllers/discountController");
const { authMiddleware } = require("../middlewares/authMiddleware");


router.post('/', authMiddleware, createDiscountCampaign);
router.get('/', getAllDiscountCampaigns);
router.get('/active', getActiveCampaigns);
router.get('/discount-product/:slug', getDiscountProductBySlug);
router.get('/:id', getCampaignById);
router.patch('/:id', authMiddleware, updateDiscountCampaign);
router.delete('/:id', authMiddleware, deleteCampaign);
router.patch('/:id/status', authMiddleware, toggleCampaignStatus);
router.get('/category/:categoryId', getCategoryDiscountProducts);



module.exports = router;