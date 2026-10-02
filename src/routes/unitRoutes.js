const express = require('express');
const router = express.Router();
const {
    createUnit,
    getAllUnits,
    updateUnit,
    deleteUnit
} = require("../controllers/unitController");
const { authMiddleware } = require("../middlewares/authMiddleware");


router.use(authMiddleware);

router.post('/', createUnit);
router.get('/', getAllUnits);
router.patch('/:id', updateUnit);
router.delete('/:id', deleteUnit);


module.exports = router;

