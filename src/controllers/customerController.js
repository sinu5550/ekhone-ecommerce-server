const prisma = require('../utils/db.js');
const { generateNumber } = require("../utils/generateNumber.js");
const { errorResponse, successResponse } = require("../utils/responseHandler.js");

// ************ Customer Create ******************
const createCustomer = async (req, res) => {
    try {
        const customerCode = await generateNumber("CUSTOMER");

        const {
            fullName,
            email,
            phone,
            status = true,
            recipientName,
            phoneNumber,
            address,
            upazila,
            postalCode,
            district,
            division,
            city,
            country = "Bangladesh",
            type = "Home",
            isDefault = true
        } = req.body;

        // Check if email already exists (if provided)
        if (email) {
            const existingEmail = await prisma.customer.findUnique({
                where: { email }
            });
            if (existingEmail) {
                return errorResponse(res, "Email already exists", 409);
            }
        }

        // Step 1 — create customer
        const customer = await prisma.customer.create({
            data: {
                customerCode,
                fullName,
                email: email || null,
                phone,
                status,
            },
        });

        // Step 2 — create address if provided
        if (address && division && district && upazila) {
            await prisma.customerAddress.create({
                data: {
                    customerId: customer.id,
                    recipientName: recipientName || fullName,
                    phoneNumber: phoneNumber || phone,
                    address,
                    upazila,
                    postalCode,
                    district,
                    division,
                    city,
                    country,
                    type,
                    isDefault,
                },
            });
        }

        // Fetch the created customer with address
        const createdCustomer = await prisma.customer.findUnique({
            where: { id: customer.id },
            include: {
                customerAddresses: true
            }
        });

        return successResponse(res, "Customer created successfully", createdCustomer, 201);

    } catch (error) {
        console.error("Create customer error:", error);
        return errorResponse(res, error.message, 400);
    }
};

// ************ Get All Customers ******************
const getAllCustomers = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 20 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build where clause
        const where = {};

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { customerCode: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (status !== undefined) {
            where.status = status === 'true';
        }

        // Get total count
        const total = await prisma.customer.count({ where });

        // Get paginated customers
        const customers = await prisma.customer.findMany({
            where,
            include: {
                customerAddresses: true,
                _count: {
                    select: {
                        onlineOrders: true,
                        invoices: true,
                        payments: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: parseInt(limit),
        });

        return successResponse(res, {
            customers,
            pagination: {
                currentPage: parseInt(page),
                limit: parseInt(limit),
                totalItems: total,
                totalPages: Math.ceil(total / parseInt(limit)),
            }
        });

    } catch (error) {
        console.error("Get all customers error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Get Customer By Email ******************
const getCustomerByEmail = async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return errorResponse(res, "Email is required", 400);
        }

        // Validate email format (basic check)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return errorResponse(res, "Invalid email format", 400);
        }

        const customer = await prisma.customer.findUnique({
            where: { email },
            include: {
                customerAddresses: true,
                onlineOrders: {
                    take: 10,
                    orderBy: { createdAt: "desc" }
                },
                _count: {
                    select: {
                        onlineOrders: true,
                        invoices: true,
                        payments: true
                    }
                }
            }
        });

        // Return success even if customer not found (with null data)
        if (!customer) {
            return successResponse(res, null);
        }

        return successResponse(res, 'data fetch successfully', customer);

    } catch (error) {
        console.error("Get customer by email error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Get Customer By ID ******************
const getCustomerById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                customerAddresses: true,
                onlineOrders: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        orderItems: {
                            include: {
                                product: {
                                    select: { id: true, productName: true, images: true, price: true }
                                }
                            }
                        }
                    }
                },
                loyaltyPoints: true,
                _count: {
                    select: {
                        onlineOrders: true
                    }
                }
            }
        });

        if (!customer) {
            return errorResponse(res, "Customer not found", 404);
        }

        return successResponse(res, "Customer fetched successfully", customer);

    } catch (error) {
        console.error("Get customer by ID error:", error);
        return errorResponse(res, error.message, 500);
    }
};


// ************ Update Customer ******************
const updateCustomer = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        const { fullName, email, phone, status } = req.body;

        // Check if customer exists
        const existingCustomer = await prisma.customer.findUnique({
            where: { id }
        });

        if (!existingCustomer) {
            return errorResponse(res, "Customer not found", 404);
        }

        // Check for duplicate phone (excluding current customer)
        if (phone && phone !== existingCustomer.phone) {
            const duplicatePhone = await prisma.customer.findUnique({
                where: { phone }
            });
            if (duplicatePhone) {
                return errorResponse(res, "Phone number already exists", 409);
            }
        }

        // Check for duplicate email (excluding current customer)
        if (email && email !== existingCustomer.email) {
            const duplicateEmail = await prisma.customer.findUnique({
                where: { email }
            });
            if (duplicateEmail) {
                return errorResponse(res, "Email already exists", 409);
            }
        }

        const updated = await prisma.customer.update({
            where: { id },
            data: {
                fullName,
                email: email || null,
                phone,
                status
            },
            include: {
                customerAddresses: true
            }
        });

        return successResponse(res, "Customer updated successfully", updated);

    } catch (error) {
        console.error("Update customer error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Delete Customer ******************
const deleteCustomer = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        const existing = await prisma.customer.findUnique({ where: { id } });
        if (!existing) return errorResponse(res, "Customer not found", 404);

        // Check if customer has related records
        const hasOrders = await prisma.onlineOrder.count({ where: { customerId: id } });
        const hasInvoices = await prisma.invoice.count({ where: { customerId: id } });
        const hasPayments = await prisma.payment.count({ where: { customerId: id } });

        if (hasOrders > 0 || hasInvoices > 0 || hasPayments > 0) {
            return errorResponse(res, "Cannot delete customer with existing transactions. Consider deactivating instead.", 400);
        }

        await prisma.customer.delete({ where: { id } });

        return successResponse(res, "Customer deleted successfully");

    } catch (error) {
        console.error("Delete customer error:", error);
        return errorResponse(res, error.message, 400);
    }
};

