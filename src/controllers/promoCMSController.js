// src/controllers/promo.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Create Promo
const createPromo = async (req, res) => {
    try {
        const { title, image, description, promo_batch, link, position, bgColor } = req.body;

        const newPromo = await prisma.offerPromo.create({
            data: {
                title: title || '',
                image: image || '',
                description: description || '',
                promo_batch: promo_batch || '',
                link: link || '',
                position: position || 'LEFT',
                bgColor: bgColor || ''
            }
        });

        return successResponse(res, 'Promo created successfully', newPromo, 201);
    } catch (error) {
        console.error('Create promo error:', error);
        return errorResponse(res, 'Failed to create promo', 500);
    }
};

// Get All Promos
const getAllPromos = async (req, res) => {
    try {
        const promos = await prisma.offerPromo.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, promos);
    } catch (error) {
        console.error('Get all promos error:', error);
        return errorResponse(res, 'Failed to retrieve promos', 500);
    }
};

// Get Promo by ID
const getPromoById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const promo = await prisma.offerPromo.findUnique({
            where: { id }
        });

        if (!promo) return errorResponse(res, 'Promo not found', 404);

        return successResponse(res, 'Promo retrieved successfully', promo);
    } catch (error) {
        console.error('Get promo by ID error:', error);
        return errorResponse(res, 'Failed to retrieve promo', 500);
    }
};

// Update Promo
const updatePromo = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const { title, image, description, promo_batch, link, position, bgColor } = req.body;

        // Check if promo exists
        const existingPromo = await prisma.offerPromo.findUnique({
            where: { id }
        });

        if (!existingPromo) return errorResponse(res, 'Promo not found', 404);

        const updatedPromo = await prisma.offerPromo.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existingPromo.title,
                image: image !== undefined ? image : existingPromo.image,
                description: description !== undefined ? description : existingPromo.description,
                promo_batch: promo_batch !== undefined ? promo_batch : existingPromo.promo_batch,
                link: link !== undefined ? link : existingPromo.link,
                position: position !== undefined ? position : existingPromo.position,
                bgColor: bgColor !== undefined ? bgColor : existingPromo.bgColor
            }
        });

        return successResponse(res, 'Promo updated successfully', updatedPromo);
    } catch (error) {
        console.error('Update promo error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Promo not found', 404);
        }
        
        return errorResponse(res, 'Failed to update promo', 500);
    }
};

// Delete Promo
const deletePromo = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        // Check if promo exists
        const existingPromo = await prisma.offerPromo.findUnique({
            where: { id }
        });

        if (!existingPromo) return errorResponse(res, 'Promo not found', 404);

        await prisma.offerPromo.delete({
            where: { id }
        });

        return successResponse(res, 'Promo deleted successfully');
    } catch (error) {
        console.error('Delete promo error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Promo not found', 404);
        }
        
        return errorResponse(res, 'Failed to delete promo', 500);
    }
};

module.exports = {
    createPromo,
    getAllPromos,
    getPromoById,
    updatePromo,
    deletePromo
};