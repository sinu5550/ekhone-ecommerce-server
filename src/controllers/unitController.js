const prisma = require('../utils/db.js');
const { errorResponse, successResponse } = require("../utils/responseHandler");


const createUnit = async (req, res) => {
    try {
        const { name, shortName } = req.body;

        const newUnit = await prisma.unit.create({
            data: { name, shortName }
        });

        return successResponse(res, 'Unit created successfully', newUnit, 201);

    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};



const getAllUnits = async (req, res) => {
    try {
        const units = await prisma.unit.findMany({
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return successResponse(res, units);

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
}


const updateUnit = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const { name, shortName } = req.body;

        const updateedUnit = await prisma.unit.update({
            where: { id },
            data: { name, shortName }
        })

        return successResponse(res, 'Unit updated successfully', updateedUnit);

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


const deleteUnit = async (req, res) => {
    try {

        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, "Invalid ID format", 400);

        await prisma.unit.delete({ where: { id } })
        return successResponse(res, "Unit deleted successfully");

    } catch (error) {
        return errorResponse(res, error.message, 500);
    }

};


module.exports = {
    createUnit,
    getAllUnits,
    updateUnit,
    deleteUnit
}