const express = require('express');
const router = express.Router();
const { chatWithAI, getProductVoiceNarration, streamBengaliAudio } = require('../controllers/aiController');

// POST /api/ai/chat - Live Bengali AI shopping assistant
router.post('/chat', chatWithAI);

// GET /api/ai/narrate/:productId - Get voice script for product
router.get('/narrate/:productId', getProductVoiceNarration);

// GET /api/ai/tts - Stream native Bengali speech audio
router.get('/tts', streamBengaliAudio);

module.exports = router;

