const prisma = require('../utils/db.js');
const { getCourierService } = require('../services/courier');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Helper: Atomically restore stock for an order's items
 * Ensures products and product variants have their quantities restored
 */
async function restoreOrderStockInTransaction(tx, orderId) {
    const orderItems = await tx.orderItem.findMany({
        where: { onlineOrderId: Number(orderId) },
        include: {
            product: true,
            productVariant: true
        }
    });

    const restoredItems = [];

    for (const item of orderItems) {
        const qty = parseInt(item.quantity || 1);

        if (item.productVariantId) {
            await tx.productVariant.update({
                where: { id: item.productVariantId },
                data: { quantity: { increment: qty } }
            });
            restoredItems.push({
                productId: item.productId,
                productVariantId: item.productVariantId,
                productName: item.product?.productName,
                quantity: qty,
                type: 'variant'
            });
        } else if (item.productId) {
            await tx.product.update({
                where: { id: item.productId },
                data: { quantity: { increment: qty } }
            });
            restoredItems.push({
                productId: item.productId,
                productVariantId: null,
                productName: item.product?.productName,
                quantity: qty,
                type: 'product'
            });
        }
    }

    return restoredItems;
}

/**
 * Create a new courier shipment for an existing order
 * POST /api/shipments/create
 */
const createShipment = async (req, res) => {
    try {
        const {
            orderId,
            courier = 'STEADFAST',
            deliveryType = 0,
            note = '',
            codAmountOverride = null
        } = req.body;

        if (!orderId) {
            return errorResponse(res, "Order ID is required.", 400);
        }

        const orderIdInt = parseInt(orderId);

        // Fetch the order with customer and shipping address
        const order = await prisma.onlineOrder.findUnique({
            where: { id: orderIdInt },
            include: {
                customer: true,
                shippingAddress: true,
                orderItems: {
                    include: {
                        product: true
                    }
                },
                shipment: true
            }
        });

        if (!order) {
            return errorResponse(res, `Order #${orderId} not found.`, 404);
        }

        // DUPLICATE PREVENTATION: Check if shipment already exists
        if (order.shipment) {
            const isCancelled = order.shipment.status === 'Cancelled';
            if (!isCancelled) {
                return errorResponse(
                    res,
                    `Shipment already exists for Order #${order.orderNumber}. Tracking Code: ${order.shipment.trackingCode || 'N/A'}, Status: ${order.shipment.status}`,
                    400
                );
            }
        }

        // Validate shipping details
        const recipientName = order.shippingAddress?.recipientName || order.customer?.fullName || 'Customer';
        const recipientPhone = order.shippingAddress?.phoneNumber || order.customer?.phone;
        
        if (!recipientPhone) {
            return errorResponse(res, "Recipient phone number is missing in the order.", 400);
        }

        // Build full address
        let recipientAddress = '';
        if (order.shippingAddress) {
            const parts = [
                order.shippingAddress.address,
                order.shippingAddress.upazila,
                order.shippingAddress.district,
                order.shippingAddress.division
            ].filter(Boolean);
            recipientAddress = parts.join(', ');
        }

        if (!recipientAddress || recipientAddress.trim().length < 5) {
            return errorResponse(res, "Valid recipient delivery address is required for shipment dispatch.", 400);
        }

        // Compute COD amount
        let codAmount = 0;
        if (codAmountOverride !== null && codAmountOverride !== undefined && codAmountOverride !== '') {
            codAmount = Math.max(0, parseFloat(codAmountOverride));
        } else if (order.paymentMethod === 'COD') {
            // For COD, amount to collect is dueAmount (or grandTotal if dueAmount is null)
            codAmount = order.dueAmount !== null && order.dueAmount !== undefined 
                ? Math.max(0, parseFloat(order.dueAmount)) 
                : Math.max(0, parseFloat(order.grandTotal));
        } else {
            // If Prepaid or online payment, check if any remaining due exists
            codAmount = order.dueAmount ? Math.max(0, parseFloat(order.dueAmount)) : 0;
        }

        // Get courier service instance
        const courierService = getCourierService(courier);

        // Call courier API
        const deliveryNote = note || order.note || '';
        const courierResult = await courierService.createShipment({
            invoice: order.orderNumber,
            recipientName,
            recipientPhone,
            recipientAddress,
            codAmount,
            note: deliveryNote,
            deliveryType: parseInt(deliveryType) || 0
        });

        // Persist shipment in DB using transaction
        const shipmentRecord = await prisma.$transaction(async (tx) => {
            // If a previous cancelled shipment record existed, remove or overwrite it
            if (order.shipment) {
                await tx.shipment.delete({
                    where: { id: order.shipment.id }
                });
            }

            const newShipment = await tx.shipment.create({
                data: {
                    orderId: order.id,
                    courier: courierService.courierName,
                    consignmentId: courierResult.consignmentId || null,
                    trackingCode: courierResult.trackingCode || null,
                    invoiceNumber: courierResult.invoice || order.orderNumber,
                    recipientName,
                    recipientPhone,
                    recipientAddress,
                    codAmount: codAmount,
                    courierStatus: courierResult.courierStatus || 'in_review',
                    status: courierResult.normalizedStatus || 'InReview',
                    deliveryType: parseInt(deliveryType) || 0,
                    note: deliveryNote,
                    metadata: courierResult.raw || null
                }
            });

            // Update order status to Processing or Shipped if currently Pending
            if (order.status === 'Pending' || order.status === 'Confirmed') {
                await tx.onlineOrder.update({
                    where: { id: order.id },
                    data: { status: 'Processing' }
                });
            }

            return newShipment;
        });

        return successResponse(
            res,
            "Shipment created successfully",
            shipmentRecord,
            201
        );

    } catch (error) {
        console.error("createShipment controller error:", error);
        return errorResponse(res, error.message || "Failed to create shipment", 500);
    }
};

