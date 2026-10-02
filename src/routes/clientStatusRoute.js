const express = require('express');
const { getAllClientStatus, updateClientStatus } = require("../controllers/clientStatusController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();



router.get('/', getAllClientStatus);
router.patch('/:id', authMiddleware, updateClientStatus);


module.exports = router;


