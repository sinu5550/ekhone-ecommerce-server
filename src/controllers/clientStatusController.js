// src/controllers/about.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Get All Client Status data with their stats
const getAllClientStatus = async (req, res) => {
    try {
        const clientStatusData = await prisma.ourClientStatus.findMany({
            include: {
                ourClientStat: true  
            },
            orderBy: { createdAt: 'desc' },
        });

        return successResponse(res, clientStatusData);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

const updateClientStatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const { title, description, ourClientStat } = req.body; 

        // Check if Client Status exists
        const existingClientStatus = await prisma.ourClientStatus.findUnique({
            where: { id },
            include: { ourClientStat: true }
        });

        if (!existingClientStatus) {
            return errorResponse(res, 'Client status information not found', 404);
        }

        // Prepare update data for OurClientStatus
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;

        // Update OurClientStatus main record
        const updatedClientStatus = await prisma.ourClientStatus.update({
            where: { id },
            data: updateData,
        });

        // Handle stats update if provided
        let updatedStats = existingClientStatus.ourClientStat;
        if (ourClientStat !== undefined && Array.isArray(ourClientStat)) {
            // Delete existing stats
            await prisma.ourClientStat.deleteMany({
                where: { clientStatusId: id }
            });

            // Create new stats if any
            if (ourClientStat.length > 0) {
                await prisma.ourClientStat.createMany({
                    data: ourClientStat.map(stat => ({
                        clientStatusId: id, 
                        label: stat.label,
                        value: parseInt(stat.value)
                    }))
                });
            }

            // Fetch updated stats
            updatedStats = await prisma.ourClientStat.findMany({
                where: { clientStatusId: id }
            });
        }

        // Return complete updated data
        const result = {
            ...updatedClientStatus,
            ourClientStat: updatedStats 
        };

        return successResponse(res, 'Client status information updated successfully', result);
    } catch (error) {
        console.error('Update error:', error);
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    getAllClientStatus,
    updateClientStatus
};