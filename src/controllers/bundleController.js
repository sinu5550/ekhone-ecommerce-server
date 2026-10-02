const prisma = require('../utils/db');
const { errorResponse, successResponse } = require("../utils/responseHandler");


const calculateBundlePricing = (items, products, discountType, discountValue) => {

    // Step 1: Calculate total bundle price from all products
    let totalBundlePrice = 0;
    const itemDetails = [];

    items.forEach(item => {
        const product = products.find(p => p.id === parseInt(item.productId));
        if (!product) {
            throw new Error(`Product with ID ${item.productId} not found`);
        }

        const quantity = item.quantity || 1;
        const itemPrice = Number(product.price) * quantity;

        totalBundlePrice += itemPrice;

        itemDetails.push({
            productId: product.id,
            quantity,
            unitPrice: Number(product.price),
            itemPrice,
            tax: product.tax || 0,
            taxType: product.taxType || 'exclusive'
        });
    });

    // Step 2: Apply bundle discount to total price
    let discountAmount = 0;
    if (discountType === 'Percentage') {
        discountAmount = (totalBundlePrice * Number(discountValue)) / 100;
    } else if (discountType === 'Fixed') {
        discountAmount = Number(discountValue);
    }

    const priceAfterDiscount = Math.max(0, totalBundlePrice - discountAmount);

    // Step 3: Calculate VAT/TAX on discounted price
    // Each product's tax is applied proportionally to its share of the discounted price
    let totalVAT = 0;

    itemDetails.forEach(item => {
        // Calculate this product's proportion of the total bundle price
        const proportion = totalBundlePrice > 0 ? item.itemPrice / totalBundlePrice : 0;

        // Calculate this product's share of the discounted price
        const discountedItemPrice = priceAfterDiscount * proportion;

        // Apply VAT based on tax type
        let itemVAT = 0;
        if (item.taxType === 'inclusive') {
            // For inclusive tax: VAT is already included in the price
            // Extract VAT amount: VAT = Price - (Price / (1 + tax_rate))
            const taxRate = item.tax / 100;
            itemVAT = discountedItemPrice - (discountedItemPrice / (1 + taxRate));
        } else {
            // For exclusive tax: VAT is added on top
            // VAT = Price × tax_rate
            itemVAT = discountedItemPrice * (item.tax / 100);
        }

        totalVAT += itemVAT;
    });

    // Step 4: Calculate final price
    const finalPrice = priceAfterDiscount + totalVAT;

    return {
        totalBundlePrice: Number(totalBundlePrice.toFixed(2)),
        discountAmount: Number(discountAmount.toFixed(2)),
        priceAfterDiscount: Number(priceAfterDiscount.toFixed(2)),
        totalVAT: Number(totalVAT.toFixed(2)),
        finalPrice: Number(finalPrice.toFixed(2)),
        itemDetails
    };
};

/**
 * Calculate detailed stats for a bundle
 */
const calculateBundleStats = (bundle) => {
    const totalOriginalPrice = bundle.bundleItems.reduce((total, item) => {
        return total + (Number(item.product.price) * item.quantity);
    }, 0);

    const totalSavings = totalOriginalPrice - Number(bundle.finalPrice);
    const savingsPercentage = totalOriginalPrice > 0
        ? (totalSavings / totalOriginalPrice * 100)
        : 0;

    return {
        totalOriginalPrice: Number(totalOriginalPrice.toFixed(2)),
        totalSavings: Number(totalSavings.toFixed(2)),
        savingsPercentage: Number(savingsPercentage.toFixed(1))
    };
};

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * Create new bundle product
 */
