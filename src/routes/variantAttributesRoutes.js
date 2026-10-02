const express = require('express');
const router = express.Router();
const {
    createVariantAttribute,
    getAllVariantAttribute,
    updateVariantAttribute,
    deleteVariantAttribute
} = require("../controllers/variantAttributesController");
const { authMiddleware } = require("../middlewares/authMiddleware");

router.use(authMiddleware);

router.post('/', createVariantAttribute);
router.get('/', getAllVariantAttribute);
router.patch('/:id', updateVariantAttribute);
router.delete('/:id', deleteVariantAttribute);


module.exports = router;