/**
 * Sync shipment status with courier API and auto-restore stock if returned
 * POST /api/shipments/sync/:id (or by orderId)
 */
const syncShipmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const idInt = parseInt(id);

        // Find shipment by shipment ID or order ID
        const shipment = await prisma.shipment.findFirst({
            where: {
                OR: [
                    { id: idInt },
                    { orderId: idInt }
                ]
            },
            include: {
                order: {
                    include: {
                        orderItems: true
                    }
                }
            }
        });

        if (!shipment) {
            return errorResponse(res, "Shipment record not found.", 404);
        }

        const courierService = getCourierService(shipment.courier || 'STEADFAST');

        // Check status from courier API using available identifiers
        let statusResult;
        if (shipment.consignmentId) {
            statusResult = await courierService.getStatusByConsignmentId(shipment.consignmentId);
        } else if (shipment.trackingCode) {
            statusResult = await courierService.getStatusByTrackingCode(shipment.trackingCode);
        } else {
            statusResult = await courierService.getStatusByInvoice(shipment.invoiceNumber);
        }

        const newCourierStatus = statusResult.deliveryStatus;
        const normalizedStatus = statusResult.normalizedStatus;
        const isReturned = statusResult.isReturned;

        let stockRestoredNow = false;
        let restoredItems = [];

        // Update shipment & handle automatic stock restoration in a transaction
        const updatedShipment = await prisma.$transaction(async (tx) => {
            let isStockRestored = shipment.isStockRestored;
            let stockRestoredAt = shipment.stockRestoredAt;

            // REQUIREMENT: When a shipment is returned/received back, automatically update the related product stock
            if (isReturned && !shipment.isStockRestored) {
                console.log(`[STOCK RESTORATION] Shipment #${shipment.id} for Order #${shipment.order.orderNumber} is ${newCourierStatus}. Restoring product stock...`);
                restoredItems = await restoreOrderStockInTransaction(tx, shipment.orderId);
                isStockRestored = true;
                stockRestoredAt = new Date();
                stockRestoredNow = true;

                // Update order status to Cancelled if returned
                await tx.onlineOrder.update({
                    where: { id: shipment.orderId },
                    data: { status: 'Cancelled' }
                });
            }

            return tx.shipment.update({
                where: { id: shipment.id },
                data: {
                    courierStatus: newCourierStatus,
                    status: normalizedStatus,
                    isStockRestored,
                    stockRestoredAt,
                    metadata: statusResult.raw || shipment.metadata
                },
                include: {
                    order: {
                        include: {
                            customer: true
                        }
                    }
                }
            });
        });

        let message = `Shipment status updated to "${newCourierStatus}".`;
        if (stockRestoredNow) {
            message += ` Parcel was marked as returned/cancelled; product inventory has been automatically restored (${restoredItems.length} items).`;
        }

        return successResponse(res, message, {
            shipment: updatedShipment,
            stockRestored: stockRestoredNow,
            restoredItems
        });

    } catch (error) {
        console.error("syncShipmentStatus controller error:", error);
        return errorResponse(res, error.message || "Failed to sync shipment status", 500);
    }
};

