// src/routes/top-pick.routes.js
const express = require('express');
const {
    getAllTopPicks,
    getTopPickById,
    createTopPick,
    updateTopPick,
    deleteTopPick
} = require('../controllers/topPickController');
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();



router.get('/', getAllTopPicks);
router.get('/:id', getTopPickById);
router.post('/', authMiddleware, createTopPick);
router.patch('/:id', authMiddleware, updateTopPick);
router.delete('/:id', authMiddleware, deleteTopPick);

module.exports = router;