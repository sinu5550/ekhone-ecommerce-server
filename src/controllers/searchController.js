const prisma = require("../utils/db.js");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// Reusable include structure
const searchInclude = {
    subCategory: {
        include: {
            category: {
                include: { mainCategory: true },
            },
        },
    },
    brand: true,
    unit: true,
    warranty: true,
    VariantAttributes: true,
    productVariants: true
};

// Search Products with Autocomplete
const searchProducts = async (req, res) => {
    try {
        const { query, limit = 10, includeDetails = false } = req.query;

        if (!query || query.trim().length < 2) {
            return successResponse(res, {
                suggestions: [],
                products: []
            });
        }

        const searchTerm = query.trim();

        // Build where clause for fuzzy search
        const where = {
            AND: [
                {
                    OR: [
                        {
                            productName: {
                                contains: searchTerm,
                                mode: 'insensitive'
                            }
                        },
                        {
                            sku: {
                                contains: searchTerm,
                                mode: 'insensitive'
                            }
                        },
                        {
                            description: {
                                contains: searchTerm,
                                mode: 'insensitive'
                            }
                        },
                        {
                            brand: {
                                name: {
                                    contains: searchTerm,
                                    mode: 'insensitive'
                                }
                            }
                        },
                        {
                            subCategory: {
                                OR: [
                                    {
                                        name: {
                                            contains: searchTerm,
                                            mode: 'insensitive'
                                        }
                                    },
                                    {
                                        category: {
                                            name: {
                                                contains: searchTerm,
                                                mode: 'insensitive'
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                },
                { status: true }, // Only active products
                { isArchived: false },
                { visibility: { not: "unpublish" } },
                { deletedAt: null }, // Only non-deleted products
                {
                    subCategory: {
                        status: true,
                        category: {
                            status: true,
                            mainCategory: {
                                status: true
                            }
                        }
                    }
                }
            ]
        };

        // Select fields based on detail requirements
        const selectFields = includeDetails === 'true' ? undefined : {
            id: true,
            slug: true,
            productName: true,
            sku: true,
            price: true,
            images: true,
            brand: {
                select: {
                    name: true,
                    id: true
                }
            },
            subCategory: {
                select: {
                    name: true,
                    category: {
                        select: {
                            name: true
                        }
                    }
                }
            }
        };

        // Fetch products with intelligent ordering
        const products = await prisma.product.findMany({
            where,
            include: includeDetails === 'true' ? searchInclude : undefined,
            select: selectFields,
            take: parseInt(limit),
            orderBy: [
                // Priority 1: Exact match in product name
                {
                    productName: 'asc'
                },
                // Priority 2: Newest / Restocked first
                {
                    updatedAt: 'desc'
                },
                {
                    createdAt: 'desc'
                }
            ]
        });

        // Manual relevance scoring for better search results
        const scoredProducts = products.map(product => {
            let score = 0;

            // Exact match in product name (highest priority)
            if (product.productName.toLowerCase() === searchTerm.toLowerCase()) {
                score += 200;
            }

            // Contains search term in product name
            if (product.productName.toLowerCase().includes(searchTerm.toLowerCase())) {
                score += 100;
            }

            // Starts with search term
            if (product.productName.toLowerCase().startsWith(searchTerm.toLowerCase())) {
                score += 50;
            }

            // Match in SKU
            if (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) {
                score += 30;
            }

            // Match in brand name
            if (product.brand?.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
                score += 20;
            }

            // Match in category
            if (product.subCategory?.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
                score += 15;
            }

            // Match in subcategory
            if (product.subCategory?.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
                score += 10;
            }

            return { ...product, _relevance: score };
        });

        // Sort by relevance score
        scoredProducts.sort((a, b) => b._relevance - a._relevance);

        // Format suggestions
        const suggestions = scoredProducts.map(product => ({
            id: product.id,
            name: product.productName,
            sku: product.sku,
            price: product.price,
            image: Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null,
            brand: product.brand?.name || '',
            slug: product.slug,
            type: 'product',
            category: product.subCategory?.category?.name || '',
            subCategory: product.subCategory?.name || ''
        }));

        // Also search categories
        const categories = await prisma.category.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { name: { contains: searchTerm, mode: 'insensitive' } },
                            {
                                subCategories: {
                                    some: {
                                        name: { contains: searchTerm, mode: 'insensitive' }
                                    }
                                }
                            }
                        ]
                    },
                    { status: true },
                    { mainCategory: { status: true } }
                ]
            },
            select: {
                id: true,
                name: true,
                image: true,
                mainCategory: {
                    select: {
                        name: true
                    }
                }
            },
            take: 3
        });

        // Also search brands
        const brands = await prisma.brand.findMany({
            where: {
                name: { contains: searchTerm, mode: 'insensitive' }
            },
            select: {
                id: true,
                name: true,
                image: true
            },
            take: 3
        });

        const categorySuggestions = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            image: cat.image,
            mainCategory: cat.mainCategory?.name,
            type: 'category'
        }));

        const brandSuggestions = brands.map(brand => ({
            id: brand.id,
            name: brand.name,
            image: brand.image,
            type: 'brand'
        }));

        // Combine all suggestions with priority ordering
        const allSuggestions = [
            ...suggestions.slice(0, 6), // Top 6 products
            ...categorySuggestions,
            ...brandSuggestions
        ];

        return successResponse(res, {
            suggestions: allSuggestions,
            products: includeDetails === 'true' ? scoredProducts : [],
            meta: {
                totalResults: products.length,
                query: searchTerm
            }
        });

    } catch (error) {
        console.error('Search error:', error);
        return errorResponse(res, 'Failed to perform search', 500);
    }
};

