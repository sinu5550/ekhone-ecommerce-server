const prisma = require('../utils/db.js');
const { errorResponse, successResponse } = require("../utils/responseHandler.js");

const parseDecimal = (value) => (value !== undefined && value !== null ? Number(value) : null);
const parseInt_ = (value) => (value !== undefined && value !== null ? parseInt(value) : null);


// ============================================
//              CREATE DISCOUNT CAMPAIGN
// ============================================
const createDiscountCampaign = async (req, res) => {
    try {
        const {
            campaignCode,
            name,
            description,
            CampaignType,
            discountType,
            discountValue,
            maxDiscountAmount,
            minOrderAmount,
            appliesToAll = false,
            stockLimit,
            perCustomerLimit,
            startAt,
            endAt,
            priority = 0,
            combinableWithCoupon = true,
            isFeatured = false,
            bannerImage,
            showCountdown = false,
            showBadge = true,
            badgeText,
            badgeColor,
            active = true,
            products = [],
            categories = [],
            subCategories = [],
        } = req.body;

        // Validation
        if (!campaignCode || !name || !discountType || discountValue == null) {
            return errorResponse(res, "Campaign code, name, discount type, and discount value are required", 400);
        }

        if (!['Fixed', 'Percentage'].includes(discountType)) {
            return errorResponse(res, "Discount type must be 'Fixed' or 'Percentage'", 400);
        }

        const discountVal = parseDecimal(discountValue);
        if (discountVal <= 0) {
            return errorResponse(res, "Discount value must be greater than 0", 400);
        }

        if (discountType === 'Percentage' && discountVal > 100) {
            return errorResponse(res, "Percentage discount cannot exceed 100%", 400);
        }

        if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
            return errorResponse(res, "Start date must be before end date", 400);
        }

        // Determine status
        let status = "Draft";
        if (active) {
            const now = new Date();
            if (startAt && new Date(startAt) > now) {
                status = "Scheduled";
            } else if (!endAt || new Date(endAt) > now) {
                status = "Active";
            } else {
                status = "Expired";
            }
        }

        // Build campaign data
        const campaignData = {
            campaignCode: campaignCode.toUpperCase(),
            name,
            description: description || null,
            CampaignType,
            status,
            discountType,
            discountValue: discountVal,
            maxDiscountAmount: parseDecimal(maxDiscountAmount),
            minOrderAmount: parseDecimal(minOrderAmount),
            appliesToAll,
            stockLimit: parseInt_(stockLimit),
            perCustomerLimit: parseInt_(perCustomerLimit),
            startAt: startAt ? new Date(startAt) : null,
            endAt: endAt ? new Date(endAt) : null,
            priority: parseInt_(priority) || 0,
            combinableWithCoupon,
            isFeatured,
            bannerImage: bannerImage || null,
            showCountdown,
            showBadge,
            badgeText: badgeText || null,
            badgeColor: badgeColor || null,
            active,
        };

        // Add relations only if not appliesToAll
        if (!appliesToAll) {
            if (products?.length) {
                campaignData.discountProducts = {
                    create: products.map((item) => ({
                        productId: parseInt(item.productId || item)
                    }))
                };
            }

            if (categories?.length) {
                campaignData.discountCategories = {
                    create: categories.map((item) => ({
                        categoryId: parseInt(item.categoryId || item)
                    }))
                };
            }

            if (subCategories?.length) {
                campaignData.discountSubCategories = {
                    create: subCategories.map((item) => ({
                        subCategoryId: parseInt(item.subCategoryId || item)
                    }))
                };
            }
        }

        // Create campaign
        const campaign = await prisma.discountCampaign.create({
            data: campaignData,
            include: {
                discountProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                price: true,
                                images: true,
                                productType: true,
                                productVariants: true,
                            }
                        }
                    }
                },
                discountCategories: {
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                },
                discountSubCategories: {
                    include: {
                        subCategory: {
                            select: {
                                id: true,
                                name: true,
                            }
                        }
                    }
                },
            },
        });

        return successResponse(res, campaign, "Discount campaign created successfully", 201);
    } catch (error) {
        console.error("Create Discount Campaign Error:", error);

        if (error.code === 'P2002') {
            return errorResponse(res, "Campaign code already exists", 400);
        }

        return errorResponse(res, error.message || "Failed to create discount campaign", 500);
    }
};


