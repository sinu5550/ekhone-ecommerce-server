// src/controllers/hero-slider.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Create Hero Slider
const createHeroSlider = async (req, res) => {
    try {
        const { sub_title, title, image, link } = req.body;

        const newHeroSlider = await prisma.heroSlider.create({
            data: {
                sub_title: sub_title || '',
                title: title || '',
                image: image || '',
                link: link || ''
            }
        });

        return successResponse(res, 'Hero slider created successfully', newHeroSlider, 201);
    } catch (error) {
        console.error('Create hero slider error:', error);
        return errorResponse(res, 'Failed to create hero slider', 500);
    }
};

// Get All Hero Sliders
const getAllHeroSliders = async (req, res) => {
    try {
        const heroSliders = await prisma.heroSlider.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, heroSliders);
    } catch (error) {
        console.error('Get all hero sliders error:', error);
        return errorResponse(res, 'Failed to retrieve hero sliders', 500);
    }
};

// Get Hero Slider by ID
const getHeroSliderById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const heroSlider = await prisma.heroSlider.findUnique({
            where: { id }
        });

        if (!heroSlider) return errorResponse(res, 'Hero slider not found', 404);

        return successResponse(res, 'Hero slider retrieved successfully', heroSlider);
    } catch (error) {
        console.error('Get hero slider by ID error:', error);
        return errorResponse(res, 'Failed to retrieve hero slider', 500);
    }
};

// Update Hero Slider
const updateHeroSlider = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const { sub_title, title, image, link } = req.body;

        // Check if hero slider exists
        const existingHeroSlider = await prisma.heroSlider.findUnique({
            where: { id }
        });

        if (!existingHeroSlider) return errorResponse(res, 'Hero slider not found', 404);

        const updatedHeroSlider = await prisma.heroSlider.update({
            where: { id },
            data: {
                sub_title: sub_title !== undefined ? sub_title : existingHeroSlider.sub_title,
                title: title !== undefined ? title : existingHeroSlider.title,
                image: image !== undefined ? image : existingHeroSlider.image,
                link: link !== undefined ? link : existingHeroSlider.link
            }
        });

        return successResponse(res, 'Hero slider updated successfully', updatedHeroSlider);
    } catch (error) {
        console.error('Update hero slider error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Hero slider not found', 404);
        }
        
        return errorResponse(res, 'Failed to update hero slider', 500);
    }
};

// Delete Hero Slider
const deleteHeroSlider = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        // Check if hero slider exists
        const existingHeroSlider = await prisma.heroSlider.findUnique({
            where: { id }
        });

        if (!existingHeroSlider) return errorResponse(res, 'Hero slider not found', 404);

        await prisma.heroSlider.delete({
            where: { id }
        });

        return successResponse(res, 'Hero slider deleted successfully');
    } catch (error) {
        console.error('Delete hero slider error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Hero slider not found', 404);
        }
        
        return errorResponse(res, 'Failed to delete hero slider', 500);
    }
};

module.exports = {
    createHeroSlider,
    getAllHeroSliders,
    getHeroSliderById,
    updateHeroSlider,
    deleteHeroSlider
};