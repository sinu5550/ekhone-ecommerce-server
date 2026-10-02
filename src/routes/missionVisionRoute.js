// src/routes/hero.routes.js
const express = require('express');
const { createMissionVision,
    getAllMissionVision,
    getMissionVisionById,
    updateMissionVision,
    deleteMissionVision } = require("../controllers/missionVisionController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();


router.get('/', getAllMissionVision);
router.get('/:id', getMissionVisionById)
router.post('/', authMiddleware, createMissionVision);
router.patch('/:id', authMiddleware, updateMissionVision);
router.delete('/:id', authMiddleware, deleteMissionVision);

module.exports = router;