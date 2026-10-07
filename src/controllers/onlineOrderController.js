const prisma = require('../utils/db.js');
const { generateNumber } = require('../utils/generateNumber.js');
const { errorResponse, successResponse } = require("../utils/responseHandler");
const axios = require('axios');

const normalizeOrderStatus = (status) => {
    if (!status) return undefined;
    const s = String(status).toLowerCase().replace(/[\s\-_]/g, '');
    const map = {
        pending: "Pending",
        confirmed: "Confirmed",
        processing: "Processing",
        readytoship: "ReadyToShip",
        incourier: "InCourier",
        shiplater: "ShipLater",
        hold: "Hold",
        returned: "Returned",
        preorder: "PreOrder",
        shipped: "Shipped",
        shipping: "Shipped",
        delivered: "Delivered",
        cancelled: "Cancelled",
        cancel: "Cancelled",
        missing: "Missing",
        lost: "Lost",
        fake: "Fake",
        trash: "Trash"
    };
    return map[s] || status;
};

const createOrder = async (req, res) => {
    try {
        const orderNumber = await generateNumber("ORDER");

        const {
            customerId,
            shippingAddressId,
            orderDate,
            totalAmount,
            discount = 0,
            voucher_promo = 0,
            tax = 0,
            shippingCost = 0,
            grandTotal,
            paidAmount = 0,
            dueAmount,
            note = "",
            status = "Pending",
            paymentMethod = "COD",
            items = [],
            bundleItems = [],
            couponCode = null,
            couponDiscount = 0,
            pointsToRedeem = 0,
            pointsDiscount = 0
        } = req.body;

        // ============================================
        // BASIC VALIDATION
        // ============================================

        let customerIdInt = customerId ? parseInt(customerId) : null;
        let shippingAddressIdInt = shippingAddressId ? parseInt(shippingAddressId) : null;

        // Auto-create/find customer & address if customer info is provided (e.g. from Landing Page or Quick Checkout)
        if ((!customerIdInt || !shippingAddressIdInt) && req.body.customer && req.body.customer.phone) {
            const custPhone = String(req.body.customer.phone).replace(/\D/g, "");
            const custName = req.body.customer.fullName || req.body.shippingAddress?.recipientName || "Guest Customer";
            const custAddress = req.body.customer.address || req.body.shippingAddress?.address || "Address not provided";
            const custCity = req.body.customer.city || req.body.shippingAddress?.city || "Dhaka";

            let existingCustomer = await prisma.customer.findFirst({
                where: { phone: custPhone },
                include: { customerAddresses: true }
            });

            if (!existingCustomer) {
                const customerCode = await generateNumber("CUSTOMER");
                existingCustomer = await prisma.customer.create({
                    data: {
                        customerCode,
                        fullName: custName,
                        phone: custPhone,
                        status: true
                    },
                    include: { customerAddresses: true }
                });
            }

            customerIdInt = existingCustomer.id;

            // Check or create customerAddress
            let defaultAddress = existingCustomer.customerAddresses?.[0];
            if (!defaultAddress) {
                defaultAddress = await prisma.customerAddress.create({
                    data: {
                        customerId: customerIdInt,
                        recipientName: custName,
                        phoneNumber: custPhone,
                        address: custAddress,
                        upazila: custCity,
                        district: custCity,
                        division: "Dhaka",
                        city: custCity,
                        country: "Bangladesh",
                        type: "Home",
                        isDefault: true
                    }
                });
            }
            shippingAddressIdInt = defaultAddress.id;
        }

        if (!customerIdInt || !shippingAddressIdInt) {
            return errorResponse(res, "Customer ID and shipping address are required", 400);
        }

        if (items.length === 0 && bundleItems.length === 0) {
            return errorResponse(res, "Order must contain at least one item", 400);
        }

        const pointsToRedeemInt = parseInt(pointsToRedeem || 0);
        const pointsDiscountFloat = parseFloat(pointsDiscount || 0);

        // Verify customer exists
        const customer = await prisma.customer.findUnique({
            where: { id: customerIdInt }
        });

        if (!customer) {
            return errorResponse(res, "Customer not found", 404);
        }

        // Verify shipping address
        const address = await prisma.customerAddress.findFirst({
            where: {
                id: shippingAddressIdInt,
                customerId: customerIdInt
            }
        });

        if (!address) {
            return errorResponse(res, "Invalid shipping address for this customer", 400);
        }

        // ============================================
        // VALIDATE REGULAR PRODUCTS ONLY (Not Bundles)
        // ============================================
        const validatedItems = [];
        for (const item of items) {
            if (!item.productId) {
                return errorResponse(res, "Product ID is required for all items", 400);
            }

            const productId = parseInt(item.productId);
            const requestedQty = parseInt(item.quantity || 1);
            const productVariantId = item.productVariantId ? parseInt(item.productVariantId) : null;

            let product;
            if (productVariantId) {
                product = await prisma.product.findUnique({
                    where: { id: productId },
                    include: {
                        productVariants: {
                            where: { id: productVariantId }
                        }
                    }
                });
            } else {
                product = await prisma.product.findUnique({
                    where: { id: productId }
                });
            }

            if (!product) {
                return errorResponse(res, `Product with ID ${productId} not found`, 404);
            }

            if (productVariantId) {
                const variant = product.productVariants?.[0];
                if (!variant) {
                    return errorResponse(res, `Variant with ID ${productVariantId} not found`, 404);
                }

                const variantStock = parseInt(variant.quantity || 0);
                if (variantStock < requestedQty) {
                    return errorResponse(
                        res,
                        `Insufficient stock for ${product.productName}. Available: ${variantStock}`,
                        400
                    );
                }

                validatedItems.push({
                    ...item,
                    productId,
                    productVariantId,
                    sku: variant.sku || item.sku || product.sku,
                    variant,
                    isVariant: true,
                    stockToUpdate: true,
                    actualPrice: parseFloat(variant.price || product.price)
                });
            } else {
                const productStock = parseInt(product.quantity || 0);
                if (product.productType !== 'variant' && productStock < requestedQty) {
                    return errorResponse(
                        res,
                        `Insufficient stock for ${product.productName}. Available: ${productStock}`,
                        400
                    );
                }

                validatedItems.push({
                    ...item,
                    productId,
                    productVariantId: null,
                    isVariant: false,
                    stockToUpdate: product.productType !== 'variant',
                    actualPrice: parseFloat(product.price)
                });
            }
        }

        // ============================================
        // VALIDATE BUNDLES - Only check if bundle exists, no stock validation
        // ============================================
        const validatedBundles = [];
        for (const bundleItem of bundleItems) {
            if (!bundleItem.bundleId) {
                return errorResponse(res, "Bundle ID is required for bundle items", 400);
            }

            const bundleId = parseInt(bundleItem.bundleId);
            const bundle = await prisma.bundleProduct.findUnique({
                where: { id: bundleId },
                include: {
                    bundleItems: {
                        include: {
                            product: true
                        }
                    }
                }
            });

            if (!bundle) {
                return errorResponse(res, `Bundle with ID ${bundleId} not found`, 404);
            }

            // ✅ No stock validation for bundles
            validatedBundles.push({
                ...bundleItem,
                bundleId,
                bundleData: bundle
            });
        }

        // ============================================
        // VALIDATE COUPON
        // ============================================
        let validatedCoupon = null;
        let calculatedCouponDiscount = 0;

        if (couponCode) {
            validatedCoupon = await prisma.coupon.findFirst({
                where: {
                    code: couponCode.toUpperCase(),
                    active: true,
                    OR: [
                        { startAt: { lte: new Date() } },
                        { startAt: null }
                    ],
                    OR: [
                        { endAt: { gte: new Date() } },
                        { endAt: null }
                    ]
                }
            });

            if (!validatedCoupon) {
                return errorResponse(res, "Invalid or expired coupon code", 400);
            }

            if (validatedCoupon.minOrderAmount && parseFloat(totalAmount) < parseFloat(validatedCoupon.minOrderAmount)) {
                return errorResponse(
                    res,
                    `Minimum order amount of ৳${validatedCoupon.minOrderAmount} required for this coupon`,
                    400
                );
            }

            if (validatedCoupon.discountType === 'Percentage') {
                calculatedCouponDiscount = (parseFloat(totalAmount) * parseFloat(validatedCoupon.discountValue)) / 100;
                if (validatedCoupon.maxDiscountAmount && calculatedCouponDiscount > parseFloat(validatedCoupon.maxDiscountAmount)) {
                    calculatedCouponDiscount = parseFloat(validatedCoupon.maxDiscountAmount);
                }
            } else if (validatedCoupon.discountType === 'Fixed') {
                calculatedCouponDiscount = parseFloat(validatedCoupon.discountValue);
            }
        }

        // ============================================
        // TRANSACTION - All DB operations
        // ============================================
        const order = await prisma.$transaction(async (tx) => {
            // ============================================
            // 1. PROCESS LOYALTY POINTS REDEMPTION (if any)
            // ============================================
            if (pointsToRedeemInt > 0) {
                let loyaltyAccount = await tx.loyaltyPoints.findUnique({
                    where: { customerId: customerIdInt }
                });

                if (!loyaltyAccount) {
                    loyaltyAccount = await tx.loyaltyPoints.create({
                        data: {
                            customerId: customerIdInt,
                            balance: 0,
                            lifetimeEarned: 0,
                            lifetimeRedeemed: 0
                        }
                    });
                }

                if (pointsToRedeemInt < 500) {
                    throw new Error("Minimum 500 points required to redeem");
                }

                if (loyaltyAccount.balance < pointsToRedeemInt) {
                    throw new Error(`Insufficient points balance. Available: ${loyaltyAccount.balance} points`);
                }

                if (pointsDiscountFloat !== pointsToRedeemInt) {
                    throw new Error(`Invalid points discount calculation. ${pointsToRedeemInt} points should equal ৳${pointsToRedeemInt}`);
                }

                const payableAmount = parseFloat(grandTotal) - calculatedCouponDiscount;
                if (pointsDiscountFloat > payableAmount) {
                    throw new Error(`Cannot redeem ${pointsToRedeemInt} points. Maximum redeemable: ${Math.floor(payableAmount)} points`);
                }

                const newBalance = loyaltyAccount.balance - pointsToRedeemInt;
                await tx.loyaltyPoints.update({
                    where: { id: loyaltyAccount.id },
                    data: {
                        balance: newBalance,
                        lifetimeRedeemed: { increment: pointsToRedeemInt },
                        updatedAt: new Date()
                    }
                });
            }

            // ============================================
            // 2. CREATE ORDER
            // ============================================
            const voucherPromoTotal = calculatedCouponDiscount + pointsDiscountFloat;
            const finalGrandTotal = parseFloat(grandTotal) - pointsDiscountFloat;
            const finalDueAmount = parseFloat(dueAmount) - pointsDiscountFloat;

            // Ensure status is a valid OrderStatus enum
            const orderStatus = normalizeOrderStatus(status) || "Pending";

            // Compute paymentStatus from paidAmount and dueAmount
            const numPaid = parseFloat(paidAmount || 0);
            const computedPaymentStatus =
                finalDueAmount <= 0 && numPaid > 0 ? "Paid" :
                    numPaid > 0 ? "Partial" : "Unpaid";
            const validPaymentStatuses = ["Unpaid", "Paid", "Partial", "Refunded", "COD"];
            const orderPaymentStatus = (req.body.paymentStatus && validPaymentStatuses.includes(req.body.paymentStatus))
                ? req.body.paymentStatus
                : computedPaymentStatus;

            const newOrder = await tx.onlineOrder.create({
                data: {
                    orderNumber,
                    customerId: customerIdInt,
                    shippingAddressId: shippingAddressIdInt,
                    orderDate: orderDate ? new Date(orderDate) : new Date(),
                    paymentMethod,
                    totalAmount: parseFloat(totalAmount),
                    discount: parseFloat(discount),
                    voucher_promo: voucherPromoTotal,
                    tax: parseFloat(tax),
                    shippingCost: parseFloat(shippingCost),
                    grandTotal: finalGrandTotal,
                    paidAmount: parseFloat(paidAmount),
                    dueAmount: finalDueAmount,
                    note: (validatedCoupon || pointsToRedeemInt > 0)
                        ? `${note || ''}${validatedCoupon ? `\nCoupon Code: ${couponCode.toUpperCase()}` : ''}${pointsToRedeemInt > 0 ? `\nRedeemed ${pointsToRedeemInt} loyalty points` : ''}`
                        : (note || null),
                    status: orderStatus,
                    paymentStatus: orderPaymentStatus,
                    pointsRedeemed: pointsToRedeemInt > 0 ? pointsToRedeemInt : null,
                    pointsRedeemedValue: pointsDiscountFloat > 0 ? pointsDiscountFloat : null,
                },
            });

            // ============================================
            // 3. CREATE LOYALTY TRANSACTION RECORD (if points redeemed)
            // ============================================
            if (pointsToRedeemInt > 0) {
                const loyaltyAccount = await tx.loyaltyPoints.findUnique({
                    where: { customerId: customerIdInt }
                });

                if (loyaltyAccount) {
                    await tx.loyaltyTransaction.create({
                        data: {
                            loyaltyPointsId: loyaltyAccount.id,
                            customerId: customerIdInt,
                            orderId: newOrder.id,
                            type: 'REDEEMED',
                            points: -pointsToRedeemInt,
                            balanceAfter: loyaltyAccount.balance - pointsToRedeemInt,
                            description: `Redeemed ${pointsToRedeemInt} points for order #${orderNumber}`,
                            metadata: {
                                orderNumber,
                                redemptionValue: pointsDiscountFloat,
                                previousBalance: loyaltyAccount.balance
                            }
                        }
                    });
                }
            }

            // ============================================
            // 4. CREATE ORDER ITEMS FOR REGULAR PRODUCTS
            // ============================================
            if (validatedItems.length > 0) {
                const orderItemsData = validatedItems.map((item) => {
                    const qty = parseInt(item.quantity || 1);
                    const unitPrice = parseFloat(item.unitPrice || item.actualPrice);
                    const itemDiscount = parseFloat(item.discount || 0);
                    const itemTax = parseFloat(item.tax || 0);
                    const lineTotal = parseFloat(item.lineTotal || (unitPrice * qty));

                    const orderItemData = {
                        onlineOrderId: newOrder.id,
                        productId: item.productId,
                        sku: item.sku || null,
                        quantity: qty,
                        unitPrice: unitPrice,
                        discount: itemDiscount,
                        tax: itemTax,
                        lineTotal: lineTotal,
                    };

                    if (item.isVariant && item.productVariantId) {
                        orderItemData.productVariantId = item.productVariantId;
                    }

                    return orderItemData;
                });

                await tx.orderItem.createMany({
                    data: orderItemsData,
                });

                // Update inventory for regular items only
                for (const item of validatedItems) {
                    const qty = parseInt(item.quantity || 1);

                    if (item.isVariant && item.productVariantId && item.stockToUpdate) {
                        await tx.productVariant.update({
                            where: { id: item.productVariantId },
                            data: { quantity: { decrement: qty } }
                        });
                    } else if (!item.isVariant && item.stockToUpdate) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { quantity: { decrement: qty } }
                        });
                    }
                }
            }

            // ============================================
            // 5. CREATE BUNDLE ORDER ITEMS & PRODUCT ORDER ITEMS
            //    ✅ NO STOCK VALIDATION OR STOCK UPDATE FOR BUNDLES
            // ============================================
            if (validatedBundles.length > 0) {
                for (const bundleItem of validatedBundles) {
                    const bundle = bundleItem.bundleData;
                    const bundleQuantity = parseInt(bundleItem.quantity || 1);

                    // Calculate bundle-level discount ratio
                    const bundleOriginalPrice = parseFloat(bundleItem.originalPrice || bundle.price || 0);
                    const bundleFinalPrice = parseFloat(bundleItem.unitPrice || bundleItem.price || 0);
                    const discountRatio = bundleOriginalPrice > 0 ? bundleFinalPrice / bundleOriginalPrice : 1;

                    // 5.1 Create BundleOrderItem record
                    await tx.bundleOrderItem.create({
                        data: {
                            onlineOrderId: newOrder.id,
                            bundleId: bundleItem.bundleId,
                            quantity: bundleQuantity,
                            unitPrice: parseFloat(bundleItem.unitPrice || bundleItem.price || 0),
                            discount: parseFloat(bundleItem.discount || 0),
                            tax: parseFloat(bundleItem.tax || 0),
                            lineTotal: parseFloat(bundleItem.lineTotal || bundleItem.price || 0),
                        }
                    });

                    // 5.2 Create OrderItem for each product in the bundle
                    // ✅ This ensures product info is stored in orderItems
                    if (bundle.bundleItems && bundle.bundleItems.length > 0) {
                        for (const bi of bundle.bundleItems) {
                            const product = bi.product;
                            const itemQuantity = parseInt(bi.quantity || 1) * bundleQuantity;
                            const productPrice = parseFloat(product.price || 0);

                            // Apply bundle discount to each product
                            const discountedPrice = productPrice * discountRatio;

                            // Calculate product discount
                            const productDiscount = (productPrice - discountedPrice) * itemQuantity;

                            // Calculate VAT if needed
                            let itemTax = 0;
                            if (product.taxType && product.taxType.toLowerCase() === "exclusive" && product.tax) {
                                const taxRate = parseFloat(product.tax || 0);
                                itemTax = (discountedPrice * itemQuantity * taxRate) / 100;
                            }

                            const lineTotal = (discountedPrice * itemQuantity) + itemTax;

                            // Create OrderItem for this bundle product
                            await tx.orderItem.create({
                                data: {
                                    onlineOrderId: newOrder.id,
                                    productId: bi.productId,
                                    sku: product.sku || null,
                                    quantity: itemQuantity,
                                    unitPrice: discountedPrice,
                                    discount: productDiscount,
                                    tax: itemTax,
                                    lineTotal: lineTotal,
                                    productVariantId: bi.productVariantId || null,
                                }
                            });
                        }
                    }

                    // ✅ NO STOCK UPDATE FOR BUNDLES OR BUNDLE PRODUCTS
                    // Bundle stock and product stock are managed separately
                }
            }

            // ============================================
            // 6. UPDATE COUPON USAGE
            // ============================================
            if (validatedCoupon) {
                await tx.coupon.update({
                    where: { id: validatedCoupon.id },
                    data: { redeemedCount: { increment: 1 } }
                });
            }

            return newOrder;
        }, {
            timeout: 15000,
        });

        // ============================================
        // FETCH COMPLETE ORDER DATA
        // ============================================
        const completeOrder = await prisma.onlineOrder.findUnique({
            where: { id: order.id },
            include: {
                orderItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                images: true
                            }
                        },
                        productVariant: true
                    }
                },
                bundleOrderItems: {
                    include: {
                        bundle: {
                            include: {
                                bundleItems: {
                                    include: {
                                        product: true
                                    }
                                }
                            }
                        }
                    }
                },
                customer: {
                    select: {
                        id: true,
                        customerCode: true,
                        fullName: true,
                        email: true,
                        phone: true
                    }
                },
                shippingAddress: true
            },
        });

        // ============================================
        // SEND ORDER CONFIRMATION EMAIL (NON-BLOCKING)
        // ============================================
        sendOrderConfirmationEmail(completeOrder).catch(error => {
            console.error(`Background email sending failed for order #${completeOrder.orderNumber}:`, error.message);
        });

        // ============================================
        // SUCCESS RESPONSE
        // ============================================
        let successMessage = "Order created successfully";
        if (validatedCoupon) {
            successMessage += ` with coupon ${couponCode}`;
        }
        if (pointsToRedeemInt > 0) {
            successMessage += ` and ${pointsToRedeemInt} loyalty points redeemed (৳${pointsDiscountFloat} discount)`;
        }

        return successResponse(res, completeOrder, successMessage);

    } catch (error) {
        console.error("Order creation error:", error);
        return errorResponse(res, error.message || "Failed to create order", 500);
    }
};


