const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { generateCategoryCode } = require('../utils/generateCategoryCode');

// Create Category
const createCategory = async (req, res) => {
    try {
        let { code, name, image, mainCategoryId, status = true, priority = 1 } = req.body;

        if (!code || typeof code !== 'string' || !code.trim()) {
            code = await generateCategoryCode('category', 'B');
        } else {
            code = code.toUpperCase().trim();
        }

        // Check if main category exists and is active
        const mainCategory = await prisma.mainCategory.findUnique({
            where: { id: parseInt(mainCategoryId) }
        });

        if (!mainCategory) {
            return errorResponse(res, 'Main category not found', 404);
        }

        if (!mainCategory.status) {
            return errorResponse(res, 'Cannot create category under an inactive main category', 400);
        }

        const category = await prisma.category.create({
            data: {
                code,
                name,
                image,
                mainCategoryId: parseInt(mainCategoryId),
                status,
                priority: priority !== undefined && priority !== null && priority !== '' ? parseInt(priority) : 1
            },
            include: {
                mainCategory: true,
                subCategories: {
                    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                }
            }
        });

        return successResponse(res, 'Category created successfully', category, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


// Get All Categories
const getAllCategories = async (req, res) => {
    try {
        const { mainCategoryId, status } = req.query;
        const where = {};

        if (mainCategoryId) {
            where.mainCategoryId = parseInt(mainCategoryId);
        }

        if (status !== undefined) {
            where.status = status === 'true';
        }

        const categories = await prisma.category.findMany({
            where,
            include: {
                mainCategory: true,
                subCategories: {
                    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                }
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
        });

        return successResponse(res, categories);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Get Category by ID
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                mainCategory: true,
                subCategories: {
                    include: {
                        Product: true
                    },
                    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                }
            }
        });

        if (!category) {
            return errorResponse(res, 'Category not found', 404);
        }

        return successResponse(res, 'Category fetched successfully', category);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Update Category
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, image, mainCategoryId, status, priority } = req.body;

        const existingCategory = await prisma.category.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingCategory) {
            return errorResponse(res, 'Category not found', 404);
        }

        const targetMainCategoryId = mainCategoryId ? parseInt(mainCategoryId) : existingCategory.mainCategoryId;
        const mainCategory = await prisma.mainCategory.findUnique({
            where: { id: targetMainCategoryId }
        });

        if (!mainCategory) {
            return errorResponse(res, 'Main category not found', 404);
        }

        if (mainCategoryId && !mainCategory.status) {
            return errorResponse(res, 'Cannot assign category to an inactive main category', 400);
        }

        if (status === true && !mainCategory.status) {
            return errorResponse(res, 'Cannot activate category because its main category is inactive', 400);
        }

        const updateData = {
            code,
            name,
            image,
            mainCategoryId: mainCategoryId ? parseInt(mainCategoryId) : undefined,
            status
        };

        if (priority !== undefined && priority !== null && priority !== '') {
            updateData.priority = parseInt(priority);
        }

        const updatedCategory = await prisma.category.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                mainCategory: true,
                subCategories: {
                    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
                }
            }
        });

        return successResponse(res, 'Category updated successfully', updatedCategory);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Delete Category
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const existingCategory = await prisma.category.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingCategory) {
            return errorResponse(res, 'Category not found', 404);
        }

        await prisma.category.delete({
            where: { id: parseInt(id) }
        });

        return successResponse(res, 'Category deleted successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory
};