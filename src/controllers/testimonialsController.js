// src/controllers/testimonials.controller.js

const prisma = require("../utils/db");
const {
  successResponse,
  errorResponse,
} = require("../utils/responseHandler");

// Create Testimonial
const createTestimonial = async (req, res) => {
  try {
    const { name, image, rating, description } = req.body;

    if (!name || !rating || !description) {
      return errorResponse(
        res,
        "Name, rating, and description are required",
        400
      );
    }

    const newTestimonial = await prisma.testimonials.create({
      data: {
        name: name.trim(),
        image: image ? image.trim() : null,
        rating: Number(rating),
        description: description.trim(),
      },
    });

    return successResponse(
      res,
      "Testimonial created successfully",
      newTestimonial,
      201
    );
  } catch (error) {
    console.error("Create testimonial error:", error);
    return errorResponse(res, "Failed to create testimonial", 500);
  }
};

// Get All Testimonials
const getAllTestimonials = async (req, res) => {
  try {
    const testimonials = await prisma.testimonials.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return successResponse( res,testimonials  );
  } catch (error) {
    console.error("Get testimonials error:", error);
    return errorResponse(res, "Failed to retrieve testimonials", 500);
  }
};

// Get Testimonial By ID
const getTestimonialById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, "Invalid ID format", 400);
    }

    const testimonial = await prisma.testimonials.findUnique({
      where: { id },
    });

    if (!testimonial) {
      return errorResponse(res, "Testimonial not found", 404);
    }

    return successResponse(
      res,
      "Testimonial retrieved successfully",
      testimonial
    );
  } catch (error) {
    console.error("Get testimonial error:", error);
    return errorResponse(res, "Failed to retrieve testimonial", 500);
  }
};

// Update Testimonial
const updateTestimonial = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, "Invalid ID format", 400);
    }

    const { name, image, rating, description } = req.body;

    const existingTestimonial = await prisma.testimonials.findUnique({
      where: { id },
    });

    if (!existingTestimonial) {
      return errorResponse(res, "Testimonial not found", 404);
    }

    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (image !== undefined)
      updateData.image = image ? image.trim() : null;
    if (rating !== undefined) updateData.rating = Number(rating);
    if (description !== undefined)
      updateData.description = description.trim();

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, "No fields to update", 400);
    }

    const updatedTestimonial = await prisma.testimonials.update({
      where: { id },
      data: updateData,
    });

    return successResponse(
      res,
      "Testimonial updated successfully",
      updatedTestimonial
    );
  } catch (error) {
    console.error("Update testimonial error:", error);

    if (error.code === "P2025") {
      return errorResponse(res, "Testimonial not found", 404);
    }

    return errorResponse(res, "Failed to update testimonial", 500);
  }
};

// Delete Testimonial
const deleteTestimonial = async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id) || id <= 0) {
      return errorResponse(res, "Invalid ID format", 400);
    }

    const existingTestimonial = await prisma.testimonials.findUnique({
      where: { id },
    });

    if (!existingTestimonial) {
      return errorResponse(res, "Testimonial not found", 404);
    }

    await prisma.testimonials.delete({
      where: { id },
    });

    return successResponse(res, "Testimonial deleted successfully");
  } catch (error) {
    console.error("Delete testimonial error:", error);

    if (error.code === "P2025") {
      return errorResponse(res, "Testimonial not found", 404);
    }

    return errorResponse(res, "Failed to delete testimonial", 500);
  }
};

module.exports = {
  createTestimonial,
  getAllTestimonials,
  getTestimonialById,
  updateTestimonial,
  deleteTestimonial,
};