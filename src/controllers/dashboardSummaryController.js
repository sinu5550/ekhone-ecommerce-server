// src/controllers/dashboardSummaryController.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const getDashboardSummary = async (req, res) => {
    try {
        // Get all data in parallel for better performance
        const [
            orders,
            products,
            customers,
            bundles,
            recentOrders,
            orderStatusStats,
            monthlyStats,
            topProducts,
            totalShipments,
            inTransitCount,
            deliveredCount,
            returnedCount,
            restoredCount,
            steadfastTotal,
            steadfastInTransit,
            steadfastDelivered,
            steadfastReturned,
            pathaoTotal,
            pathaoInTransit,
            pathaoDelivered,
            pathaoReturned,
            totalCodAgg,
            collectedCodAgg,
            pendingCodAgg,
            returnedCodAgg,
            steadfastTotalCodAgg,
            steadfastDeliveredCodAgg,
            steadfastPendingCodAgg,
            pathaoTotalCodAgg,
            pathaoDeliveredCodAgg,
            pathaoPendingCodAgg
        ] = await Promise.all([
            // Get orders count and basic stats
            prisma.onlineOrder.findMany({
                select: {
                    id: true,
                    grandTotal: true,
                    status: true,
                    orderDate: true,
                    createdAt: true,
                    customerId: true,
                    orderItems: {
                        select: {
                            productId: true,
                            quantity: true,
                            lineTotal: true,
                            product: {
                                select: {
                                    productName: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 1000 // Limit for performance
            }),

            // Products count
            prisma.product.count({
                where: { isArchived: false }
            }),

            // Customers count
            prisma.customer.count(),

            // Bundles count
            prisma.bundleProduct.count(),

            // Recent 5 orders with customer info
            prisma.onlineOrder.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: {
                        select: {
                            fullName: true
                        }
                    },
                    orderItems: {
                        take: 1,
                        include: {
                            product: {
                                select: {
                                    productName: true
                                }
                            }
                        }
                    }
                }
            }),

            // Order status distribution
            prisma.onlineOrder.groupBy({
                by: ['status'],
                _count: true
            }),

            // Monthly order stats (last 7 months)
            getMonthlyOrderStats(prisma),

            // Top 4 products by revenue
            prisma.orderItem.groupBy({
                by: ['productId'],
                _sum: {
                    lineTotal: true,
                    quantity: true
                },
                orderBy: {
                    _sum: {
                        lineTotal: 'desc'
                    }
                },
                take: 4
            }),

            // Courier Shipments Summary Counts
            prisma.shipment.count(),
            prisma.shipment.count({ where: { status: { in: ['Pending', 'InReview', 'Dispatched', 'InTransit', 'Hold'] } } }),
            prisma.shipment.count({ where: { status: 'Delivered' } }),
            prisma.shipment.count({ where: { status: { in: ['Returned', 'Cancelled'] } } }),
            prisma.shipment.count({ where: { isStockRestored: true } }),
            prisma.shipment.count({ where: { courier: 'STEADFAST' } }),
            prisma.shipment.count({ where: { courier: 'STEADFAST', status: { in: ['Pending', 'InReview', 'Dispatched', 'InTransit', 'Hold'] } } }),
            prisma.shipment.count({ where: { courier: 'STEADFAST', status: 'Delivered' } }),
            prisma.shipment.count({ where: { courier: 'STEADFAST', status: { in: ['Returned', 'Cancelled'] } } }),
            prisma.shipment.count({ where: { courier: 'PATHAO' } }),
            prisma.shipment.count({ where: { courier: 'PATHAO', status: { in: ['Pending', 'InReview', 'Dispatched', 'InTransit', 'Hold'] } } }),
            prisma.shipment.count({ where: { courier: 'PATHAO', status: 'Delivered' } }),
            prisma.shipment.count({ where: { courier: 'PATHAO', status: { in: ['Returned', 'Cancelled'] } } }),

            // Courier Financial Summary (_sum codAmount)
            prisma.shipment.aggregate({ _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { status: 'Delivered' }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { status: { in: ['Pending', 'InReview', 'Dispatched', 'InTransit', 'Hold'] } }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { status: { in: ['Returned', 'Cancelled'] } }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { courier: 'STEADFAST' }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { courier: 'STEADFAST', status: 'Delivered' }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { courier: 'STEADFAST', status: { in: ['Pending', 'InReview', 'Dispatched', 'InTransit', 'Hold'] } }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { courier: 'PATHAO' }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { courier: 'PATHAO', status: 'Delivered' }, _sum: { codAmount: true } }),
            prisma.shipment.aggregate({ where: { courier: 'PATHAO', status: { in: ['Pending', 'InReview', 'Dispatched', 'InTransit', 'Hold'] } }, _sum: { codAmount: true } })
        ]);

        // Calculate revenue
        const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.grandTotal) || 0), 0);
        const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

        // Calculate active customers (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeCustomers = new Set(
            orders
                .filter(o => new Date(o.orderDate || o.createdAt) >= thirtyDaysAgo)
                .map(o => o.customerId)
        ).size;

        // Process monthly revenue
        const monthlyRevenue = getMonthlyRevenue(orders);

        // Process order status distribution
        const statusDistribution = orderStatusStats.map(item => ({
            name: item.status,
            count: item._count,
            color: getStatusColor(item.status)
        }));

        // Process recent orders for display
        const formattedRecentOrders = recentOrders.map(order => ({
            id: order.orderNumber || `#ORD-${order.id}`,
            customer: order.customer?.fullName || 'Guest Customer',
            product: order.orderItems?.[0]?.product?.productName || 'Multiple Items',
            amount: parseFloat(order.grandTotal) || 0,
            status: order.status || 'Pending',
            date: new Date(order.orderDate || order.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            })
        }));

        // Process top products with actual product names and thumbnails
        const topProductIds = topProducts.map(item => item.productId).filter(Boolean);
        let formattedTopProducts = [];
        try {
            const topProductDetails = topProductIds.length > 0
                ? await prisma.product.findMany({
                    where: { id: { in: topProductIds } },
                    select: { id: true, productName: true, images: true, sku: true }
                })
                : [];
            const productMap = new Map(topProductDetails.map(p => [p.id, p]));

            formattedTopProducts = topProducts.map(item => {
                const prod = productMap.get(item.productId);
                let thumbnail = null;
                if (prod?.images) {
                    if (Array.isArray(prod.images) && prod.images.length > 0) {
                        thumbnail = typeof prod.images[0] === 'string' ? prod.images[0] : (prod.images[0]?.url || prod.images[0]?.thumbnail || null);
                    } else if (typeof prod.images === 'string') {
                        thumbnail = prod.images;
                    } else if (prod.images?.thumbnail || prod.images?.url) {
                        thumbnail = prod.images.thumbnail || prod.images.url;
                    }
                }
                return {
                    id: item.productId,
                    name: prod?.productName || `Product #${item.productId}`,
                    thumbnail,
                    sku: prod?.sku || null,
                    sales: item._sum?.quantity || 0,
                    revenue: parseFloat(item._sum?.lineTotal || 0)
                };
            });
        } catch (err) {
            console.error('Error fetching top product details in dashboard summary:', err);
            formattedTopProducts = topProducts.map(item => ({
                id: item.productId,
                name: `Product #${item.productId}`,
                thumbnail: null,
                sku: null,
                sales: item._sum?.quantity || 0,
                revenue: parseFloat(item._sum?.lineTotal || 0)
            }));
        }

        // Calculate conversion rate
        const conversionRate = customers > 0 ? Math.min(100, Math.round((orders.length / customers) * 100)) : 0;

        // Calculate order growth
        const orderGrowth = calculateGrowth(orders, 'orders');
        const revenueGrowth = calculateGrowth(orders, 'revenue');

        return successResponse(res, {
            summary: {
                totalRevenue,
                totalOrders: orders.length,
                totalProducts: products,
                totalCustomers: customers,
                totalBundles: bundles,
                activeCustomers,
                avgOrderValue,
                conversionRate,
                orderGrowth,
                revenueGrowth
            },
            charts: {
                monthlyOrderStatus: monthlyStats,
                monthlyRevenue,
                statusDistribution
            },
            recentOrders: formattedRecentOrders,
            topProducts: formattedTopProducts,
            orderStatusCounts: orderStatusStats.reduce((acc, item) => {
                acc[item.status] = item._count;
                return acc;
            }, {}),
            courierSummary: {
                totalShipments,
                inTransitCount,
                deliveredCount,
                returnedCount,
                restoredCount,
                financials: {
                    totalCod: parseFloat(totalCodAgg?._sum?.codAmount) || 0,
                    collectedCod: parseFloat(collectedCodAgg?._sum?.codAmount) || 0,
                    pendingCod: parseFloat(pendingCodAgg?._sum?.codAmount) || 0,
                    returnedCod: parseFloat(returnedCodAgg?._sum?.codAmount) || 0,
                    collectionRate: parseFloat(totalCodAgg?._sum?.codAmount) > 0 
                        ? Math.round(((parseFloat(collectedCodAgg?._sum?.codAmount) || 0) / parseFloat(totalCodAgg?._sum?.codAmount)) * 100) 
                        : 0
                },
                steadfast: {
                    total: steadfastTotal,
                    inTransit: steadfastInTransit,
                    delivered: steadfastDelivered,
                    returned: steadfastReturned,
                    totalCod: parseFloat(steadfastTotalCodAgg?._sum?.codAmount) || 0,
                    collectedCod: parseFloat(steadfastDeliveredCodAgg?._sum?.codAmount) || 0,
                    pendingCod: parseFloat(steadfastPendingCodAgg?._sum?.codAmount) || 0
                },
                pathao: {
                    total: pathaoTotal,
                    inTransit: pathaoInTransit,
                    delivered: pathaoDelivered,
                    returned: pathaoReturned,
                    totalCod: parseFloat(pathaoTotalCodAgg?._sum?.codAmount) || 0,
                    collectedCod: parseFloat(pathaoDeliveredCodAgg?._sum?.codAmount) || 0,
                    pendingCod: parseFloat(pathaoPendingCodAgg?._sum?.codAmount) || 0
                }
            }
        });

    } catch (error) {
        console.error("Dashboard summary error:", error);
        return errorResponse(res, error.message || "Failed to fetch dashboard data", 500);
    }
};

