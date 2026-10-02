// src/controllers/mainCategory.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { generateCategoryCode } = require('../utils/generateCategoryCode');

//Get All Main Categories
const getAllMainCategories = async (req, res) => {
    try {

        const { status } = req.query;
        const where = {};
        if (status !== undefined) {
            where.status = status === 'true';
        }

        const mainCategories = await prisma.mainCategory.findMany({
            where,
            include: {
                categories: {
                    include: { 
                        subCategories: {
                            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                        } 
                    },
                    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                },
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        });        
        return successResponse(res, mainCategories);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

//Get Main Category by ID
const getMainCategoryById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const mainCategory = await prisma.mainCategory.findUnique({
            where: { id },
            include: {
                categories: {
                    include: { 
                        subCategories: {
                            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                        } 
                    },
                    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                },
            },
        });

        if (!mainCategory) return errorResponse(res, 'Main category not found', 404);

        return successResponse(res, mainCategory);
    } catch (error) {
        return errorResponse(res, error.message);
    }
};

//Create Main Category
const createMainCategory = async (req, res) => {
    try {
        let { code, name, image, description, status = true, priority = 1 } = req.body;

        if (!code || typeof code !== 'string' || !code.trim()) {
            code = await generateCategoryCode('mainCategory', 'A');
        } else {
            code = code.toUpperCase().trim();
        }

        const existing = await prisma.mainCategory.findUnique({ where: { code } });
        if (existing) return errorResponse(res, 'Main category code already exists', 400);

        const newCategory = await prisma.mainCategory.create({
            data: { 
                code, 
                name, 
                image, 
                description, 
                status,
                priority: priority !== undefined && priority !== null && priority !== '' ? parseInt(priority) : 1
            },
        });

        return successResponse(res, 'Main category created successfully', newCategory, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

//Update Main Category
const updateMainCategory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const { name, image, description, status, priority } = req.body;

        const existing = await prisma.mainCategory.findUnique({ where: { id } });
        if (!existing) return errorResponse(res, 'Main category not found', 404);

        const updateData = { name, image, description, status };
        if (priority !== undefined && priority !== null && priority !== '') {
            updateData.priority = parseInt(priority);
        }

        const updated = await prisma.mainCategory.update({
            where: { id },
            data: updateData,
        });

        return successResponse(res, updated);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

//Delete Main Category
const deleteMainCategory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const existing = await prisma.mainCategory.findUnique({ where: { id } });
        if (!existing) return errorResponse(res, 'Main category not found', 404);

        await prisma.mainCategory.delete({ where: { id } });

        return successResponse(res, 'Main category deleted successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    getAllMainCategories,
    getMainCategoryById,
    createMainCategory,
    updateMainCategory,
    deleteMainCategory,
};
