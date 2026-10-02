const express = require('express');
const router = express.Router();
const {
    getWishlist,
    removeFromWishlist,
    clearWishlist,
    syncWishlist,
    addToWishlist
} = require("../controllers/wishlistController");



router.post('/', addToWishlist);
router.get('/', getWishlist);
router.delete('/:productId', removeFromWishlist);
router.delete('/', clearWishlist);

// Sync local wishlist to database after login
router.post('/sync', syncWishlist);

module.exports = router;