// ************ Get Customer Addresses ******************
const getCustomerAddresses = async (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) {
            return errorResponse(res, "Invalid customer ID", 400);
        }

        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            select: { id: true }
        });

        if (!customer) {
            return errorResponse(res, "Customer not found", 404);
        }

        const addresses = await prisma.customerAddress.findMany({
            where: { customerId },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return successResponse(res, addresses);

    } catch (error) {
        console.error("Get customer addresses error:", error);
        return errorResponse(res, error.message, 500);
    }
};

// ************ Add Customer Address ******************
const addCustomerAddress = async (req, res) => {
    try {
        const customerId = parseInt(req.params.id);
        if (isNaN(customerId)) return errorResponse(res, "Invalid customer ID", 400);

        const {
            recipientName,
            phoneNumber,
            address,
            upazila,
            postalCode,
            district,
            division,
            city,
            country = "Bangladesh",
            type = "Home",
            isDefault = false
        } = req.body;

        // Validate required fields
        if (!recipientName || !phoneNumber || !address || !upazila || !district || !division) {
            return errorResponse(res, "recipientName, phoneNumber, address, upazila, district, and division are required", 400);
        }

        // Validate phone number format
        const phoneRegex = /^(?:\+88|01)?\d{9,11}$/;
        if (!phoneRegex.test(phoneNumber.trim().replace(/\s+/g, ''))) {
            return errorResponse(res, "Invalid Bangladeshi phone number format", 400);
        }

        // Check if customer exists
        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });

        if (!customer) {
            return errorResponse(res, "Customer not found", 404);
        }

        // If setting as default, update other addresses
        if (isDefault) {
            await prisma.customerAddress.updateMany({
                where: { customerId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const customerAddress = await prisma.customerAddress.create({
            data: {
                customerId,
                recipientName,
                phoneNumber,
                address,
                upazila,
                postalCode,
                district,
                division,
                city,
                country,
                type,
                isDefault
            }
        });

        return successResponse(res, "Address added successfully", customerAddress, 201);

    } catch (error) {
        console.error("Add address error:", error);
        return errorResponse(res, error.message, 400);
    }
};

// ************ Update Customer Address ******************
const updateCustomerAddress = async (req, res) => {
    try {
        const addressId = parseInt(req.params.addressId);
        if (isNaN(addressId)) return errorResponse(res, "Invalid address ID", 400);

        const {
            recipientName,
            phoneNumber,
            address,
            upazila,
            postalCode,
            district,
            division,
            city,
            country,
            type,
            isDefault
        } = req.body;

        // Validate required fields
        if (!recipientName || !phoneNumber || !address || !upazila || !district || !division) {
            return errorResponse(res, "recipientName, phoneNumber, address, upazila, district, and division are required", 400);
        }

        // Validate phone number format
        const phoneRegex = /^(?:\+88|01)?\d{9,11}$/;
        if (!phoneRegex.test(phoneNumber.trim().replace(/\s+/g, ''))) {
            return errorResponse(res, "Invalid Bangladeshi phone number format", 400);
        }

        // Get current address
        const currentAddress = await prisma.customerAddress.findUnique({
            where: { id: addressId }
        });

        if (!currentAddress) {
            return errorResponse(res, "Address not found", 404);
        }

        // If setting as default, update other addresses
        if (isDefault && !currentAddress.isDefault) {
            await prisma.customerAddress.updateMany({
                where: {
                    customerId: currentAddress.customerId,
                    isDefault: true
                },
                data: { isDefault: false }
            });
        }

        const updatedAddress = await prisma.customerAddress.update({
            where: { id: addressId },
            data: {
                recipientName,
                phoneNumber,
                address,
                upazila,
                postalCode,
                district,
                division,
                city,
                country,
                type,
                isDefault
            }
        });

        return successResponse(res, "Address updated successfully", updatedAddress);

    } catch (error) {
        console.error("Update address error:", error);
        return errorResponse(res, error.message, 400);
    }
};

// ************ Delete Customer Address ******************
const deleteCustomerAddress = async (req, res) => {
    try {
        const addressId = parseInt(req.params.addressId);
        if (isNaN(addressId)) return errorResponse(res, "Invalid address ID", 400);

        const address = await prisma.customerAddress.findUnique({
            where: { id: addressId }
        });

        if (!address) {
            return errorResponse(res, "Address not found", 404);
        }

        // Check if it's the last address
        const addressCount = await prisma.customerAddress.count({
            where: { customerId: address.customerId }
        });

        if (addressCount <= 1) {
            return errorResponse(res, "Cannot delete the last address", 400);
        }

        await prisma.customerAddress.delete({
            where: { id: addressId }
        });

        // If deleted address was default, set another as default
        if (address.isDefault) {
            const remainingAddress = await prisma.customerAddress.findFirst({
                where: { customerId: address.customerId }
            });

            if (remainingAddress) {
                await prisma.customerAddress.update({
                    where: { id: remainingAddress.id },
                    data: { isDefault: true }
                });
            }
        }

        return successResponse(res, "Address deleted successfully");

    } catch (error) {
        console.error("Delete address error:", error);
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    createCustomer,
    getAllCustomers,
    getCustomerByEmail,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    getCustomerAddresses,
    addCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress
};