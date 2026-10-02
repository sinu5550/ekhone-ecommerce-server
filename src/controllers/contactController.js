// src/controllers/contact.controller.js
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Get All Contact Data (only first record since it's a singleton)
const getContactData = async (req, res) => {
    try {
        const contactData = await prisma.contactUs.findFirst();
        
        if (!contactData) {
            // Return default/empty structure if no data exists
            return successResponse(res, 'Contact data retrieved successfully', {
                id: null,
                title: '',
                image: '',
                address: '',
                google_map: '',
                phone_number: '',
                telephone: '',
                primary_email: '',
                secondary_email: '',
                description: '',
                facebook: '',
                linkedIn: '',
                youtube: '',
                instagram: '',
                twitter: '',
                createdAt: null,
                updatedAt: null
            });
        }

        return successResponse(res, 'Contact data retrieved successfully', contactData);
    } catch (error) {
        console.error('Get contact data error:', error);
        return errorResponse(res, 'Failed to retrieve contact data', 500);
    }
};

// Create Contact Data (only one record should exist)
const createContactData = async (req, res) => {
    try {
        const {
            title,
            image,
            address,
            google_map,
            phone_number,
            telephone,
            primary_email,
            secondary_email,
            description,
            facebook,
            linkedIn,
            youtube,
            instagram,
            twitter
        } = req.body;

        // Check if contact data already exists
        const existingContact = await prisma.contactUs.findFirst();
        
        if (existingContact) {
            return errorResponse(res, 'Contact data already exists. Use update instead.', 409);
        }

        const newContact = await prisma.contactUs.create({
            data: {
                title: title || '',
                image: image || '',
                address: address || '',
                google_map: google_map || '',
                phone_number: phone_number || '',
                telephone: telephone || '',
                primary_email: primary_email || '',
                secondary_email: secondary_email || '',
                description: description || '',
                facebook: facebook || '',
                linkedIn: linkedIn || '',
                youtube: youtube || '',
                instagram: instagram || '',
                twitter: twitter || ''
            },
        });

        return successResponse(res, 'Contact data created successfully', newContact, 201);
    } catch (error) {
        console.error('Create contact data error:', error);
        return errorResponse(res, 'Failed to create contact data', 500);
    }
};

// Update Contact Data
const updateContactData = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        const {
            title,
            image,
            address,
            google_map,
            phone_number,
            telephone,
            primary_email,
            secondary_email,
            description,
            facebook,
            linkedIn,
            youtube,
            instagram,
            twitter
        } = req.body;

        // Check if contact exists
        const existingContact = await prisma.contactUs.findUnique({
            where: { id }
        });

        if (!existingContact) return errorResponse(res, 'Contact data not found', 404);

        const updatedContact = await prisma.contactUs.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existingContact.title,
                image: image !== undefined ? image : existingContact.image,
                address: address !== undefined ? address : existingContact.address,
                google_map: google_map !== undefined ? google_map : existingContact.google_map,
                phone_number: phone_number !== undefined ? phone_number : existingContact.phone_number,
                telephone: telephone !== undefined ? telephone : existingContact.telephone,
                primary_email: primary_email !== undefined ? primary_email : existingContact.primary_email,
                secondary_email: secondary_email !== undefined ? secondary_email : existingContact.secondary_email,
                description: description !== undefined ? description : existingContact.description,
                facebook: facebook !== undefined ? facebook : existingContact.facebook,
                linkedIn: linkedIn !== undefined ? linkedIn : existingContact.linkedIn,
                youtube: youtube !== undefined ? youtube : existingContact.youtube,
                instagram: instagram !== undefined ? instagram : existingContact.instagram,
                twitter: twitter !== undefined ? twitter : existingContact.twitter
            },
        });

        return successResponse(res, 'Contact data updated successfully', updatedContact);
    } catch (error) {
        console.error('Update contact data error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Contact data not found', 404);
        }
        
        return errorResponse(res, 'Failed to update contact data', 500);
    }
};

// Delete Contact Data
const deleteContactData = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) return errorResponse(res, 'Invalid ID format', 400);

        // Check if contact exists
        const existingContact = await prisma.contactUs.findUnique({
            where: { id }
        });

        if (!existingContact) return errorResponse(res, 'Contact data not found', 404);

        await prisma.contactUs.delete({
            where: { id }
        });

        return successResponse(res, 'Contact data deleted successfully');
    } catch (error) {
        console.error('Delete contact data error:', error);
        
        if (error.code === 'P2025') {
            return errorResponse(res, 'Contact data not found', 404);
        }
        
        return errorResponse(res, 'Failed to delete contact data', 500);
    }
};

module.exports = {
    getContactData,
    createContactData,
    updateContactData,
    deleteContactData
};