// ============================================
// SEPARATE FUNCTION FOR EMAIL SENDING
// ============================================
async function sendOrderConfirmationEmail(orderData) {
    try {
        const { sendOrderConfirmationDirect } = require('./emailController');
        if (typeof sendOrderConfirmationDirect === 'function') {
            await sendOrderConfirmationDirect(orderData);
            console.log(`Order confirmation email sent for order #${orderData.orderNumber}`);
            return;
        }

        const emailData = {
            orderNumber: orderData.orderNumber,
            customer: {
                fullName: orderData.customer?.fullName,
                email: orderData.customer?.email,
                phone: orderData.customer?.phone
            },
            shippingAddress: {
                recipientName: orderData.shippingAddress?.recipientName,
                phoneNumber: orderData.shippingAddress?.phoneNumber,
                address: orderData.shippingAddress?.address,
                upazila: orderData.shippingAddress?.upazila,
                postalCode: orderData.shippingAddress?.postalCode,
                district: orderData.shippingAddress?.district,
                city: orderData.shippingAddress?.city,
                country: orderData.shippingAddress?.country
            },
            orderItems: (orderData.orderItems || []).map(item => {
                const variant = item.productVariant || null;
                const vAttrs = variant?.attributes ? (typeof variant.attributes === 'string' ? JSON.parse(variant.attributes) : variant.attributes) : null;
                const vDetails = vAttrs ? Object.values(vAttrs).join(' - ') : (variant?.color || variant?.size || null);
                const rawName = item.product?.productName || 'Product';
                const displayName = vDetails && !rawName.toLowerCase().includes(String(vDetails).toLowerCase())
                    ? `${rawName} (${vDetails})`
                    : rawName;
                const finalSku = item.sku || variant?.sku || item.product?.sku || 'N/A';

                return {
                    product: {
                        productName: displayName,
                        sku: finalSku
                    },
                    productName: displayName,
                    sku: finalSku,
                    quantity: item.quantity,
                    unitPrice: parseFloat(item.unitPrice || 0),
                    lineTotal: parseFloat(item.lineTotal || 0)
                };
            }),
            orderDate: orderData.orderDate,
            totalAmount: parseFloat(orderData.totalAmount || 0),
            discount: parseFloat(orderData.discount || 0),
            voucher_promo: parseFloat(orderData.voucher_promo || 0),
            tax: parseFloat(orderData.tax || 0),
            shippingCost: parseFloat(orderData.shippingCost || 0),
            grandTotal: parseFloat(orderData.grandTotal || 0),
            paidAmount: parseFloat(orderData.paidAmount || 0),
            dueAmount: parseFloat(orderData.dueAmount || 0),
            note: orderData.note,
            paymentMethod: orderData.paymentMethod,
            status: orderData.status
        };

        if (orderData.bundleOrderItems?.length > 0) {
            emailData.bundleItems = orderData.bundleOrderItems.map(bundleItem => ({
                bundleName: bundleItem.bundle?.name,
                quantity: bundleItem.quantity,
                unitPrice: parseFloat(bundleItem.unitPrice || 0),
                lineTotal: parseFloat(bundleItem.lineTotal || 0)
            }));
        }

        const apiBase = process.env.API_URL || 'http://localhost:5000';
        await axios.post(`${apiBase}/api/emails/order-confirmation`, emailData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        console.log(`Order confirmation email sent for order #${orderData.orderNumber}`);
    } catch (error) {
        console.error(`Failed to send order confirmation email for order #${orderData.orderNumber}:`, error.message);
    }
}


// ============================================
//         KEEP ONLY EXISTING FUNCTIONS
// ============================================

const getAllOrder = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            search, 
            status, 
            paymentStatus 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Build where clause
        const where = {};

        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { customer: { fullName: { contains: search, mode: 'insensitive' } } },
                { customer: { email: { contains: search, mode: 'insensitive' } } },
                { customer: { phone: { contains: search, mode: 'insensitive' } } }
            ];
        }

        if (status && status !== 'all') {
            where.status = normalizeOrderStatus(status);
        }

        if (paymentStatus && paymentStatus !== 'all') {
            where.paymentStatus = paymentStatus;
        }

        // Get total count
        const total = await prisma.onlineOrder.count({ where });

        // Get paginated orders
        const orders = await prisma.onlineOrder.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true
                    }
                },
                shippingAddress: true,
                shipment: true,
                orderItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                images: true
                            }
                        },
                        productVariant: true
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
        });

        return successResponse(res, {
            orders,
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: total,
                totalPages: Math.ceil(total / parseInt(limit)),
            }
        });

    } catch (error) {
        console.error("Error fetching orders:", error);
        return errorResponse(res, error.message, 500);
    }
};

