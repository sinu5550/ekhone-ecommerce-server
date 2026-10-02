const express = require('express');
const {
    createWarranty,
    getAllWarranty,
    updateWarranty,
    deleteWarranty } = require("../controllers/warrantyControllers");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();

router.use(authMiddleware);

router.post('/', createWarranty);
router.get('/', getAllWarranty);
router.patch('/:id', updateWarranty);
router.delete('/:id', deleteWarranty);


module.exports = router;

