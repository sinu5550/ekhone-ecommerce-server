const express = require('express');
const router = express.Router();
const {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    addCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress,
    getCustomerByEmail,
    getCustomerAddresses
} = require("../controllers/customerController");
const { authMiddleware } = require("../middlewares/authMiddleware");


router.post('/', createCustomer);
router.get('/', authMiddleware, getAllCustomers);
router.get('/email/:email', getCustomerByEmail);
router.get('/:id', authMiddleware, getCustomerById);
router.patch('/:id', authMiddleware, updateCustomer);
router.delete('/:id', authMiddleware, deleteCustomer);
// Get addresses for a customer
router.get('/:id/addresses', getCustomerAddresses);
router.post('/:id/addresses',  addCustomerAddress);
router.patch('/addresses/:addressId', authMiddleware, updateCustomerAddress);
router.delete('/addresses/:addressId', authMiddleware, deleteCustomerAddress);


module.exports = router;
