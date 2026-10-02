const express = require('express');
const { getAllTeamMember, createTeamMember, updateTeamMember, deleteTeamMember } = require("../controllers/teamMemberController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const router = express.Router();


router.get('/', getAllTeamMember);
router.get('/:id', getAllTeamMember)
router.post('/', authMiddleware, createTeamMember);
router.patch('/:id', authMiddleware, updateTeamMember);
router.delete('/:id', authMiddleware, deleteTeamMember);

module.exports = router;