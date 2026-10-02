const prisma = require('../utils/db.js');
const { errorResponse, successResponse } = require("../utils/responseHandler.js");

const parseDecimal = (value) => (value !== undefined && value !== null ? Number(value) : null);

// Format price helper function (moved outside validateCoupon)
const formatPrice = (amount) => {
    return `৳${parseFloat(amount || 0).toLocaleString('en-BD', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

const createCoupon = async (req, res) => {
    try {
        const {
            name,
            code,
            description,
            discountType,
            discountValue,
            maxDiscountAmount,
            minOrderAmount,
            usageLimit,
            perUserLimit,
            appliesToAll = true,
            active = true,
            startAt,
            endAt,
            products,
            categories,
            combinable = false,
            metadata,
        } = req.body;

        // Basic validation
        if (!name || !code || !discountType || discountValue == null) {
            return errorResponse(res, "Name, code, discount type, and discount value are required");
        }

        // Validate discount type
        if (!['Fixed', 'Percentage'].includes(discountType)) {
            return errorResponse(res, "Discount type must be 'Fixed' or 'Percentage'");
        }

        // Validate discount value
        const discountVal = parseDecimal(discountValue);
        if (discountVal <= 0) {
            return errorResponse(res, "Discount value must be greater than 0");
        }

        // Validate percentage range
        if (discountType === 'Percentage' && discountVal > 100) {
            return errorResponse(res, "Percentage discount cannot exceed 100%");
        }

        // Validate date range
        if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
            return errorResponse(res, "Start date must be before end date");
        }

        // Check for duplicate code
        const existingCoupon = await prisma.coupon.findUnique({
            where: { code: code.toUpperCase() }
        });

        if (existingCoupon) {
            return errorResponse(res, "Coupon code already exists");
        }

        // Create coupon with relations
        const coupon = await prisma.coupon.create({
            data: {
                name,
                code: code.toUpperCase(), // Store codes in uppercase
                description: description || null,
                discountType,
                discountValue: discountVal,
                maxDiscountAmount: parseDecimal(maxDiscountAmount),
                minOrderAmount: parseDecimal(minOrderAmount),
                usageLimit: usageLimit != null ? parseInt(usageLimit) : null,
                perUserLimit: perUserLimit != null ? parseInt(perUserLimit) : null,
                appliesToAll,
                combinable,
                active,
                startAt: startAt ? new Date(startAt) : null,
                endAt: endAt ? new Date(endAt) : null,
                metadata: metadata || null,
                // Only create relations if not applies to all
                couponProducts: !appliesToAll && products?.length
                    ? { create: products.map((productId) => ({ productId: parseInt(productId) })) }
                    : undefined,
                couponCategories: !appliesToAll && categories?.length
                    ? { create: categories.map((categoryId) => ({ categoryId: parseInt(categoryId) })) }
                    : undefined,
            },
            include: {
                couponProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                            }
                        }
                    }
                },
                couponCategories: true,
            },
        });

        return successResponse(res, coupon, "Coupon created successfully");
    } catch (error) {
        console.error("Create Coupon Error:", error);

        // Handle Prisma unique constraint errors
        if (error.code === 'P2002') {
            return errorResponse(res, "Coupon code already exists");
        }

        return errorResponse(res, error.message || "Failed to create coupon");
    }
};

const getAllCoupons = async (req, res) => {
    try {
        const { active, discountType, search } = req.query;

        // Build filter conditions
        const where = {};

        if (active !== undefined) {
            where.active = active === 'true';
        }

        if (discountType && discountType !== 'all') {
            where.discountType = discountType;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const coupons = await prisma.coupon.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                couponProducts: {
                    select: {
                        id: true,
                        productId: true,
                    }
                },
                couponCategories: {
                    select: {
                        id: true,
                        categoryId: true,
                    }
                }

            },
        });

        return successResponse(res, coupons);
    } catch (error) {
        console.error("Get All Coupons Error:", error);
        return errorResponse(res, error.message);
    }
};

const getCouponById = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await prisma.coupon.findUnique({
            where: { id: parseInt(id) },
            include: {
                couponProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                price: true,
                            }
                        }
                    }
                },
                couponCategories: {
                    select: {
                        id: true,
                        categoryId: true,
                    }
                }
            },
        });

        if (!coupon) {
            return errorResponse(res, "Coupon not found", 404);
        }

        return successResponse(res, coupon);
    } catch (error) {
        console.error("Get Coupon By ID Error:", error);
        return errorResponse(res, error.message);
    }
};

const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            code,
            description,
            discountType,
            discountValue,
            maxDiscountAmount,
            minOrderAmount,
            usageLimit,
            perUserLimit,
            appliesToAll,
            active,
            startAt,
            endAt,
            products,
            categories,
            combinable,
            metadata,
        } = req.body;

        // Check if coupon exists
        const existingCoupon = await prisma.coupon.findUnique({
            where: { id: parseInt(id) },
            include: {
                couponProducts: true,
                couponCategories: true,
            }
        });

        if (!existingCoupon) {
            return errorResponse(res, "Coupon not found", 404);
        }

        // Validate discount type if provided
        if (discountType && !['Fixed', 'Percentage'].includes(discountType)) {
            return errorResponse(res, "Discount type must be 'Fixed' or 'Percentage'");
        }

        // Validate discount value if provided
        if (discountValue !== undefined) {
            const discountVal = parseDecimal(discountValue);
            if (discountVal <= 0) {
                return errorResponse(res, "Discount value must be greater than 0");
            }

            const finalDiscountType = discountType || existingCoupon.discountType;
            if (finalDiscountType === 'Percentage' && discountVal > 100) {
                return errorResponse(res, "Percentage discount cannot exceed 100%");
            }
        }

        // Validate date range if both provided
        if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
            return errorResponse(res, "Start date must be before end date");
        }

        // Check for duplicate code if changing code
        if (code && code.toUpperCase() !== existingCoupon.code) {
            const duplicateCode = await prisma.coupon.findUnique({
                where: { code: code.toUpperCase() }
            });

            if (duplicateCode) {
                return errorResponse(res, "Coupon code already exists");
            }
        }

        // Prepare update data
        const updateData = {
            ...(name && { name }),
            ...(code && { code: code.toUpperCase() }),
            ...(description !== undefined && { description: description || null }),
            ...(discountType && { discountType }),
            ...(discountValue !== undefined && { discountValue: parseDecimal(discountValue) }),
            ...(maxDiscountAmount !== undefined && { maxDiscountAmount: parseDecimal(maxDiscountAmount) }),
            ...(minOrderAmount !== undefined && { minOrderAmount: parseDecimal(minOrderAmount) }),
            ...(usageLimit !== undefined && { usageLimit: usageLimit ? parseInt(usageLimit) : null }),
            ...(perUserLimit !== undefined && { perUserLimit: perUserLimit ? parseInt(perUserLimit) : null }),
            ...(appliesToAll !== undefined && { appliesToAll }),
            ...(combinable !== undefined && { combinable }),
            ...(active !== undefined && { active }),
            ...(startAt !== undefined && { startAt: startAt ? new Date(startAt) : null }),
            ...(endAt !== undefined && { endAt: endAt ? new Date(endAt) : null }),
            ...(metadata !== undefined && { metadata }),
        };

        // Handle product/category relations update
        const finalAppliesToAll = appliesToAll !== undefined ? appliesToAll : existingCoupon.appliesToAll;

        if (!finalAppliesToAll) {
            // If products are provided, update them
            if (products !== undefined) {
                // Delete existing product relations
                await prisma.couponProduct.deleteMany({
                    where: { couponId: parseInt(id) }
                });

                // Create new product relations
                if (products.length > 0) {
                    updateData.couponProducts = {
                        create: products.map((productId) => ({
                            productId: parseInt(productId)
                        }))
                    };
                }
            }

            // If categories are provided, update them
            if (categories !== undefined) {
                // Delete existing category relations
                await prisma.couponCategory.deleteMany({
                    where: { couponId: parseInt(id) }
                });

                // Create new category relations
                if (categories.length > 0) {
                    updateData.couponCategories = {
                        create: categories.map((categoryId) => ({
                            categoryId: parseInt(categoryId)
                        }))
                    };
                }
            }
        } else {
            // If applies to all, remove all product/category relations
            await prisma.couponProduct.deleteMany({
                where: { couponId: parseInt(id) }
            });
            await prisma.couponCategory.deleteMany({
                where: { couponId: parseInt(id) }
            });
        }

        // Update the coupon
        const updatedCoupon = await prisma.coupon.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                couponProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                            }
                        }
                    }
                },
                couponCategories: true,
            },
        });

        return successResponse(res, updatedCoupon, "Coupon updated successfully");
    } catch (error) {
        console.error("Update Coupon Error:", error);

        if (error.code === 'P2002') {
            return errorResponse(res, "Coupon code already exists");
        }

        return errorResponse(res, error.message || "Failed to update coupon");
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if coupon exists
        const existingCoupon = await prisma.coupon.findUnique({
            where: { id: parseInt(id) },
            include: {
                _count: {
                    select: {
                        redemptions: true,
                    }
                }
            }
        });

        if (!existingCoupon) {
            return errorResponse(res, "Coupon not found", 404);
        }

        // Optional: Prevent deletion if coupon has been redeemed
        // if (existingCoupon._count.redemptions > 0) {
        //     return errorResponse(res, "Cannot delete coupon that has been redeemed. Consider deactivating it instead.", 400);
        // }

        // Delete coupon (cascade will handle relations)
        await prisma.coupon.delete({
            where: { id: parseInt(id) },
        });

        return successResponse(res, { id: parseInt(id) }, "Coupon deleted successfully");
    } catch (error) {
        console.error("Delete Coupon Error:", error);

        // Handle foreign key constraint errors
        if (error.code === 'P2003') {
            return errorResponse(res, "Cannot delete coupon due to existing dependencies", 400);
        }

        return errorResponse(res, error.message || "Failed to delete coupon");
    }
};

// Toggle coupon active status
const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;

        if (active === undefined) {
            return errorResponse(res, "Active status is required");
        }

        const updatedCoupon = await prisma.coupon.update({
            where: { id: parseInt(id) },
            data: { active: Boolean(active) },
            select: {
                id: true,
                name: true,
                code: true,
                active: true,
            }
        });

        return successResponse(res, updatedCoupon, `Coupon ${active ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
        console.error("Toggle Coupon Status Error:", error);

        if (error.code === 'P2025') {
            return errorResponse(res, "Coupon not found", 404);
        }

        return errorResponse(res, error.message || "Failed to update coupon status");
    }
};

