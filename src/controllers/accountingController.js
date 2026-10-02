const prisma = require("../utils/db.js");
const { successResponse, errorResponse } = require("../utils/responseHandler");

/**
 * Helper: Parse date filter parameters (period, startDate, endDate)
 */
function parseDateFilter(query) {
    const { period, startDate, endDate } = query;
    const now = new Date();
    let start = null;
    let end = null;

    if (period) {
        switch (period.toLowerCase()) {
            case "today": {
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            }
            case "yesterday": {
                const y = new Date(now);
                y.setDate(y.getDate() - 1);
                start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
                end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
                break;
            }
            case "this_week": {
                const day = now.getDay();
                const diff = now.getDate() - day; // Sunday as start
                start = new Date(now.setDate(diff));
                start.setHours(0, 0, 0, 0);
                end = new Date();
                end.setHours(23, 59, 59, 999);
                break;
            }
            case "last_7_days": {
                start = new Date(now);
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                end = new Date(now);
                end.setHours(23, 59, 59, 999);
                break;
            }
            case "this_month": {
                start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            }
            case "last_month": {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
            }
            case "this_year": {
                start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                break;
            }
            case "all":
            default:
                break;
        }
    }

    if (startDate) {
        const customStart = new Date(startDate);
        if (!isNaN(customStart.getTime())) {
            customStart.setHours(0, 0, 0, 0);
            start = customStart;
        }
    }

    if (endDate) {
        const customEnd = new Date(endDate);
        if (!isNaN(customEnd.getTime())) {
            customEnd.setHours(23, 59, 59, 999);
            end = customEnd;
        }
    }

    const filter = {};
    if (start && end) {
        filter.gte = start;
        filter.lte = end;
    } else if (start) {
        filter.gte = start;
    } else if (end) {
        filter.lte = end;
    }

    return {
        dateFilter: Object.keys(filter).length > 0 ? filter : null,
        startDate: start,
        endDate: end
    };
}

/**
 * Helper: Generate unique voucher number
 */
