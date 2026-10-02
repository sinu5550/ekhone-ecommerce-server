const express = require('express');
const {
    getAllBentoImageCards,
    getBentoImageCardById,
    createBentoImageCard,
    updateBentoImageCard,
    deleteBentoImageCard } = require('../controllers/bentoImageGalleryController');
const router = express.Router();


router.get('/', getAllBentoImageCards);
router.get('/:id', getBentoImageCardById)
router.post('/', createBentoImageCard);
router.patch('/:id',  updateBentoImageCard);
router.delete('/:id', deleteBentoImageCard);

module.exports = router;