// Helper functions
const ALL_ORDER_STATUSES = [
    "Pending", "Confirmed", "Processing", "ReadyToShip", "InCourier",
    "ShipLater", "Hold", "Returned", "PreOrder", "Shipped",
    "Delivered", "Cancelled", "Missing", "Lost", "Fake", "Trash"
];

async function getMonthlyOrderStats(prisma) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    const monthlyStats = {};

    const getDefaultMonthObj = (monthName) => {
        const obj = { month: monthName };
        ALL_ORDER_STATUSES.forEach(status => {
            obj[status] = 0;
        });
        return obj;
    };

    // Get orders from last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const orders = await prisma.onlineOrder.findMany({
        where: {
            createdAt: {
                gte: twelveMonthsAgo
            }
        },
        select: {
            status: true,
            createdAt: true
        }
    });

    orders.forEach(o => {
        const monthName = months[new Date(o.createdAt).getMonth()];
        if (!monthlyStats[monthName]) {
            monthlyStats[monthName] = getDefaultMonthObj(monthName);
        }
        if (o.status) {
            monthlyStats[monthName][o.status] = (monthlyStats[monthName][o.status] || 0) + 1;
        }
    });

    const result = [];
    for (let i = 11; i >= 0; i--) {
        const monthName = months[(currentMonth - i + 12) % 12];
        result.push(monthlyStats[monthName] || getDefaultMonthObj(monthName));
    }
    return result;
}

