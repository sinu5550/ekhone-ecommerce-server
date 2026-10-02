// src/controllers/teamMember.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Create Team Member
const createTeamMember = async (req, res) => {
    try {
        const { name, role, image, department, description, socialLinks } = req.body;

        // Validate required fields
        if (!name || !role || !image || !department || !description) {
            return errorResponse(res, 'Name, role, image, department, and description are required', 400);
        }

        const newTeamMember = await prisma.teamMember.create({
            data: {
                name: name.trim(),
                role: role.trim(),
                image: image.trim(),
                department: department.trim(),
                description: description.trim(),
                socialLinks: socialLinks || null
            }
        });

        return successResponse(res, 'Team member created successfully', newTeamMember, 201);
    } catch (error) {
        console.error('Create team member error:', error);
        return errorResponse(res, 'Failed to create team member', 500);
    }
};

// Get All Team Members
const getAllTeamMember = async (req, res) => {
    try {
        const teamMembers = await prisma.teamMember.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        });

        return successResponse(res, teamMembers);
    } catch (error) {
        console.error('Get all team members error:', error);
        return errorResponse(res, 'Failed to retrieve team members', 500);
    }
};

// Get Team Member by ID
const getTeamMemberById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            return errorResponse(res, 'Invalid ID format', 400);
        }

        const teamMember = await prisma.teamMember.findUnique({
            where: { id }
        });

        if (!teamMember) {
            return errorResponse(res, 'Team member not found', 404);
        }

        return successResponse(res, 'Team member retrieved successfully', teamMember);
    } catch (error) {
        console.error('Get team member by ID error:', error);
        return errorResponse(res, 'Failed to retrieve team member', 500);
    }
};

// Update Team Member
const updateTeamMember = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            return errorResponse(res, 'Invalid ID format', 400);
        }

        const { name, role, image, department, description, socialLinks } = req.body;

        // Check if team member exists
        const existingTeamMember = await prisma.teamMember.findUnique({
            where: { id }
        });

        if (!existingTeamMember) {
            return errorResponse(res, 'Team member not found', 404);
        }

        // Prepare update data (only include fields that are provided)
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (role !== undefined) updateData.role = role.trim();
        if (image !== undefined) updateData.image = image.trim();
        if (department !== undefined) updateData.department = department.trim();
        if (description !== undefined) updateData.description = description.trim();
        if (socialLinks !== undefined) updateData.socialLinks = socialLinks;

        // If no fields to update
        if (Object.keys(updateData).length === 0) {
            return errorResponse(res, 'No fields to update', 400);
        }

        const updatedTeamMember = await prisma.teamMember.update({
            where: { id },
            data: updateData
        });

        return successResponse(res, 'Team member updated successfully', updatedTeamMember);
    } catch (error) {
        console.error('Update team member error:', error);

        if (error.code === 'P2025') {
            return errorResponse(res, 'Team member not found', 404);
        }

        return errorResponse(res, 'Failed to update team member', 500);
    }
};

// Delete Team Member
const deleteTeamMember = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            return errorResponse(res, 'Invalid ID format', 400);
        }

        // Check if team member exists
        const existingTeamMember = await prisma.teamMember.findUnique({
            where: { id }
        });

        if (!existingTeamMember) {
            return errorResponse(res, 'Team member not found', 404);
        }

        await prisma.teamMember.delete({
            where: { id }
        });

        return successResponse(res, 'Team member deleted successfully');
    } catch (error) {
        console.error('Delete team member error:', error);

        if (error.code === 'P2025') {
            return errorResponse(res, 'Team member not found', 404);
        }

        return errorResponse(res, 'Failed to delete team member', 500);
    }
};

module.exports = {
    createTeamMember,
    getAllTeamMember,
    getTeamMemberById,
    updateTeamMember,
    deleteTeamMember
};