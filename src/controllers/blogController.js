// src/controllers/blogs.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Get All Blogs (always include sections)
const getAllBlogs = async (req, res) => {
    try {
        const blogs = await prisma.blog.findMany({
            orderBy: { publishDate: 'desc' },
            include: {
                sections: {
                    orderBy: { id: 'asc' }
                }
            }
        });

        return successResponse(res, blogs);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Get Blog by ID
const getBlogById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const blog = await prisma.blog.findUnique({
            where: { id },
            include: {
                sections: {
                    orderBy: { id: 'asc' }
                }
            }
        });

        if (!blog) return errorResponse(res, 'Blog not found', 404);

        return successResponse(res, blog);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

// Create Blog with Sections
const createBlog = async (req, res) => {
    try {
        const {
            title,
            publishDate,
            shortDescription,
            thumbnailImage,
            sections
        } = req.body;

        // Validate required fields
        if (!title || !publishDate || !shortDescription || !thumbnailImage) {
            return errorResponse(res, 'Missing required fields: title, publishDate, shortDescription, thumbnailImage', 400);
        }

        if (!sections || !Array.isArray(sections) || sections.length === 0) {
            return errorResponse(res, 'At least one section is required', 400);
        }

        // Create blog with sections
        const newBlog = await prisma.blog.create({
            data: {
                title,
                publishDate: new Date(publishDate),
                shortDescription,
                thumbnailImage,
                sections: {
                    create: sections.map(section => ({
                        heading: section.heading,
                        paragraphs: section.paragraphs,
                        image: section.image || ''
                    }))
                }
            },
            include: {
                sections: true
            }
        });

        return successResponse(res, 'Blog created successfully', newBlog, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Update Blog (Full update with sections)
const updateBlog = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const {
            title,
            publishDate,
            shortDescription,
            thumbnailImage,
            sections
        } = req.body;

        // Check if blog exists
        const existingBlog = await prisma.blog.findUnique({
            where: { id }
        });

        if (!existingBlog) return errorResponse(res, 'Blog not found', 404);

        // Update blog with transaction to handle sections
        const updatedBlog = await prisma.$transaction(async (prisma) => {
            // Update blog basic info
            const blog = await prisma.blog.update({
                where: { id },
                data: {
                    title,
                    publishDate: new Date(publishDate),
                    shortDescription,
                    thumbnailImage
                }
            });

            // Delete existing sections
            await prisma.blogSection.deleteMany({
                where: { blogId: id }
            });

            // Create new sections
            if (sections && Array.isArray(sections) && sections.length > 0) {
                await prisma.blogSection.createMany({
                    data: sections.map(section => ({
                        heading: section.heading,
                        paragraphs: section.paragraphs,
                        image: section.image || '',
                        blogId: id
                    }))
                });
            }

            // Return updated blog with sections
            return await prisma.blog.findUnique({
                where: { id },
                include: { sections: true }
            });
        });

        return successResponse(res, 'Blog updated successfully', updatedBlog);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Partial Update Blog (metadata only)
const patchBlog = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const {
            title,
            publishDate,
            shortDescription,
            thumbnailImage
        } = req.body;

        const existingBlog = await prisma.blog.findUnique({
            where: { id }
        });

        if (!existingBlog) return errorResponse(res, 'Blog not found', 404);

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (publishDate !== undefined) updateData.publishDate = new Date(publishDate);
        if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
        if (thumbnailImage !== undefined) updateData.thumbnailImage = thumbnailImage;

        const updatedBlog = await prisma.blog.update({
            where: { id },
            data: updateData,
            include: { sections: true }
        });

        return successResponse(res, 'Blog updated successfully', updatedBlog);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Add single section to existing blog
const addBlogSection = async (req, res) => {
    try {
        const blogId = parseInt(req.params.id);
        if (isNaN(blogId)) return errorResponse(res, 'Invalid ID format', 400);

        const { heading, paragraphs, image } = req.body;

        if (!heading || !paragraphs || !Array.isArray(paragraphs)) {
            return errorResponse(res, 'heading and paragraphs array are required', 400);
        }

        const existingBlog = await prisma.blog.findUnique({
            where: { id: blogId }
        });

        if (!existingBlog) return errorResponse(res, 'Blog not found', 404);

        const newSection = await prisma.blogSection.create({
            data: {
                heading,
                paragraphs,
                image: image || '',
                blogId
            }
        });

        return successResponse(res, 'Section added successfully', newSection, 201);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Update single section
const updateBlogSection = async (req, res) => {
    try {
        const sectionId = parseInt(req.params.sectionId);
        if (isNaN(sectionId)) return errorResponse(res, 'Invalid section ID format', 400);

        const { heading, paragraphs, image } = req.body;

        const existingSection = await prisma.blogSection.findUnique({
            where: { id: sectionId }
        });

        if (!existingSection) return errorResponse(res, 'Section not found', 404);

        const updateData = {};
        if (heading !== undefined) updateData.heading = heading;
        if (paragraphs !== undefined) updateData.paragraphs = paragraphs;
        if (image !== undefined) updateData.image = image;

        const updatedSection = await prisma.blogSection.update({
            where: { id: sectionId },
            data: updateData
        });

        return successResponse(res, 'Section updated successfully', updatedSection);
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Delete single section
const deleteBlogSection = async (req, res) => {
    try {
        const sectionId = parseInt(req.params.sectionId);
        if (isNaN(sectionId)) return errorResponse(res, 'Invalid section ID format', 400);

        const existingSection = await prisma.blogSection.findUnique({
            where: { id: sectionId }
        });

        if (!existingSection) return errorResponse(res, 'Section not found', 404);

        await prisma.blogSection.delete({
            where: { id: sectionId }
        });

        return successResponse(res, 'Section deleted successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

// Delete Blog
const deleteBlog = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return errorResponse(res, 'Invalid ID format', 400);

        const existingBlog = await prisma.blog.findUnique({
            where: { id }
        });

        if (!existingBlog) return errorResponse(res, 'Blog not found', 404);

        await prisma.blog.delete({
            where: { id }
        });

        return successResponse(res, 'Blog deleted successfully');
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

module.exports = {
    getAllBlogs,
    getBlogById,
    createBlog,
    updateBlog,
    patchBlog,
    addBlogSection,
    updateBlogSection,
    deleteBlogSection,
    deleteBlog
};