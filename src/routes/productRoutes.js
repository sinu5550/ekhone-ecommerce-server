const express = require('express');
const router = express.Router();

const {
    createProduct,
    getAllProduct,
    updateProduct,
    deleteProduct,
    getProductBySlug,
    getProductById,
    getProductsGroupedByCategory,
    getArchivedProducts,
    getNewProducts,
    getTopSellingProducts
} = require("../controllers/productController");

const { searchProducts, searchProductsDetailed } = require("../controllers/searchController");
const { authMiddleware } = require("../middlewares/authMiddleware");


router.get('/search/suggestions', searchProducts);
router.get('/search/detailed', searchProductsDetailed);
router.get('/grouped', getProductsGroupedByCategory);
router.get('/top-selling', getTopSellingProducts);
router.get('/new', getNewProducts);
router.get('/archived', authMiddleware, getArchivedProducts);

// Main CRUD routes
router.get('/', getAllProduct);
router.post('/', authMiddleware, createProduct);
router.get('/id/:id', getProductById);
router.get('/:slug', getProductBySlug);
router.patch('/:id', authMiddleware, updateProduct);
router.delete('/:id', authMiddleware, deleteProduct);



module.exports = router;


