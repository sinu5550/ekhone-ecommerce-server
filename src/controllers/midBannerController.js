// src/controllers/midBanner.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Create MidBanner
const createMidBanner = async (req, res) => {
    try {
        const { sub_title, title, image, link, category } = req.body;

        const newMidBanner = await prisma.midBanner.create({
            data: {
                sub_title: sub_title || '',
                title: title || '',
                image: image || '',
                link: link || '',
                category: category || ''
            }
        });

        return successResponse(res, 'Mid banner created successfully', newMidBanner, 201);
    } catch (error) {
        console.error('Create mid banner error:', error);
        return errorResponse(res, 'Failed to create mid banner', 500);
    }
};

// Get All MidBanners
const getAllMidBanners = async (req, res) => {
    try {
        const midBannerData = await prisma.midBanner.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, midBannerData);
    } catch (error) {
        console.error('Get all mid banners error:', error);
        return errorResponse(res, 'Failed to retrieve mid banners', 500);
    }
};

// Get MidBanner by ID
const getMidBannerById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const midBanner = await prisma.midBanner.findUnique({
            where: { id }
        });

        if (!midBanner) return errorResponse(res, 'Mid banner not found', 404);

        return successResponse(res, midBanner);
    } catch (error) {
        console.error('Get mid banner by ID error:', error);
        return errorResponse(res, 'Failed to retrieve mid banner', 500);
    }
};

// Update MidBanner
const updateMidBanner = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const { sub_title, title, image, link, category } = req.body;

        // Check if mid banner exists
        const existingMidBanner = await prisma.midBanner.findUnique({
            where: { id }
        });

        if (!existingMidBanner) return errorResponse(res, 'Mid banner not found', 404);

        const updatedMidBanner = await prisma.midBanner.update({
            where: { id },
            data: {
                sub_title: sub_title !== undefined ? sub_title : existingMidBanner.sub_title,
                title: title !== undefined ? title : existingMidBanner.title,
                image: image !== undefined ? image : existingMidBanner.image,
                link: link !== undefined ? link : existingMidBanner.link,
                category: category !== undefined ? category : existingMidBanner.category
            }
        });

        return successResponse(res, 'Mid banner updated successfully', updatedMidBanner);
    } catch (error) {
        console.error('Update mid banner error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Mid banner not found', 404);
        }
        
        return errorResponse(res, 'Failed to update mid banner', 500);
    }
};

// Delete MidBanner
const deleteMidBanner = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        // Check if mid banner exists
        const existingMidBanner = await prisma.midBanner.findUnique({
            where: { id }
        });

        if (!existingMidBanner) return errorResponse(res, 'Mid banner not found', 404);

        await prisma.midBanner.delete({
            where: { id }
        });

        return successResponse(res, 'Mid banner deleted successfully');
    } catch (error) {
        console.error('Delete mid banner error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Mid banner not found', 404);
        }
        
        return errorResponse(res, 'Failed to delete mid banner', 500);
    }
};

module.exports = {
    createMidBanner,
    getAllMidBanners,
    getMidBannerById,
    updateMidBanner,
    deleteMidBanner
};