// Get coupon by code (alternative route)
const getCouponByCode = async (req, res) => {
    try {
        const { code } = req.params;

        if (!code) {
            return errorResponse(res, "Coupon code is required");
        }

        const coupon = await prisma.coupon.findUnique({
            where: {
                code: code.toUpperCase()
            },
            include: {
                couponProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true
                            }
                        }
                    }
                },
                couponCategories: {
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
            }
        });

        if (!coupon) {
            return errorResponse(res, "Coupon not found", 404);
        }

        return successResponse(res, coupon, "Coupon retrieved successfully");

    } catch (error) {
        console.error("Get Coupon By Code Error:", error);
        return errorResponse(res, error.message || "Failed to retrieve coupon");
    }
};

const validateCoupon = async (req, res) => {
    try {
        const { code, orderAmount, productIds = [] } = req.body;

        if (!code) {
            return errorResponse(res, "Coupon code is required");
        }

        // Find coupon (make sure to check all necessary fields)
        const coupon = await prisma.coupon.findUnique({
            where: {
                code: code.toUpperCase().trim()
            },
            include: {
                couponProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true
                            }
                        }
                    }
                },
                couponCategories: {
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                },
            }
        });

        // Check if coupon exists
        if (!coupon) {
            return errorResponse(res, "Invalid coupon code", 400);
        }

        // Check if coupon is active
        if (!coupon.active) {
            return errorResponse(res, "This coupon is not active", 400);
        }

        // Check coupon validity dates
        const now = new Date();
        if (coupon.startAt && new Date(coupon.startAt) > now) {
            return successResponse(res, {
                valid: false,
                message: "This coupon is not yet valid"
            });
        }

        if (coupon.endAt && new Date(coupon.endAt) < now) {
            return successResponse(res, {
                valid: false,
                message: "This coupon has expired"
            });
        }

        // Check minimum order amount
        const minOrder = parseFloat(coupon.minOrderAmount || 0);
        const orderTotal = parseFloat(orderAmount || 0);

        if (orderTotal < minOrder) {
            return successResponse(res, {
                valid: false,
                message: `Minimum order amount is ${formatPrice(minOrder)}`
            });
        }

        // Check product applicability
        if (!coupon.appliesToAll && productIds.length > 0) {
            const applicableProductIds = coupon.couponProducts.map(cp => cp.productId);
            const hasApplicableProduct = productIds.some(id =>
                applicableProductIds.includes(parseInt(id))
            );

            if (!hasApplicableProduct) {
                return successResponse(res, {
                    valid: false,
                    message: "This coupon is not applicable to the selected products"
                });
            }
        }

        // Calculate discount
        let discountAmount = 0;
        const discountValue = parseFloat(coupon.discountValue || 0);

        if (coupon.discountType === 'Fixed') {
            discountAmount = Math.min(discountValue, orderTotal);
        } else if (coupon.discountType === 'Percentage') {
            discountAmount = (orderTotal * discountValue) / 100;

            // Apply maximum discount if specified
            if (coupon.maxDiscountAmount) {
                const maxDiscount = parseFloat(coupon.maxDiscountAmount);
                discountAmount = Math.min(discountAmount, maxDiscount);
            }

            // Ensure discount doesn't exceed order amount
            discountAmount = Math.min(discountAmount, orderTotal);
        }

        return successResponse(res, {
            valid: true,
            coupon: {
                id: coupon.id,
                name: coupon.name,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                maxDiscountAmount: coupon.maxDiscountAmount,
                minOrderAmount: coupon.minOrderAmount,
                appliesToAll: coupon.appliesToAll,
                usageLimit: coupon.usageLimit,
                perUserLimit: coupon.perUserLimit,
                startAt: coupon.startAt,
                endAt: coupon.endAt,
                active: coupon.active,
                description: coupon.description,
                combinable: coupon.combinable
            },
            discountAmount: parseFloat(discountAmount.toFixed(2)),
            formattedDiscount: formatPrice(discountAmount),
            discountPercentage: coupon.discountType === 'Percentage' ? discountValue : null,
            message: "Coupon applied successfully"
        });

    } catch (error) {
        console.error("Validate Coupon Error:", error);
        return errorResponse(res, error.message || "Failed to validate coupon");
    }
};

module.exports = {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    validateCoupon,
    getCouponByCode
};