const createBundle = async (req, res) => {
    try {
        const {
            name,
            slug,
            image,
            description,
            discountType,
            discountValue,
            status = true,
            stockQuantity = 0,
            minQuantity = 1,
            maxQuantity,
            startDate,
            endDate,
            sortOrder = 0,
            isFeatured = false,
            items
        } = req.body;

        // ========== VALIDATION ==========
        if (!name?.trim()) {
            return errorResponse(res, 'Bundle name is required', 400);
        }

        if (!slug?.trim()) {
            return errorResponse(res, 'Slug is required', 400);
        }

        if (!image?.trim()) {
            return errorResponse(res, 'Image is required', 400);
        }

        if (!discountType || !['Percentage', 'Fixed'].includes(discountType)) {
            return errorResponse(res, 'Valid discount type (Percentage/Fixed) is required', 400);
        }

        if (!discountValue || Number(discountValue) < 0) {
            return errorResponse(res, 'Valid discount value is required', 400);
        }

        if (!items || !Array.isArray(items) || items.length < 2) {
            return errorResponse(res, 'Bundle must contain at least 2 products', 400);
        }

        // ========== FETCH PRODUCTS ==========
        const productIds = items.map(item => parseInt(item.productId));
        const products = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                productName: true,
                price: true,
                tax: true,
                taxType: true,
                quantity: true
            }
        });

        if (products.length !== productIds.length) {
            return errorResponse(res, 'Some products not found', 404);
        }

        // Check stock availability
        for (const item of items) {
            const product = products.find(p => p.id === parseInt(item.productId));
            if (product.quantity < (item.quantity || 1)) {
                return errorResponse(
                    res,
                    `Insufficient stock for ${product.productName}. Available: ${product.quantity}`,
                    400
                );
            }
        }

        // ========== CALCULATE PRICING ==========
        const pricing = calculateBundlePricing(
            items,
            products,
            discountType,
            discountValue
        );

        // Validate final price
        if (pricing.finalPrice < 0) {
            return errorResponse(res, 'Final price cannot be negative', 400);
        }

        // ========== CREATE BUNDLE ==========
        const bundleData = await prisma.bundleProduct.create({
            data: {
                name: name.trim(),
                slug: slug.trim(),
                image: image.trim(),
                description: description?.trim(),
                discountType,
                discountValue: Number(discountValue),
                price: pricing.totalBundlePrice,
                discountAmount: pricing.discountAmount,
                totalVAT: pricing.totalVAT,
                finalPrice: pricing.finalPrice,
                status,
                stockQuantity: Number(stockQuantity),
                minQuantity: Number(minQuantity),
                maxQuantity: maxQuantity ? Number(maxQuantity) : null,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                sortOrder: Number(sortOrder),
                isFeatured,
                bundleItems: {
                    create: items.map((item, index) => ({
                        productId: parseInt(item.productId),
                        quantity: item.quantity || 1,
                        sortOrder: index
                    }))
                }
            },
            include: {
                bundleItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                price: true,
                                tax: true,
                                taxType: true,
                                images: true,
                                quantity: true
                            }
                        }
                    }
                }
            }
        });

        return successResponse(res, 'Bundle created successfully', bundleData, 201);

    } catch (error) {
        console.error('Create bundle error:', error);

        if (error.code === 'P2002') {
            return errorResponse(res, 'Bundle with this slug already exists', 400);
        }

        return errorResponse(res, error.message || 'Failed to create bundle', 500);
    }
};

/**
 * Get all bundles with pagination and filters
 */
const getAllBundles = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            search,
            featured
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const where = {};

        if (status !== undefined) {
            where.status = status === 'true';
        }

        if (search?.trim()) {
            where.OR = [
                { name: { contains: search.trim(), mode: 'insensitive' } },
                { description: { contains: search.trim(), mode: 'insensitive' } },
                { slug: { contains: search.trim(), mode: 'insensitive' } }
            ];
        }

        // Fetch bundles
        const [bundles, total] = await Promise.all([
            prisma.bundleProduct.findMany({
                where,
                include: {
                    bundleItems: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    productName: true,
                                    slug: true,
                                    price: true,
                                    tax: true,
                                    taxType: true,
                                    images: true,
                                    quantity: true,
                                    insideDhakaDeliveryCharge: true,
                                    outsideDhakaDeliveryCharge: true
                                }
                            }
                        },
                        orderBy: { sortOrder: 'asc' }
                    },
                    _count: {
                        select: { bundleItems: true }
                    }
                },
                skip,
                take: parseInt(limit),
                orderBy: { sortOrder: 'asc' }
            }),
            prisma.bundleProduct.count({ where })
        ]);

        // Calculate stats for each bundle
        const bundlesWithStats = bundles.map(bundle => ({
            ...bundle,
            ...calculateBundleStats(bundle)
        }));

        return successResponse(res, {
            data: bundlesWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get bundles error:', error);
        return errorResponse(res, 'Failed to fetch bundles', 500);
    }
};