function getMonthlyRevenue(orders) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    const monthlyRevenue = {};

    orders.forEach(o => {
        const monthName = months[new Date(o.orderDate || o.createdAt).getMonth()];
        if (!monthlyRevenue[monthName]) {
            monthlyRevenue[monthName] = { month: monthName, revenue: 0, orders: 0 };
        }
        monthlyRevenue[monthName].revenue += parseFloat(o.grandTotal) || 0;
        monthlyRevenue[monthName].orders++;
    });

    const result = [];
    for (let i = 6; i >= 0; i--) {
        const monthName = months[(currentMonth - i + 12) % 12];
        result.push(monthlyRevenue[monthName] || { month: monthName, revenue: 0, orders: 0 });
    }
    return result;
}

function calculateGrowth(orders, type) {
    if (orders.length < 2) return "+0%";
    const currentMonth = new Date().getMonth();
    
    let current = 0;
    let previous = 0;

    orders.forEach(o => {
        const month = new Date(o.orderDate || o.createdAt).getMonth();
        if (month === currentMonth) {
            current += type === 'orders' ? 1 : (parseFloat(o.grandTotal) || 0);
        } else if (month === (currentMonth - 1 + 12) % 12) {
            previous += type === 'orders' ? 1 : (parseFloat(o.grandTotal) || 0);
        }
    });

    if (previous === 0) return "+0%";
    const growth = ((current - previous) / previous) * 100;
    return `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`;
}

function getStatusColor(status) {
    const colors = {
        Pending: "#f59e0b",
        Confirmed: "#0ea5e9",
        Processing: "#a855f7",
        ReadyToShip: "#14b8a6",
        InCourier: "#6366f1",
        ShipLater: "#3b82f6",
        Hold: "#eab308",
        Returned: "#f43f5e",
        PreOrder: "#9333ea",
        Shipped: "#4f46e5",
        Delivered: "#10b981",
        Cancelled: "#ef4444",
        Missing: "#ec4899",
        Lost: "#d946ef",
        Fake: "#78716c",
        Trash: "#6b7280"
    };
    return colors[status] || "#64748b";
}

module.exports = {
    getDashboardSummary
};