const prisma = require('../utils/db.js');
const { successResponse, errorResponse } = require("../utils/responseHandler.js");

/** ---------------------------------------
 *  Reusable formatter
 --------------------------------------- */
const formatWishlistItems = (items) => {
    return items.map(item => {
        if (!item.product) {
            console.warn('Product missing in item:', item);
            return null;
        }

        const product = item.product;
        const quantity = Number(product.quantity) || 0;
        const isActive = product.status !== false; // Convert status to isActive for frontend

        return {
            id: item.id,
            productId: product.id,
            name: product.productName, // Use productName from your database
            slug: product.slug,
            price: product.discountPrice || product.price,
            originalPrice: product.price,
            image: product.images?.[0],
            quantity: quantity,
            quantityStatus: quantity > 0 ? 'In Stock' : 'Out of Stock',
            isActive: isActive, // Convert from status
            subCategory: product.subCategory?.name,
            addedAt: item.createdAt
        };
    }).filter(item => item !== null); // Remove null items
};

/** ---------------------------------------
 * Add to wishlist
 --------------------------------------- */
const addToWishlist = async (req, res) => {
    try {
        const customerId = req?.user?.id;
        if (!customerId) return errorResponse(res, "Unauthorized", 401);

        const { productId } = req.body;
        const parsedProductId = parseInt(productId);

        if (!parsedProductId) {
            return errorResponse(res, "Valid product ID required", 400);
        }

        // Use productName and status from your schema
        const product = await prisma.product.findUnique({
            where: { id: parsedProductId },
            select: {
                id: true,
                productName: true, // Changed from name to productName
                status: true,      // Changed from isActive to status
                quantity: true     // Added quantity check
            }
        });

        console.log('Product found:', product); // Debug log

        // Check if product exists and is active (status)
        if (!product || !product.status) {
            return errorResponse(res, "Product unavailable", 404);
        }

        const existingItem = await prisma.wishlist.findUnique({
            where: {
                customerId_productId: { customerId, productId: parsedProductId }
            }
        });

        if (existingItem) {
            return errorResponse(res, "Already added", 409);
        }

        const created = await prisma.wishlist.create({
            data: { customerId, productId: parsedProductId },
            include: {
                product: {
                    select: {
                        id: true,
                        productName: true, // Changed from name
                        slug: true,
                        price: true,
                        discountPrice: true,
                        images: true,
                        quantity: true,
                        status: true,      // Changed from isActive
                        subCategory: { select: { name: true } }
                    }
                }
            }
        });

        return successResponse(res, formatWishlistItems([created])[0], "Added");
    } catch (err) {
        console.error("Add wishlist error:", err);
        return errorResponse(res, "Failed to add", 500);
    }
};

/** ---------------------------------------
 * Get wishlist
 --------------------------------------- */
const getWishlist = async (req, res) => {
    try {
        const customerId = req.user.id;

        const wishlist = await prisma.wishlist.findMany({
            where: { customerId },
            include: {
                product: {
                    select: {
                        id: true,
                        productName: true, // Changed from name
                        slug: true,
                        price: true,
                        discountPrice: true,
                        images: true,
                        quantity: true,
                        status: true,      // Changed from isActive
                        subCategory: { select: { name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log('Wishlist from DB:', wishlist); // Debug log
        return successResponse(res, formatWishlistItems(wishlist));
    } catch (err) {
        console.error("Fetch wishlist error:", err);
        return errorResponse(res, "Failed to fetch", 500);
    }
};

/** ---------------------------------------
 * Remove item
 --------------------------------------- */
const removeFromWishlist = async (req, res) => {
    try {
        const customerId = req.user.id;
        const productId = parseInt(req.params.productId);

        if (!productId) return errorResponse(res, "Invalid product ID", 400);

        const item = await prisma.wishlist.findUnique({
            where: { customerId_productId: { customerId, productId } }
        });

        if (!item) return errorResponse(res, "Not found", 404);

        await prisma.wishlist.delete({
            where: { customerId_productId: { customerId, productId } }
        });

        return successResponse(res, null, "Removed");
    } catch (err) {
        console.error("Remove wishlist error:", err);
        return errorResponse(res, "Failed to remove", 500);
    }
};

/** ---------------------------------------
 * Clear wishlist
 --------------------------------------- */
const clearWishlist = async (req, res) => {
    try {
        const customerId = req.user.id;

        await prisma.wishlist.deleteMany({ where: { customerId } });

        return successResponse(res, null, "Cleared");
    } catch (err) {
        console.error("Clear wishlist error:", err);
        return errorResponse(res, "Failed to clear", 500);
    }
};

/** ---------------------------------------
 * Sync wishlist after login
 --------------------------------------- */
const syncWishlist = async (req, res) => {
    try {
        const customerId = req.user.id;
        const { productIds } = req.body;

        if (!Array.isArray(productIds) || productIds.length === 0) {
            return successResponse(res, [], "No items to sync");
        }

        const ids = productIds.map(Number).filter(n => !isNaN(n));

        const result = await prisma.$transaction(async (tx) => {
            const existing = await tx.wishlist.findMany({
                where: { customerId },
                select: { productId: true }
            });

            const existingIds = new Set(existing.map(i => i.productId));
            const newIds = ids.filter(id => !existingIds.has(id));

            const validProducts = await tx.product.findMany({
                where: {
                    id: { in: newIds },
                    status: true // Use status instead of isActive
                },
                select: { id: true }
            });

            const validIds = validProducts.map(p => p.id);

            if (validIds.length > 0) {
                await tx.wishlist.createMany({
                    data: validIds.map(id => ({
                        customerId,
                        productId: id
                    })),
                    skipDuplicates: true
                });
            }

            const updated = await tx.wishlist.findMany({
                where: { customerId },
                include: {
                    product: {
                        select: {
                            id: true,
                            productName: true, // Use productName
                            slug: true,
                            price: true,
                            discountPrice: true,
                            images: true,
                            quantity: true,
                            status: true, // Use status
                            subCategory: { select: { name: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            return updated;
        });

        return successResponse(res, formatWishlistItems(result), "Synced");
    } catch (err) {
        console.error("Sync wishlist error:", err);
        return errorResponse(res, "Failed to sync", 500);
    }
};

module.exports = {
    addToWishlist,
    getWishlist,
    removeFromWishlist,
    clearWishlist,
    syncWishlist
};