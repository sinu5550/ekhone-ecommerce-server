// src/controllers/about.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Get All About Us data with their stats
const getAlTeamMemberStatus = async (req, res) => {
    try {
        const teamMembersData = await prisma.teamStatus.findMany({
            include: {
                teamStat: true
            },
            orderBy: { createdAt: 'desc' },
        });

        return successResponse(res, teamMembersData);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};


const updateTeamMemberStatus = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const { title, description, teamStat } = req.body;

        // Check if Team Member exists
        const existingMember = await prisma.teamStatus.findUnique({
            where: { id },
            include: { teamStat: true }
        });

        if (!existingMember) {
            return errorResponse(res, 'Team member information not found', 404);
        }

        // Prepare update data for TeamStatus
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;

        // Update TeamStatus main record (FIXED: was aboutUs)
        const updatedMember = await prisma.teamStatus.update({
            where: { id },
            data: updateData,
        });

        // Handle stats update if provided
        let updatedStats = existingMember.teamStat;
        if (teamStat !== undefined && Array.isArray(teamStat)) {
            // Delete existing stats
            await prisma.teamStat.deleteMany({
                where: { teamStatusId: id } // FIXED: check your relation field name
            });

            // Create new stats if any
            if (teamStat.length > 0) {
                await prisma.teamStat.createMany({
                    data: teamStat.map(stat => ({
                        teamStatusId: id, // FIXED: should match your schema
                        label: stat.label,
                        value: parseInt(stat.value)
                    }))
                });
            }

            // Fetch updated stats
            updatedStats = await prisma.teamStat.findMany({
                where: { teamStatusId: id } // FIXED: use correct field name
            });
        }

        // Return complete updated data
        const result = {
            ...updatedMember,
            teamStat: updatedStats
        };

        return successResponse(res, 'Team member information updated successfully', result);
    } catch (error) {
        console.error('Update error:', error);
        return errorResponse(res, error.message, 400);
    }
};
module.exports = {
    getAlTeamMemberStatus,
    updateTeamMemberStatus
};