function generateVoucherNumber(type = "EXPENSE") {
    const prefix = type === "INCOME" ? "INC" : "EXP";
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${dateStr}-${randomHex}`;
}

// ============================================================================
// 1. ACCOUNT HEADS
// ============================================================================

/**
 * GET /api/accounting/heads
 * List all account heads with optional filters (type, status, search) and aggregate stats
 */
exports.getAccountHeads = async (req, res) => {
    try {
        const { type, status, search } = req.query;

        const where = {};
        if (type && ["INCOME", "EXPENSE"].includes(type.toUpperCase())) {
            where.type = type.toUpperCase();
        }
        if (status !== undefined && status !== "all") {
            where.status = status === "true" || status === true;
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const heads = await prisma.accountHead.findMany({
            where,
            include: {
                transactions: {
                    select: {
                        amount: true
                    }
                }
            },
            orderBy: [{ type: "asc" }, { title: "asc" }]
        });

        // Compute total amount and transaction count for each head
        const data = heads.map(head => {
            const transactionCount = head.transactions.length;
            const totalAmount = head.transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
            const { transactions, ...rest } = head;
            return {
                ...rest,
                transactionCount,
                totalAmount
            };
        });

        return successResponse(res, "Account heads retrieved successfully", data);
    } catch (error) {
        console.error("getAccountHeads error:", error);
        return errorResponse(res, "Failed to retrieve account heads", 500, error.message);
    }
};

/**
 * POST /api/accounting/heads
 * Create new account head
 */
exports.createAccountHead = async (req, res) => {
    try {
        const { title, type, description, status = true, code } = req.body;

        if (!title || !type) {
            return errorResponse(res, "Title and Type (INCOME or EXPENSE) are required", 400);
        }

        const headType = type.toUpperCase();
        if (!["INCOME", "EXPENSE"].includes(headType)) {
            return errorResponse(res, "Type must be either INCOME or EXPENSE", 400);
        }

        // Check title uniqueness
        const existing = await prisma.accountHead.findFirst({
            where: { title: { equals: title.trim(), mode: "insensitive" } }
        });
        if (existing) {
            return errorResponse(res, `Account Head '${title}' already exists`, 409);
        }

        // Auto generate code if not provided
        let headCode = code ? code.trim() : null;
        if (!headCode) {
            const count = await prisma.accountHead.count({ where: { type: headType } });
            const prefix = headType === "INCOME" ? "AH-INC" : "AH-EXP";
            headCode = `${prefix}-${String(count + 1).padStart(3, "0")}`;
        }

        const newHead = await prisma.accountHead.create({
            data: {
                title: title.trim(),
                code: headCode,
                type: headType,
                description: description ? description.trim() : null,
                status: Boolean(status)
            }
        });

        return successResponse(res, "Account head created successfully", newHead, 201);
    } catch (error) {
        console.error("createAccountHead error:", error);
        return errorResponse(res, "Failed to create account head", 500, error.message);
    }
};

/**
 * PUT /api/accounting/heads/:id
 * Update account head
 */
exports.updateAccountHead = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { title, type, description, status, code } = req.body;

        const head = await prisma.accountHead.findUnique({ where: { id } });
        if (!head) {
            return errorResponse(res, "Account head not found", 404);
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title.trim();
        if (code !== undefined) updateData.code = code.trim();
        if (type !== undefined && ["INCOME", "EXPENSE"].includes(type.toUpperCase())) {
            updateData.type = type.toUpperCase();
        }
        if (description !== undefined) updateData.description = description ? description.trim() : null;
        if (status !== undefined) updateData.status = Boolean(status);

        const updated = await prisma.accountHead.update({
            where: { id },
            data: updateData
        });

        return successResponse(res, "Account head updated successfully", updated);
    } catch (error) {
        console.error("updateAccountHead error:", error);
        return errorResponse(res, "Failed to update account head", 500, error.message);
    }
};

/**
 * DELETE /api/accounting/heads/:id
 * Delete or deactivate account head
 */
exports.deleteAccountHead = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const head = await prisma.accountHead.findUnique({
            where: { id },
            include: {
                _count: { select: { transactions: true } }
            }
        });

        if (!head) {
            return errorResponse(res, "Account head not found", 404);
        }

        // Prevent deletion if transactions are linked
        if (head._count.transactions > 0) {
            return errorResponse(
                res,
                `Cannot delete head '${head.title}' because it has ${head._count.transactions} linked transaction(s). You can deactivate it instead.`,
                400
            );
        }

        await prisma.accountHead.delete({ where: { id } });

        return successResponse(res, "Account head deleted successfully", null);
    } catch (error) {
        console.error("deleteAccountHead error:", error);
        return errorResponse(res, "Failed to delete account head", 500, error.message);
    }
};

/**
 * POST /api/accounting/heads/seed-defaults
 * Seed standard e-commerce Account Heads
 */
exports.seedDefaultHeads = async (req, res) => {
    try {
        const defaultHeads = [
            // Incomes
            { code: "AH-INC-001", title: "Direct Product Sales", type: "INCOME", description: "Revenue from direct e-commerce product orders", isSystem: true },
            { code: "AH-INC-002", title: "Delivery / Shipping Charges Collected", type: "INCOME", description: "Delivery fees collected from customers", isSystem: true },
            { code: "AH-INC-003", title: "Other Income & Cashback", type: "INCOME", description: "Discounts received, cashbacks, or auxiliary receipts", isSystem: false },
            { code: "AH-INC-004", title: "Affiliate & Partner Commission", type: "INCOME", description: "Incomes from affiliates, ads or brand partnerships", isSystem: false },

            // Expenses
            { code: "AH-EXP-001", title: "Digital Marketing & Ads", type: "EXPENSE", description: "Facebook ads, Google ads, TikTok promos, influencer marketing", isSystem: true },
            { code: "AH-EXP-002", title: "Courier Delivery Charges", type: "EXPENSE", description: "Steadfast, Pathao & other courier service shipping fees", isSystem: true },
            { code: "AH-EXP-003", title: "Packaging & Supplies", type: "EXPENSE", description: "Boxes, flyers, bubble wrap, poly bags, tape, and labels", isSystem: true },
            { code: "AH-EXP-004", title: "Staff Salaries & Allowances", type: "EXPENSE", description: "Employee salaries, bonuses, and staff incentives", isSystem: false },
            { code: "AH-EXP-005", title: "Office Rent & Warehouse", type: "EXPENSE", description: "Monthly office and warehouse rental payments", isSystem: false },
            { code: "AH-EXP-006", title: "Utilities (Electricity, Internet)", type: "EXPENSE", description: "Electricity, high-speed internet, water, and gas bills", isSystem: false },
            { code: "AH-EXP-007", title: "Software, Domain & Hosting", type: "EXPENSE", description: "Cloud servers, domain renewals, SaaS subscriptions", isSystem: false },
            { code: "AH-EXP-008", title: "Returned / Damaged Goods Loss", type: "EXPENSE", description: "Customer return delivery charges and damaged parcel losses", isSystem: true },
            { code: "AH-EXP-009", title: "Office Stationery & Refreshment", type: "EXPENSE", description: "Tea, snacks, cleaning, printing papers, and consumables", isSystem: false },
            { code: "AH-EXP-010", title: "Miscellaneous Expenses", type: "EXPENSE", description: "Uncategorized day-to-day general expenses", isSystem: false },
        ];

        let createdCount = 0;
        for (const head of defaultHeads) {
            const exists = await prisma.accountHead.findFirst({
                where: {
                    OR: [
                        { title: { equals: head.title, mode: "insensitive" } },
                        { code: head.code }
                    ]
                }
            });
            if (!exists) {
                await prisma.accountHead.create({ data: head });
                createdCount++;
            }
        }

        return successResponse(res, `Default account heads initialized (${createdCount} new heads created)`, { createdCount });
    } catch (error) {
        console.error("seedDefaultHeads error:", error);
        return errorResponse(res, "Failed to seed default account heads", 500, error.message);
    }
};

// ============================================================================
// 2. INCOME & EXPENSE TRANSACTIONS
// ============================================================================

/**
 * GET /api/accounting/transactions
 * List paginated transactions with flexible filtering
 */
exports.getTransactions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            type,
            accountHeadId,
            paymentMethod,
            search,
            orderId,
            shipmentId
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, parseInt(limit));
        const skip = (pageNum - 1) * limitNum;

        const { dateFilter } = parseDateFilter(req.query);

        const where = {};
        if (type && ["INCOME", "EXPENSE"].includes(type.toUpperCase())) {
            where.type = type.toUpperCase();
        }
        if (accountHeadId) {
            where.accountHeadId = parseInt(accountHeadId);
        }
        if (paymentMethod && paymentMethod !== "all") {
            where.paymentMethod = { equals: paymentMethod, mode: "insensitive" };
        }
        if (dateFilter) {
            where.date = dateFilter;
        }
        if (orderId) {
            where.orderId = parseInt(orderId);
        }
        if (shipmentId) {
            where.shipmentId = parseInt(shipmentId);
        }
        if (search) {
            where.OR = [
                { voucherNo: { contains: search, mode: "insensitive" } },
                { reference: { contains: search, mode: "insensitive" } },
                { note: { contains: search, mode: "insensitive" } },
                { accountHead: { title: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [totalItems, transactions, incomeAgg, expenseAgg] = await Promise.all([
            prisma.accountTransaction.count({ where }),
            prisma.accountTransaction.findMany({
                where,
                include: {
                    accountHead: true,
                    order: {
                        select: {
                            id: true,
                            orderNumber: true,
                            grandTotal: true,
                            status: true
                        }
                    },
                    shipment: {
                        select: {
                            id: true,
                            trackingCode: true,
                            courier: true,
                            status: true
                        }
                    }
                },
                orderBy: { date: "desc" },
                skip,
                take: limitNum
            }),
            prisma.accountTransaction.aggregate({
                where: { ...where, type: "INCOME" },
                _sum: { amount: true }
            }),
            prisma.accountTransaction.aggregate({
                where: { ...where, type: "EXPENSE" },
                _sum: { amount: true }
            })
        ]);

        const totalIncome = parseFloat(incomeAgg._sum.amount || 0);
        const totalExpense = parseFloat(expenseAgg._sum.amount || 0);
        const netBalance = totalIncome - totalExpense;

        return successResponse(res, "Transactions retrieved successfully", {
            transactions,
            summary: {
                totalIncome,
                totalExpense,
                netBalance
            },
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / limitNum),
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error("getTransactions error:", error);
        return errorResponse(res, "Failed to retrieve transactions", 500, error.message);
    }
};

/**
 * POST /api/accounting/transactions
 * Record new income or expense voucher entry
 */
exports.createTransaction = async (req, res) => {
    try {
        const {
            type,
            accountHeadId,
            amount,
            date = new Date(),
            paymentMethod = "Cash",
            reference,
            note,
            attachment,
            orderId,
            shipmentId
        } = req.body;

        if (!type || !accountHeadId || amount === undefined) {
            return errorResponse(res, "Type, Account Head and Amount are required", 400);
        }

        const transType = type.toUpperCase();
        if (!["INCOME", "EXPENSE"].includes(transType)) {
            return errorResponse(res, "Type must be INCOME or EXPENSE", 400);
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return errorResponse(res, "Amount must be a positive number", 400);
        }

        const head = await prisma.accountHead.findUnique({
            where: { id: parseInt(accountHeadId) }
        });
        if (!head) {
            return errorResponse(res, "Account Head not found", 404);
        }

        const voucherNo = req.body.voucherNo ? req.body.voucherNo.trim() : generateVoucherNumber(transType);

        const transaction = await prisma.accountTransaction.create({
            data: {
                voucherNo,
                type: transType,
                accountHeadId: head.id,
                amount: parsedAmount,
                date: new Date(date),
                paymentMethod: paymentMethod || "Cash",
                reference: reference ? reference.trim() : null,
                note: note ? note.trim() : null,
                attachment: attachment || null,
                orderId: orderId ? parseInt(orderId) : null,
                shipmentId: shipmentId ? parseInt(shipmentId) : null,
                createdById: req.user?.id || null
            },
            include: {
                accountHead: true
            }
        });

        return successResponse(res, "Transaction recorded successfully", transaction, 201);
    } catch (error) {
        console.error("createTransaction error:", error);
        return errorResponse(res, "Failed to record transaction", 500, error.message);
    }
};

/**
 * GET /api/accounting/transactions/:id
 * Get details of a single transaction
 */
exports.getTransactionById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const transaction = await prisma.accountTransaction.findUnique({
            where: { id },
            include: {
                accountHead: true,
                order: true,
                shipment: true
            }
        });

        if (!transaction) {
            return errorResponse(res, "Transaction not found", 404);
        }

        return successResponse(res, "Transaction retrieved", transaction);
    } catch (error) {
        console.error("getTransactionById error:", error);
        return errorResponse(res, "Failed to retrieve transaction", 500, error.message);
    }
};

/**
 * PUT /api/accounting/transactions/:id
 * Update transaction entry
 */
exports.updateTransaction = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const {
            type,
            accountHeadId,
            amount,
            date,
            paymentMethod,
            reference,
            note,
            attachment,
            orderId,
            shipmentId
        } = req.body;

        const existing = await prisma.accountTransaction.findUnique({ where: { id } });
        if (!existing) {
            return errorResponse(res, "Transaction not found", 404);
        }

        const updateData = {};
        if (type && ["INCOME", "EXPENSE"].includes(type.toUpperCase())) {
            updateData.type = type.toUpperCase();
        }
        if (accountHeadId) {
            updateData.accountHeadId = parseInt(accountHeadId);
        }
        if (amount !== undefined) {
            const parsed = parseFloat(amount);
            if (isNaN(parsed) || parsed <= 0) {
                return errorResponse(res, "Amount must be a positive number", 400);
            }
            updateData.amount = parsed;
        }
        if (date) updateData.date = new Date(date);
        if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
        if (reference !== undefined) updateData.reference = reference ? reference.trim() : null;
        if (note !== undefined) updateData.note = note ? note.trim() : null;
        if (attachment !== undefined) updateData.attachment = attachment;
        if (orderId !== undefined) updateData.orderId = orderId ? parseInt(orderId) : null;
        if (shipmentId !== undefined) updateData.shipmentId = shipmentId ? parseInt(shipmentId) : null;

        const updated = await prisma.accountTransaction.update({
            where: { id },
            data: updateData,
            include: { accountHead: true }
        });

        return successResponse(res, "Transaction updated successfully", updated);
    } catch (error) {
        console.error("updateTransaction error:", error);
        return errorResponse(res, "Failed to update transaction", 500, error.message);
    }
};

/**
 * DELETE /api/accounting/transactions/:id
 * Delete transaction entry
 */
exports.deleteTransaction = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const existing = await prisma.accountTransaction.findUnique({ where: { id } });
        if (!existing) {
            return errorResponse(res, "Transaction not found", 404);
        }

        await prisma.accountTransaction.delete({ where: { id } });
        return successResponse(res, "Transaction deleted successfully", null);
    } catch (error) {
        console.error("deleteTransaction error:", error);
        return errorResponse(res, "Failed to delete transaction", 500, error.message);
    }
};

// ============================================================================
// 3. DASHBOARD FINANCIAL KPIS
// ============================================================================

/**
 * GET /api/accounting/dashboard-kpis
 * Key performance indicators for accounting dashboard:
 * - Total Sales
 * - Total Collection
 * - Total Expenses
 * - Gross Profit
 * - Net Profit
 * - Returns (count & value)
 * - Courier Charges
 */
exports.getDashboardKPIs = async (req, res) => {
    try {
        const { dateFilter, startDate, endDate } = parseDateFilter(req.query);
        const { status } = req.query;

        // Base order where clause
        const orderWhere = {};
        if (dateFilter) {
            orderWhere.orderDate = dateFilter;
        }
        if (status && status !== "all") {
            orderWhere.status = status;
        } else {
            // Calculate only from Delivered orders
            orderWhere.status = "Delivered";
        }

        // Run all independent queries in parallel
        const [
            orders,
            paymentAgg,
            expenseAgg,
            otherIncomeAgg,
            saleReturnsAgg,
            returnedShipments,
            recentTransactions
        ] = await Promise.all([
            prisma.onlineOrder.findMany({
                where: orderWhere,
                select: {
                    id: true,
                    grandTotal: true,
                    totalAmount: true,
                    paidAmount: true,
                    dueAmount: true,
                    shippingCost: true,
                    status: true,
                    shippingAddress: {
                        select: {
                            district: true,
                            city: true,
                            address: true
                        }
                    },
                    shipment: {
                        select: {
                            recipientAddress: true
                        }
                    },
                    orderItems: {
                        select: {
                            quantity: true,
                            unitPrice: true,
                            lineTotal: true,
                            product: {
                                select: {
                                    id: true,
                                    costPrice: true,
                                    price: true,
                                    insideDhakaDeliveryCharge: true,
                                    outsideDhakaDeliveryCharge: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.payment.aggregate({
                where: dateFilter ? { paymentDate: dateFilter } : {},
                _sum: { paymentAmount: true },
                _count: { id: true }
            }),
            prisma.accountTransaction.aggregate({
                where: { ...(dateFilter ? { date: dateFilter } : {}), type: "EXPENSE" },
                _sum: { amount: true },
                _count: { id: true }
            }),
            prisma.accountTransaction.aggregate({
                where: { ...(dateFilter ? { date: dateFilter } : {}), type: "INCOME" },
                _sum: { amount: true },
                _count: { id: true }
            }),
            prisma.saleReturn.aggregate({
                where: dateFilter ? { createdAt: dateFilter } : {},
                _sum: { refundAmount: true },
                _count: { id: true }
            }),
            prisma.shipment.findMany({
                where: {
                    status: "Returned",
                    ...(dateFilter ? { updatedAt: dateFilter } : {})
                },
                select: {
                    id: true,
                    codAmount: true,
                    courierCharge: true,
                    order: {
                        select: { grandTotal: true }
                    }
                }
            }),
            prisma.accountTransaction.findMany({
                include: { accountHead: true },
                orderBy: { date: "desc" },
                take: 5
            })
        ]);

        let totalSales = 0;
        let totalPaidFromOrders = 0;
        let totalDue = 0;
        let totalCogs = 0;
        let totalOrderShippingIncome = 0;
        let totalShippingCost = 0;

        orders.forEach(ord => {
            const saleVal = parseFloat(ord.grandTotal || ord.totalAmount || 0);
            totalSales += saleVal;
            totalPaidFromOrders += parseFloat(ord.paidAmount || 0);
            totalDue += parseFloat(ord.dueAmount || 0);
            totalOrderShippingIncome += parseFloat(ord.shippingCost || 0);

            const addrText = [
                ord.shippingAddress?.district,
                ord.shippingAddress?.city,
                ord.shippingAddress?.address,
                ord.shipment?.recipientAddress
            ].filter(Boolean).join(" ").toLowerCase();
            const isDhaka = addrText.includes("dhaka");

            let maxProductShipping = 0;
            if (ord.orderItems && ord.orderItems.length > 0) {
                ord.orderItems.forEach(item => {
                    const unitCharge = isDhaka
                        ? parseFloat(item.product?.insideDhakaDeliveryCharge ?? 0)
                        : parseFloat(item.product?.outsideDhakaDeliveryCharge ?? 0);

                    if (unitCharge > maxProductShipping) {
                        maxProductShipping = unitCharge;
                    }

                    const qty = parseInt(item.quantity || 1);
                    const cost = parseFloat(item.product?.costPrice || 0);
                    const effectiveCost = cost > 0 ? cost : (parseFloat(item.unitPrice || 0) * 0.65);
                    totalCogs += effectiveCost * qty;
                });
            }

            const orderShipping = parseFloat(ord.shippingCost || 0) > 0
                ? parseFloat(ord.shippingCost)
                : maxProductShipping;

            totalShippingCost += orderShipping;
        });

        const totalCollection = Math.max(
            parseFloat(paymentAgg._sum?.paymentAmount || 0),
            totalPaidFromOrders
        );

        const recordedExpenses = parseFloat(expenseAgg._sum?.amount || 0);
        const otherIncome = parseFloat(otherIncomeAgg._sum?.amount || 0);
        const totalRevenue = totalSales + otherIncome;

        const directRefunds = parseFloat(saleReturnsAgg._sum?.refundAmount || 0);
        const returnOrdersCount = returnedShipments.length + (saleReturnsAgg._count?.id || 0);
        const returnParcelsValue = returnedShipments.reduce((acc, s) => acc + parseFloat(s.order?.grandTotal || s.codAmount || 0), 0);
        const totalReturnsValue = directRefunds + returnParcelsValue;

        const totalExpenses = recordedExpenses + totalShippingCost;
        const grossProfit = totalSales - totalShippingCost;
        const grossProfitMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(2) : 0;

        const netProfit = totalRevenue - totalExpenses;
        const netProfitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

        return successResponse(res, "Dashboard KPIs retrieved successfully", {
            kpis: {
                totalSales: parseFloat(totalSales.toFixed(2)),
                totalCollection: parseFloat(totalCollection.toFixed(2)),
                otherIncome: parseFloat(otherIncome.toFixed(2)),
                totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                shippingCost: parseFloat(totalShippingCost.toFixed(2)),
                totalExpenses: parseFloat(totalExpenses.toFixed(2)),
                totalExpense: parseFloat(totalExpenses.toFixed(2)),
                operatingExpensesOnly: parseFloat(recordedExpenses.toFixed(2)),
                grossProfit: parseFloat(grossProfit.toFixed(2)),
                grossProfitMargin: parseFloat(grossProfitMargin),
                netProfit: parseFloat(netProfit.toFixed(2)),
                netProfitMargin: parseFloat(netProfitMargin),
                totalDue: parseFloat(totalDue.toFixed(2)),
                cogs: parseFloat(totalCogs.toFixed(2)),
                returns: {
                    count: returnOrdersCount,
                    totalValue: parseFloat(totalReturnsValue.toFixed(2)),
                    directRefunds: parseFloat(directRefunds.toFixed(2))
                },
                courierCharges: parseFloat(totalShippingCost.toFixed(2)),
                totalOrders: orders.length
            },
            recentTransactions,
            filterApplied: {
                startDate,
                endDate,
                status: status || "all"
            }
        });
    } catch (error) {
        console.error("getDashboardKPIs error:", error);
        return errorResponse(res, "Failed to retrieve dashboard KPIs", 500, error.message);
    }
};

// ============================================================================
// 4. HEAD-WISE EXPENSES REPORT
// ============================================================================

/**
 * GET /api/accounting/reports/head-wise-expenses
 * Breakdown and distribution of expenses grouped by Account Head
 */
exports.getHeadWiseExpenses = async (req, res) => {
    try {
        const { dateFilter, startDate, endDate } = parseDateFilter(req.query);

        const where = { type: "EXPENSE" };
        if (dateFilter) {
            where.date = dateFilter;
        }

        const transactions = await prisma.accountTransaction.findMany({
            where,
            include: {
                accountHead: true
            }
        });

        // Also incorporate courier charges as an automatic breakdown head if shipments exist
        const shipmentWhere = {};
        if (dateFilter) shipmentWhere.createdAt = dateFilter;
        const shipments = await prisma.shipment.findMany({
            where: shipmentWhere,
            select: {
                courier: true,
                courierCharge: true,
                codAmount: true,
                order: { select: { shippingCost: true } }
            }
        });

        let automatedCourierExpense = 0;
        shipments.forEach(s => {
            const charge = parseFloat(s.courierCharge || 0);
            if (charge > 0) {
                automatedCourierExpense += charge;
            } else {
                automatedCourierExpense += parseFloat(s.order?.shippingCost || 0);
            }
        });

        // Group by head
        const headMap = {};
        let grandTotal = 0;

        transactions.forEach(t => {
            const headId = t.accountHeadId;
            const headTitle = t.accountHead?.title || "Uncategorized";
            const headCode = t.accountHead?.code || "N/A";
            const amt = parseFloat(t.amount || 0);

            if (!headMap[headId]) {
                headMap[headId] = {
                    headId,
                    title: headTitle,
                    code: headCode,
                    amount: 0,
                    count: 0
                };
            }
            headMap[headId].amount += amt;
            headMap[headId].count += 1;
            grandTotal += amt;
        });

        // Add auto courier expense if no manual Courier Delivery Charges transaction was recorded
        const hasCourierTrans = Object.values(headMap).some(h => h.title.toLowerCase().includes("courier"));
        if (!hasCourierTrans && automatedCourierExpense > 0) {
            headMap["courier-auto"] = {
                headId: 0,
                title: "Courier Shipping Fees (Automated)",
                code: "AH-EXP-AUTO",
                amount: automatedCourierExpense,
                count: shipments.length
            };
            grandTotal += automatedCourierExpense;
        }

        const breakdown = Object.values(headMap).map(item => ({
            ...item,
            amount: parseFloat(item.amount.toFixed(2)),
            percentage: grandTotal > 0 ? parseFloat(((item.amount / grandTotal) * 100).toFixed(2)) : 0
        })).sort((a, b) => b.amount - a.amount);

        return successResponse(res, "Head-wise expenses retrieved successfully", {
            breakdown,
            totalExpenses: parseFloat(grandTotal.toFixed(2)),
            filterApplied: { startDate, endDate }
        });
    } catch (error) {
        console.error("getHeadWiseExpenses error:", error);
        return errorResponse(res, "Failed to retrieve head-wise expenses", 500, error.message);
    }
};

// ============================================================================
// 5. SALES & COLLECTION REPORT
// ============================================================================

/**
 * GET /api/accounting/reports/sales-collection
 * Order-by-order sales and collection list with customer, payment, and courier data
 */
exports.getSalesAndCollectionReport = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            paymentStatus,
            orderStatus,
            courier,
            paymentMethod
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, parseInt(limit));
        const skip = (pageNum - 1) * limitNum;

        const { dateFilter, startDate, endDate } = parseDateFilter(req.query);

        const where = {};
        if (dateFilter) {
            where.orderDate = dateFilter;
        }
        if (paymentStatus && paymentStatus !== "all") {
            where.paymentStatus = paymentStatus;
        }
        if (orderStatus && orderStatus !== "all") {
            where.status = orderStatus;
        } else {
            // Strictly Delivered orders
            where.status = "Delivered";
        }
        if (paymentMethod && paymentMethod !== "all") {
            where.paymentMethod = paymentMethod;
        }
        if (courier && courier !== "all") {
            where.shipment = { courier: courier.toUpperCase() };
        }
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { customer: { fullName: { contains: search, mode: "insensitive" } } },
                { customer: { phone: { contains: search, mode: "insensitive" } } },
                { shipment: { trackingCode: { contains: search, mode: "insensitive" } } }
            ];
        }

        const [totalItems, orders, aggregates] = await Promise.all([
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
                    invoices: {
                        select: {
                            id: true,
                            invoiceNumber: true
                        },
                        take: 1
                    },
                    shipment: {
                        select: {
                            id: true,
                            courier: true,
                            trackingCode: true,
                            status: true,
                            codAmount: true,
                            courierCharge: true
                        }
                    },
                    payments: {
                        select: {
                            id: true,
                            paymentNumber: true,
                            paymentAmount: true,
                            paymentMethod: true,
                            paymentDate: true
                        }
                    }
                },
                orderBy: { orderDate: "desc" },
                skip,
                take: limitNum
            }),
            prisma.onlineOrder.aggregate({
                where,
                _sum: {
                    grandTotal: true,
                    paidAmount: true,
                    dueAmount: true
                }
            })
        ]);

        const totalSales = parseFloat(aggregates._sum.grandTotal || 0);
        const totalCollected = parseFloat(aggregates._sum.paidAmount || 0);
        const totalDue = parseFloat(aggregates._sum.dueAmount || 0);

        return successResponse(res, "Sales and collection report retrieved", {
            orders,
            summary: {
                totalSales: parseFloat(totalSales.toFixed(2)),
                totalCollected: parseFloat(totalCollected.toFixed(2)),
                totalDue: parseFloat(totalDue.toFixed(2))
            },
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / limitNum),
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error("getSalesAndCollectionReport error:", error);
        return errorResponse(res, "Failed to retrieve sales and collection report", 500, error.message);
    }
};

// ============================================================================
// 6. PROFIT & LOSS REPORT
// ============================================================================

/**
 * GET /api/accounting/reports/profit-and-loss
 * Formal Profit & Loss Statement (Revenue, COGS, Gross Profit, Operating Expenses, Returns, Net Profit)
 */
exports.getProfitAndLossReport = async (req, res) => {
    try {
        const { dateFilter, startDate, endDate } = parseDateFilter(req.query);

        const orderWhere = { status: "Delivered" };
        if (dateFilter) orderWhere.orderDate = dateFilter;

        const incomeWhere = { type: "INCOME" };
        if (dateFilter) incomeWhere.date = dateFilter;

        const expenseWhere = { type: "EXPENSE" };
        if (dateFilter) expenseWhere.date = dateFilter;

        const returnWhere = {};
        if (dateFilter) returnWhere.createdAt = dateFilter;

        // Run all independent queries in parallel
        const [orders, otherIncomes, expenseTransactions, returnsAgg, contactRecord] = await Promise.all([
            prisma.onlineOrder.findMany({
                where: orderWhere,
                select: {
                    id: true,
                    grandTotal: true,
                    totalAmount: true,
                    discount: true,
                    voucher_promo: true,
                    shippingCost: true,
                    shippingAddress: {
                        select: {
                            district: true,
                            city: true,
                            address: true
                        }
                    },
                    shipment: {
                        select: {
                            recipientAddress: true
                        }
                    },
                    orderItems: {
                        select: {
                            quantity: true,
                            unitPrice: true,
                            product: {
                                select: {
                                    costPrice: true,
                                    price: true,
                                    insideDhakaDeliveryCharge: true,
                                    outsideDhakaDeliveryCharge: true
                                }
                            }
                        }
                    }
                }
            }),
            prisma.accountTransaction.findMany({
                where: incomeWhere,
                select: {
                    amount: true
                }
            }),
            prisma.accountTransaction.findMany({
                where: expenseWhere,
                select: {
                    amount: true,
                    accountHead: {
                        select: {
                            title: true
                        }
                    }
                }
            }),
            prisma.saleReturn.aggregate({
                where: returnWhere,
                _sum: { refundAmount: true },
                _count: { id: true }
            }),
            prisma.contactUs.findFirst({
                select: {
                    address: true,
                    phone_number: true,
                    telephone: true,
                    primary_email: true
                }
            })
        ]);

        let totalSales = 0;
        let grossProductSales = 0;
        let totalDiscounts = 0;
        let totalShippingCollected = 0;
        let totalCOGS = 0;
        let totalShippingCost = 0;

        orders.forEach(o => {
            const saleAmt = parseFloat(o.grandTotal || o.totalAmount || 0);
            totalSales += saleAmt;
            const productAmt = parseFloat(o.totalAmount || 0);
            const discountAmt = parseFloat(o.discount || 0) + parseFloat(o.voucher_promo || 0);
            const shipAmt = parseFloat(o.shippingCost || 0);

            grossProductSales += productAmt;
            totalDiscounts += discountAmt;
            totalShippingCollected += shipAmt;

            const addrText = [
                o.shippingAddress?.district,
                o.shippingAddress?.city,
                o.shippingAddress?.address,
                o.shipment?.recipientAddress
            ].filter(Boolean).join(" ").toLowerCase();
            const isDhaka = addrText.includes("dhaka");

            let maxProductShipping = 0;
            if (o.orderItems && o.orderItems.length > 0) {
                o.orderItems.forEach(item => {
                    const unitCharge = isDhaka
                        ? parseFloat(item.product?.insideDhakaDeliveryCharge ?? 0)
                        : parseFloat(item.product?.outsideDhakaDeliveryCharge ?? 0);

                    if (unitCharge > maxProductShipping) {
                        maxProductShipping = unitCharge;
                    }

                    const qty = parseInt(item.quantity || 1);
                    const cost = parseFloat(item.product?.costPrice || 0);
                    const effectiveCost = cost > 0 ? cost : (parseFloat(item.unitPrice || 0) * 0.65);
                    totalCOGS += effectiveCost * qty;
                });
            }

            const orderShipping = parseFloat(o.shippingCost || 0) > 0
                ? parseFloat(o.shippingCost)
                : maxProductShipping;

            totalShippingCost += orderShipping;
        });

        const netProductSales = grossProductSales - totalDiscounts;
        const otherIncomeTotal = otherIncomes.reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);
        const totalRevenue = totalSales + otherIncomeTotal;

        const grossProfit = totalSales - totalShippingCost;
        const grossMarginPercent = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(2) : 0;

        const expensesByHead = {};
        let totalRecordedExpenses = 0;
        expenseTransactions.forEach(t => {
            const headName = t.accountHead?.title || "General Expenses";
            const amt = parseFloat(t.amount || 0);
            expensesByHead[headName] = (expensesByHead[headName] || 0) + amt;
            totalRecordedExpenses += amt;
        });

        expensesByHead["Shipping & Courier Charges"] = totalShippingCost;
        const totalExpenses = totalRecordedExpenses + totalShippingCost;
        const totalRefunds = parseFloat(returnsAgg._sum?.refundAmount || 0);

        const netProfit = totalRevenue - totalExpenses;
        const netMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

        const companyInfo = {
            name: "Ekhone",
            address: contactRecord?.address || "Dhaka, Bangladesh",
            phone: contactRecord?.phone_number || contactRecord?.telephone || "+8801700000000",
            email: contactRecord?.primary_email || "support@ekhone.com",
        };

        return successResponse(res, "Profit and loss report generated successfully", {
            period: { startDate, endDate },
            companyInfo,
            revenue: {
                totalSales: parseFloat(totalSales.toFixed(2)),
                grossProductSales: parseFloat(grossProductSales.toFixed(2)),
                discountsAndPromos: parseFloat(totalDiscounts.toFixed(2)),
                netProductSales: parseFloat(netProductSales.toFixed(2)),
                shippingIncome: parseFloat(totalShippingCollected.toFixed(2)),
                otherIncome: parseFloat(otherIncomeTotal.toFixed(2)),
                totalRevenue: parseFloat(totalRevenue.toFixed(2))
            },
            shippingCost: {
                totalShippingCost: parseFloat(totalShippingCost.toFixed(2)),
                orderCount: orders.length
            },
            cogs: {
                costOfGoodsSold: parseFloat(totalCOGS.toFixed(2)),
                itemsSoldOrderCount: orders.length
            },
            grossProfit: {
                amount: parseFloat(grossProfit.toFixed(2)),
                marginPercent: parseFloat(grossMarginPercent)
            },
            operatingExpenses: {
                breakdown: Object.entries(expensesByHead).map(([head, amount]) => ({
                    head,
                    amount: parseFloat(amount.toFixed(2))
                })),
                accountHeadExpenses: parseFloat(totalRecordedExpenses.toFixed(2)),
                shippingCost: parseFloat(totalShippingCost.toFixed(2)),
                total: parseFloat(totalExpenses.toFixed(2))
            },
            returnsAndLosses: {
                directRefunds: parseFloat(totalRefunds.toFixed(2)),
                returnCount: returnsAgg._count.id || 0
            },
            netProfit: {
                amount: parseFloat(netProfit.toFixed(2)),
                marginPercent: parseFloat(netMarginPercent)
            }
        });
    } catch (error) {
        console.error("getProfitAndLossReport error:", error);
        return errorResponse(res, "Failed to generate profit and loss report", 500, error.message);
    }
};

// ============================================================================
// 7. PRODUCT-WISE SALES REPORT
// ============================================================================

/**
 * GET /api/accounting/reports/product-wise-sales
 * Sales, unit cost, revenue, and gross profit by product
 */
exports.getProductWiseSalesReport = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search,
            categoryId,
            sortBy = "revenue",
            order = "desc"
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, parseInt(limit));
        const skip = (pageNum - 1) * limitNum;

        const { dateFilter, startDate, endDate } = parseDateFilter(req.query);

        // Fetch OrderItems within date filter (excluding cancelled orders)
        const itemWhere = {
            onlineOrder: {
                status: { not: "Cancelled" },
                ...(dateFilter ? { orderDate: dateFilter } : {})
            }
        };

        if (categoryId) {
            itemWhere.product = {
                subCategory: {
                    categoryId: parseInt(categoryId)
                }
            };
        }

        if (search) {
            itemWhere.product = {
                ...(itemWhere.product || {}),
                OR: [
                    { productName: { contains: search, mode: "insensitive" } },
                    { sku: { contains: search, mode: "insensitive" } }
                ]
            };
        }

        const orderItems = await prisma.orderItem.findMany({
            where: itemWhere,
            select: {
                productId: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
                product: {
                    select: {
                        id: true,
                        productName: true,
                        sku: true,
                        price: true,
                        costPrice: true,
                        subCategory: {
                            select: {
                                name: true,
                                category: { select: { name: true } }
                            }
                        }
                    }
                }
            }
        });

        // Group by product
        const productMap = {};
        orderItems.forEach(item => {
            const pId = item.productId;
            if (!productMap[pId]) {
                productMap[pId] = {
                    productId: pId,
                    productName: item.product?.productName || "Unknown Product",
                    sku: item.product?.sku || "N/A",
                    category: item.product?.subCategory?.category?.name || "General",
                    sellingPrice: parseFloat(item.product?.price || item.unitPrice || 0),
                    costPrice: parseFloat(item.product?.costPrice || 0),
                    unitsSold: 0,
                    totalRevenue: 0,
                    totalCost: 0,
                    grossProfit: 0
                };
            }

            const qty = parseInt(item.quantity || 1);
            const lineRev = parseFloat(item.lineTotal || (parseFloat(item.unitPrice || 0) * qty));
            const costPerUnit = productMap[pId].costPrice > 0 ? productMap[pId].costPrice : (parseFloat(item.unitPrice || 0) * 0.65);
            const lineCost = costPerUnit * qty;

            productMap[pId].unitsSold += qty;
            productMap[pId].totalRevenue += lineRev;
            productMap[pId].totalCost += lineCost;
            productMap[pId].grossProfit += (lineRev - lineCost);
        });

        let list = Object.values(productMap).map(p => ({
            ...p,
            totalRevenue: parseFloat(p.totalRevenue.toFixed(2)),
            totalCost: parseFloat(p.totalCost.toFixed(2)),
            grossProfit: parseFloat(p.grossProfit.toFixed(2)),
            profitMargin: p.totalRevenue > 0 ? parseFloat(((p.grossProfit / p.totalRevenue) * 100).toFixed(2)) : 0
        }));

        // Sorting
        if (sortBy === "quantity") {
            list.sort((a, b) => order === "asc" ? a.unitsSold - b.unitsSold : b.unitsSold - a.unitsSold);
        } else if (sortBy === "profit") {
            list.sort((a, b) => order === "asc" ? a.grossProfit - b.grossProfit : b.grossProfit - a.grossProfit);
        } else {
            list.sort((a, b) => order === "asc" ? a.totalRevenue - b.totalRevenue : b.totalRevenue - a.totalRevenue);
        }

        const totalItems = list.length;
        const paginatedList = list.slice(skip, skip + limitNum);

        const grandRevenue = list.reduce((acc, p) => acc + p.totalRevenue, 0);
        const grandProfit = list.reduce((acc, p) => acc + p.grossProfit, 0);
        const grandUnits = list.reduce((acc, p) => acc + p.unitsSold, 0);

        return successResponse(res, "Product-wise sales report retrieved", {
            products: paginatedList,
            summary: {
                totalRevenue: parseFloat(grandRevenue.toFixed(2)),
                totalGrossProfit: parseFloat(grandProfit.toFixed(2)),
                totalUnitsSold: grandUnits,
                totalProducts: totalItems
            },
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / limitNum),
                currentPage: pageNum,
                limit: limitNum
            }
        });
    } catch (error) {
        console.error("getProductWiseSalesReport error:", error);
        return errorResponse(res, "Failed to retrieve product-wise sales report", 500, error.message);
    }
};

// ============================================================================
// 8. DATE-WISE FINANCIAL REPORT
// ============================================================================

/**
 * GET /api/accounting/reports/date-wise
 * Daily aggregation of Sales, Collections, Expenses, Courier Charges, Returns and Net
 */
exports.getDateWiseReport = async (req, res) => {
    try {
        const { dateFilter, startDate, endDate } = parseDateFilter(req.query);

        // Fetch Orders
        const orderWhere = { status: { not: "Cancelled" } };
        if (dateFilter) orderWhere.orderDate = dateFilter;
        const orders = await prisma.onlineOrder.findMany({
            where: orderWhere,
            select: {
                id: true,
                orderDate: true,
                grandTotal: true,
                paidAmount: true
            }
        });

        // Fetch Payments
        const paymentWhere = {};
        if (dateFilter) paymentWhere.paymentDate = dateFilter;
        const payments = await prisma.payment.findMany({
            where: paymentWhere,
            select: {
                paymentAmount: true,
                paymentDate: true
            }
        });

        // Fetch Expenses
        const expWhere = { type: "EXPENSE" };
        if (dateFilter) expWhere.date = dateFilter;
        const expenses = await prisma.accountTransaction.findMany({
            where: expWhere,
            select: {
                amount: true,
                date: true
            }
        });

        // Group by Date string YYYY-MM-DD
        const dateMap = {};

        const getDateKey = d => new Date(d).toISOString().slice(0, 10);

        orders.forEach(o => {
            const k = getDateKey(o.orderDate);
            if (!dateMap[k]) {
                dateMap[k] = { date: k, orderCount: 0, sales: 0, collections: 0, expenses: 0, netFlow: 0 };
            }
            dateMap[k].orderCount += 1;
            dateMap[k].sales += parseFloat(o.grandTotal || 0);
            dateMap[k].collections += parseFloat(o.paidAmount || 0);
        });

        payments.forEach(p => {
            const k = getDateKey(p.paymentDate);
            if (!dateMap[k]) {
                dateMap[k] = { date: k, orderCount: 0, sales: 0, collections: 0, expenses: 0, netFlow: 0 };
            }
            // Use maximum of payment record or order paid to avoid double counting
            const amt = parseFloat(p.paymentAmount || 0);
            if (amt > dateMap[k].collections) {
                dateMap[k].collections = amt;
            }
        });

        expenses.forEach(e => {
            const k = getDateKey(e.date);
            if (!dateMap[k]) {
                dateMap[k] = { date: k, orderCount: 0, sales: 0, collections: 0, expenses: 0, netFlow: 0 };
            }
            dateMap[k].expenses += parseFloat(e.amount || 0);
        });

        const dailyList = Object.values(dateMap).map(d => {
            const netFlow = d.collections - d.expenses;
            return {
                date: d.date,
                orderCount: d.orderCount,
                sales: parseFloat(d.sales.toFixed(2)),
                collections: parseFloat(d.collections.toFixed(2)),
                expenses: parseFloat(d.expenses.toFixed(2)),
                netFlow: parseFloat(netFlow.toFixed(2))
            };
        }).sort((a, b) => b.date.localeCompare(a.date));

        const grandSales = dailyList.reduce((acc, d) => acc + d.sales, 0);
        const grandCollections = dailyList.reduce((acc, d) => acc + d.collections, 0);
        const grandExpenses = dailyList.reduce((acc, d) => acc + d.expenses, 0);
        const grandNet = grandCollections - grandExpenses;

        return successResponse(res, "Date-wise report retrieved successfully", {
            records: dailyList,
            summary: {
                totalSales: parseFloat(grandSales.toFixed(2)),
                totalCollections: parseFloat(grandCollections.toFixed(2)),
                totalExpenses: parseFloat(grandExpenses.toFixed(2)),
                netCashFlow: parseFloat(grandNet.toFixed(2))
            },
            filterApplied: { startDate, endDate }
        });
    } catch (error) {
        console.error("getDateWiseReport error:", error);
        return errorResponse(res, "Failed to retrieve date-wise report", 500, error.message);
    }
};

// ============================================================================
// 9. COURIER-WISE SALES REPORT (STEADFAST & PATHAO)
// ============================================================================

/**
 * GET /api/accounting/reports/courier-wise
 * Comparative courier financial report for Steadfast and Pathao
 */
exports.getCourierWiseSalesReport = async (req, res) => {
    try {
        const { dateFilter, startDate, endDate } = parseDateFilter(req.query);
        const { courier } = req.query;

        const where = {};
        if (dateFilter) where.createdAt = dateFilter;
        if (courier && courier !== "all") {
            where.courier = courier.toUpperCase();
        }

        const shipments = await prisma.shipment.findMany({
            where,
            include: {
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        orderDate: true,
                        grandTotal: true,
                        shippingCost: true,
                        customer: {
                            select: {
                                fullName: true,
                                phone: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Aggregation per courier
        const courierStats = {
            STEADFAST: {
                name: "Steadfast Courier",
                totalParcels: 0,
                delivered: 0,
                inTransit: 0,
                returned: 0,
                totalCodSent: 0,
                deliveredCodCollected: 0,
                pendingCod: 0,
                courierCharges: 0,
                netRealized: 0,
                successRate: 0,
                returnRate: 0
            },
            PATHAO: {
                name: "Pathao Courier",
                totalParcels: 0,
                delivered: 0,
                inTransit: 0,
                returned: 0,
                totalCodSent: 0,
                deliveredCodCollected: 0,
                pendingCod: 0,
                courierCharges: 0,
                netRealized: 0,
                successRate: 0,
                returnRate: 0
            }
        };

        const parcelList = [];

        shipments.forEach(s => {
            const cKey = (s.courier || "STEADFAST").toUpperCase();
            if (!courierStats[cKey]) {
                courierStats[cKey] = {
                    name: s.courier,
                    totalParcels: 0,
                    delivered: 0,
                    inTransit: 0,
                    returned: 0,
                    totalCodSent: 0,
                    deliveredCodCollected: 0,
                    pendingCod: 0,
                    courierCharges: 0,
                    netRealized: 0,
                    successRate: 0,
                    returnRate: 0
                };
            }

            const target = courierStats[cKey];
            target.totalParcels += 1;

            const codAmt = parseFloat(s.codAmount || s.order?.grandTotal || 0);
            target.totalCodSent += codAmt;

            // Compute shipment courier charges using own order shippingCost (no COD commission)
            let sCharge = parseFloat(s.courierCharge || 0);
            if (sCharge <= 0) {
                sCharge = parseFloat(s.order?.shippingCost || 0);
            }
            target.courierCharges += sCharge;

            const status = s.status;
            if (status === "Delivered") {
                target.delivered += 1;
                target.deliveredCodCollected += codAmt;
            } else if (status === "Returned") {
                target.returned += 1;
            } else {
                target.inTransit += 1;
                target.pendingCod += codAmt;
            }

            parcelList.push({
                id: s.id,
                trackingCode: s.trackingCode,
                orderNumber: s.order?.orderNumber,
                orderDate: s.order?.orderDate,
                recipientName: s.recipientName || s.order?.customer?.fullName,
                recipientPhone: s.recipientPhone || s.order?.customer?.phone,
                courier: cKey,
                codAmount: codAmt,
                courierCharge: sCharge,
                status: s.status,
                createdAt: s.createdAt
            });
        });

        // Compute rates and net realization
        Object.keys(courierStats).forEach(k => {
            const c = courierStats[k];
            c.netRealized = c.deliveredCodCollected - c.courierCharges;
            c.successRate = c.totalParcels > 0 ? parseFloat(((c.delivered / c.totalParcels) * 100).toFixed(2)) : 0;
            c.returnRate = c.totalParcels > 0 ? parseFloat(((c.returned / c.totalParcels) * 100).toFixed(2)) : 0;

            c.totalCodSent = parseFloat(c.totalCodSent.toFixed(2));
            c.deliveredCodCollected = parseFloat(c.deliveredCodCollected.toFixed(2));
            c.pendingCod = parseFloat(c.pendingCod.toFixed(2));
            c.courierCharges = parseFloat(c.courierCharges.toFixed(2));
            c.netRealized = parseFloat(c.netRealized.toFixed(2));
        });

        return successResponse(res, "Courier-wise sales report retrieved", {
            couriers: courierStats,
            shipments: parcelList.slice(0, 100), // First 100 parcels
            filterApplied: { startDate, endDate, courier: courier || "all" }
        });
    } catch (error) {
        console.error("getCourierWiseSalesReport error:", error);
        return errorResponse(res, "Failed to retrieve courier-wise sales report", 500, error.message);
    }
};