/**
 * Get single bundle by ID
 */
const getBundleById = async (req, res) => {
    try {
        const { id } = req.params;

        const bundle = await prisma.bundleProduct.findUnique({
            where: { id: parseInt(id) },
            include: {
                bundleItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                slug: true,
                                sku: true,
                                price: true,
                                tax: true,
                                taxType: true,
                                images: true,
                                quantity: true,
                                insideDhakaDeliveryCharge: true,
                                outsideDhakaDeliveryCharge: true
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        if (!bundle) {
            return errorResponse(res, 'Bundle not found', 404);
        }

        // Calculate detailed stats
        const stats = calculateBundleStats(bundle);

        const bundleWithDetails = {
            ...bundle,
            ...stats,
            priceAfterDiscount: Number(bundle.price) - Number(bundle.discountAmount)
        };

        return successResponse(res, 'Bundle fetched successfully', bundleWithDetails);

    } catch (error) {
        console.error('Get bundle error:', error);
        return errorResponse(res, 'Failed to fetch bundle', 500);
    }
};

/**
 * Get single bundle by slug
 */
const getBundleBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        if (!slug?.trim()) {
            return errorResponse(res, 'Slug is required', 400);
        }

        const bundle = await prisma.bundleProduct.findUnique({
            where: { slug: slug.trim() },
            include: {
                bundleItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                slug: true,
                                sku: true,
                                price: true,
                                tax: true,
                                taxType: true,
                                images: true,
                                quantity: true,
                                insideDhakaDeliveryCharge: true,
                                outsideDhakaDeliveryCharge: true,
                                subCategory: true,
                                brand: true
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                },
                _count: {
                    select: { bundleItems: true }
                }
            }
        });

        if (!bundle) {
            return errorResponse(res, 'Bundle not found', 404);
        }

        // Calculate detailed stats
        const stats = calculateBundleStats(bundle);

        const bundleWithDetails = {
            ...bundle,
            ...stats,
            priceAfterDiscount: Number(bundle.price) - Number(bundle.discountAmount)
        };

        return successResponse(res, bundleWithDetails);

    } catch (error) {
        console.error('Get bundle by slug error:', error);
        return errorResponse(res, 'Failed to fetch bundle', 500);
    }
};

/**
 * Update bundle
 */
const updateBundle = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            slug,
            image,
            description,
            discountType,
            discountValue,
            status,
            stockQuantity,
            minQuantity,
            maxQuantity,
            startDate,
            endDate,
            sortOrder,
            isFeatured,
            items
        } = req.body;

        // Check if bundle exists
        const existingBundle = await prisma.bundleProduct.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingBundle) {
            return errorResponse(res, 'Bundle not found', 404);
        }

        // Prepare update data
        const updateData = {};

        if (name !== undefined) updateData.name = name.trim();
        if (slug !== undefined) updateData.slug = slug.trim();
        if (image !== undefined) updateData.image = image.trim();
        if (description !== undefined) updateData.description = description?.trim();
        if (status !== undefined) updateData.status = status;
        if (stockQuantity !== undefined) updateData.stockQuantity = Number(stockQuantity);
        if (minQuantity !== undefined) updateData.minQuantity = Number(minQuantity);
        if (maxQuantity !== undefined) updateData.maxQuantity = maxQuantity ? Number(maxQuantity) : null;
        if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (sortOrder !== undefined) updateData.sortOrder = Number(sortOrder);
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;

        // If items or pricing changed, recalculate
        if (items || discountType || discountValue) {
            const finalDiscountType = discountType || existingBundle.discountType;
            const finalDiscountValue = discountValue || existingBundle.discountValue;
            const finalItems = items || [];

            if (finalItems.length > 0) {
                // Fetch products
                const productIds = finalItems.map(item => parseInt(item.productId));
                const products = await prisma.product.findMany({
                    where: { id: { in: productIds } },
                    select: {
                        id: true,
                        productName: true,
                        price: true,
                        tax: true,
                        taxType: true,
                        quantity: true
                    }
                });

                // Check stock
                for (const item of finalItems) {
                    const product = products.find(p => p.id === parseInt(item.productId));
                    if (product.quantity < (item.quantity || 1)) {
                        return errorResponse(
                            res,
                            `Insufficient stock for ${product.productName}`,
                            400
                        );
                    }
                }

                // Recalculate pricing
                const pricing = calculateBundlePricing(
                    finalItems,
                    products,
                    finalDiscountType,
                    finalDiscountValue
                );

                if (pricing.finalPrice < 0) {
                    return errorResponse(res, 'Final price cannot be negative', 400);
                }

                updateData.discountType = finalDiscountType;
                updateData.discountValue = Number(finalDiscountValue);
                updateData.price = pricing.totalBundlePrice;
                updateData.discountAmount = pricing.discountAmount;
                updateData.totalVAT = pricing.totalVAT;
                updateData.finalPrice = pricing.finalPrice;
            }
        }

        // Update in transaction
        const result = await prisma.$transaction(async (tx) => {
            // Update bundle
            const bundle = await tx.bundleProduct.update({
                where: { id: parseInt(id) },
                data: updateData
            });

            // Update items if provided
            if (items && Array.isArray(items) && items.length > 0) {
                // Delete existing items
                await tx.bundleItem.deleteMany({
                    where: { bundleId: parseInt(id) }
                });

                // Create new items
                await tx.bundleItem.createMany({
                    data: items.map((item, index) => ({
                        bundleId: parseInt(id),
                        productId: parseInt(item.productId),
                        quantity: item.quantity || 1,
                        sortOrder: index
                    }))
                });
            }

            // Return updated bundle with items
            return await tx.bundleProduct.findUnique({
                where: { id: parseInt(id) },
                include: {
                    bundleItems: {
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    productName: true,
                                    price: true,
                                    tax: true,
                                    taxType: true,
                                    images: true,
                                    quantity: true
                                }
                            }
                        },
                        orderBy: { sortOrder: 'asc' }
                    }
                }
            });
        });

        return successResponse(res, 'Bundle updated successfully', result);

    } catch (error) {
        console.error('Update bundle error:', error);

        if (error.code === 'P2002') {
            return errorResponse(res, 'Bundle with this slug already exists', 400);
        }

        return errorResponse(res, 'Failed to update bundle', 500);
    }
};