/**
 * Bulk sync all active shipments
 * POST /api/shipments/bulk-sync
 */
const bulkSyncStatus = async (req, res) => {
    try {
        // Fetch active shipments (not yet Delivered and not yet Returned)
        const activeShipments = await prisma.shipment.findMany({
            where: {
                status: {
                    notIn: ['Delivered', 'Returned']
                }
            },
            take: 50 // process in manageable batches
        });

        let updatedCount = 0;
        let restoredCount = 0;
        const errors = [];

        for (const shipment of activeShipments) {
            try {
                const courierService = getCourierService(shipment.courier || 'STEADFAST');
                let statusResult;

                if (shipment.consignmentId) {
                    statusResult = await courierService.getStatusByConsignmentId(shipment.consignmentId);
                } else if (shipment.trackingCode) {
                    statusResult = await courierService.getStatusByTrackingCode(shipment.trackingCode);
                } else {
                    continue;
                }

                const newCourierStatus = statusResult.deliveryStatus;
                const normalizedStatus = statusResult.normalizedStatus;
                const isReturned = statusResult.isReturned;

                await prisma.$transaction(async (tx) => {
                    let isStockRestored = shipment.isStockRestored;
                    let stockRestoredAt = shipment.stockRestoredAt;

                    if (isReturned && !shipment.isStockRestored) {
                        await restoreOrderStockInTransaction(tx, shipment.orderId);
                        isStockRestored = true;
                        stockRestoredAt = new Date();
                        restoredCount++;

                        await tx.onlineOrder.update({
                            where: { id: shipment.orderId },
                            data: { status: 'Cancelled' }
                        });
                    }

                    await tx.shipment.update({
                        where: { id: shipment.id },
                        data: {
                            courierStatus: newCourierStatus,
                            status: normalizedStatus,
                            isStockRestored,
                            stockRestoredAt,
                            metadata: statusResult.raw || shipment.metadata
                        }
                    });
                });

                updatedCount++;
            } catch (err) {
                errors.push({
                    shipmentId: shipment.id,
                    orderId: shipment.orderId,
                    error: err.message
                });
            }
        }

        return successResponse(res, `Bulk sync complete. Updated ${updatedCount} shipments. ${restoredCount} return stock restorations performed.`, {
            totalChecked: activeShipments.length,
            updatedCount,
            restoredCount,
            errors
        });

    } catch (error) {
        console.error("bulkSyncStatus error:", error);
        return errorResponse(res, error.message || "Failed to bulk sync shipments", 500);
    }
};

/**
 * Get all shipments with filters and pagination
 * GET /api/shipments
 */
