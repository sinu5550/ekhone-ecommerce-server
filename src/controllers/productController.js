const prisma = require("../utils/db.js");
const { errorResponse, successResponse } = require("../utils/responseHandler");

const productInclude = {
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
    productVariants: true,
    collections: {
        include: {
            collection: true,
        },
    },
};

const createProduct = async (req, res) => {
    try {
        const {
            productType = "single",
            variants,
            collectionIds,
            collections,
            ...productData
        } = req.body;

        const allowedFields = [
            "slug",
            "sku",
            "productName",
            "sellingType",
            "subCategoryId",
            "brandId",
            "unitId",
            "store",
            "warehouse",
            "warrantyId",
            "price",
            "costPrice",
            "quantity",
            "images",
            "description",
            "quantityAlert",
            "taxType",
            "tax",
            "discountType",
            "discountValue",
            "manufacturer",
            "manufacturerData",
            "expireOn",
            "variantAttributesId",
            "productType",
            "insideDhakaDeliveryCharge",
            "outsideDhakaDeliveryCharge",
            "visibility",
        ];

        const data = Object.keys(productData)
            .filter((key) => allowedFields.includes(key))
            .reduce((obj, key) => ({ ...obj, [key]: productData[key] }), {});

        data.productType = productType;
        if (!data.visibility) {
            data.visibility = "public";
        }

        if (data.subCategoryId) {
            data.subCategoryId = parseInt(data.subCategoryId);
            const subCategory = await prisma.subCategory.findUnique({
                where: { id: data.subCategoryId },
                include: {
                    category: {
                        include: {
                            mainCategory: true
                        }
                    }
                }
            });

            if (!subCategory) {
                return errorResponse(res, 'Subcategory not found', 404);
            }

            if (!subCategory.status) {
                return errorResponse(res, 'Cannot create product with an inactive subcategory', 400);
            }

            if (!subCategory.category || !subCategory.category.status) {
                return errorResponse(res, 'Cannot create product under an inactive category', 400);
            }

            if (!subCategory.category.mainCategory || !subCategory.category.mainCategory.status) {
                return errorResponse(res, 'Cannot create product under an inactive main category', 400);
            }
        }
        if (data.brandId) data.brandId = parseInt(data.brandId);
        if (data.unitId) data.unitId = parseInt(data.unitId);
        if (data.warrantyId) data.warrantyId = parseInt(data.warrantyId);
        if (data.variantAttributesId) data.variantAttributesId = parseInt(data.variantAttributesId);
        if (data.price) data.price = parseFloat(data.price);
        if (data.costPrice !== undefined) data.costPrice = parseFloat(data.costPrice) || 0;
        if (data.quantity) data.quantity = parseInt(data.quantity);
        if (data.quantityAlert) data.quantityAlert = parseInt(data.quantityAlert);
        if (data.tax) data.tax = parseFloat(data.tax);
        if (data.discountValue !== undefined) {
            data.discountValue = (data.discountValue === null || data.discountValue === '' || isNaN(parseInt(data.discountValue)))
                ? 0
                : parseInt(data.discountValue);
        } else {
            data.discountValue = 0;
        }
        if (data.discountType !== undefined) {
            data.discountType = data.discountType ? data.discountType : null;
        } else {
            data.discountType = null;
        }
        if (!data.discountType || data.discountValue === 0) {
            data.discountType = null;
            data.discountValue = 0;
        }
        if (data.insideDhakaDeliveryCharge) data.insideDhakaDeliveryCharge = parseFloat(data.insideDhakaDeliveryCharge);
        if (data.outsideDhakaDeliveryCharge) data.outsideDhakaDeliveryCharge = parseFloat(data.outsideDhakaDeliveryCharge);

        if (productType === "variant" && variants && variants.length > 0) {
            data.quantity = 0;
        }

        const createdProductId = await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data,
            });

            if (productType === "variant" && variants && variants.length > 0) {
                const variantData = variants.map((variant, index) => ({
                    productId: product.id,
                    sku: variant.sku,
                    price: parseFloat(variant.price),
                    costPrice: parseFloat(variant.costPrice) || parseFloat(data.costPrice) || 0,
                    quantity: parseInt(variant.quantity) || 0,
                    attributes: variant.attributes,
                    image: variant.image || null,
                    isDefault: index === 0,
                }));

                await tx.productVariant.createMany({
                    data: variantData,
                });
            }

            const targetCollections = collectionIds || collections;
            if (Array.isArray(targetCollections) && targetCollections.length > 0) {
                const collectionData = targetCollections
                    .map(id => typeof id === "object" ? (id.id || id.collectionId) : id)
                    .filter(id => id && !isNaN(parseInt(id)))
                    .map(id => ({
                        productId: product.id,
                        collectionId: parseInt(id)
                    }));

                if (collectionData.length > 0) {
                    await tx.productCollection.createMany({
                        data: collectionData,
                        skipDuplicates: true
                    });
                }
            }

            return product.id;
        }, {
            maxWait: 15000,
            timeout: 30000,
        });

        const newProduct = await prisma.product.findUnique({
            where: { id: createdProductId },
            include: productInclude,
        });

        return successResponse(res, "Product created successfully", newProduct, 201);
    } catch (error) {
        console.error("Create Product Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

const getAllProduct = async (req, res) => {
    try {
        const {
            brandId,
            collectionId,
            collectionSlug,
            collection,
            subCategoryName,
            subCategoryId,
            categoryId,
            categoryName,
            mainCategoryId,
            mainCategoryName,
            status,
            minPrice,
            maxPrice,
            sellingType,
            productType,
            search,
            page = 1,
            limit = 20,
        } = req.query;

        const where = {
            isArchived: false,
            visibility: { not: "unpublish" },
        };

        if (status !== undefined) {
            where.status = status === "true";
        } else {
            where.status = true;
        }

        if (productType) {
            where.productType = productType;
        }

        if (brandId) where.brandId = parseInt(brandId);
        if (sellingType) where.sellingType = sellingType;

        const activeCollectionId = collectionId || collection;
        if (activeCollectionId && activeCollectionId !== "all") {
            where.collections = {
                some: {
                    collectionId: parseInt(activeCollectionId)
                }
            };
        } else if (collectionSlug) {
            where.collections = {
                some: {
                    collection: {
                        slug: collectionSlug
                    }
                }
            };
        }

        const subCategoryConditions = {
            status: true,
            category: {
                status: true,
                mainCategory: {
                    status: true,
                },
            },
        };

        if (subCategoryId) subCategoryConditions.id = parseInt(subCategoryId);
        if (subCategoryName) subCategoryConditions.name = { equals: subCategoryName, mode: "insensitive" };
        if (categoryId) subCategoryConditions.category.id = parseInt(categoryId);
        if (categoryName) subCategoryConditions.category.name = { equals: categoryName, mode: "insensitive" };
        if (mainCategoryId) subCategoryConditions.category.mainCategory.id = parseInt(mainCategoryId);
        if (mainCategoryName) subCategoryConditions.category.mainCategory.name = { equals: mainCategoryName, mode: "insensitive" };

        where.subCategory = subCategoryConditions;

        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        if (search) {
            where.OR = [
                { productName: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: productInclude,
                orderBy: [
                    { updatedAt: "desc" },
                    { createdAt: "desc" }
                ],
                skip,
                take,
            }),
            prisma.product.count({ where }),
        ]);

        const response = {
            products,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        };

        return successResponse(res, response);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

const getProductById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return errorResponse(res, "Invalid product ID format", 400);
        }

        const product = await prisma.product.findUnique({
            where: { id },
            include: productInclude,
        });

        if (!product) {
            return errorResponse(res, "Product not found", 404);
        }

        return successResponse(res, "Product retrieved successfully", product);
    } catch (error) {
        console.error("Get Product Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

const getProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const product = await prisma.product.findFirst({
            where: {
                slug,
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
            },
            include: productInclude,
        });

        if (!product) return errorResponse(res, "Product not found", 404);
        return successResponse(res, product);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

const updateProduct = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid product ID format", 400);

        const {
            variants,
            productType,
            collectionIds,
            collections,
            ...productData
        } = req.body;

        const allowedFields = [
            "slug",
            "sku",
            "productName",
            "sellingType",
            "subCategoryId",
            "brandId",
            "unitId",
            "store",
            "warehouse",
            "warrantyId",
            "price",
            "costPrice",
            "quantity",
            "images",
            "description",
            "quantityAlert",
            "taxType",
            "tax",
            "discountType",
            "discountValue",
            "manufacturer",
            "manufacturerData",
            "expireOn",
            "variantAttributesId",
            "status",
            "productType",
            "insideDhakaDeliveryCharge",
            "outsideDhakaDeliveryCharge",
            "visibility",
        ];

        const data = Object.keys(productData)
            .filter((key) => allowedFields.includes(key))
            .reduce((obj, key) => ({ ...obj, [key]: productData[key] }), {});

        if (productType !== undefined) {
            data.productType = productType;
        }

        const targetCollections = collectionIds !== undefined ? collectionIds : collections;

        if (Object.keys(data).length === 0 && !variants && targetCollections === undefined) {
            return errorResponse(res, "No valid fields provided for update", 400);
        }

        if (data.subCategoryId) {
            data.subCategoryId = parseInt(data.subCategoryId);
            const subCategory = await prisma.subCategory.findUnique({
                where: { id: data.subCategoryId },
                include: {
                    category: {
                        include: {
                            mainCategory: true
                        }
                    }
                }
            });

            if (!subCategory) {
                return errorResponse(res, 'Subcategory not found', 404);
            }

            if (!subCategory.status) {
                return errorResponse(res, 'Cannot assign product to an inactive subcategory', 400);
            }

            if (!subCategory.category || !subCategory.category.status) {
                return errorResponse(res, 'Cannot assign product to an inactive category', 400);
            }

            if (!subCategory.category.mainCategory || !subCategory.category.mainCategory.status) {
                return errorResponse(res, 'Cannot assign product to an inactive main category', 400);
            }
        }
        if (data.brandId !== undefined) data.brandId = data.brandId ? parseInt(data.brandId) : null;
        if (data.unitId !== undefined) data.unitId = data.unitId ? parseInt(data.unitId) : null;
        if (data.warrantyId !== undefined) data.warrantyId = data.warrantyId ? parseInt(data.warrantyId) : null;
        if (data.variantAttributesId !== undefined) data.variantAttributesId = data.variantAttributesId ? parseInt(data.variantAttributesId) : null;
        if (data.price !== undefined) data.price = parseFloat(data.price);
        if (data.costPrice !== undefined) data.costPrice = parseFloat(data.costPrice);
        if (data.quantity !== undefined) data.quantity = parseInt(data.quantity) || 0;
        if (data.quantityAlert !== undefined) data.quantityAlert = parseInt(data.quantityAlert);
        if (data.tax !== undefined) data.tax = parseFloat(data.tax);
        if (data.discountValue !== undefined) {
            data.discountValue = (data.discountValue === null || data.discountValue === '' || isNaN(parseInt(data.discountValue)))
                ? 0
                : parseInt(data.discountValue);
        }
        if (data.discountType !== undefined) {
            data.discountType = data.discountType ? data.discountType : null;
        }
        if (data.discountType === null || data.discountValue === 0) {
            data.discountType = null;
            data.discountValue = 0;
        }
        if (data.insideDhakaDeliveryCharge !== undefined) data.insideDhakaDeliveryCharge = parseFloat(data.insideDhakaDeliveryCharge);
        if (data.outsideDhakaDeliveryCharge !== undefined) data.outsideDhakaDeliveryCharge = parseFloat(data.outsideDhakaDeliveryCharge);

        if ((productType === "variant" || data.productType === "variant") && variants && Array.isArray(variants)) {
            data.quantity = 0;
        }

        await prisma.$transaction(async (tx) => {
            await tx.product.update({
                where: { id },
                data,
            });

            if (variants && Array.isArray(variants)) {
                const existingVariants = await tx.productVariant.findMany({
                    where: { productId: id },
                });
                const existingVariantMap = new Map(existingVariants.map(v => [v.id, v]));
                const existingSkuMap = new Map(existingVariants.map(v => [v.sku, v]));
                const processedVariantIds = [];

                for (let index = 0; index < variants.length; index++) {
                    const variant = variants[index];
                    const variantId = variant.id ? parseInt(variant.id) : null;

                    const variantData = {
                        sku: variant.sku,
                        price: parseFloat(variant.price) || 0,
                        costPrice: variant.costPrice !== undefined ? (parseFloat(variant.costPrice) || 0) : (data.costPrice !== undefined ? (parseFloat(data.costPrice) || 0) : 0),
                        quantity: parseInt(variant.quantity) || 0,
                        attributes: variant.attributes || {},
                        image: variant.image || null,
                        isDefault: variant.isDefault !== undefined ? Boolean(variant.isDefault) : index === 0,
                    };

                    if (variantId && existingVariantMap.has(variantId)) {
                        // Update existing variant by ID
                        const updated = await tx.productVariant.update({
                            where: { id: variantId },
                            data: variantData,
                        });
                        processedVariantIds.push(updated.id);
                    } else if (variant.sku && existingSkuMap.has(variant.sku)) {
                        // Fallback: match by SKU on the same product
                        const matchedVariant = existingSkuMap.get(variant.sku);
                        const updated = await tx.productVariant.update({
                            where: { id: matchedVariant.id },
                            data: variantData,
                        });
                        processedVariantIds.push(updated.id);
                    } else {
                        // Create new variant
                        const created = await tx.productVariant.create({
                            data: {
                                productId: id,
                                ...variantData,
                            },
                        });
                        processedVariantIds.push(created.id);
                    }
                }

                // Handle variants removed from this product
                const variantsToRemove = existingVariants.filter(
                    v => !processedVariantIds.includes(v.id)
                );

                for (const v of variantsToRemove) {
                    const orderCount = await tx.orderItem.count({
                        where: { productVariantId: v.id }
                    });

                    if (orderCount === 0) {
                        await tx.productVariant.delete({ where: { id: v.id } });
                    } else {
                        // Keep row for historical order integrity, set stock to 0
                        await tx.productVariant.update({
                            where: { id: v.id },
                            data: { quantity: 0 }
                        });
                    }
                }
            }

            if (targetCollections !== undefined) {
                await tx.productCollection.deleteMany({
                    where: { productId: id },
                });

                if (Array.isArray(targetCollections) && targetCollections.length > 0) {
                    const collectionData = targetCollections
                        .map((item) => (typeof item === "object" ? item.id || item.collectionId : item))
                        .filter((cid) => cid && !isNaN(parseInt(cid)))
                        .map((cid) => ({
                            productId: id,
                            collectionId: parseInt(cid),
                        }));

                    if (collectionData.length > 0) {
                        await tx.productCollection.createMany({
                            data: collectionData,
                            skipDuplicates: true,
                        });
                    }
                }
            }
        }, {
            maxWait: 15000,
            timeout: 30000,
        });

        const updatedProduct = await prisma.product.findUnique({
            where: { id },
            include: productInclude,
        });

        return successResponse(res, "Product updated successfully", updatedProduct);
    } catch (error) {
        console.error("Update Product Error:", error);
        return errorResponse(res, error.message, 500);
    }
};

const deleteProduct = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return errorResponse(res, "Invalid product ID format", 400);
        }

        const product = await prisma.product.findUnique({
            where: { id },
            include: { productVariants: true },
        });

        if (!product) {
            return errorResponse(res, "Product not found", 404);
        }

        const variantIds = product.productVariants.map(v => v.id);
        const usageCount = await prisma.orderItem.count({
            where: {
                OR: [
                    { productId: id },
                    { productVariantId: { in: variantIds } }
                ]
            },
        });

        if (usageCount > 0) {
            const archived = await prisma.product.update({
                where: { id },
                data: {
                    status: false,
                    isArchived: true,
                    deletedAt: new Date(),
                },
            });

            return successResponse(
                res,
                "Product archived (cannot be deleted because it exists in orders)",
                archived
            );
        }

        await prisma.product.delete({ where: { id } });
        return successResponse(res, "Product deleted successfully");
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

