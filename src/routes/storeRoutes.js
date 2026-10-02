const express = require('express');
const {
    createStore,
    getAllStores,
    getStoreById,
    updateStore,
    deleteStore
} = require('../controllers/storeController');
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();



router.post('/', authMiddleware, createStore);
router.get('/', getAllStores);
router.get('/:id', getStoreById);
router.patch('/:id', authMiddleware, updateStore);
router.delete('/:id', authMiddleware, deleteStore);

module.exports = router;


