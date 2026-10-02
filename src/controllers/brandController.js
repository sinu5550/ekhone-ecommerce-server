const prisma = require('../utils/db.js');
const { errorResponse, successResponse } = require("../utils/responseHandler.js");

// ************ Brand Create ******************

const createBrand = async (req, res) => {
    try {
        const { name, image } = req.body;

        const newbrand = await prisma.brand.create({
            data: { name, image },
        });

        return successResponse(res, 'Brand created successfully', newbrand, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


// ************ Brands Get All ******************
const getAllBrands = async (req, res) => {
    try {
        const brands = await prisma.brand.findMany({
            include: {
                _count: {
                    select: { products: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, brands);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }

};


// ************ Brand Get By ID ******************
const getBrandById = async (req, res) => {

    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'invalid ID format', 400);

        const brand = await prisma.brand.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });
        return successResponse(res, brand);
    } catch (error) {
        return errorResponse(res, error.message, 500)
    }

};



const updateBrand = async (req, res) => {

    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);
        
        const { name, image, status } = req.body;

        const existingBrand = await prisma.brand.findUnique({ where: { id } });
        if (!existingBrand) return errorResponse(res, 'Brand not found', 404);

        const updatedBrand = await prisma.brand.update({
            where: { id },
            data: { name, image, status }
        });

        return successResponse(res, 'Update successfully', updatedBrand)

    } catch (error) {
        return errorResponse(res, error.message, 500)
    }

};

const deleteBrand = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const existing = await prisma.brand.findUnique({ where: { id } });
        if (!existing) return errorResponse(res, 'brand not found', 404);

        await prisma.brand.delete({ where: { id } });

        return successResponse(res, 'brand deleted successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};


module.exports = {
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand
};


