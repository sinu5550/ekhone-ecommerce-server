// src/controllers/missionVision.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Create Mission Vision
const createMissionVision = async (req, res) => {
    try {
        const { title, description, image } = req.body;

        // Validate required fields
        if (!title || !description || !image) {
            return errorResponse(res, 'Title, description, and image are required', 400);
        }

        const newMissionVision = await prisma.missionVision.create({
            data: {
                title: title.trim(),
                description: description.trim(),
                image: image.trim()
            }
        });

        return successResponse(res, 'Mission/Vision created successfully', newMissionVision, 201);
    } catch (error) {
        console.error('Create mission/vision error:', error);
        return errorResponse(res, 'Failed to create mission/vision', 500);
    }
};

// Get All Mission Vision
const getAllMissionVision = async (req, res) => {
    try {
        const missionVisionData = await prisma.missionVision.findMany({});

        return successResponse(res, 'Mission/Vision retrieved successfully', missionVisionData);
    } catch (error) {
        console.error('Get all mission/vision error:', error);
        return errorResponse(res, 'Failed to retrieve mission/vision', 500);
    }
};

// Get Mission Vision by ID
const getMissionVisionById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            return errorResponse(res, 'Invalid ID format', 400);
        }

        const missionVision = await prisma.missionVision.findUnique({
            where: { id }
        });

        if (!missionVision) {
            return errorResponse(res, 'Mission/Vision not found', 404);
        }

        return successResponse(res, 'Mission/Vision retrieved successfully', missionVision);
    } catch (error) {
        console.error('Get mission/vision by ID error:', error);
        return errorResponse(res, 'Failed to retrieve mission/vision', 500);
    }
};

// Update Mission Vision
const updateMissionVision = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            return errorResponse(res, 'Invalid ID format', 400);
        }

        const { title, description, image } = req.body;

        // Check if mission/vision exists
        const existingMissionVision = await prisma.missionVision.findUnique({
            where: { id }
        });

        if (!existingMissionVision) {
            return errorResponse(res, 'Mission/Vision not found', 404);
        }

        // Prepare update data (only include fields that are provided)
        const updateData = {};
        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (image !== undefined) updateData.image = image.trim();

        // If no fields to update
        if (Object.keys(updateData).length === 0) {
            return errorResponse(res, 'No fields to update', 400);
        }

        const updatedMissionVision = await prisma.missionVision.update({
            where: { id },
            data: updateData
        });

        return successResponse(res, 'Mission/Vision updated successfully', updatedMissionVision);
    } catch (error) {
        console.error('Update mission/vision error:', error);

        if (error.code === 'P2025') {
            return errorResponse(res, 'Mission/Vision not found', 404);
        }

        return errorResponse(res, 'Failed to update mission/vision', 500);
    }
};

// Delete Mission Vision
const deleteMissionVision = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            return errorResponse(res, 'Invalid ID format', 400);
        }

        // Check if mission/vision exists
        const existingMissionVision = await prisma.missionVision.findUnique({
            where: { id }
        });

        if (!existingMissionVision) {
            return errorResponse(res, 'Mission/Vision not found', 404);
        }

        await prisma.missionVision.delete({
            where: { id }
        });

        return successResponse(res, 'Mission/Vision deleted successfully');
    } catch (error) {
        console.error('Delete mission/vision error:', error);

        if (error.code === 'P2025') {
            return errorResponse(res, 'Mission/Vision not found', 404);
        }

        return errorResponse(res, 'Failed to delete mission/vision', 500);
    }
};

module.exports = {
    createMissionVision,
    getAllMissionVision,
    getMissionVisionById,
    updateMissionVision,
    deleteMissionVision
};