// ============================================
//                GET ALL CAMPAIGNS
// ============================================
const getAllDiscountCampaigns = async (req, res) => {
    try {
        const {
            status,
            campaignType,
            active,
            isFeatured,
            search,
            page = 1,
            limit = 20
        } = req.query;

        const where = { isDeleted: false };

        if (status) where.status = status;
        if (campaignType) where.campaignType = campaignType;
        if (active !== undefined) where.active = active === 'true';
        if (isFeatured !== undefined) where.isFeatured = isFeatured === 'true';

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { campaignCode: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [campaigns, totalCount] = await Promise.all([
            prisma.discountCampaign.findMany({
                where,
                skip,
                take,
                orderBy: [
                    { isFeatured: 'desc' },
                    { priority: 'desc' },
                    { createdAt: 'desc' }
                ],
                include: {
                    discountProducts: {
                        where: {
                            product: {
                                status: true,
                                deletedAt: null
                            }
                        },
                        include: {
                            product: {
                                select: {
                                    id: true,
                                    productName: true,
                                    sku: true,
                                    slug: true,
                                    price: true,
                                    images: true,
                                    quantity: true,
                                    status: true,
                                    productType: true,
                                    productVariants: true
                                }
                            }
                        }
                    },
                    discountCategories: {
                        include: {
                            category: {
                                select: {
                                    id: true,
                                    name: true,
                                    status: true
                                }
                            }
                        }
                    },
                    discountSubCategories: {
                        include: {
                            subCategory: {
                                select: {
                                    id: true,
                                    name: true,
                                    status: true
                                }
                            }
                        }
                    },
                    _count: {
                        select: {
                            discountProducts: true,
                            discountCategories: true,
                            discountSubCategories: true,
                        }
                    }
                },
            }),
            prisma.discountCampaign.count({ where })
        ]);

        return successResponse(res, {
            campaigns,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCount / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Get All Campaigns Error:", error);
        return errorResponse(res, error.message || "Failed to fetch campaigns", 500);
    }
};


// ============================================
// GET ACTIVE CAMPAIGNS (PUBLIC)
// ============================================
const getActiveCampaigns = async (req, res) => {
    try {
        const now = new Date();

        const campaigns = await prisma.discountCampaign.findMany({
            where: {
                active: true,
                isDeleted: false,
                status: 'Active',
                OR: [
                    { startAt: null },
                    { startAt: { lte: now } }
                ],
                AND: [
                    {
                        OR: [
                            { endAt: null },
                            { endAt: { gte: now } }
                        ]
                    }
                ]
            },
            orderBy: [
                { isFeatured: 'desc' },
                { priority: 'desc' },
                { createdAt: 'desc' }
            ],
            include: {
                discountProducts: {
                    where: {
                        product: {
                            status: true,
                            isArchived: false,
                            visibility: { not: "unpublish" },
                            deletedAt: null,
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
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                slug: true,
                                price: true,
                                images: true,
                                quantity: true,
                                taxType: true,
                                tax: true,
                                status: true,
                                productType: true,
                                productVariants: true
                            }
                        }
                    }
                },
                discountCategories: {
                    where: {
                        category: {
                            status: true
                        }
                    },
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true,
                                // Remove slug if it doesn't exist
                                status: true
                                // You can add other available fields if needed:
                                // code: true,
                                // image: true,
                                // mainCategoryId: true
                            }
                        }
                    }
                },
                discountSubCategories: {
                    where: {
                        subCategory: {
                            status: true
                        }
                    },
                    include: {
                        subCategory: {
                            select: {
                                id: true,
                                name: true,
                                // Remove slug if it doesn't exist for subCategory either
                                status: true
                            }
                        }
                    }
                },
            },
        });

        return successResponse(res, campaigns);
    } catch (error) {
        console.error("Get Active Campaigns Error:", error);
        return errorResponse(res, error.message || "Failed to fetch active campaigns", 500);
    }
};



