// src/controllers/collectionController.js
const prisma = require("../utils/db.js");
const { errorResponse, successResponse } = require("../utils/responseHandler.js");

// ************ Collection Create ******************
const createCollection = async (req, res) => {
    try {
        const { name, slug, status = true, priority = 1 } = req.body;

        if (!name || !name.trim()) {
            return errorResponse(res, "Collection name is required", 400);
        }

        // Generate slug if not provided
        const finalSlug = (slug || name)
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");

        // Check if slug already exists
        const existingSlug = await prisma.collection.findUnique({
            where: { slug: finalSlug }
        });

        if (existingSlug) {
            return errorResponse(res, "A collection with this slug already exists", 400);
        }

        const newCollection = await prisma.collection.create({
            data: {
                name: name.trim(),
                slug: finalSlug,
                status: status !== undefined ? Boolean(status) : true,
                priority: priority !== undefined && priority !== null && priority !== "" ? parseInt(priority) : 1
            },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        const formatted = {
            ...newCollection,
            productCount: newCollection._count?.products || 0
        };

        return successResponse(res, "Collection created successfully", formatted, 201);
    } catch (error) {
        console.error("Create Collection Error:", error);
        return errorResponse(res, error.message, 400);
    }
};

// ************ Collections Get All ******************
const getAllCollections = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = status === "true" || status === true;
        }

        const collections = await prisma.collection.findMany({
            where,
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: [
                { priority: "asc" },
                { createdAt: "desc" }
            ]
        });

        // Add a computed productCount for convenience
        const formatted = collections.map(col => ({
            ...col,
            productCount: col._count?.products || 0
        }));

        return successResponse(res, formatted);
    } catch (error) {
        console.error("Get Collections Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Collection Get By ID ******************
const getCollectionById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        const collection = await prisma.collection.findUnique({
            where: { id },
            include: {
                products: {
                    include: {
                        product: {
                            include: {
                                brand: true,
                                productVariants: true,
                                subCategory: {
                                    include: {
                                        category: {
                                            include: { mainCategory: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!collection) return errorResponse(res, "Collection not found", 404);

        return successResponse(res, {
            ...collection,
            productCount: collection.products?.length || 0
        });
    } catch (error) {
        console.error("Get Collection By ID Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Collection Get By Slug (For Frontend Dynamic Route) ******************
const getCollectionBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        if (!slug) return errorResponse(res, "Slug is required", 400);

        const collection = await prisma.collection.findUnique({
            where: { slug },
            include: {
                products: {
                    where: {
                        product: {
                            status: true,
                            isArchived: false,
                            visibility: { not: "unpublish" },
                            subCategory: {
                                status: true,
                                category: {
                                    status: true,
                                    mainCategory: {
                                        status: true,
                                    },
                                },
                            },
                        }
                    },
                    include: {
                        product: {
                            include: {
                                brand: true,
                                unit: true,
                                warranty: true,
                                VariantAttributes: true,
                                productVariants: true,
                                subCategory: {
                                    include: {
                                        category: {
                                            include: { mainCategory: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!collection) return errorResponse(res, "Collection not found", 404);

        // Extract products cleanly
        const products = collection.products.map(p => p.product);

        return successResponse(res, {
            ...collection,
            products,
            totalProducts: products.length
        });
    } catch (error) {
        console.error("Get Collection By Slug Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Collection Update ******************
const updateCollection = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        const { name, slug, status, priority } = req.body;

        const existing = await prisma.collection.findUnique({ where: { id } });
        if (!existing) return errorResponse(res, "Collection not found", 404);

        const data = {};
        if (name !== undefined) data.name = name.trim();
        if (slug !== undefined) {
            data.slug = slug
                .toString()
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-");

            // Verify unique slug
            const slugCheck = await prisma.collection.findFirst({
                where: {
                    slug: data.slug,
                    id: { not: id }
                }
            });
            if (slugCheck) {
                return errorResponse(res, "Another collection with this slug already exists", 400);
            }
        }
        if (status !== undefined) data.status = Boolean(status);
        if (priority !== undefined && priority !== null && priority !== "") data.priority = parseInt(priority);

        const updated = await prisma.collection.update({
            where: { id },
            data,
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        const formatted = {
            ...updated,
            productCount: updated._count?.products || 0
        };

        return successResponse(res, "Collection updated successfully", formatted);
    } catch (error) {
        console.error("Update Collection Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Toggle Collection Status ******************
const toggleCollectionStatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        const existing = await prisma.collection.findUnique({ where: { id } });
        if (!existing) return errorResponse(res, "Collection not found", 404);

        const newStatus = typeof req.body.status === "boolean" ? req.body.status : !existing.status;

        const updated = await prisma.collection.update({
            where: { id },
            data: { status: newStatus },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        const formatted = {
            ...updated,
            productCount: updated._count?.products || 0
        };

        return successResponse(res, "Status updated successfully", formatted);
    } catch (error) {
        console.error("Toggle Collection Status Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Delete Collection ******************
const deleteCollection = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        const existing = await prisma.collection.findUnique({ where: { id } });
        if (!existing) return errorResponse(res, "Collection not found", 404);

        await prisma.collection.delete({ where: { id } });

        return successResponse(res, "Collection deleted successfully");
    } catch (error) {
        console.error("Delete Collection Error:", error);
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    createCollection,
    getAllCollections,
    getCollectionById,
    getCollectionBySlug,
    updateCollection,
    toggleCollectionStatus,
    deleteCollection
};
