// src/routes/hero.routes.js
const express = require('express');
const {
    getAllHeros,
    getHeroById,
    createHero,
    updateHero,
    deleteHero
} = require('../controllers/heroController');
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();


router.get('/', getAllHeros);
router.get('/:id', getHeroById)
router.post('/', authMiddleware, createHero);
router.patch('/:id', authMiddleware, updateHero);
router.delete('/:id', authMiddleware, deleteHero);

module.exports = router;