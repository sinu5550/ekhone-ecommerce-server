// paymentController.js
const prisma = require('../utils/db.js');
const { generateNumber } = require('../utils/generateNumber.js');
const { errorResponse, successResponse } = require("../utils/responseHandler");

// For Manual payments by Admin
const createPayment = async (req, res) => {
    try {
        const { orderId, amount, paymentMethod = "COD", reference = null, notes = "" } = req.body;

        if (!orderId) {
            return errorResponse(res, "Order ID is required", 400);
        }

        if (!amount || amount <= 0) {
            return errorResponse(res, "Valid payment amount is required", 400);
        }

        const orderIdInt = Number(orderId);
        const paymentAmount = parseFloat(amount);

        // 1. Fetch order with customer and invoices (plural)
        const order = await prisma.onlineOrder.findUnique({
            where: { id: orderIdInt },
            include: {
                customer: true,
                invoices: true  
            }
        });

        if (!order) {
            return errorResponse(res, "Order not found", 404);
        }

        // Get the first invoice (usually there's only one per order)
        const invoice = order.invoices?.[0];

        const currentPaid = Number(order.paidAmount || 0);
        const grandTotal = Number(order.grandTotal);
        const remainingDue = grandTotal - currentPaid;

        if (paymentAmount > remainingDue) {
            return errorResponse(
                res,
                `Payment exceeds due amount: ${remainingDue}`,
                400
            );
        }

        const newPaidAmount = currentPaid + paymentAmount;
        const newDueAmount = grandTotal - newPaidAmount;

        // Calculate payment status based on new amounts
        const paymentStatus =
            newDueAmount <= 0 ? "Paid" :
                newPaidAmount > 0 ? "Partial" : "Unpaid";

        const paymentNumber = await generateNumber("PAYMENT");

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Payment record
            const payment = await tx.payment.create({
                data: {
                    paymentNumber,
                    orderId: orderIdInt,
                    invoiceId: invoice?.id || null,
                    customerId: order.customerId,
                    paymentAmount,
                    paymentMethod,
                    referenceNumber: reference,
                    paymentNotes: notes,
                    paymentDate: new Date()
                }
            });

            // 2. Update OnlineOrder (source of truth)
            const updatedOrder = await tx.onlineOrder.update({
                where: { id: orderIdInt },
                data: {
                    paidAmount: newPaidAmount,
                    dueAmount: newDueAmount,
                    paymentStatus: paymentStatus,
                    status: newDueAmount <= 0 ? "Delivered" : order.status
                }
            });

            // 3. Update Invoice if exists
            let updatedInvoice = null;

            if (invoice) {
                updatedInvoice = await tx.invoice.update({
                    where: { id: invoice.id },
                    data: {
                        paidAmount: newPaidAmount,
                        dueAmount: newDueAmount,
                        paymentStatus: paymentStatus
                    }
                });
            }

            // 4. Update loyalty points if payment is completed
            if (paymentStatus === "Paid" && !order.pointsEarned && order.pointsEarned !== 0) {
                const pointsToEarn = Math.floor(grandTotal / 100);

                if (pointsToEarn > 0) {
                    let loyaltyAccount = await tx.loyaltyPoints.findUnique({
                        where: { customerId: order.customerId }
                    });

                    if (!loyaltyAccount) {
                        loyaltyAccount = await tx.loyaltyPoints.create({
                            data: {
                                customerId: order.customerId,
                                balance: 0,
                                lifetimeEarned: 0,
                                lifetimeRedeemed: 0
                            }
                        });
                    }

                    const newBalance = (loyaltyAccount.balance || 0) + pointsToEarn;

                    await tx.loyaltyPoints.update({
                        where: { id: loyaltyAccount.id },
                        data: {
                            balance: newBalance,
                            lifetimeEarned: { increment: pointsToEarn }
                        }
                    });

                    await tx.loyaltyTransaction.create({
                        data: {
                            loyaltyPointsId: loyaltyAccount.id,
                            customerId: order.customerId,
                            orderId: orderIdInt,
                            type: 'EARNED',
                            points: pointsToEarn,
                            balanceAfter: newBalance,
                            description: `Earned ${pointsToEarn} points from order #${order.orderNumber}`,
                            metadata: {
                                orderNumber: order.orderNumber,
                                paymentAmount: paymentAmount
                            }
                        }
                    });

                    await tx.onlineOrder.update({
                        where: { id: orderIdInt },
                        data: { pointsEarned: pointsToEarn }
                    });
                }
            }

            return { payment, order: updatedOrder, invoice: updatedInvoice };
        }, { timeout: 10000 });

        // Fetch complete updated data for response
        const completeOrder = await prisma.onlineOrder.findUnique({
            where: { id: orderIdInt },
            include: {
                customer: true,
                invoices: true,
                payments: {
                    orderBy: { paymentDate: 'desc' }
                }
            }
        });

        const currentInvoice = completeOrder?.invoices?.[0];

        return successResponse(res, {
            payment: {
                id: result.payment.id,
                paymentNumber: result.payment.paymentNumber,
                paymentAmount: result.payment.paymentAmount,
                paymentMethod: result.payment.paymentMethod,
                paymentDate: result.payment.paymentDate,
                referenceNumber: result.payment.referenceNumber
            },
            order: {
                id: completeOrder.id,
                orderNumber: completeOrder.orderNumber,
                paidAmount: completeOrder.paidAmount,
                dueAmount: completeOrder.dueAmount,
                paymentStatus: completeOrder.paymentStatus,
                status: completeOrder.status,
                pointsEarned: completeOrder.pointsEarned
            },
            invoice: currentInvoice ? {
                id: currentInvoice.id,
                invoiceNumber: currentInvoice.invoiceNumber,
                paymentStatus: currentInvoice.paymentStatus,
                paidAmount: currentInvoice.paidAmount,
                dueAmount: currentInvoice.dueAmount
            } : null,
            allPayments: completeOrder.payments
        }, `Payment of ৳${paymentAmount} processed successfully`);

    } catch (error) {
        console.error("Payment creation error:", error);
        return errorResponse(res, error.message || "Failed to create payment", 500);
    }
};

const getPaymentsByOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        const orderIdInt = Number(orderId);

        const order = await prisma.onlineOrder.findUnique({
            where: { id: orderIdInt },
            include: {
                invoices: true
            },
            select: {
                id: true,
                orderNumber: true,
                grandTotal: true,
                paidAmount: true,
                dueAmount: true,
                paymentStatus: true,
                status: true,
                invoices: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        paymentStatus: true,
                        paidAmount: true,
                        dueAmount: true
                    }
                }
            }
        });

        if (!order) {
            return errorResponse(res, "Order not found", 404);
        }

        const invoice = order.invoices?.[0];

        const payments = await prisma.payment.findMany({
            where: { orderId: orderIdInt },
            orderBy: { paymentDate: "desc" }
        });

        return successResponse(res, {
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                grandTotal: order.grandTotal,
                paidAmount: order.paidAmount,
                dueAmount: order.dueAmount,
                paymentStatus: order.paymentStatus,
                status: order.status
            },
            invoice: invoice || null,
            payments
        }, "Payments fetched successfully");

    } catch (error) {
        console.error("Error fetching payments:", error);
        return errorResponse(res, error.message || "Failed to fetch payments", 500);
    }
};

const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await prisma.payment.findUnique({
            where: { id: parseInt(id) },
            include: {
                order: {
                    include: {
                        invoices: true
                    },
                    select: {
                        id: true,
                        orderNumber: true,
                        grandTotal: true,
                        paidAmount: true,
                        dueAmount: true,
                        paymentStatus: true,
                        status: true,
                        orderDate: true,
                        invoices: {
                            select: {
                                id: true,
                                invoiceNumber: true,
                                paymentStatus: true
                            }
                        }
                    }
                },
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        customerCode: true
                    }
                },
                invoice: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        paymentStatus: true
                    }
                }
            }
        });

        if (!payment) {
            return errorResponse(res, "Payment not found", 404);
        }

        return successResponse(res, payment, "Payment fetched successfully");

    } catch (error) {
        console.error("Error fetching payment:", error);
        return errorResponse(res, error.message || "Failed to fetch payment", 500);
    }
};

const getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20, startDate, endDate, paymentMethod, orderId, customerId } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);
        const where = {};

        if (startDate || endDate) {
            where.paymentDate = {};
            if (startDate) where.paymentDate.gte = new Date(startDate);
            if (endDate) where.paymentDate.lte = new Date(endDate);
        }

        if (paymentMethod) where.paymentMethod = paymentMethod;
        if (orderId) where.orderId = parseInt(orderId);
        if (customerId) where.customerId = parseInt(customerId);

        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where,
                include: {
                    order: {
                        include: {
                            invoices: {
                                select: {
                                    id: true,
                                    invoiceNumber: true
                                }
                            }
                        }
                    },
                    customer: {
                        select: {
                            id: true,
                            fullName: true,
                            phone: true,
                            customerCode: true
                        }
                    },
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true
                        }
                    }
                },
                orderBy: { paymentDate: "desc" },
                skip,
                take
            }),
            prisma.payment.count({ where })
        ]);

        return successResponse(res, {
            payments,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / take),
                totalItems: total,
                itemsPerPage: take
            }
        }, "Payments fetched successfully");

    } catch (error) {
        console.error("Error fetching payments:", error);
        return errorResponse(res, error.message || "Failed to fetch payments", 500);
    }
};

const updatePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, referenceNumber, paymentNotes } = req.body;

        const existingPayment = await prisma.payment.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingPayment) {
            return errorResponse(res, "Payment not found", 404);
        }

        const updatedPayment = await prisma.payment.update({
            where: { id: parseInt(id) },
            data: {
                ...(paymentMethod && { paymentMethod }),
                ...(referenceNumber !== undefined && { referenceNumber }),
                ...(paymentNotes !== undefined && { paymentNotes })
            }
        });

        return successResponse(res, updatedPayment, "Payment updated successfully");

    } catch (error) {
        console.error("Error updating payment:", error);
        return errorResponse(res, error.message || "Failed to update payment", 500);
    }
};

const getPaymentStatistics = async (req, res) => {
    try {
        const overallStats = await prisma.payment.aggregate({
            _count: { id: true },
            _sum: { paymentAmount: true },
            _avg: { paymentAmount: true }
        });

        const methodDistribution = await prisma.payment.groupBy({
            by: ['paymentMethod'],
            _count: { id: true },
            _sum: { paymentAmount: true },
            orderBy: { paymentMethod: 'asc' }
        });

        return successResponse(res, {
            overall: {
                totalPayments: overallStats._count.id,
                totalAmount: overallStats._sum.paymentAmount || 0,
                averageAmount: overallStats._avg.paymentAmount || 0
            },
            byPaymentMethod: methodDistribution.map(m => ({
                method: m.paymentMethod,
                count: m._count.id,
                totalAmount: m._sum.paymentAmount || 0
            }))
        }, "Payment statistics fetched successfully");

    } catch (error) {
        console.error("Error fetching statistics:", error);
        return errorResponse(res, error.message || "Failed to fetch statistics", 500);
    }
};

module.exports = {
    createPayment,
    getPaymentsByOrder,
    getPaymentById,
    getAllPayments,
    updatePayment,
    getPaymentStatistics
};


