const express = require('express');
const router = express.Router();
const {
    createCollection,
    getAllCollections,
    getCollectionById,
    getCollectionBySlug,
    updateCollection,
    toggleCollectionStatus,
    deleteCollection
} = require('../controllers/collectionController');

// Public and Admin Routes
router.get('/', getAllCollections);
router.get('/slug/:slug', getCollectionBySlug);
router.get('/:id', getCollectionById);
router.post('/', createCollection);
router.put('/:id', updateCollection);
router.patch('/:id', updateCollection);
router.patch('/:id/status', toggleCollectionStatus);
router.delete('/:id', deleteCollection);

module.exports = router;
