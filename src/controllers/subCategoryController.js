const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { generateCategoryCode } = require('../utils/generateCategoryCode');

// Create SubCategory
const createSubCategory = async (req, res) => {
    try {
        let { code, name, categoryId, status, priority = 1 } = req.body;

        if (!code || typeof code !== 'string' || !code.trim()) {
            code = await generateCategoryCode('subCategory', 'C');
        } else {
            code = code.toUpperCase().trim();
        }

        // Check if category exists and is active
        const category = await prisma.category.findUnique({
            where: { id: parseInt(categoryId) },
            include: { mainCategory: true }
        });

        if (!category) {
            return errorResponse(res, 'Category not found', 404);
        }

        if (!category.status) {
            return errorResponse(res, 'Cannot create subcategory under an inactive category', 400);
        }

        if (category.mainCategory && !category.mainCategory.status) {
            return errorResponse(res, 'Cannot create subcategory under an inactive main category', 400);
        }

        const subCategory = await prisma.subCategory.create({
            data: {
                code,
                name,
                categoryId: parseInt(categoryId),
                status,
                priority: priority !== undefined && priority !== null && priority !== '' ? parseInt(priority) : 1
            },
            include: {
                category: {
                    include: {
                        mainCategory: true
                    }
                },
                _count: {
                    select: { Product: true }
                }
            }
        });

        return successResponse(res, 'SubCategory created successfully', subCategory, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


// Get All SubCategories
const getAllSubCategories = async (req, res) => {
    try {
        const { categoryId, status } = req.query;

        const where = { };

        if (categoryId) {
            where.categoryId = parseInt(categoryId);
        }

        if (status !== undefined) {
            where.status = status === 'true';
        }

        const subCategories = await prisma.subCategory.findMany({
            where,
            include: {
                category: {
                    include: {
                        mainCategory: true
                    }
                },
                _count: {
                    select: { Product: true }
                }
            },
            orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
        });

        return successResponse(res, subCategories);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


// Get SubCategory by ID
const getSubCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const subCategory = await prisma.subCategory.findUnique({
            where: { id: parseInt(id) },
            include: {
                category: {
                    include: {
                        mainCategory: true
                    }
                },
                Product: {
                    include: {
                        brand: true,
                        unit: true,
                        warranty: true,
                        store: true,
                        VariantAttributes: true
                    }
                }
            }
        });

        if (!subCategory) {
            return errorResponse(res, 'SubCategory not found', 404);
        }

        return successResponse(res, 'SubCategory fetched successfully', subCategory);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Get SubCategories by Category ID
const getSubCategoriesByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { status = true } = req.query;

        const category = await prisma.category.findUnique({
            where: { id: parseInt(categoryId) }
        });

        if (!category) {
            return errorResponse(res, 'Category not found', 404);
        }

        const subCategories = await prisma.subCategory.findMany({
            where: {
                categoryId: parseInt(categoryId),
                status: status === 'true'
            },
            include: {
                category: {
                    include: {
                        mainCategory: true
                    }
                },
                _count: {
                    select: { Product: true }
                }
            },
            orderBy: [{ priority: 'asc' }, { name: 'asc' }]
        });

        return successResponse(res, 'SubCategories fetched successfully', subCategories);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Update SubCategory
const updateSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, categoryId, status, priority } = req.body;

        const existingSubCategory = await prisma.subCategory.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingSubCategory) {
            return errorResponse(res, 'SubCategory not found', 404);
        }

        const targetCategoryId = categoryId ? parseInt(categoryId) : existingSubCategory.categoryId;
        const category = await prisma.category.findUnique({
            where: { id: targetCategoryId },
            include: { mainCategory: true }
        });

        if (!category) {
            return errorResponse(res, 'Category not found', 404);
        }

        if (categoryId) {
            if (!category.status) {
                return errorResponse(res, 'Cannot assign subcategory to an inactive category', 400);
            }
            if (category.mainCategory && !category.mainCategory.status) {
                return errorResponse(res, 'Cannot assign subcategory to an inactive main category', 400);
            }
        }

        if (status === true) {
            if (!category.status || (category.mainCategory && !category.mainCategory.status)) {
                return errorResponse(res, 'Cannot activate subcategory because its parent category or main category is inactive', 400);
            }
        }

        const updateData = {
            code,
            name,
            categoryId: categoryId ? parseInt(categoryId) : undefined,
            status
        };

        if (priority !== undefined && priority !== null && priority !== '') {
            updateData.priority = parseInt(priority);
        }

        const updatedSubCategory = await prisma.subCategory.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                category: {
                    include: {
                        mainCategory: true
                    }
                },
                _count: {
                    select: { Product: true }
                }
            }
        });

        return successResponse(res, 'SubCategory updated successfully', updatedSubCategory);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Delete SubCategory
const deleteSubCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const existingSubCategory = await prisma.subCategory.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingSubCategory) {
            return errorResponse(res, 'SubCategory not found', 404);
        }

        await prisma.subCategory.delete({
            where: { id: parseInt(id) }
        });

        return successResponse(res, 'SubCategory deleted successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Get Complete Category Tree
const getCategoryTree = async (req, res) => {
    try {
        const categoryTree = await prisma.mainCategory.findMany({
            where: { status: true },
            include: {
                categories: {
                    where: { status: true },
                    include: {
                        subCategories: {
                            where: { status: true },
                            include: {
                                Product: {
                                    where: {
                                        // You can add product filters here if needed
                                    },
                                    select: {
                                        id: true,
                                        name: true,
                                        sku: true
                                    }
                                }
                            },
                            orderBy: [{ priority: 'asc' }, { name: 'asc' }]
                        }
                    },
                    orderBy: [{ priority: 'asc' }, { name: 'asc' }]
                }
            },
            orderBy: [{ priority: 'asc' }, { name: 'asc' }]
        });

        return successResponse(res, 'Category tree fetched successfully', categoryTree);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

module.exports = {
    createSubCategory,
    getAllSubCategories,
    getSubCategoryById,
    getSubCategoriesByCategory,
    updateSubCategory,
    deleteSubCategory,
    getCategoryTree
};