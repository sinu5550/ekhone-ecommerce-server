const express = require('express');
const router = express.Router();
const landingPageController = require('../controllers/landingPageController');

// Public API for frontend
router.get('/slug/:slug', landingPageController.getLandingPageBySlug);

// Admin APIs
router.get('/', landingPageController.getAllLandingPages);
router.get('/:id', landingPageController.getLandingPageById);
router.post('/', landingPageController.createLandingPage);
router.put('/:id', landingPageController.updateLandingPage);
router.delete('/:id', landingPageController.deleteLandingPage);

module.exports = router;