const getProductsGroupedByCategory = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: {
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
            },
            include: productInclude,
            orderBy: [
                { updatedAt: 'desc' },
                { createdAt: 'desc' }
            ],
        });

        const groupedProducts = products.reduce((acc, product) => {
            const categoryName = product.subCategory?.category?.name || 'Uncategorized';
            if (!acc[categoryName]) {
                acc[categoryName] = [];
            }
            acc[categoryName].push(product);
            return acc;
        }, {});

        return successResponse(res, groupedProducts);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

const getAllProductForAdmin = async (req, res) => {
    try {
        const {
            brandId,
            brandName,
            collectionId,
            collectionSlug,
            collection,
            subCategoryName,
            subCategoryId,
            categoryId,
            categoryName,
            mainCategoryId,
            mainCategoryName,
            sellingType,
            productType,
            visibility,
            status,
            store,
            warehouse,
            unitId,
            warrantyId,
            minPrice,
            maxPrice,
            stockStatus,
            sortBy,
            sortOrder,
            page = 1,
            limit = 20,
            search = "",
        } = req.query;

        const parsedPage = Math.max(1, parseInt(page) || 1);
        const parsedLimit = Math.max(1, parseInt(limit) || 20);
        const skip = (parsedPage - 1) * parsedLimit;
        const take = parsedLimit;

        const where = {
            isArchived: false,
        };

        // Visibility filter
        if (visibility && visibility !== "all") {
            where.visibility = visibility;
        }

        // Status filter (active/inactive)
        if (status !== undefined && status !== "all") {
            where.status = status === "true" || status === true || status === "1" || status === 1;
        }

        // Comprehensive search across product name, SKU, description, brand, category hierarchy, variants, store, warehouse
        if (search && search.trim()) {
            const searchTerm = search.trim();
            where.OR = [
                { productName: { contains: searchTerm, mode: "insensitive" } },
                { sku: { contains: searchTerm, mode: "insensitive" } },
                { description: { contains: searchTerm, mode: "insensitive" } },
                { brand: { name: { contains: searchTerm, mode: "insensitive" } } },
                { store: { contains: searchTerm, mode: "insensitive" } },
                { warehouse: { contains: searchTerm, mode: "insensitive" } },
                { subCategory: { name: { contains: searchTerm, mode: "insensitive" } } },
                { subCategory: { code: { contains: searchTerm, mode: "insensitive" } } },
                { subCategory: { category: { name: { contains: searchTerm, mode: "insensitive" } } } },
                { subCategory: { category: { mainCategory: { name: { contains: searchTerm, mode: "insensitive" } } } } },
                {
                    productVariants: {
                        some: {
                            sku: { contains: searchTerm, mode: "insensitive" },
                        },
                    },
                },
            ];
        }

        // Brand filter
        if (brandId && brandId !== "all" && !isNaN(parseInt(brandId))) {
            where.brandId = parseInt(brandId);
        } else if (brandName && brandName !== "all") {
            where.brand = { name: { equals: brandName.trim(), mode: "insensitive" } };
        }

        // Product Type filter
        if (productType && productType !== "all") {
            where.productType = productType;
        }

        // Selling Type filter
        if (sellingType && sellingType !== "all") {
            where.sellingType = sellingType;
        }

        // Store & Warehouse filter
        if (store && store !== "all") {
            where.store = store;
        }
        if (warehouse && warehouse !== "all") {
            where.warehouse = warehouse;
        }

        // Unit & Warranty filter
        if (unitId && unitId !== "all" && !isNaN(parseInt(unitId))) {
            where.unitId = parseInt(unitId);
        }
        if (warrantyId && warrantyId !== "all" && !isNaN(parseInt(warrantyId))) {
            where.warrantyId = parseInt(warrantyId);
        }

        // Price range filter
        if ((minPrice && minPrice !== "all") || (maxPrice && maxPrice !== "all")) {
            where.price = {};
            if (minPrice && !isNaN(parseFloat(minPrice))) where.price.gte = parseFloat(minPrice);
            if (maxPrice && !isNaN(parseFloat(maxPrice))) where.price.lte = parseFloat(maxPrice);
        }

        // Stock status filter
        if (stockStatus && stockStatus !== "all") {
            if (!where.AND) where.AND = [];
            if (stockStatus === "in_stock") {
                where.AND.push({
                    OR: [
                        { productType: { not: "variant" }, quantity: { gt: 0 } },
                        { productType: "variant", productVariants: { some: { quantity: { gt: 0 } } } }
                    ]
                });
            } else if (stockStatus === "out_of_stock") {
                where.AND.push({
                    OR: [
                        { productType: { not: "variant" }, quantity: { lte: 0 } },
                        { productType: "variant", productVariants: { every: { quantity: { lte: 0 } } } }
                    ]
                });
            } else if (stockStatus === "low_stock") {
                where.AND.push({
                    OR: [
                        { productType: { not: "variant" }, quantity: { lte: 10, gt: 0 } },
                        { productType: "variant", productVariants: { some: { quantity: { lte: 10, gt: 0 } } } }
                    ]
                });
            }
        }

        // Collection filter
        const activeCollectionId = collectionId || collection;
        if (activeCollectionId && activeCollectionId !== "all" && !isNaN(parseInt(activeCollectionId))) {
            where.collections = {
                some: {
                    collectionId: parseInt(activeCollectionId),
                },
            };
        } else if (collectionSlug && collectionSlug !== "all") {
            where.collections = {
                some: {
                    collection: {
                        slug: collectionSlug,
                    },
                },
            };
        }

        // Category Hierarchy filter (Main Category -> Category -> Sub Category)
        const subCategoryConditions = {};

        if (subCategoryId && subCategoryId !== "all" && !isNaN(parseInt(subCategoryId))) {
            where.subCategoryId = parseInt(subCategoryId);
        } else if (subCategoryName && subCategoryName !== "all") {
            subCategoryConditions.name = { equals: subCategoryName.trim(), mode: "insensitive" };
        }

        const categoryConditions = {};
        if (categoryId && categoryId !== "all" && !isNaN(parseInt(categoryId))) {
            categoryConditions.id = parseInt(categoryId);
        } else if (categoryName && categoryName !== "all") {
            categoryConditions.name = { equals: categoryName.trim(), mode: "insensitive" };
        }

        const mainCategoryConditions = {};
        if (mainCategoryId && mainCategoryId !== "all" && !isNaN(parseInt(mainCategoryId))) {
            mainCategoryConditions.id = parseInt(mainCategoryId);
        } else if (mainCategoryName && mainCategoryName !== "all") {
            mainCategoryConditions.name = { equals: mainCategoryName.trim(), mode: "insensitive" };
        }

        if (Object.keys(mainCategoryConditions).length > 0) {
            categoryConditions.mainCategory = mainCategoryConditions;
        }

        if (Object.keys(categoryConditions).length > 0) {
            subCategoryConditions.category = categoryConditions;
        }

        if (Object.keys(subCategoryConditions).length > 0) {
            where.subCategory = subCategoryConditions;
        }

        // Sorting
        const validSortFields = ["createdAt", "updatedAt", "price", "quantity", "productName", "sku"];
        const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
        const sortDirection = sortOrder && sortOrder.toLowerCase() === "asc" ? "asc" : "desc";
        const orderBy = { [sortField]: sortDirection };

        // Run count and products fetch in parallel
        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                include: productInclude,
                orderBy,
                skip,
                take,
            }),
        ]);

        return successResponse(res, {
            products,
            pagination: {
                currentPage: parsedPage,
                limit: parsedLimit,
                totalItems: total,
                totalPages: Math.ceil(total / parsedLimit),
            },
        });

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


