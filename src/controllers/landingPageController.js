const prisma = require('../utils/db.js');

// GET all landing pages for admin
exports.getAllLandingPages = async (req, res) => {
    try {
        const landingPages = await prisma.landingPage.findMany({
            include: {
                product: {
                    select: {
                        id: true,
                        productName: true,
                        sku: true,
                        price: true,
                        discountType: true,
                        discountValue: true,
                        images: true,
                        productVariants: true,
                        status: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            success: true,
            data: landingPages
        });
    } catch (error) {
        console.error('Error fetching landing pages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch landing pages',
            error: error.message
        });
    }
};

// GET single landing page by slug (Public API for Frontend)
exports.getLandingPageBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const landingPage = await prisma.landingPage.findUnique({
            where: { slug },
            include: {
                product: {
                    include: {
                        productVariants: true,
                        brand: true,
                        subCategory: {
                            include: {
                                category: true
                            }
                        }
                    }
                },
                orderBumpProduct: {
                    include: {
                        productVariants: true
                    }
                }
            }
        });

        if (!landingPage) {
            return res.status(404).json({
                success: false,
                message: 'Landing page not found'
            });
        }

        // Increment view count asynchronously
        prisma.landingPage.update({
            where: { id: landingPage.id },
            data: { viewsCount: { increment: 1 } }
        }).catch(err => console.error('Failed to increment landing page views:', err.message));

        res.status(200).json({
            success: true,
            data: landingPage
        });
    } catch (error) {
        console.error('Error fetching landing page by slug:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch landing page details',
            error: error.message
        });
    }
};

// GET single landing page by ID (for Admin Edit)
exports.getLandingPageById = async (req, res) => {
    try {
        const { id } = req.params;

        const landingPage = await prisma.landingPage.findUnique({
            where: { id: parseInt(id) },
            include: {
                product: {
                    include: {
                        productVariants: true
                    }
                },
                orderBumpProduct: {
                    include: {
                        productVariants: true
                    }
                }
            }
        });

        if (!landingPage) {
            return res.status(404).json({
                success: false,
                message: 'Landing page not found'
            });
        }

        res.status(200).json({
            success: true,
            data: landingPage
        });
    } catch (error) {
        console.error('Error fetching landing page by id:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch landing page',
            error: error.message
        });
    }
};

// CREATE landing page
exports.createLandingPage = async (req, res) => {
    try {
        const {
            productId,
            orderBumpProductId,
            orderBumpTitle,
            orderBumpSubtitle,
            orderBumpDiscount,
            orderBumpPrice,
            slug,
            pageTitle,
            subTitle,
            badgeText,
            videoUrl,
            bannerImages,
            whyChooseUsTitle,
            features,
            trustPoints,
            variantDiscounts,
            highlightsTitle,
            highlights,
            reviews,
            insideDhakaDelivery,
            outsideDhakaDelivery,
            offerPrice,
            urgencyText,
            fakeOrderCounter,
            themeColor,
            isPublished
        } = req.body;

        if (!productId || !slug || !pageTitle) {
            return res.status(400).json({
                success: false,
                message: 'Product, slug, and page title are required'
            });
        }

        // Check if slug already exists
        const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
        const existing = await prisma.landingPage.findUnique({
            where: { slug: cleanSlug }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `The slug "${cleanSlug}" is already taken. Please choose another one.`
            });
        }

        const newLandingPage = await prisma.landingPage.create({
            data: {
                productId: parseInt(productId),
                orderBumpProductId: orderBumpProductId ? parseInt(orderBumpProductId) : null,
                orderBumpTitle: orderBumpTitle ? orderBumpTitle.trim() : null,
                orderBumpSubtitle: orderBumpSubtitle ? orderBumpSubtitle.trim() : null,
                orderBumpDiscount: orderBumpDiscount !== undefined ? parseFloat(orderBumpDiscount) : 0,
                orderBumpPrice: orderBumpPrice ? parseFloat(orderBumpPrice) : null,
                slug: cleanSlug,
                pageTitle: pageTitle.trim(),
                subTitle: subTitle ? subTitle.trim() : null,
                badgeText: badgeText ? badgeText.trim() : "১০০% খাঁটি ও সেরা কোয়ালিটি",
                videoUrl: videoUrl ? videoUrl.trim() : null,
                bannerImages: bannerImages || [],
                whyChooseUsTitle: whyChooseUsTitle || "কেন আমাদের পণ্য সেরা?",
                features: features || [],
                trustPoints: trustPoints || [],
                variantDiscounts: variantDiscounts || {},
                highlightsTitle: highlightsTitle || "পণ্যটির আকর্ষণীয় ব্যবহার ও বৈশিষ্ট্য",
                highlights: highlights || [],
                reviews: reviews || [],
                insideDhakaDelivery: insideDhakaDelivery !== undefined ? parseFloat(insideDhakaDelivery) : 70.00,
                outsideDhakaDelivery: outsideDhakaDelivery !== undefined ? parseFloat(outsideDhakaDelivery) : 130.00,
                offerPrice: offerPrice ? parseFloat(offerPrice) : null,
                urgencyText: urgencyText || "অফারটি সীমিত সময়ের জন্য! এখনই অর্ডার করুন",
                fakeOrderCounter: fakeOrderCounter ? parseInt(fakeOrderCounter) : 120,
                themeColor: themeColor || "#F45116",
                isPublished: isPublished !== undefined ? Boolean(isPublished) : true
            },
            include: {
                product: true,
                orderBumpProduct: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Landing page created successfully',
            data: newLandingPage
        });
    } catch (error) {
        console.error('Error creating landing page:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create landing page',
            error: error.message
        });
    }
};

