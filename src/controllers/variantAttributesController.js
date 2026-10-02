const prisma = require('../utils/db.js');
const { errorResponse, successResponse } = require("../utils/responseHandler");


const createVariantAttribute = async (req, res) => {
    try {
        const { variant, values } = req.body;
        const newVariantAttribute = await prisma.variantAttributes.create({
            data: { variant, values }
        })
        return successResponse(res, 'Variant Attribute created successfully', newVariantAttribute, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


const getAllVariantAttribute = async (req, res) => {
    try {

        const variantAttributes = await prisma.variantAttributes.findMany({
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { createdAt: 'desc' }

        });
        return successResponse(res, variantAttributes);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


const updateVariantAttribute = async (req, res) => {
    try {

        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const { variant, values } = req.body;
        const updatedVariantAttribute = await prisma.variantAttributes.update({
            where: { id },
            data: { variant, values }
        })
        return successResponse(res, 'Variant Attribute updated successfully', updatedVariantAttribute);

    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


const deleteVariantAttribute = async (req, res) => {
    try {

        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        await prisma.variantAttributes.delete({
            where: { id }

        })
        return successResponse(res, 'Variant Attribute deleted successfully');

    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
}

module.exports = {
    createVariantAttribute,
    getAllVariantAttribute,
    updateVariantAttribute,
    deleteVariantAttribute
}