const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma.onlineOrder.findUnique({
            where: { id: Number(id) },
            include: {
                customer: true,
                orderItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                images: true
                            }
                        },
                        productVariant: true
                    },
                },
                bundleOrderItems: {
                    include: {
                        bundle: {
                            include: {
                                bundleItems: {
                                    include: {
                                        product: true
                                    }
                                }
                            }
                        }
                    }
                },
                shippingAddress: true,
                shipment: true
            },
        });

        if (!order) return errorResponse(res, "Order not found", 404);
        return successResponse(res, "Order fetched successfully", order);
    } catch (error) {
        console.error("Error fetching order:", error);
        return errorResponse(res, error.message, 500);
    }
};

const isRestoredStatus = (s) => {
    if (!s) return false;
    const norm = normalizeOrderStatus(s);
    return norm === "Returned" || norm === "Cancelled";
};

const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            totalAmount,
            discount,
            tax,
            shippingCost,
            grandTotal,
            paidAmount,
            dueAmount,
            note,
            status,
            items
        } = req.body;

        const existingOrder = await prisma.onlineOrder.findUnique({
            where: { id: Number(id) },
            select: {
                id: true,
                status: true,
                orderItems: {
                    select: {
                        productId: true,
                        productVariantId: true,
                        quantity: true
                    }
                },
                shipment: {
                    select: {
                        id: true,
                        isStockRestored: true
                    }
                }
            },
        });

        if (!existingOrder) return errorResponse(res, "Order not found", 404);

        const updatedOrder = await prisma.$transaction(async (tx) => {
            // Only update items if items array is provided in the request
            if (items && items.length > 0) {
                await tx.orderItem.deleteMany({ where: { onlineOrderId: Number(id) } });

                await tx.orderItem.createMany({
                    data: items.map((item) => ({
                        onlineOrderId: Number(id),
                        productId: item.productId,
                        productVariantId: item.productVariantId || null,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discount: item.discount || 0,
                        tax: item.tax || 0,
                        lineTotal: (item.unitPrice * item.quantity) - (item.discount || 0) + (item.tax || 0),
                        variantAttributes: item.variantAttributes || null
                    })),
                });
            }

            const normalizedStatus = status !== undefined ? normalizeOrderStatus(status) : undefined;

            // =========================================================================
            // STOCK MANAGEMENT ON STATUS TRANSITIONS (Return & Cancel)
            // =========================================================================
            if (normalizedStatus !== undefined) {
                const currentStatusNorm = normalizeOrderStatus(existingOrder.status);
                const nextStatusNorm = normalizedStatus;

                if (currentStatusNorm !== nextStatusNorm) {
                    const isCurrentlyRestored = isRestoredStatus(currentStatusNorm) || Boolean(existingOrder.shipment?.isStockRestored);
                    const willBeRestored = isRestoredStatus(nextStatusNorm);

                    // 1. Moving from Active status -> Returned / Cancelled (Restore stock back into inventory)
                    if (!isCurrentlyRestored && willBeRestored) {
                        for (const item of existingOrder.orderItems) {
                            const qty = parseInt(item.quantity || 1);
                            if (item.productVariantId) {
                                await tx.productVariant.update({
                                    where: { id: item.productVariantId },
                                    data: { quantity: { increment: qty } }
                                });
                            } else if (item.productId) {
                                await tx.product.update({
                                    where: { id: item.productId },
                                    data: { quantity: { increment: qty } }
                                });
                            }
                        }

                        if (existingOrder.shipment) {
                            await tx.shipment.update({
                                where: { id: existingOrder.shipment.id },
                                data: {
                                    isStockRestored: true,
                                    stockRestoredAt: new Date()
                                }
                            });
                        }
                    }
                    // 2. Moving from Returned / Cancelled back to Active status (Deduct stock from inventory again)
                    else if (isCurrentlyRestored && !willBeRestored) {
                        for (const item of existingOrder.orderItems) {
                            const qty = parseInt(item.quantity || 1);
                            if (item.productVariantId) {
                                await tx.productVariant.update({
                                    where: { id: item.productVariantId },
                                    data: { quantity: { decrement: qty } }
                                });
                            } else if (item.productId) {
                                await tx.product.update({
                                    where: { id: item.productId },
                                    data: { quantity: { decrement: qty } }
                                });
                            }
                        }

                        if (existingOrder.shipment) {
                            await tx.shipment.update({
                                where: { id: existingOrder.shipment.id },
                                data: {
                                    isStockRestored: false,
                                    stockRestoredAt: null
                                }
                            });
                        }
                    }
                }
            }

            // Update the order with provided fields
            return tx.onlineOrder.update({
                where: { id: Number(id) },
                data: {
                    ...(totalAmount !== undefined && { totalAmount }),
                    ...(discount !== undefined && { discount }),
                    ...(tax !== undefined && { tax }),
                    ...(shippingCost !== undefined && { shippingCost }),
                    ...(grandTotal !== undefined && { grandTotal }),
                    ...(paidAmount !== undefined && { paidAmount }),
                    ...(dueAmount !== undefined && { dueAmount }),
                    ...(note !== undefined && { note }),
                    ...(normalizedStatus !== undefined && { status: normalizedStatus }),
                },
                include: {
                    orderItems: items && items.length > 0 ? {
                        include: {
                            product: true,
                            productVariant: true
                        }
                    } : true,
                },
            });
        });

        return successResponse(res, updatedOrder, "Order updated successfully");
    } catch (error) {
        console.error("Error updating order:", error);
        return errorResponse(res, error.message, 500);
    }
};


