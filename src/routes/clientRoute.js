const express = require('express');
const router = express.Router();
const {
    getAllClients,
    createClient,
    getClientById,
    getClientBySlug,
    updateClient,
    deleteClient,
    getProjectById,
    getAllProjects } = require("../controllers/ourClientController");
const { authMiddleware } = require("../middlewares/authMiddleware");



router.get('/', getAllClients);
router.post('/', authMiddleware, createClient);
router.get('/projects/all', getAllProjects);
router.get('/id/:id', getClientById);
router.get('/project/:id', getProjectById);
router.get('/:slug', getClientBySlug);
router.patch('/:id', authMiddleware, updateClient);
router.delete('/:id', authMiddleware, deleteClient);


module.exports = router;