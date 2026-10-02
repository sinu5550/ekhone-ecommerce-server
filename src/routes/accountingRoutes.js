const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');

// Account Heads
router.get('/heads', accountingController.getAccountHeads);
router.post('/heads', accountingController.createAccountHead);
router.put('/heads/:id', accountingController.updateAccountHead);
router.delete('/heads/:id', accountingController.deleteAccountHead);
router.post('/heads/seed-defaults', accountingController.seedDefaultHeads);

// Transactions (Income & Expense)
router.get('/transactions', accountingController.getTransactions);
router.post('/transactions', accountingController.createTransaction);
router.get('/transactions/:id', accountingController.getTransactionById);
router.put('/transactions/:id', accountingController.updateTransaction);
router.delete('/transactions/:id', accountingController.deleteTransaction);

// Dashboard KPIs
router.get('/dashboard-kpis', accountingController.getDashboardKPIs);

// Reports
router.get('/reports/head-wise-expenses', accountingController.getHeadWiseExpenses);
router.get('/reports/sales-collection', accountingController.getSalesAndCollectionReport);
router.get('/reports/profit-and-loss', accountingController.getProfitAndLossReport);
router.get('/reports/product-wise-sales', accountingController.getProductWiseSalesReport);
router.get('/reports/date-wise', accountingController.getDateWiseReport);
router.get('/reports/courier-wise', accountingController.getCourierWiseSalesReport);

module.exports = router;
