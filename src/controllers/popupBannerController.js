// src/controllers/popupBannerController.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Get active popup banner (Public for storefront)
const getActivePopupBanner = async (req, res) => {
  try {
    const banner = await prisma.popupBanner.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    return successResponse(res, 'Active popup banner fetched successfully', banner || null);
  } catch (error) {
    console.error('Get active popup banner error:', error);
    return errorResponse(res, 'Failed to fetch popup banner', 500);
  }
};

// Get all popup banners (Admin)
const getAllPopupBanners = async (req, res) => {
  try {
    const banners = await prisma.popupBanner.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return successResponse(res, 'Popup banners fetched successfully', banners);
  } catch (error) {
    console.error('Get all popup banners error:', error);
    return errorResponse(res, 'Failed to fetch popup banners', 500);
  }
};

// Create or update popup banner (Admin)
const savePopupBanner = async (req, res) => {
  try {
    const { id, image, link, title, isActive = true } = req.body;

    if (!image) {
      return errorResponse(res, 'Image URL is required', 400);
    }

    let banner;
    if (id) {
      banner = await prisma.popupBanner.update({
        where: { id: parseInt(id) },
        data: {
          image,
          link: link || null,
          title: title || null,
          isActive: Boolean(isActive)
        }
      });
    } else {
      // If setting this active, set other active banners to false
      if (isActive) {
        await prisma.popupBanner.updateMany({
          data: { isActive: false }
        });
      }
      banner = await prisma.popupBanner.create({
        data: {
          image,
          link: link || null,
          title: title || null,
          isActive: Boolean(isActive)
        }
      });
    }

    return successResponse(res, 'Popup banner saved successfully', banner, 201);
  } catch (error) {
    console.error('Save popup banner error:', error);
    return errorResponse(res, 'Failed to save popup banner', 500);
  }
};

// Toggle banner active status (Admin)
const togglePopupBannerStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.popupBanner.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Banner not found', 404);

    const newStatus = !existing.isActive;

    // If activating, deactivate others
    if (newStatus) {
      await prisma.popupBanner.updateMany({
        where: { id: { not: id } },
        data: { isActive: false }
      });
    }

    const updated = await prisma.popupBanner.update({
      where: { id },
      data: { isActive: newStatus }
    });

    return successResponse(res, `Banner ${newStatus ? 'activated' : 'deactivated'} successfully`, updated);
  } catch (error) {
    console.error('Toggle status error:', error);
    return errorResponse(res, 'Failed to toggle status', 500);
  }
};

// Delete banner (Admin)
const deletePopupBanner = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.popupBanner.delete({ where: { id } });
    return successResponse(res, 'Popup banner deleted successfully');
  } catch (error) {
    console.error('Delete popup banner error:', error);
    return errorResponse(res, 'Failed to delete popup banner', 500);
  }
};

module.exports = {
  getActivePopupBanner,
  getAllPopupBanners,
  savePopupBanner,
  togglePopupBannerStatus,
  deletePopupBanner
};
