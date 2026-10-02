const prisma = require('../utils/db.js');
const { errorResponse, successResponse } = require("../utils/responseHandler");


const createWarranty = async (req, res) => {
    try {
        const { name, duration, period, description, status = true } = req.body;

        const newWarranty = await prisma.warranty.create({
            data: { name, duration, period, description, status }
        })
        return successResponse(res, newWarranty, "Warranty created successfully", 201);

    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const getAllWarranty = async (req, res) => {
    try {
        const warrantyData = await prisma.warranty.findMany({
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return successResponse(res, warrantyData);

    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

const updateWarranty = async (req, res) => {
    try {
        const id = parseInt(req.params.id)
        if (isNaN(id)) return errorResponse(res, "Invalid ID formate", 400)


        const { name, duration, period, description, status } = req.body;

        const updatedWarranty = await prisma.warranty.update({
            where: { id },
            data: { name, duration, period, description, status }
        })
        return successResponse(res, "Warranty update successfully", updatedWarranty)

    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


const deleteWarranty = async (req, res) => {
    try {

        const id = parseInt(req.params.id)
        if (isNaN(id)) return errorResponse(res, "Invalid ID formate", 400)

        await prisma.warranty.delete({ where: { id } })

        return successResponse(res, 'warranty deleted successfully');

    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


module.exports = {
    createWarranty,
    getAllWarranty,
    updateWarranty,
    deleteWarranty
}

