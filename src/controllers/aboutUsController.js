// src/controllers/about.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Get All About Us data with their stats
const getAllAboutInfo = async (req, res) => {
    try {
        const aboutUs = await prisma.aboutUs.findMany({
            include: {
                aboutStats: true // Include related stats
            },
            orderBy: { createdAt: 'desc' },
        });

        return successResponse(res, aboutUs);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Update About Us info (using PATCH)
const updateAboutInfo = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const { title, sub_title, description, aboutStats } = req.body;

        // Check if About Us exists
        const existingAbout = await prisma.aboutUs.findUnique({
            where: { id },
            include: { aboutStats: true }
        });

        if (!existingAbout) {
            return errorResponse(res, 'About Us information not found', 404);
        }

        // Prepare update data for AboutUs
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (sub_title !== undefined) updateData.sub_title = sub_title;
        if (description !== undefined) updateData.description = description;

        // Update About Us main record
        const updatedAbout = await prisma.aboutUs.update({
            where: { id },
            data: updateData,
        });

        // Handle stats update if provided
        let updatedStats = existingAbout.aboutStats;
        if (aboutStats !== undefined && Array.isArray(aboutStats)) {
            // Delete existing stats
            await prisma.aboutStat.deleteMany({
                where: { aboutId: id }
            });

            // Create new stats if any
            if (aboutStats.length > 0) {
                await prisma.aboutStat.createMany({
                    data: aboutStats.map(stat => ({
                        aboutId: id,
                        label: stat.label,
                        value: parseInt(stat.value)
                    }))
                });
            }

            // Fetch updated stats
            updatedStats = await prisma.aboutStat.findMany({
                where: { aboutId: id }
            });
        }

        // Return complete updated data
        const result = {
            ...updatedAbout,
            aboutStats: updatedStats
        };

        return successResponse(res, 'About Us information updated successfully', result);
    } catch (error) {
        console.error('Update error:', error);
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    getAllAboutInfo,
    updateAboutInfo
};