const getAllShipments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            status = 'all',
            courier = 'all'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where = {};

        if (status && status !== 'all') {
            where.status = status;
        }

        if (courier && courier !== 'all') {
            where.courier = courier.toUpperCase();
        }

        if (search) {
            where.OR = [
                { invoiceNumber: { contains: search, mode: 'insensitive' } },
                { trackingCode: { contains: search, mode: 'insensitive' } },
                { consignmentId: { contains: search, mode: 'insensitive' } },
                { recipientName: { contains: search, mode: 'insensitive' } },
                { recipientPhone: { contains: search, mode: 'insensitive' } }
            ];
        }

        const kpiWhere = courier && courier !== 'all' ? { courier: courier.toUpperCase() } : {};

        const [
            total,
            shipments,
            kpiTotal,
            kpiInTransit,
            kpiDelivered,
            kpiReturned,
            kpiRestored
        ] = await Promise.all([
            prisma.shipment.count({ where }),
            prisma.shipment.findMany({
                where,
                include: {
                    order: {
                        select: {
                            id: true,
                            orderNumber: true,
                            orderDate: true,
                            totalAmount: true,
                            grandTotal: true,
                            paidAmount: true,
                            dueAmount: true,
                            status: true,
                            paymentMethod: true,
                            paymentStatus: true,
                            customer: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    phone: true,
                                    email: true
                                }
                            },
                            orderItems: {
                                select: {
                                    id: true,
                                    quantity: true,
                                    unitPrice: true,
                                    lineTotal: true,
                                    product: {
                                        select: {
                                            id: true,
                                            productName: true,
                                            sku: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            }),
            prisma.shipment.count({ where: kpiWhere }),
            prisma.shipment.count({
                where: {
                    ...kpiWhere,
                    status: { in: ['Pending', 'InReview', 'Dispatched', 'InTransit', 'Hold'] }
                }
            }),
            prisma.shipment.count({
                where: {
                    ...kpiWhere,
                    status: 'Delivered'
                }
            }),
            prisma.shipment.count({
                where: {
                    ...kpiWhere,
                    status: { in: ['Returned', 'Cancelled'] }
                }
            }),
            prisma.shipment.count({
                where: {
                    ...kpiWhere,
                    isStockRestored: true
                }
            })
        ]);

        return successResponse(res, "Shipments retrieved successfully", {
            shipments,
            kpis: {
                totalShipments: kpiTotal,
                inTransit: kpiInTransit,
                delivered: kpiDelivered,
                returned: kpiReturned,
                stockRestored: kpiRestored
            },
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("getAllShipments error:", error);
        return errorResponse(res, error.message || "Failed to fetch shipments", 500);
    }
};

/**
 * Admin Action: Mark a shipment / parcel as Delivered (Product Received by customer)
 * POST /api/shipments/deliver/:id
 */
const markProductDelivered = async (req, res) => {
    try {
        const { id } = req.params;
        const shipmentId = parseInt(id);

        if (!shipmentId) {
            return errorResponse(res, "Valid shipment ID is required.", 400);
        }

        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: { order: true }
        });

        if (!shipment) {
            return errorResponse(res, "Shipment record not found.", 404);
        }

        const result = await prisma.$transaction(async (tx) => {
            const updatedShipment = await tx.shipment.update({
                where: { id: shipmentId },
                data: {
                    status: 'Delivered',
                    courierStatus: 'delivered'
                },
                include: {
                    order: {
                        include: {
                            customer: true
                        }
                    }
                }
            });

            const orderUpdate = {
                status: 'Delivered'
            };

            if (shipment.order && shipment.order.paymentMethod === 'COD') {
                orderUpdate.paymentStatus = 'Paid';
                orderUpdate.paidAmount = shipment.order.grandTotal;
                orderUpdate.dueAmount = 0;
            }

            if (shipment.orderId) {
                await tx.onlineOrder.update({
                    where: { id: shipment.orderId },
                    data: orderUpdate
                });
            }

            return updatedShipment;
        });

        return successResponse(
            res,
            `Order #${shipment.order?.orderNumber || shipment.invoiceNumber} successfully marked as Product Delivered.`,
            result
        );

    } catch (error) {
        console.error("markProductDelivered error:", error);
        return errorResponse(res, error.message || "Failed to mark product delivered", 500);
    }
};

/**
 * Admin Action: Mark a shipment as Return Received with Duplicate-Prevention Safeguards
 * Restores product and variant inventory atomically inside a transaction
 * POST /api/shipments/return-received/:id
 */
const markReturnReceived = async (req, res) => {
    try {
        const { id } = req.params;
        const shipmentId = parseInt(id);

        if (!shipmentId) {
            return errorResponse(res, "Valid shipment ID is required.", 400);
        }

        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: {
                order: {
                    include: {
                        customer: true,
                        orderItems: {
                            include: {
                                product: true,
                                productVariant: true
                            }
                        }
                    }
                }
            }
        });

        if (!shipment) {
            return errorResponse(res, "Shipment record not found.", 404);
        }

        // DUPLICATE SAFEGUARD: Check if stock was already restored
        if (shipment.isStockRestored) {
            return successResponse(
                res,
                `Stock for Order #${shipment.order?.orderNumber || shipment.invoiceNumber} was already restored on ${new Date(shipment.stockRestoredAt).toLocaleString()}. Duplicate restoration prevented.`,
                {
                    shipment,
                    alreadyRestored: true,
                    restoredItems: []
                }
            );
        }

        // Perform stock restoration and status update atomically in a database transaction
        const result = await prisma.$transaction(async (tx) => {
            const freshShipment = await tx.shipment.findUnique({
                where: { id: shipmentId }
            });

            if (freshShipment.isStockRestored) {
                return {
                    shipment: freshShipment,
                    alreadyRestored: true,
                    restoredItems: []
                };
            }

            // Atomically increment inventory quantities for products and variants
            const restoredItems = await restoreOrderStockInTransaction(tx, shipment.orderId);

            // Update shipment record
            const updatedShipment = await tx.shipment.update({
                where: { id: shipmentId },
                data: {
                    status: 'Returned',
                    courierStatus: 'return_received',
                    isStockRestored: true,
                    stockRestoredAt: new Date()
                },
                include: {
                    order: {
                        include: {
                            customer: true
                        }
                    }
                }
            });

            // Update order status to Cancelled
            if (shipment.orderId) {
                await tx.onlineOrder.update({
                    where: { id: shipment.orderId },
                    data: { status: 'Cancelled' }
                });
            }

            return {
                shipment: updatedShipment,
                alreadyRestored: false,
                restoredItems
            };
        });

        return successResponse(
            res,
            `Return received successfully! Inventory stock has been restored for ${result.restoredItems.length} item(s).`,
            result
        );

    } catch (error) {
        console.error("markReturnReceived error:", error);
        return errorResponse(res, error.message || "Failed to process return received", 500);
    }
};

/**
 * Get orders with their shipment details for Courier Dispatch Management Table
 * GET /api/shipments/orders
 */
const getShipmentOrders = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = '',
            shipmentFilter = 'all', // all | created | pending
            paymentMethod = 'all'
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where = {};

        if (paymentMethod && paymentMethod !== 'all') {
            where.paymentMethod = paymentMethod;
        }

        if (shipmentFilter === 'created') {
            where.shipment = { isNot: null };
        } else if (shipmentFilter === 'pending') {
            where.shipment = null;
        }

        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { customer: { fullName: { contains: search, mode: 'insensitive' } } },
                { customer: { phone: { contains: search, mode: 'insensitive' } } },
                { shippingAddress: { phoneNumber: { contains: search, mode: 'insensitive' } } },
                { shipment: { trackingCode: { contains: search, mode: 'insensitive' } } },
                { shipment: { consignmentId: { contains: search, mode: 'insensitive' } } }
            ];
        }

        const [total, orders, stats] = await Promise.all([
            prisma.onlineOrder.count({ where }),
            prisma.onlineOrder.findMany({
                where,
                include: {
                    customer: {
                        select: {
                            id: true,
                            fullName: true,
                            phone: true,
                            email: true
                        }
                    },
                    shippingAddress: true,
                    shipment: true,
                    orderItems: {
                        select: {
                            id: true,
                            quantity: true,
                            unitPrice: true,
                            product: {
                                select: {
                                    id: true,
                                    productName: true,
                                    sku: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            }),
            prisma.$transaction([
                prisma.onlineOrder.count(),
                prisma.onlineOrder.count({ where: { paymentMethod: 'COD' } }),
                prisma.onlineOrder.count({ where: { paymentMethod: { not: 'COD' } } }),
                prisma.shipment.count(),
                prisma.onlineOrder.count({ where: { shipment: null } }),
                prisma.shipment.count({ where: { status: 'Returned' } })
            ])
        ]);

        return successResponse(res, "Orders with shipment status retrieved", {
            orders,
            kpis: {
                totalOrders: stats[0],
                codOrders: stats[1],
                prepaidOrders: stats[2],
                shipmentCreated: stats[3],
                pendingShipment: stats[4],
                returnedCount: stats[5]
            },
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error("getShipmentOrders error:", error);
        return errorResponse(res, error.message || "Failed to fetch orders for dispatch", 500);
    }
};

/**
 * Get current courier account balance
 * GET /api/shipments/balance
 */
const getCourierBalance = async (req, res) => {
    try {
        const { courier = 'STEADFAST' } = req.query;
        const courierService = getCourierService(courier);
        const balanceData = await courierService.getBalance();
        return successResponse(res, "Balance fetched successfully", balanceData);
    } catch (error) {
        console.error("getCourierBalance error:", error);
        return errorResponse(res, error.message || "Failed to get courier balance", 500);
    }
};

/**
 * Fraud check for a phone number
 * GET /api/shipments/fraud-check/:phone
 */
const checkFraud = async (req, res) => {
    try {
        const { phone } = req.params;
        const courierService = getCourierService('STEADFAST');
        const fraudData = await courierService.checkFraud(phone);
        return successResponse(res, "Fraud check complete", fraudData);
    } catch (error) {
        console.error("checkFraud error:", error);
        return errorResponse(res, error.message || "Failed to perform fraud check", 500);
    }
};

/**
 * Webhook handler for Steadfast push updates
 * POST /api/shipments/webhook
 */
const handleWebhook = async (req, res) => {
    try {
        const payload = req.body;
        console.log("[STEADFAST WEBHOOK RECEIVED]:", JSON.stringify(payload));

        const consignmentId = payload.consignment_id || payload.cid;
        const trackingCode = payload.tracking_code;
        const invoice = payload.invoice;
        const deliveryStatus = payload.status || payload.delivery_status;

        if (!deliveryStatus) {
            return res.status(400).json({ success: false, message: "Missing delivery status in webhook payload" });
        }

        // Find shipment by consignment ID, tracking code, or invoice
        const shipment = await prisma.shipment.findFirst({
            where: {
                OR: [
                    ...(consignmentId ? [{ consignmentId: String(consignmentId) }] : []),
                    ...(trackingCode ? [{ trackingCode: String(trackingCode) }] : []),
                    ...(invoice ? [{ invoiceNumber: String(invoice) }] : [])
                ]
            },
            include: {
                order: true
            }
        });

        if (!shipment) {
            console.warn("[STEADFAST WEBHOOK] No matching shipment found for payload:", payload);
            return res.status(200).json({ success: true, message: "Webhook acknowledged, no matching shipment." });
        }

        const courierService = getCourierService('STEADFAST');
        const normalizedStatus = courierService.normalizeStatus(deliveryStatus);
        const isReturned = courierService.isReturnedStatus(deliveryStatus);

        await prisma.$transaction(async (tx) => {
            let isStockRestored = shipment.isStockRestored;
            let stockRestoredAt = shipment.stockRestoredAt;

            // Auto-restore stock if returned and not previously restored
            if (isReturned && !shipment.isStockRestored) {
                console.log(`[STEADFAST WEBHOOK] Shipment #${shipment.id} returned. Restoring stock...`);
                await restoreOrderStockInTransaction(tx, shipment.orderId);
                isStockRestored = true;
                stockRestoredAt = new Date();

                await tx.onlineOrder.update({
                    where: { id: shipment.orderId },
                    data: { status: 'Cancelled' }
                });
            }

            await tx.shipment.update({
                where: { id: shipment.id },
                data: {
                    courierStatus: deliveryStatus,
                    status: normalizedStatus,
                    isStockRestored,
                    stockRestoredAt,
                    metadata: payload
                }
            });
        });

        return res.status(200).json({ success: true, message: "Webhook processed successfully" });

    } catch (error) {
        console.error("handleWebhook error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createShipment,
    syncShipmentStatus,
    bulkSyncStatus,
    getAllShipments,
    getShipmentOrders,
    getCourierBalance,
    checkFraud,
    handleWebhook,
    markProductDelivered,
    markReturnReceived
};