// UPDATE landing page
exports.updateLandingPage = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            orderBumpProductId,
            orderBumpTitle,
            orderBumpSubtitle,
            orderBumpDiscount,
            orderBumpPrice,
            slug,
            pageTitle,
            subTitle,
            badgeText,
            videoUrl,
            bannerImages,
            whyChooseUsTitle,
            features,
            trustPoints,
            variantDiscounts,
            highlightsTitle,
            highlights,
            reviews,
            insideDhakaDelivery,
            outsideDhakaDelivery,
            offerPrice,
            urgencyText,
            fakeOrderCounter,
            themeColor,
            isPublished
        } = req.body;

        const cleanSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-') : undefined;

        if (cleanSlug) {
            const existingWithSlug = await prisma.landingPage.findFirst({
                where: {
                    slug: cleanSlug,
                    id: { not: parseInt(id) }
                }
            });
            if (existingWithSlug) {
                return res.status(400).json({
                    success: false,
                    message: `The slug "${cleanSlug}" is already in use by another landing page.`
                });
            }
        }

        const updated = await prisma.landingPage.update({
            where: { id: parseInt(id) },
            data: {
                ...(orderBumpProductId !== undefined && {
                    orderBumpProduct: orderBumpProductId
                        ? { connect: { id: parseInt(orderBumpProductId) } }
                        : { disconnect: true }
                }),
                ...(orderBumpTitle !== undefined && { orderBumpTitle: orderBumpTitle ? orderBumpTitle.trim() : null }),
                ...(orderBumpSubtitle !== undefined && { orderBumpSubtitle: orderBumpSubtitle ? orderBumpSubtitle.trim() : null }),
                ...(orderBumpDiscount !== undefined && { orderBumpDiscount: parseFloat(orderBumpDiscount || 0) }),
                ...(orderBumpPrice !== undefined && { orderBumpPrice: orderBumpPrice ? parseFloat(orderBumpPrice) : null }),
                ...(cleanSlug && { slug: cleanSlug }),
                ...(pageTitle !== undefined && { pageTitle: pageTitle.trim() }),
                ...(subTitle !== undefined && { subTitle: subTitle ? subTitle.trim() : null }),
                ...(badgeText !== undefined && { badgeText: badgeText.trim() }),
                ...(videoUrl !== undefined && { videoUrl: videoUrl ? videoUrl.trim() : null }),
                ...(bannerImages !== undefined && { bannerImages }),
                ...(whyChooseUsTitle !== undefined && { whyChooseUsTitle }),
                ...(features !== undefined && { features }),
                ...(trustPoints !== undefined && { trustPoints }),
                ...(variantDiscounts !== undefined && { variantDiscounts }),
                ...(highlightsTitle !== undefined && { highlightsTitle }),
                ...(highlights !== undefined && { highlights }),
                ...(reviews !== undefined && { reviews }),
                ...(insideDhakaDelivery !== undefined && { insideDhakaDelivery: parseFloat(insideDhakaDelivery) }),
                ...(outsideDhakaDelivery !== undefined && { outsideDhakaDelivery: parseFloat(outsideDhakaDelivery) }),
                ...(offerPrice !== undefined && { offerPrice: offerPrice ? parseFloat(offerPrice) : null }),
                ...(urgencyText !== undefined && { urgencyText }),
                ...(fakeOrderCounter !== undefined && { fakeOrderCounter: parseInt(fakeOrderCounter) }),
                ...(themeColor !== undefined && { themeColor }),
                ...(isPublished !== undefined && { isPublished: Boolean(isPublished) })
            },
            include: {
                product: true,
                orderBumpProduct: true
            }
        });

        res.status(200).json({
            success: true,
            message: 'Landing page updated successfully',
            data: updated
        });
    } catch (error) {
        console.error('Error updating landing page:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update landing page',
            error: error.message
        });
    }
};

// DELETE landing page
exports.deleteLandingPage = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.landingPage.delete({
            where: { id: parseInt(id) }
        });

        res.status(200).json({
            success: true,
            message: 'Landing page deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting landing page:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete landing page',
            error: error.message
        });
    }
};