// Enhanced product search with filters for search results page
const searchProductsDetailed = async (req, res) => {
    try {
        const {
            query,
            page = 1,
            limit = 20,
            minPrice,
            maxPrice,
            brandId,
            categoryId,
            sortBy = 'relevance'
        } = req.query;

        if (!query || query.trim().length < 2) {
            return successResponse(res, {
                products: [],
                pagination: {
                    total: 0,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: 0
                },
                filters: {
                    brands: [],
                    categories: []
                }
            });
        }

        const searchTerm = query.trim();
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build base where clause
        const where = {
            AND: [
                {
                    OR: [
                        { productName: { contains: searchTerm, mode: 'insensitive' } },
                        { sku: { contains: searchTerm, mode: 'insensitive' } },
                        { description: { contains: searchTerm, mode: 'insensitive' } },
                        {
                            brand: {
                                name: { contains: searchTerm, mode: 'insensitive' }
                            }
                        },
                        {
                            subCategory: {
                                OR: [
                                    { name: { contains: searchTerm, mode: 'insensitive' } },
                                    {
                                        category: {
                                            name: { contains: searchTerm, mode: 'insensitive' }
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                },
                { status: true },
                { isArchived: false },
                { visibility: { not: "unpublish" } },
                { deletedAt: null }
            ]
        };

        // Apply price filter
        if (minPrice || maxPrice) {
            where.AND.push({
                price: {
                    ...(minPrice && { gte: parseFloat(minPrice) }),
                    ...(maxPrice && { lte: parseFloat(maxPrice) })
                }
            });
        }

        // Apply brand filter
        if (brandId) {
            where.AND.push({ brandId: parseInt(brandId) });
        }

        const subCategoryCondition = {
            status: true,
            category: {
                status: true,
                mainCategory: {
                    status: true
                }
            }
        };

        // Apply category filter
        if (categoryId) {
            subCategoryCondition.categoryId = parseInt(categoryId);
        }

        where.AND.push({ subCategory: subCategoryCondition });

        // Build orderBy based on sort parameter
        let orderBy = [];
        switch (sortBy) {
            case 'price-low':
                orderBy = [{ price: 'asc' }];
                break;
            case 'price-high':
                orderBy = [{ price: 'desc' }];
                break;
            case 'newest':
                orderBy = [
                    { updatedAt: 'desc' },
                    { createdAt: 'desc' }
                ];
                break;
            case 'popular':
                // Use newest as a proxy for popular since we don't have order count
                orderBy = [
                    { updatedAt: 'desc' },
                    { createdAt: 'desc' }
                ];
                break;
            case 'relevance':
            default:
                // Default relevance sorting
                orderBy = [
                    { productName: 'asc' },
                    { updatedAt: 'desc' },
                    { createdAt: 'desc' }
                ];
                break;
        }

        // Fetch products with pagination
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: searchInclude,
                orderBy,
                skip,
                take: parseInt(limit),
            }),
            prisma.product.count({ where })
        ]);

        // Get unique brands and categories for filters from search results
        const [allBrands, allCategories] = await Promise.all([
            prisma.brand.findMany({
                where: {
                    products: {
                        some: {
                            status: true,
                            deletedAt: null
                        }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    image: true
                },
                orderBy: {
                    name: 'asc'
                }
            }),
            prisma.category.findMany({
                where: {
                    status: true,
                    subCategories: {
                        some: {
                            Product: {
                                some: {
                                    status: true,
                                    deletedAt: null
                                }
                            }
                        }
                    }
                },
                select: {
                    id: true,
                    name: true,
                    image: true
                },
                orderBy: {
                    name: 'asc'
                }
            })
        ]);

        // Calculate product counts for current search
        const brandCounts = await Promise.all(
            allBrands.map(async (brand) => {
                const count = await prisma.product.count({
                    where: {
                        ...where,
                        brandId: brand.id
                    }
                });
                return { ...brand, searchCount: count };
            })
        );

        const categoryCounts = await Promise.all(
            allCategories.map(async (category) => {
                const count = await prisma.product.count({
                    where: {
                        ...where,
                        subCategory: {
                            categoryId: category.id
                        }
                    }
                });
                return { ...category, searchCount: count };
            })
        );

        return successResponse(res, {
            products,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            },
            filters: {
                brands: brandCounts.filter(b => b.searchCount > 0),
                categories: categoryCounts.filter(c => c.searchCount > 0)
            },
            meta: {
                query: searchTerm,
                hasResults: total > 0
            }
        });

    } catch (error) {
        console.error('Detailed search error:', error);
        return errorResponse(res, 'Failed to perform detailed search', 500);
    }
};

module.exports = {
    searchProducts,
    searchProductsDetailed
};