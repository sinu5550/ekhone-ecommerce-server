const express = require('express');
const {
    signUp,
    resendOtp,
    verifyOtp,
    login,
    requestPasswordReset,
    refreshToken,
    logout,
    updatePassword,
    getCurrentUser } = require("../controllers/adminAuthController");
const router = express.Router();


// Public routes
///api/admin-auth - auth
router.post('/signup', signUp);
router.post('/resend-otp', resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/request-password-reset', requestPasswordReset);
router.post('/refresh-token', refreshToken);


// Protected routes (require authentication)
router.post('/logout', logout);
router.put('/update-password', updatePassword);
router.get('/me', getCurrentUser);

module.exports = router;






