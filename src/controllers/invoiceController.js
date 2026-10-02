const prisma = require('../utils/db.js');
const { generateNumber } = require('../utils/generateNumber.js');
const { errorResponse, successResponse } = require("../utils/responseHandler");

const createInvoice = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return errorResponse(res, "orderId is required", 400);
        }

        const numericOrderId = Number(orderId);

        // Get full order details with payments and order number
        const order = await prisma.onlineOrder.findUnique({
            where: { id: numericOrderId },
            include: {
                customer: true,
                shippingAddress: true,
                payments: true
            }
        });

        if (!order) {
            return errorResponse(res, "Order not found", 404);
        }

        // Get order items
        const orderItems = await prisma.orderItem.findMany({
            where: { onlineOrderId: numericOrderId },
            include: {
                product: {
                    select: {
                        id: true,
                        productName: true,
                        sku: true,
                        description: true
                    }
                }
            }
        });

        if (!orderItems || orderItems.length === 0) {
            return errorResponse(
                res,
                `Order ${order.orderNumber} has no items.`,
                400
            );
        }

        // Check if invoice already exists
        const existingInvoice = await prisma.invoice.findFirst({
            where: { orderId: numericOrderId }
        });

        if (existingInvoice) {
            return errorResponse(
                res,
                `Invoice ${existingInvoice.invoiceNumber} already exists for order ${order.orderNumber}`,
                400
            );
        }

        const invoiceNumber = await generateNumber("INVOICE");

        // Calculate paid amount from existing payments
        const totalPaid = order.payments.reduce((sum, payment) =>
            sum + Number(payment.paymentAmount || 0), 0
        );

        const grandTotal = Number(order.grandTotal);
        const dueAmount = grandTotal - totalPaid;

        const paymentStatus =
            dueAmount <= 0 ? "Paid" :
                totalPaid > 0 ? "Partial" : "Unpaid";

        const invoiceItemsData = orderItems.map((item) => ({
            orderItemId: item.id,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            discount: Number(item.discount || 0),
            tax: Number(item.tax || 0),
            lineTotal: Number(item.lineTotal || 0)
        }));

        const invoice = await prisma.$transaction(async (tx) => {
            const created = await tx.invoice.create({
                data: {
                    invoiceNumber,
                    orderId: numericOrderId,
                    customerId: order.customerId,
                    shippingAddressId: order.shippingAddressId,
                    totalAmount: Number(order.totalAmount),
                    discount: Number(order.discount || 0),
                    voucher_promo: Number(order.voucher_promo || 0),
                    tax: Number(order.tax || 0),
                    grandTotal: grandTotal,
                    paidAmount: totalPaid,
                    dueAmount: dueAmount,
                    paymentStatus: paymentStatus,
                    remarks: order.note || "",
                    invoiceItems: {
                        create: invoiceItemsData
                    }
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                            customerCode: true
                        }
                    },
                    shippingAddress: {
                        select: {
                            recipientName: true,
                            phoneNumber: true,
                            address: true,
                            upazila: true,
                            postalCode: true,
                            district: true,
                            division: true,
                            city: true,
                            country: true
                        }
                    },
                    invoiceItems: {
                        include: {
                            orderItem: {
                                include: {
                                    product: {
                                        select: {
                                            id: true,
                                            productName: true,
                                            sku: true,
                                            description: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Add order number to the response
            return {
                ...created,
                orderNumber: order.orderNumber
            };
        });

        return successResponse(res, invoice, "Invoice created successfully");

    } catch (error) {
        console.error("❌ Invoice Creation Error:", error);
        return errorResponse(res, error.message || "Failed to create invoice", 500);
    }
};

const getAllInvoices = async (req, res) => {
    try {
        const { 
            paymentStatus, 
            customerId, 
            startDate, 
            endDate,
            page = 1, 
            limit = 20 
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where = {};

        if (paymentStatus && paymentStatus !== 'all') {
            where.paymentStatus = paymentStatus;
        }

        if (customerId) {
            where.customerId = Number(customerId);
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        // Get total count for pagination
        const total = await prisma.invoice.count({ where });

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                onlineOrder: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        paymentMethod: true,
                        orderDate: true
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
                shippingAddress: {
                    select: {
                        recipientName: true,
                        phoneNumber: true,
                        address: true,
                        upazila: true,
                        postalCode: true,
                        district: true,
                        division: true,
                        city: true,
                        country: true
                    }
                },
                invoiceItems: {
                    include: {
                        orderItem: {
                            include: {
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
                },
                payments: {
                    select: {
                        id: true,
                        paymentNumber: true,
                        paymentAmount: true,
                        paymentMethod: true,
                        paymentDate: true,
                        referenceNumber: true,
                        paymentNotes: true
                    },
                    orderBy: {
                        paymentDate: 'desc'
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
        });

        // Transform the response to include orderNumber at root level for easier access
        const transformedInvoices = invoices.map(invoice => ({
            ...invoice,
            orderNumber: invoice.onlineOrder?.orderNumber,
            orderStatus: invoice.onlineOrder?.status,
            orderDate: invoice.onlineOrder?.orderDate,
            paymentMethod: invoice.onlineOrder?.paymentMethod
        }));

        return successResponse(res, {
            invoices: transformedInvoices,
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: total,
                totalPages: Math.ceil(total / parseInt(limit)),
            }
        }, "Invoices fetched successfully");

    } catch (error) {
        console.error("Error fetching invoices:", error);
        return errorResponse(res, error.message || "Failed to fetch invoices", 500);
    }
};


const getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await prisma.invoice.findUnique({
            where: { id: Number(id) },
            include: {
                onlineOrder: {  // Include order details
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        paymentMethod: true,
                        orderDate: true,
                        note: true
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
                shippingAddress: {
                    select: {
                        recipientName: true,
                        phoneNumber: true,
                        address: true,
                        upazila: true,
                        postalCode: true,
                        district: true,
                        division: true,
                        city: true,
                        country: true
                    }
                },
                invoiceItems: {
                    include: {
                        orderItem: {
                            include: {
                                product: {
                                    select: {
                                        id: true,
                                        productName: true,
                                        sku: true,
                                        description: true,
                                        images: true
                                    }
                                },
                                productVariant: {
                                    select: {
                                        id: true,
                                        sku: true,
                                        attributes: true
                                    }
                                }
                            }
                        }
                    }
                },
                payments: {
                    select: {
                        id: true,
                        paymentNumber: true,
                        paymentAmount: true,
                        paymentMethod: true,
                        onlinePaymentMethod: true,
                        paymentDate: true,
                        referenceNumber: true,
                        paymentNotes: true
                    },
                    orderBy: {
                        paymentDate: 'desc'
                    }
                }
            }
        });

        if (!invoice) {
            return errorResponse(res, "Invoice not found", 404);
        }

        // Transform the response to include order information at root level
        const transformedInvoice = {
            ...invoice,
            orderNumber: invoice.onlineOrder?.orderNumber,
            orderStatus: invoice.onlineOrder?.status,
            orderDate: invoice.onlineOrder?.orderDate,
            orderPaymentMethod: invoice.onlineOrder?.paymentMethod,
            orderNote: invoice.onlineOrder?.note
        };

        return successResponse(res, transformedInvoice, "Invoice fetched successfully");
    } catch (error) {
        console.error("Error fetching invoice:", error);
        return errorResponse(res, error.message || "Failed to fetch invoice", 500);
    }
};

const updateInvoicePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;

        const validStatuses = ["Paid", "Unpaid", "Partial"];
        if (!validStatuses.includes(paymentStatus)) {
            return errorResponse(res, "Invalid payment status. Valid statuses: Paid, Unpaid, Partial", 400);
        }

        // Get the invoice to check current paid amount
        const existingInvoice = await prisma.invoice.findUnique({
            where: { id: Number(id) },
            include: {
                onlineOrder: true
            }
        });

        if (!existingInvoice) {
            return errorResponse(res, "Invoice not found", 404);
        }

        // If marking as Paid, ensure paidAmount equals grandTotal
        if (paymentStatus === "Paid") {
            const updatedInvoice = await prisma.invoice.update({
                where: { id: Number(id) },
                data: {
                    paymentStatus,
                    paidAmount: existingInvoice.grandTotal,
                    dueAmount: 0
                },
                include: {
                    customer: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true
                        }
                    },
                    onlineOrder: {
                        select: {
                            orderNumber: true
                        }
                    },
                    invoiceItems: {
                        include: {
                            orderItem: {
                                include: {
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
                }
            });

            // Also update the order payment status
            await prisma.onlineOrder.update({
                where: { id: existingInvoice.orderId },
                data: {
                    paymentStatus: "Paid",
                    paidAmount: existingInvoice.grandTotal,
                    dueAmount: 0
                }
            });

            return successResponse(res, {
                ...updatedInvoice,
                orderNumber: updatedInvoice.onlineOrder?.orderNumber
            }, "Invoice marked as paid successfully");
        }

        // For other status updates
        const invoice = await prisma.invoice.update({
            where: { id: Number(id) },
            data: { paymentStatus },
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true
                    }
                },
                onlineOrder: {
                    select: {
                        orderNumber: true
                    }
                },
                invoiceItems: {
                    include: {
                        orderItem: {
                            include: {
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
            }
        });

        return successResponse(res, {
            ...invoice,
            orderNumber: invoice.onlineOrder?.orderNumber
        }, "Invoice payment status updated successfully");

    } catch (error) {
        console.error("Error updating invoice:", error);
        if (error.code === 'P2025') {
            return errorResponse(res, "Invoice not found", 404);
        }
        return errorResponse(res, error.message || "Failed to update invoice", 500);
    }
};

const deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await prisma.invoice.findUnique({
            where: { id: Number(id) },
            include: {
                payments: true,
                onlineOrder: {
                    select: {
                        orderNumber: true
                    }
                }
            }
        });

        if (!invoice) {
            return errorResponse(res, "Invoice not found", 404);
        }

        if (invoice.payments && invoice.payments.length > 0) {
            return errorResponse(
                res,
                `Cannot delete invoice ${invoice.invoiceNumber} for order ${invoice.onlineOrder?.orderNumber} because it has ${invoice.payments.length} payment(s) associated.`,
                400
            );
        }

        await prisma.invoice.delete({
            where: { id: Number(id) }
        });

        return successResponse(
            res,
            null,
            `Invoice ${invoice.invoiceNumber} for order ${invoice.onlineOrder?.orderNumber} deleted successfully`
        );
    } catch (error) {
        console.error("Error deleting invoice:", error);
        if (error.code === 'P2025') {
            return errorResponse(res, "Invoice not found", 404);
        }
        return errorResponse(res, error.message || "Failed to delete invoice", 500);
    }
};

// Additional utility function to get invoices by order number
const getInvoicesByOrderNumber = async (req, res) => {
    try {
        const { orderNumber } = req.params;

        const invoices = await prisma.invoice.findMany({
            where: {
                onlineOrder: {
                    orderNumber: orderNumber
                }
            },
            include: {
                onlineOrder: {
                    select: {
                        orderNumber: true,
                        status: true
                    }
                },
                customer: {
                    select: {
                        fullName: true,
                        email: true,
                        phone: true
                    }
                },
                payments: {
                    select: {
                        paymentNumber: true,
                        paymentAmount: true,
                        paymentMethod: true,
                        paymentDate: true
                    }
                }
            }
        });

        if (invoices.length === 0) {
            return errorResponse(res, `No invoices found for order number ${orderNumber}`, 404);
        }

        return successResponse(res, invoices, "Invoices fetched successfully");
    } catch (error) {
        console.error("Error fetching invoices by order number:", error);
        return errorResponse(res, error.message || "Failed to fetch invoices", 500);
    }
};

module.exports = {
    createInvoice,
    getAllInvoices,
    getInvoiceById,
    updateInvoicePaymentStatus,
    deleteInvoice,
    getInvoicesByOrderNumber  // New utility function
};