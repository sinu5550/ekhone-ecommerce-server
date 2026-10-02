const express = require('express');
const { getAllAboutInfo, updateAboutInfo } = require("../controllers/aboutUsController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();



router.get('/', getAllAboutInfo);
router.patch('/:id', authMiddleware, updateAboutInfo);


module.exports = router;


