// src/controllers/top-pick.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Create Top Pick
const createTopPick = async (req, res) => {
    try {
        const { title, category, image, link } = req.body;

        const newTopPick = await prisma.topPickSeason.create({
            data: {
                title: title || '',
                category: category || '',
                image: image || '',
                link: link || ''
            }
        });

        return successResponse(res, 'Top pick created successfully', newTopPick, 201);
    } catch (error) {
        console.error('Create top pick error:', error);
        return errorResponse(res, 'Failed to create top pick', 500);
    }
};

// Get All Top Picks
const getAllTopPicks = async (req, res) => {
    try {
        const topPicks = await prisma.topPickSeason.findMany({
            orderBy: { id: 'asc' }
        });

        return successResponse(res, 'Top picks retrieved successfully', topPicks);
    } catch (error) {
        console.error('Get all top picks error:', error);
        return errorResponse(res, 'Failed to retrieve top picks', 500);
    }
};

// Get Top Pick by ID
const getTopPickById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const topPick = await prisma.topPickSeason.findUnique({
            where: { id }
        });

        if (!topPick) return errorResponse(res, 'Top pick not found', 404);

        return successResponse(res, 'Top pick retrieved successfully', topPick);
    } catch (error) {
        console.error('Get top pick by ID error:', error);
        return errorResponse(res, 'Failed to retrieve top pick', 500);
    }
};

// Update Top Pick
const updateTopPick = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const { title, category, image, link } = req.body;

        // Check if top pick exists
        const existingTopPick = await prisma.topPickSeason.findUnique({
            where: { id }
        });

        if (!existingTopPick) return errorResponse(res, 'Top pick not found', 404);

        const updatedTopPick = await prisma.topPickSeason.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existingTopPick.title,
                category: category !== undefined ? category : existingTopPick.category,
                image: image !== undefined ? image : existingTopPick.image,
                link: link !== undefined ? link : existingTopPick.link
            }
        });

        return successResponse(res, 'Top pick updated successfully', updatedTopPick);
    } catch (error) {
        console.error('Update top pick error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Top pick not found', 404);
        }
        
        return errorResponse(res, 'Failed to update top pick', 500);
    }
};

// Delete Top Pick
const deleteTopPick = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        // Check if top pick exists
        const existingTopPick = await prisma.topPickSeason.findUnique({
            where: { id }
        });

        if (!existingTopPick) return errorResponse(res, 'Top pick not found', 404);

        await prisma.topPickSeason.delete({
            where: { id }
        });

        return successResponse(res, 'Top pick deleted successfully');
    } catch (error) {
        console.error('Delete top pick error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Top pick not found', 404);
        }
        
        return errorResponse(res, 'Failed to delete top pick', 500);
    }
};

module.exports = {
    createTopPick,
    getAllTopPicks,
    getTopPickById,
    updateTopPick,
    deleteTopPick
};