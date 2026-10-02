// src/controllers/hero.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Create Hero
const createHero = async (req, res) => {
    try {
        const { title, sub_title, image, link, category } = req.body;

        const newHero = await prisma.hero.create({
            data: {
                title: title || '',
                sub_title: sub_title || '',
                image: image || '',
                link: link || '',
                category: category || ''
            }
        });

        return successResponse(res, 'Hero created successfully', newHero, 201);
    } catch (error) {
        console.error('Create hero error:', error);
        return errorResponse(res, 'Failed to create hero', 500);
    }
};

// Get All Hero
const getAllHeros = async (req, res) => {
    try {
        const heroData = await prisma.hero.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, heroData);
    } catch (error) {
        console.error('Get all heros error:', error);
        return errorResponse(res, 'Failed to retrieve heros', 500);
    }
};

// Get Hero by ID
const getHeroById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const hero = await prisma.hero.findUnique({
            where: { id }
        });

        if (!hero) return errorResponse(res, 'Hero not found', 404);

        return successResponse(res, hero);
    } catch (error) {
        console.error('Get hero by ID error:', error);
        return errorResponse(res, 'Failed to retrieve hero', 500);
    }
};

// Update Hero
const updateHero = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const { title, sub_title, image, link, category } = req.body;

        // Check if hero exists
        const existingHero = await prisma.hero.findUnique({
            where: { id }
        });

        if (!existingHero) return errorResponse(res, 'Hero not found', 404);

        const updatedHero = await prisma.hero.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existingHero.title,
                sub_title: sub_title !== undefined ? sub_title : existingHero.sub_title,
                image: image !== undefined ? image : existingHero.image,
                link: link !== undefined ? link : existingHero.link,
                category: category !== undefined ? category : existingHero.category
            }
        });

        return successResponse(res, 'Hero updated successfully', updatedHero);
    } catch (error) {
        console.error('Update hero error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Hero not found', 404);
        }
        
        return errorResponse(res, 'Failed to update hero', 500);
    }
};

// Delete Hero
const deleteHero = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        // Check if hero exists
        const existingHero = await prisma.hero.findUnique({
            where: { id }
        });

        if (!existingHero) return errorResponse(res, 'Hero not found', 404);

        await prisma.hero.delete({
            where: { id }
        });

        return successResponse(res, 'Hero deleted successfully');
    } catch (error) {
        console.error('Delete hero error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Hero not found', 404);
        }
        
        return errorResponse(res, 'Failed to delete hero', 500);
    }
};

module.exports = {
    createHero,
    getAllHeros,
    getHeroById,
    updateHero,
    deleteHero
};