// ============================================
// GET CAMPAIGN BY ID
// ============================================
const getCampaignById = async (req, res) => {
    try {
        const { id } = req.params;

        const campaign = await prisma.discountCampaign.findUnique({
            where: { id: parseInt(id) },
            include: {
                discountProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                slug: true,
                                price: true,
                                images: true,
                                quantity: true,
                                description: true,
                                productType: true,
                                productVariants: true,
                            }
                        }
                    }
                },
                discountCategories: {
                    include: {
                        category: true
                    }
                },
                discountSubCategories: {
                    include: {
                        subCategory: true
                    }
                },
            },
        });

        if (!campaign) {
            return errorResponse(res, "Campaign not found", 404);
        }

        // Increment view count
        await prisma.discountCampaign.update({
            where: { id: parseInt(id) },
            data: { viewCount: { increment: 1 } }
        });

        return successResponse(res, campaign);
    } catch (error) {
        console.error("Get Campaign Error:", error);
        return errorResponse(res, error.message || "Failed to fetch campaign", 500);
    }
};

// ============================================
// UPDATE CAMPAIGN
// ============================================
const updateDiscountCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            campaignCode,
            name,
            description,
            campaignType,
            status,
            discountType,
            discountValue,
            maxDiscountAmount,
            minOrderAmount,
            appliesToAll,
            stockLimit,
            perCustomerLimit,
            startAt,
            endAt,
            priority,
            combinableWithCoupon,
            isFeatured,
            bannerImage,
            showCountdown,
            showBadge,
            badgeText,
            badgeColor,
            active,
            products,
            categories,
            subCategories,
        } = req.body;

        const existingCampaign = await prisma.discountCampaign.findUnique({
            where: { id: parseInt(id) },
            include: {
                discountProducts: true,
                discountCategories: true,
                discountSubCategories: true,
            }
        });

        if (!existingCampaign) {
            return errorResponse(res, "Campaign not found", 404);
        }

        // Validation
        if (discountType && !['Fixed', 'Percentage'].includes(discountType)) {
            return errorResponse(res, "Discount type must be 'Fixed' or 'Percentage'", 400);
        }

        if (discountValue !== undefined) {
            const discountVal = parseDecimal(discountValue);
            if (discountVal <= 0) {
                return errorResponse(res, "Discount value must be greater than 0", 400);
            }

            const finalType = discountType || existingCampaign.discountType;
            if (finalType === 'Percentage' && discountVal > 100) {
                return errorResponse(res, "Percentage discount cannot exceed 100%", 400);
            }
        }

        if (startAt && endAt && new Date(startAt) >= new Date(endAt)) {
            return errorResponse(res, "Start date must be before end date", 400);
        }

        // Check duplicate code
        if (campaignCode && campaignCode.toUpperCase() !== existingCampaign.campaignCode) {
            const duplicate = await prisma.discountCampaign.findUnique({
                where: { campaignCode: campaignCode.toUpperCase() }
            });

            if (duplicate) {
                return errorResponse(res, "Campaign code already exists", 400);
            }
        }

        // Build update data
        const updateData = {
            ...(campaignCode && { campaignCode: campaignCode.toUpperCase() }),
            ...(name && { name }),
            ...(description !== undefined && { description: description || null }),
            ...(campaignType && { campaignType }),
            ...(status && { status }),
            ...(discountType && { discountType }),
            ...(discountValue !== undefined && { discountValue: parseDecimal(discountValue) }),
            ...(maxDiscountAmount !== undefined && { maxDiscountAmount: parseDecimal(maxDiscountAmount) }),
            ...(minOrderAmount !== undefined && { minOrderAmount: parseDecimal(minOrderAmount) }),
            ...(appliesToAll !== undefined && { appliesToAll }),
            ...(stockLimit !== undefined && { stockLimit: parseInt_(stockLimit) }),
            ...(perCustomerLimit !== undefined && { perCustomerLimit: parseInt_(perCustomerLimit) }),
            ...(startAt !== undefined && { startAt: startAt ? new Date(startAt) : null }),
            ...(endAt !== undefined && { endAt: endAt ? new Date(endAt) : null }),
            ...(priority !== undefined && { priority: parseInt_(priority) || 0 }),
            ...(combinableWithCoupon !== undefined && { combinableWithCoupon }),
            ...(isFeatured !== undefined && { isFeatured }),
            ...(bannerImage !== undefined && { bannerImage: bannerImage || null }),
            ...(showCountdown !== undefined && { showCountdown }),
            ...(showBadge !== undefined && { showBadge }),
            ...(badgeText !== undefined && { badgeText: badgeText || null }),
            ...(badgeColor !== undefined && { badgeColor: badgeColor || null }),
            ...(active !== undefined && { active }),
        };

        const finalAppliesToAll = appliesToAll !== undefined ? appliesToAll : existingCampaign.appliesToAll;

        // Update relations
        if (!finalAppliesToAll) {
            // Products
            if (products !== undefined) {
                await prisma.discountProduct.deleteMany({
                    where: { campaignId: parseInt(id) }
                });

                if (products.length > 0) {
                    updateData.discountProducts = {
                        create: products.map((item) => ({
                            productId: parseInt(item.productId || item)
                        }))
                    };
                }
            }

            // Categories
            if (categories !== undefined) {
                await prisma.discountCategory.deleteMany({
                    where: { campaignId: parseInt(id) }
                });

                if (categories.length > 0) {
                    updateData.discountCategories = {
                        create: categories.map((item) => ({
                            categoryId: parseInt(item.categoryId || item)
                        }))
                    };
                }
            }

            // SubCategories
            if (subCategories !== undefined) {
                await prisma.discountSubCategory.deleteMany({
                    where: { campaignId: parseInt(id) }
                });

                if (subCategories.length > 0) {
                    updateData.discountSubCategories = {
                        create: subCategories.map((item) => ({
                            subCategoryId: parseInt(item.subCategoryId || item)
                        }))
                    };
                }
            }
        } else {
            // Remove all relations if appliesToAll
            await Promise.all([
                prisma.discountProduct.deleteMany({ where: { campaignId: parseInt(id) } }),
                prisma.discountCategory.deleteMany({ where: { campaignId: parseInt(id) } }),
                prisma.discountSubCategory.deleteMany({ where: { campaignId: parseInt(id) } }),
            ]);
        }

        const updatedCampaign = await prisma.discountCampaign.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                discountProducts: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                price: true,
                                images: true,
                            }
                        }
                    }
                },
                discountCategories: {
                    include: {
                        category: true
                    }
                },
                discountSubCategories: {
                    include: {
                        subCategory: true
                    }
                },
            },
        });

        return successResponse(res, updatedCampaign, "Campaign updated successfully");
    } catch (error) {
        console.error("Update Campaign Error:", error);

        if (error.code === 'P2002') {
            return errorResponse(res, "Campaign code already exists", 400);
        }

        return errorResponse(res, error.message || "Failed to update campaign", 500);
    }
};

