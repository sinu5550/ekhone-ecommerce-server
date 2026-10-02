// src/controllers/ourClient.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Helper function to generate slug from name
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

// Helper function to ensure unique slug
const generateUniqueSlug = async (name, existingId = null) => {
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    let existingClient = await prisma.client.findUnique({
        where: { slug }
    });

    if (existingId && existingClient && existingClient.id === existingId) {
        return slug;
    }

    while (existingClient) {
        slug = `${baseSlug}-${counter}`;
        existingClient = await prisma.client.findUnique({
            where: { slug }
        });
        counter++;
    }

    return slug;
};

// Get All Clients
const getAllClients = async (req, res) => {
    try {
        const { industry, category, isActive } = req.query;

        const where = {};
        if (industry) where.industry = industry;
        if (category) where.category = category;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const clients = await prisma.client.findMany({
            where,
            include: {
                projects: {
                    include: { details: true },
                    orderBy: { date: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return successResponse(res, clients);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Get Client by ID
const getClientById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const client = await prisma.client.findUnique({
            where: { id },
            include: {
                projects: {
                    include: { details: true },
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!client) return errorResponse(res, 'Client not found', 404);
        return successResponse(res, client);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Get Client by Slug
const getClientBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const client = await prisma.client.findUnique({
            where: { slug },
            include: {
                projects: {
                    include: { details: true },
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!client) return errorResponse(res, 'Client not found', 404);
        return successResponse(res, client);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Create Client
const createClient = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            image,
            testimonials,
            industry,
            location,
            founded,
            websiteUrl,
            isActive,
            projects
        } = req.body;

        if (!name || !description || !category || !testimonials || !industry || !location || !founded) {
            return errorResponse(res, 'Missing required fields', 400);
        }

        const slug = await generateUniqueSlug(name);

        const data = {
            name,
            slug,
            description,
            image: image || null,
            category,
            testimonials,
            industry,
            location,
            founded: parseInt(founded),
            websiteUrl: websiteUrl || null,
            isActive: isActive !== undefined ? isActive : true
        };

        if (projects && projects.length > 0) {
            data.projects = {
                create: projects.map(project => ({
                    name: project.name,
                    images: project.images || [],
                    youtubeLink: project.youtubeLink || null,
                    description: project.description,
                    date: project.date ? new Date(project.date) : new Date(),
                    details: project.details?.length > 0 ? {
                        create: project.details.map(detail => ({
                            title: detail.title,
                            description: detail.description,
                            image: detail.image
                        }))
                    } : undefined
                }))
            };
        }

        const newClient = await prisma.client.create({
            data,
            include: {
                projects: { include: { details: true } }
            }
        });

        return successResponse(res, 'Client created successfully', newClient, 201);
    } catch (error) {
        console.error('Create client error:', error);
        return errorResponse(res, error.message, 400);
    }
};

// Update Client
const updateClient = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const {
            name,
            description,
            category,
            image,
            testimonials,
            industry,
            location,
            founded,
            websiteUrl,
            isActive,
            projects
        } = req.body;

        const existingClient = await prisma.client.findUnique({
            where: { id },
            include: {
                projects: { include: { details: true } }
            }
        });

        if (!existingClient) {
            return errorResponse(res, 'Client not found', 404);
        }

        const updateData = {
            description: description || existingClient.description,
            category: category || existingClient.category,
            testimonials: testimonials || existingClient.testimonials,
            industry: industry || existingClient.industry,
            location: location || existingClient.location,
            founded: founded ? parseInt(founded) : existingClient.founded,
            websiteUrl: websiteUrl !== undefined ? websiteUrl : existingClient.websiteUrl,
            isActive: isActive !== undefined ? isActive : existingClient.isActive
        };

        if (image !== undefined) updateData.image = image;

        if (name && name !== existingClient.name) {
            updateData.name = name;
            updateData.slug = await generateUniqueSlug(name, id);
        }

        if (projects !== undefined) {
            const existingProjectIds = existingClient.projects.map(p => p.id);
            const newProjectIds = projects.filter(p => p.id).map(p => parseInt(p.id));
            const projectsToDelete = existingProjectIds.filter(id => !newProjectIds.includes(id));

            for (const projectId of projectsToDelete) {
                await prisma.projectDetail.deleteMany({ where: { projectId } });
                await prisma.clientProject.delete({ where: { id: projectId } });
            }

            for (const project of projects) {
                if (project.id) {
                    const existingProject = existingClient.projects.find(p => p.id === project.id);
                    if (existingProject) {
                        await prisma.clientProject.update({
                            where: { id: parseInt(project.id) },
                            data: {
                                name: project.name,
                                images: project.images || existingProject.images || [],
                                youtubeLink: project.youtubeLink !== undefined ? project.youtubeLink : existingProject.youtubeLink,
                                description: project.description,
                                date: project.date ? new Date(project.date) : existingProject.date
                            }
                        });

                        if (project.details !== undefined) {
                            const existingDetailIds = existingProject.details.map(d => d.id);
                            const newDetailIds = project.details.filter(d => d.id).map(d => parseInt(d.id));
                            const detailsToDelete = existingDetailIds.filter(id => !newDetailIds.includes(id));

                            for (const detailId of detailsToDelete) {
                                await prisma.projectDetail.delete({ where: { id: detailId } });
                            }

                            for (const detail of project.details) {
                                if (detail.id) {
                                    await prisma.projectDetail.update({
                                        where: { id: parseInt(detail.id) },
                                        data: {
                                            title: detail.title,
                                            description: detail.description,
                                            image: detail.image
                                        }
                                    });
                                } else {
                                    await prisma.projectDetail.create({
                                        data: {
                                            title: detail.title,
                                            description: detail.description,
                                            image: detail.image,
                                            projectId: parseInt(project.id)
                                        }
                                    });
                                }
                            }
                        }
                    }
                } else {
                    const newProject = await prisma.clientProject.create({
                        data: {
                            name: project.name,
                            images: project.images || [],
                            youtubeLink: project.youtubeLink || null,
                            description: project.description,
                            date: project.date ? new Date(project.date) : new Date(),
                            clientId: id
                        }
                    });

                    if (project.details?.length > 0) {
                        for (const detail of project.details) {
                            await prisma.projectDetail.create({
                                data: {
                                    title: detail.title,
                                    description: detail.description,
                                    image: detail.image,
                                    projectId: newProject.id
                                }
                            });
                        }
                    }
                }
            }
        }

        const updatedClient = await prisma.client.update({
            where: { id },
            data: updateData,
            include: {
                projects: { include: { details: true } }
            }
        });

        return successResponse(res, 'Client updated successfully', updatedClient);
    } catch (error) {
        console.error('Update client error:', error);
        return errorResponse(res, error.message, 400);
    }
};

// Delete Client
const deleteClient = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const existingClient = await prisma.client.findUnique({
            where: { id }
        });

        if (!existingClient) {
            return errorResponse(res, 'Client not found', 404);
        }

        await prisma.client.delete({ where: { id } });
        return successResponse(res, 'Client deleted successfully');
    } catch (error) {
        console.error('Delete client error:', error);
        return errorResponse(res, error.message, 400);
    }
};

// Get Project by ID
const getProjectById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const project = await prisma.clientProject.findUnique({
            where: { id },
            include: {
                details: true,
                client: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        category: true,
                        location: true,
                        image: true
                    }
                }
            }
        });

        if (!project) return errorResponse(res, 'Project not found', 404);
        return successResponse(res, project);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Get all projects
const getAllProjects = async (req, res) => {
    try {
        const { clientId, category, minDate, maxDate } = req.query;
        const where = {};

        if (clientId) where.clientId = parseInt(clientId);
        if (category) where.client = { category };
        if (minDate || maxDate) {
            where.date = {};
            if (minDate) where.date.gte = new Date(minDate);
            if (maxDate) where.date.lte = new Date(maxDate);
        }

        const projects = await prisma.clientProject.findMany({
            where,
            include: {
                details: { orderBy: { id: 'asc' } },
                client: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        category: true,
                        industry: true,
                        location: true,
                        isActive: true,
                        image: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        const activeProjects = projects.filter(project => project.client.isActive === true);

        return successResponse(res, {
            total: projects.length,
            activeTotal: activeProjects.length,
            projects
        });
    } catch (error) {
        console.error('Get all projects error:', error);
        return errorResponse(res, error.message, 500);
    }
};

module.exports = {
    getAllClients,
    getClientById,
    getClientBySlug,
    getProjectById,
    getAllProjects,
    createClient,
    updateClient,
    deleteClient
};