const getArchivedProducts = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: {
                isArchived: true,
                // deletedAt: null,
            },
            include: productInclude,
            orderBy: { updatedAt: "desc" },
        });

        return successResponse(res, { products, total: products.length });
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

const getVariantStock = async (req, res) => {
    try {
        const { variantId } = req.params;

        const variant = await prisma.productVariant.findUnique({
            where: { id: parseInt(variantId) },
            select: { quantity: true, sku: true, price: true },
        });

        if (!variant) {
            return errorResponse(res, "Variant not found", 404);
        }

        return successResponse(res, variant);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


// Get new products in last 60 days
const getNewProducts = async (req, res) => {
    try {
        const { page = 1, limit = 20, ...filters } = req.query;

        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        sixtyDaysAgo.setHours(0, 0, 0, 0);

        const where = {
            createdAt: { gte: sixtyDaysAgo },
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
        };

        if (filters.status !== undefined && filters.status !== "") {
            where.status = filters.status === "true";
        }

        if (filters.brandId) where.brandId = parseInt(filters.brandId);
        if (filters.subCategoryId) where.subCategory.id = parseInt(filters.subCategoryId);
        if (filters.productType) where.productType = filters.productType;
        if (filters.sellingType) where.sellingType = filters.sellingType;

        if (filters.search) {
            where.OR = [
                { productName: { contains: filters.search, mode: "insensitive" } },
                { sku: { contains: filters.search, mode: "insensitive" } },
            ];
        }

        if (filters.minPrice || filters.maxPrice) {
            where.price = {};
            if (filters.minPrice) where.price.gte = parseFloat(filters.minPrice);
            if (filters.maxPrice) where.price.lte = parseFloat(filters.maxPrice);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: productInclude,
                orderBy: [
                    { updatedAt: "desc" },
                    { createdAt: "desc" }
                ],
                skip,
                take,
            }),
            prisma.product.count({ where }),
        ]);

        const productsWithAge = products.map(product => ({
            ...product,
            daysSinceCreation: Math.floor((Date.now() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
            isNew: true,
        }));

        const response = {
            products: productsWithAge,
            summary: {
                totalNewProducts: total,
                daysRange: 60,
                fromDate: sixtyDaysAgo,
                toDate: new Date(),
            },
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        };

        return successResponse(res, "New products retrieved successfully", response);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Top Selling products
const getTopSellingProducts = async (req, res) => {
    try {
        const { limit = 10, sortBy = "revenue", status } = req.query;

        const whereClause = {};
        if (status) {
            whereClause.order = { status };
        }

        const salesData = await prisma.orderItem.groupBy({
            by: ["productId"],
            where: whereClause,
            _sum: { quantity: true, lineTotal: true },
            orderBy: sortBy === "quantity" ? { _sum: { quantity: "desc" } } : { _sum: { lineTotal: "desc" } },
            take: parseInt(limit),
        });

        if (salesData.length === 0) {
            return successResponse(res, { products: [], salesStats: [] });
        }

        const validSalesData = salesData.filter((item) => item.productId !== null);

        if (validSalesData.length === 0) {
            return successResponse(res, { products: [], salesStats: [] });
        }

        const productIds = validSalesData.map((item) => item.productId);

        const products = await prisma.product.findMany({
            where: {
                id: { in: productIds },
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
            },
            include: productInclude,
        });

        const topSellingProducts = validSalesData
            .map((sale) => {
                const product = products.find((p) => p.id === sale.productId);
                if (product) {
                    return {
                        ...product,
                        _totalSold: sale._sum.quantity || 0,
                        _totalRevenue: sale._sum.lineTotal || 0,
                    };
                }
                return null;
            })
            .filter(Boolean);

        return successResponse(res, { products: topSellingProducts });
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

module.exports = {
    createProduct,
    getAllProduct,
    updateProduct,
    deleteProduct,
    getProductBySlug,
    getProductById,
    getProductsGroupedByCategory,
    getAllProductForAdmin,
    getArchivedProducts,
    getVariantStock,
    getNewProducts,
    getTopSellingProducts
};