// ============================================
// DELETE CAMPAIGN
// ============================================
const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;

        const campaign = await prisma.discountCampaign.findUnique({
            where: { id: parseInt(id) }
        });

        if (!campaign) {
            return errorResponse(res, "Campaign not found", 404);
        }

        // Soft delete
        await prisma.discountCampaign.update({
            where: { id: parseInt(id) },
            data: {
                isDeleted: true,
                active: false,
                status: 'Expired'
            }
        });

        return successResponse(res, { id: parseInt(id) }, "Campaign deleted successfully");
    } catch (error) {
        console.error("Delete Campaign Error:", error);
        return errorResponse(res, error.message || "Failed to delete campaign", 500);
    }
};

// ============================================
// TOGGLE STATUS
// ============================================
const toggleCampaignStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;

        if (active === undefined) {
            return errorResponse(res, "Active status is required", 400);
        }

        const newStatus = active ? 'Active' : 'Paused';

        const updatedCampaign = await prisma.discountCampaign.update({
            where: { id: parseInt(id) },
            data: {
                active: Boolean(active),
                status: newStatus
            },
            select: {
                id: true,
                name: true,
                campaignCode: true,
                active: true,
                status: true,
            }
        });

        return successResponse(
            res,
            updatedCampaign,
            `Campaign ${active ? 'activated' : 'deactivated'} successfully`
        );
    } catch (error) {
        console.error("Toggle Status Error:", error);

        if (error.code === 'P2025') {
            return errorResponse(res, "Campaign not found", 404);
        }

        return errorResponse(res, error.message || "Failed to update status", 500);
    }
};