/**
 * Delete bundle
 */
const deleteBundle = async (req, res) => {
    try {
        const { id } = req.params;

        const bundle = await prisma.bundleProduct.findUnique({
            where: { id: parseInt(id) }
        });

        if (!bundle) {
            return errorResponse(res, 'Bundle not found', 404);
        }

        await prisma.bundleProduct.delete({
            where: { id: parseInt(id) }
        });

        return successResponse(res, 'Bundle deleted successfully');

    } catch (error) {
        console.error('Delete bundle error:', error);
        return errorResponse(res, 'Failed to delete bundle', 500);
    }
};

/**
 * Toggle bundle status
 */
const toggleBundleStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const bundle = await prisma.bundleProduct.findUnique({
            where: { id: parseInt(id) }
        });

        if (!bundle) {
            return errorResponse(res, 'Bundle not found', 404);
        }

        const updatedBundle = await prisma.bundleProduct.update({
            where: { id: parseInt(id) },
            data: { status: !bundle.status }
        });

        const message = `Bundle ${updatedBundle.status ? 'activated' : 'deactivated'} successfully`;
        return successResponse(res, message, updatedBundle);

    } catch (error) {
        console.error('Toggle bundle status error:', error);
        return errorResponse(res, 'Failed to toggle bundle status', 500);
    }
};

/**
 * Toggle featured status
 */
const toggleFeaturedStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const bundle = await prisma.bundleProduct.findUnique({
            where: { id: parseInt(id) }
        });

        if (!bundle) {
            return errorResponse(res, 'Bundle not found', 404);
        }

        const updatedBundle = await prisma.bundleProduct.update({
            where: { id: parseInt(id) },
            data: { isFeatured: !bundle.isFeatured }
        });

        const message = `Bundle ${updatedBundle.isFeatured ? 'added to featured' : 'removed from featured'} successfully`;
        return successResponse(res, message, updatedBundle);

    } catch (error) {
        console.error('Toggle featured status error:', error);
        return errorResponse(res, 'Failed to toggle featured status', 500);
    }
};


module.exports = {
    createBundle,
    getAllBundles,
    getBundleById,
    getBundleBySlug,
    updateBundle,
    deleteBundle,
    toggleBundleStatus,
    toggleFeaturedStatus
};