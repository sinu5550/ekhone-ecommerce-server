// src/controllers/EnquiryUs.controller.js

const prisma = require("../utils/db");
const {
    successResponse,
    errorResponse,
} = require("../utils/responseHandler");

// Create Enquiry
const createEnquiryUs = async (req, res) => {
    try {
        const {
            name,
            email,
            mobile,
            subject,
            selectedService,
            message,
            orderNumber,
        } = req.body;

        // Required field validation
        if (
            !name ||
            !email ||
            !mobile ||
            !subject ||
            !selectedService ||
            !message
        ) {
            return errorResponse(res, "All required fields must be provided.", 400);
        }

        const enquiry = await prisma.enquiryUs.create({
            data: {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                mobile: mobile.trim(),
                subject: subject.trim(),
                selectedService: selectedService.trim(),
                message: message.trim(),
                orderNumber: orderNumber?.trim() || null,
            },
        });

        return successResponse(
            res,
            "Enquiry submitted successfully.",
            enquiry,
            201
        );
    } catch (error) {
        console.error("Create Enquiry error:", error);
        return errorResponse(res, "Failed to submit enquiry.", 500);
    }
};

// Get All Enquiries
const getAllEnquiryUs = async (req, res) => {
    try {
        const enquiries = await prisma.enquiryUs.findMany({
            orderBy: {
                createdAt: "desc",
            },
        });

        return successResponse(res, enquiries);
    } catch (error) {
        console.error("Get Enquiries error:", error);
        return errorResponse(res, "Failed to retrieve enquiries.", 500);
    }
};

// Delete Enquiry
const deleteEnquiryUs = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id) || id <= 0) {
            return errorResponse(res, "Invalid ID format.", 400);
        }

        const enquiry = await prisma.enquiryUs.findUnique({
            where: { id },
        });

        if (!enquiry) {
            return errorResponse(res, "Enquiry not found.", 404);
        }

        await prisma.enquiryUs.delete({
            where: { id },
        });

        return successResponse(res, "Enquiry deleted successfully.");
    } catch (error) {
        console.error("Delete Enquiry error:", error);

        if (error.code === "P2025") {
            return errorResponse(res, "Enquiry not found.", 404);
        }

        return errorResponse(res, "Failed to delete enquiry.", 500);
    }
};

module.exports = {
    createEnquiryUs,
    getAllEnquiryUs,
    deleteEnquiryUs,
};