// ============================================
// GET CATEGORY PRODUCTS WITH DISCOUNT
// ============================================
const getCategoryDiscountProducts = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const now = new Date();

        // Find active campaigns for this category
        const campaigns = await prisma.discountCampaign.findMany({
            where: {
                active: true,
                isDeleted: false,
                status: 'Active',
                OR: [
                    { startAt: null },
                    { startAt: { lte: now } }
                ],
                AND: [
                    {
                        OR: [
                            { endAt: null },
                            { endAt: { gte: now } }
                        ]
                    }
                ],
                discountCategories: {
                    some: {
                        categoryId: parseInt(categoryId)
                    }
                }
            },
            orderBy: {
                priority: 'desc'
            }
        });

        if (campaigns.length === 0) {
            return successResponse(res, { hasDiscount: false, products: [] });
        }

        const campaign = campaigns[0]; // Highest priority

        // Get all products in this category
        const products = await prisma.product.findMany({
            where: {
                categoryId: parseInt(categoryId)
            }
        });

        // Apply discount to each product
        const productsWithDiscount = products.map(product => {
            const originalPrice = parseFloat(product.price);
            const discountType = campaign.discountType;
            const discountValue = parseFloat(campaign.discountValue);

            let discountAmount = 0;
            if (discountType === 'Fixed') {
                discountAmount = discountValue;
            } else {
                discountAmount = (originalPrice * discountValue) / 100;
                if (campaign.maxDiscountAmount) {
                    discountAmount = Math.min(discountAmount, parseFloat(campaign.maxDiscountAmount));
                }
            }

            const discountedPrice = Math.max(0, originalPrice - discountAmount);
            const discountPercentage = ((discountAmount / originalPrice) * 100).toFixed(0);

            return {
                ...product,
                originalPrice: originalPrice.toFixed(2),
                discountAmount: discountAmount.toFixed(2),
                discountedPrice: discountedPrice.toFixed(2),
                discountPercentage: `${discountPercentage}%`,
                campaign: {
                    id: campaign.id,
                    name: campaign.name,
                    campaignCode: campaign.campaignCode,
                    badgeText: campaign.badgeText || `${discountPercentage}% OFF`,
                    badgeColor: campaign.badgeColor,
                }
            };
        });

        return successResponse(res, {
            hasDiscount: true,
            campaign: {
                id: campaign.id,
                name: campaign.name,
                campaignCode: campaign.campaignCode,
            },
            products: productsWithDiscount
        });
    } catch (error) {
        console.error("Get Category Discount Error:", error);
        return errorResponse(res, error.message || "Failed to fetch discounts", 500);
    }
};

// ============================================
// GET DISCOUNT PRODUCT BY SLUG - FIXED VERSION
// ============================================

const getDiscountProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        if (!slug) {
            return errorResponse(res, "Product slug is required", 400);
        }

        const now = new Date();

        // Step 1: Find the product by slug with correct relations
        const product = await prisma.product.findFirst({
            where: {
                slug: slug,
                status: true,
                isArchived: false,
                visibility: { not: "unpublish" },
                deletedAt: null,
                subCategory: {
                    status: true,
                    category: {
                        status: true,
                        mainCategory: {
                            status: true,
                        },
                    },
                },
            },
            include: {
                brand: true,
                unit: true,
                warranty: true,
                productVariants: {
                    orderBy: { isDefault: 'desc' }
                },
                VariantAttributes: true,
                subCategory: {
                    include: {
                        category: {
                            include: {
                                mainCategory: true
                            }
                        }
                    }
                }
            },
        });

        if (!product) {
            return errorResponse(res, "Product not found", 404);
        }

        // Get category from subCategory relationship
        const category = product.subCategory?.category;
        const mainCategory = category?.mainCategory;

        // Step 2: Check if this product is in any active discount campaign
        const discountProduct = await prisma.discountProduct.findFirst({
            where: {
                productId: product.id,
                campaign: {
                    active: true,
                    isDeleted: false,
                    status: 'Active',
                    OR: [
                        { startAt: null },
                        { startAt: { lte: now } }
                    ],
                    AND: [
                        {
                            OR: [
                                { endAt: null },
                                { endAt: { gte: now } }
                            ]
                        }
                    ]
                }
            },
            include: {
                campaign: true
            },
            orderBy: {
                campaign: {
                    priority: 'desc'
                }
            }
        });

        // Step 3: Also check for category-based discounts
        let categoryDiscount = null;
        if (category?.id) {
            categoryDiscount = await prisma.discountCategory.findFirst({
                where: {
                    categoryId: category.id,
                    campaign: {
                        active: true,
                        isDeleted: false,
                        status: 'Active',
                        OR: [
                            { startAt: null },
                            { startAt: { lte: now } }
                        ],
                        AND: [
                            {
                                OR: [
                                    { endAt: null },
                                    { endAt: { gte: now } }
                                ]
                            }
                        ]
                    }
                },
                include: {
                    campaign: true
                },
                orderBy: {
                    campaign: {
                        priority: 'desc'
                    }
                }
            });
        }

        // Step 4: Check for subcategory-based discounts
        let subCategoryDiscount = null;
        if (product.subCategoryId) {
            subCategoryDiscount = await prisma.discountSubCategory.findFirst({
                where: {
                    subCategoryId: product.subCategoryId,
                    campaign: {
                        active: true,
                        isDeleted: false,
                        status: 'Active',
                        OR: [
                            { startAt: null },
                            { startAt: { lte: now } }
                        ],
                        AND: [
                            {
                                OR: [
                                    { endAt: null },
                                    { endAt: { gte: now } }
                                ]
                            }
                        ]
                    }
                },
                include: {
                    campaign: true
                },
                orderBy: {
                    campaign: {
                        priority: 'desc'
                    }
                }
            });
        }

        // Step 5: Determine which campaign to apply (priority order: product > subcategory > category)
        let activeCampaign = null;
        if (discountProduct) {
            activeCampaign = discountProduct.campaign;
        } else if (subCategoryDiscount) {
            activeCampaign = subCategoryDiscount.campaign;
        } else if (categoryDiscount) {
            activeCampaign = categoryDiscount.campaign;
        }

        let campaignInfo = null;
        let originalPrice = parseFloat(product.price) || 0;
        let discountedPrice = originalPrice;
        let discountAmount = 0;

        if (activeCampaign) {
            const discountValue = parseFloat(activeCampaign.discountValue) || 0;
            const maxDiscount = activeCampaign.maxDiscountAmount
                ? parseFloat(activeCampaign.maxDiscountAmount)
                : null;

            // Calculate discount based on type
            if (activeCampaign.discountType === 'Fixed') {
                discountAmount = Math.min(discountValue, originalPrice);
                discountedPrice = Math.max(0, originalPrice - discountAmount);
            } else {
                // Percentage discount
                discountAmount = (originalPrice * discountValue) / 100;

                if (maxDiscount && discountAmount > maxDiscount) {
                    discountAmount = maxDiscount;
                }

                discountedPrice = Math.max(0, originalPrice - discountAmount);
            }

            // Round to 2 decimal places
            discountAmount = Math.round(discountAmount * 100) / 100;
            discountedPrice = Math.round(discountedPrice * 100) / 100;

            // Calculate discount percentage
            const discountPercentage = originalPrice > 0
                ? Math.round((discountAmount / originalPrice) * 100)
                : 0;

            campaignInfo = {
                campaignId: activeCampaign.id,
                campaignCode: activeCampaign.campaignCode,
                campaignName: activeCampaign.name,
                campaignType: activeCampaign.campaignType,
                discountType: activeCampaign.discountType,
                discountValue: discountValue,
                discountAmount: discountAmount,
                discountPercentage: discountPercentage,
                maxDiscountAmount: maxDiscount,
                minOrderAmount: activeCampaign.minOrderAmount ? parseFloat(activeCampaign.minOrderAmount) : null,
                appliesToAll: activeCampaign.appliesToAll,
                startAt: activeCampaign.startAt,
                endAt: activeCampaign.endAt,
                showCountdown: activeCampaign.showCountdown,
                showBadge: activeCampaign.showBadge,
                badgeText: activeCampaign.badgeText,
                badgeColor: activeCampaign.badgeColor,
                priority: activeCampaign.priority,
                combinableWithCoupon: activeCampaign.combinableWithCoupon
            };
        }

        // Step 6: Handle images
        let images = [];
        if (product.images) {
            try {
                if (typeof product.images === 'string') {
                    try {
                        const parsed = JSON.parse(product.images);
                        if (Array.isArray(parsed)) {
                            images = parsed.filter(url => url && typeof url === 'string');
                        }
                    } catch {
                        images = [product.images].filter(url => url);
                    }
                } else if (Array.isArray(product.images)) {
                    images = product.images.filter(url => url && typeof url === 'string');
                }
            } catch {
                images = [];
            }
        }

        if (images.length === 0) {
            images = ['https://res.cloudinary.com/dh34eqbhu/image/upload/v1747211252/ju2uf9y33y1bncwufrl7.png'];
        }

        // Step 7: Build the response structure
        const responseData = {
            // Basic product info
            id: product.id,
            productName: product.productName,
            sku: product.sku,
            slug: product.slug,
            description: product.description || '',
            quantity: product.quantity || 0,
            status: product.status,
            taxType: product.taxType,
            tax: product.tax ? parseFloat(product.tax) : null,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,

            // Variant information
            productType: product.productType || (product.productVariants && product.productVariants.length > 0 ? 'variant' : 'single'),
            productVariants: product.productVariants || [],
            VariantAttributes: product.VariantAttributes || null,

            // Images
            images: images,

            // Relations
            brand: product.brand || null,
            category: category ? {
                id: category.id,
                name: category.name,
                code: category.code,
                image: category.image,
                mainCategoryId: category.mainCategoryId,
                status: category.status,
                mainCategory: mainCategory ? {
                    id: mainCategory.id,
                    name: mainCategory.name,
                    code: mainCategory.code,
                    image: mainCategory.image,
                    status: mainCategory.status
                } : null
            } : null,

            subCategory: product.subCategory ? {
                id: product.subCategory.id,
                name: product.subCategory.name,
                code: product.subCategory.code,
                status: product.subCategory.status,
                categoryId: product.subCategory.categoryId
            } : null,

            unit: product.unit,
            warranty: product.warranty,

            // Price information
            price: parseFloat(product.price) || 0,
            originalPrice: originalPrice,
            discountedPrice: discountedPrice,
            campaignDiscountAmount: discountAmount,
            campaignInfo: campaignInfo,
            hasCampaignDiscount: !!campaignInfo,

            // Calculated fields
            discountPercentage: campaignInfo?.discountPercentage || 0,
            youSave: discountAmount,
            finalPrice: discountedPrice
        };

        return successResponse(res, responseData, "Product with discount info fetched successfully");

    } catch (error) {
        // Log error for monitoring (you might want to use a proper logging service)
        // logger.error("Error in getDiscountProductBySlug", { error: error.message, params: req.params });

        const errorMessage = process.env.NODE_ENV === 'production'
            ? "Internal server error. Please try again later."
            : error.message;

        return errorResponse(res, errorMessage, 500);
    }
};


module.exports = {
    createDiscountCampaign,
    getAllDiscountCampaigns,
    getDiscountProductBySlug,
    getCampaignById,
    updateDiscountCampaign,
    deleteCampaign,
    toggleCampaignStatus,
    getActiveCampaigns,
    getCategoryDiscountProducts

};