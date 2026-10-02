const express = require('express');
const { getAlTeamMemberStatus, updateTeamMemberStatus } = require("../controllers/teamStatusController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();



router.get('/', getAlTeamMemberStatus);
router.patch('/:id', authMiddleware, updateTeamMemberStatus);


module.exports = router;