const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const existingOrder = await prisma.onlineOrder.findUnique({
            where: { id: Number(id) },
            include: { orderItems: true, shipment: true }
        });

        if (!existingOrder) return errorResponse(res, "Order not found", 404);

        await prisma.$transaction(async (tx) => {
            const currentStatus = normalizeOrderStatus(existingOrder.status);
            const isRestored = isRestoredStatus(currentStatus) || Boolean(existingOrder.shipment?.isStockRestored);

            // If deleting an order whose stock hasn't been restored yet, restore stock to inventory
            if (!isRestored && existingOrder.orderItems?.length > 0) {
                for (const item of existingOrder.orderItems) {
                    const qty = parseInt(item.quantity || 1);
                    if (item.productVariantId) {
                        await tx.productVariant.update({
                            where: { id: item.productVariantId },
                            data: { quantity: { increment: qty } }
                        });
                    } else if (item.productId) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { quantity: { increment: qty } }
                        });
                    }
                }
            }

            await tx.onlineOrder.delete({ where: { id: Number(id) } });
        });

        return successResponse(res, null, "Order deleted successfully");
    } catch (error) {
        console.error("Error deleting order:", error);
        return errorResponse(res, error.message, 500);
    }
};


const getOrdersWithoutInvoice = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            search 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Build where clause
        const where = {
            status: { not: 'Pending' },
            orderItems: {
                some: {} // Must have at least one order item
            },
            // Exclude orders that have invoice items
            orderItems: {
                some: {
                    invoiceItem: null // No invoice item associated
                }
            }
        };

        // Add search functionality
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { customer: { fullName: { contains: search, mode: 'insensitive' } } },
                { customer: { email: { contains: search, mode: 'insensitive' } } },
                { customer: { phone: { contains: search, mode: 'insensitive' } } }
            ];
        }

        // Get total count
        const total = await prisma.onlineOrder.count({ where });

        // Get paginated orders
        const orders = await prisma.onlineOrder.findMany({
            where,
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true
                    }
                },
                shipment: true,
                orderItems: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                productName: true,
                                sku: true,
                                images: true
                            }
                        },
                        productVariant: true
                    }
                }
            },
            orderBy: {
                orderDate: 'desc'
            },
            skip,
            take,
        });

        return successResponse(res, {
            orders,
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: total,
                totalPages: Math.ceil(total / parseInt(limit)),
            }
        }, "Orders fetched successfully");

    } catch (error) {
        console.error("Error fetching orders without invoices:", error);
        return errorResponse(res, error.message || "Failed to fetch orders", 500);
    }
};

const trackOrderStatus = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const order = await prisma.onlineOrder.findUnique({
            where: { orderNumber: orderNumber },
            select: {
                orderNumber: true,
                orderDate: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!order) {
            return errorResponse(res, "Order not found", 404);
        }

        return successResponse(res, order, "Order status retrieved");
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};



module.exports = {
    createOrder,
    getAllOrder,
    getOrderById,
    updateOrder,
    deleteOrder,
    getOrdersWithoutInvoice,
    trackOrderStatus
};