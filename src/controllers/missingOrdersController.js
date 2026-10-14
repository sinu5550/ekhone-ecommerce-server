const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BizMationService = require('../services/bizmationService');

/**
 * Helper to format Date into 'YYYY-MM-DD HH:mm:ss'
 * @param {Date|string} date
 * @returns {string}
 */
function formatDateToStandard(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * GET /api/missing-orders
 * Reconciles and serves orders to BizMation with api_1 and api_2 query parameter authentication.
 */
const getMissingOrders = async (req, res) => {
    try {
        const { api_1, api_2, skip = 0, take = 30, after, before } = req.query;

        const expectedApi1 = process.env.BIZMATION_API_KEY_1;
        const expectedApi2 = process.env.BIZMATION_API_KEY_2;

        // 1. Authentication Check
        if (!expectedApi1 || !expectedApi2 || api_1 !== expectedApi1 || api_2 !== expectedApi2) {
            console.warn('[BizMation Missing-Orders] Unauthorized attempt with invalid or missing API keys.');
            return res.status(401).json({
                success: false,
                message: 'Unauthorized',
            });
        }

        // 2. Query Parameters Sanitization
        const skipNumber = Math.max(0, parseInt(skip, 10) || 0);
        const takeNumber = Math.min(100, Math.max(1, parseInt(take, 10) || 30));

        // 3. Build Date Filter
        const whereClause = {};

        if (after || before) {
            whereClause.createdAt = {};
            if (after) {
                const afterDate = new Date(after);
                if (!isNaN(afterDate.getTime())) {
                    whereClause.createdAt.gte = afterDate;
                }
            }
            if (before) {
                const beforeDate = new Date(before);
                if (!isNaN(beforeDate.getTime())) {
                    whereClause.createdAt.lte = beforeDate;
                }
            }
        }

        // 4. Query Orders
        const orders = await prisma.onlineOrder.findMany({
            where: whereClause,
            skip: skipNumber,
            take: takeNumber,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                customer: {
                    select: {
                        fullName: true,
                        phone: true,
                    },
                },
                shippingAddress: true,
                orderItems: {
                    include: {
                        product: {
                            select: {
                                productName: true,
                            },
                        },
                    },
                },
                bundleOrderItems: {
                    include: {
                        bundle: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        // 5. Transform Orders to BizMation Exact Spec
        const transformedData = orders.map((order) => {
            const rawPhone =
                order.shippingAddress?.phoneNumber ||
                order.customer?.phone ||
                '';

            const mobileNumber = BizMationService.formatMobileNumber(rawPhone) || rawPhone;

            const customerName =
                order.shippingAddress?.recipientName ||
                order.customer?.fullName ||
                'Customer';

            const customerAddress =
                order.shippingAddress?.address ||
                [
                    order.shippingAddress?.upazila,
                    order.shippingAddress?.city,
                    order.shippingAddress?.district
                ].filter(Boolean).join(', ') ||
                'Address not provided';

            // Extract items
            const orderItems = [];

            if (Array.isArray(order.orderItems)) {
                order.orderItems.forEach((item) => {
                    const title = item.product?.productName || item.sku || `Product #${item.productId}`;
                    orderItems.push({
                        product_title: String(title).trim(),
                        price: parseFloat(item.unitPrice || 0),
                        quantity: parseInt(item.quantity || 1, 10),
                    });
                });
            }

            if (Array.isArray(order.bundleOrderItems)) {
                order.bundleOrderItems.forEach((bundleItem) => {
                    const title = bundleItem.bundle?.name || `Bundle #${bundleItem.bundleId}`;
                    orderItems.push({
                        product_title: String(title).trim(),
                        price: parseFloat(bundleItem.unitPrice || 0),
                        quantity: parseInt(bundleItem.quantity || 1, 10),
                    });
                });
            }

            // item.unitPrice is already the selling price (after product discount).
            // Only additional order-level discounts (coupons, vouchers) should be in 'discount'.
            const discountAmount = parseFloat(order.voucher_promo || 0);

            return {
                reference_no: order.id,
                created_at: formatDateToStandard(order.createdAt || order.orderDate),
                name: String(customerName).trim(),
                mobile_number: mobileNumber,
                address: String(customerAddress).trim(),
                shipping_charge: parseFloat(order.shippingCost || 0),
                discount: discountAmount,
                paid_amount: parseFloat(order.paidAmount || 0),
                note: order.note ? String(order.note).trim() : '',
                order_items: orderItems,
            };
        });

        console.log(`[BizMation Missing-Orders] Returning ${transformedData.length} orders (skip: ${skipNumber}, take: ${takeNumber}).`);

        return res.status(200).json({
            success: true,
            code: 200,
            message: 'Data fetched Success.',
            data: transformedData,
        });
    } catch (error) {
        console.error('[BizMation Missing-Orders Error]:', error);
        return res.status(500).json({
            success: false,
            code: 500,
            message: error.message || 'Server error',
            data: [],
        });
    }
};

module.exports = {
    getMissingOrders,
};
