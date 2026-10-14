// src/controllers/storeSettingController.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const DEFAULT_SETTINGS = {
  id: 1,
  siteTitle: 'Ekhone',
  logo: null,
  footerLogo: null,
  favicon: null,
  navbarLogoBg: false,
  footerLogoBg: false,
  primaryColor: '#F45116',
  secondaryColor: '#102D50'
};

// Get Store Settings (Public for Storefront and Admin)
const getStoreSettings = async (req, res) => {
  try {
    let settings = await prisma.storeSetting.findUnique({
      where: { id: 1 }
    });

    if (!settings) {
      settings = await prisma.storeSetting.create({
        data: DEFAULT_SETTINGS
      });
    }

    return successResponse(res, 'Store settings fetched successfully', settings);
  } catch (error) {
    console.error('Get store settings error:', error);
    return errorResponse(res, 'Failed to fetch store settings', 500);
  }
};

// Update Store Settings (Admin)
const updateStoreSettings = async (req, res) => {
  try {
    const {
      siteTitle,
      logo,
      footerLogo,
      favicon,
      navbarLogoBg,
      footerLogoBg,
      primaryColor,
      secondaryColor
    } = req.body;

    const dataToUpdate = {};
    if (siteTitle !== undefined) dataToUpdate.siteTitle = siteTitle.trim() || 'Ekhone';
    if (logo !== undefined) dataToUpdate.logo = logo || null;
    if (footerLogo !== undefined) dataToUpdate.footerLogo = footerLogo || null;
    if (favicon !== undefined) dataToUpdate.favicon = favicon || null;
    if (navbarLogoBg !== undefined) dataToUpdate.navbarLogoBg = Boolean(navbarLogoBg);
    if (footerLogoBg !== undefined) dataToUpdate.footerLogoBg = Boolean(footerLogoBg);
    if (primaryColor !== undefined) dataToUpdate.primaryColor = primaryColor || '#F45116';
    if (secondaryColor !== undefined) dataToUpdate.secondaryColor = secondaryColor || '#102D50';

    const updated = await prisma.storeSetting.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...DEFAULT_SETTINGS,
        ...dataToUpdate
      },
      update: dataToUpdate
    });

    return successResponse(res, 'Store settings updated successfully', updated);
  } catch (error) {
    console.error('Update store settings error:', error);
    return errorResponse(res, 'Failed to update store settings', 500);
  }
};

module.exports = {
  getStoreSettings,
  updateStoreSettings
};
