// src/controllers/store.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Validation utility function
const validateStoreData = (data) => {
    const errors = [];

    if (!data.title || data.title.trim() === '') {
        errors.push('Title is required');
    }

    if (!data.address || data.address.trim() === '') {
        errors.push('Address is required');
    }

    // Validate email format if provided
    if (data.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            errors.push('Invalid email format');
        }
    }

    return errors;
};

// Create Store
const createStore = async (req, res) => {
    try {
        const { title, image, address, phone_number, email, google_mapLink, notice, open_time } = req.body;

        // Validate input data
        const validationErrors = validateStoreData(req.body);
        if (validationErrors.length > 0) {
            return errorResponse(res, validationErrors.join(', '), 400);
        }

        const newStore = await prisma.ourStore.create({
            data: {
                title: title.trim(),
                image: image?.trim() || null,
                address: address.trim(),
                phone_number: phone_number?.trim() || null,
                email: email?.trim() || null,
                google_mapLink: google_mapLink?.trim() || null,
                notice: notice?.trim() || null,
                open_time: open_time?.trim() || null,
            },
        });

        return successResponse(res, 'Store created successfully', newStore, 201);
    } catch (error) {
        console.error('Create store error:', error);

        // Handle Prisma-specific errors
        if (error.code === 'P2002') {
            return errorResponse(res, 'A store with similar details already exists', 409);
        }

        return errorResponse(res, 'Failed to create store', 500);
    }
};

// Get All Stores
const getAllStores = async (req, res) => {
    try {
        const storeData = await prisma.ourStore.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                image: true,
                address: true,
                phone_number: true,
                email: true,
                google_mapLink: true,
                notice: true,
                open_time: true,
                createdAt: true,
                updatedAt: true,
            }
        });

        return successResponse(res, storeData);
    } catch (error) {
        console.error('Get all stores error:', error);
        return errorResponse(res, 'Failed to retrieve stores', 500);
    }
};

// Get Store by ID
const getStoreById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const storeData = await prisma.ourStore.findUnique({
            where: { id },
        });

        if (!storeData) return errorResponse(res, 'Store not found', 404);

        return successResponse(res, 'Store retrieved successfully', storeData);
    } catch (error) {
        console.error('Get store by ID error:', error);
        return errorResponse(res, 'Failed to retrieve store', 500);
    }
};

// Update Store
const updateStore = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const { title, image, address, phone_number, email, google_mapLink, notice, open_time } = req.body;

        // Check if store exists
        const existingStore = await prisma.ourStore.findUnique({
            where: { id }
        });

        if (!existingStore) return errorResponse(res, 'Store not found', 404);

        // Validate required fields
        if (title !== undefined && title.trim() === '') {
            return errorResponse(res, 'Title cannot be empty', 400);
        }

        if (address !== undefined && address.trim() === '') {
            return errorResponse(res, 'Address cannot be empty', 400);
        }

        const updatedStore = await prisma.ourStore.update({
            where: { id },
            data: {
                title: title !== undefined ? title.trim() : existingStore.title,
                image: image !== undefined ? image.trim() : existingStore.image,
                address: address !== undefined ? address.trim() : existingStore.address,
                phone_number: phone_number !== undefined ? phone_number.trim() : existingStore.phone_number,
                email: email !== undefined ? email.trim() : existingStore.email,
                google_mapLink: google_mapLink !== undefined ? google_mapLink.trim() : existingStore.google_mapLink,
                notice: notice !== undefined ? notice.trim() : existingStore.notice,
                open_time: open_time !== undefined ? open_time.trim() : existingStore.open_time,
            },
        });

        return successResponse(res, 'Store updated successfully', updatedStore);
    } catch (error) {
        console.error('Update store error:', error);

        // Handle Prisma-specific errors
        if (error.code === 'P2025') {
            return errorResponse(res, 'Store not found', 404);
        }

        return errorResponse(res, 'Failed to update store', 500);
    }
};

// Delete Store
const deleteStore = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        // Check if store exists
        const existingStore = await prisma.ourStore.findUnique({
            where: { id }
        });

        if (!existingStore) return errorResponse(res, 'Store not found', 404);

        await prisma.ourStore.delete({
            where: { id }
        });

        return successResponse(res, 'Store deleted successfully');
    } catch (error) {
        console.error('Delete store error:', error);

        // Handle Prisma-specific errors
        if (error.code === 'P2025') {
            return errorResponse(res, 'Store not found', 404);
        }

        return errorResponse(res, 'Failed to delete store', 500);
    }
};

module.exports = {
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore
};