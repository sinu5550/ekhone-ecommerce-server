const express = require('express');
const router = express.Router();
const {
    signUp,
    verifyOtp,
    login,
    logout,
    requestPasswordReset,
    updatePassword,
    getCurrentUser,
    refreshToken,
    socialAuth,
    resendOtp
} = require('../controllers/authController');


// Public routes
///api/auth - auth
router.post('/signup', signUp);
router.post('/resend-otp',resendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/request-password-reset', requestPasswordReset);
router.post('/refresh-token', refreshToken);
router.post('/social/:provider', socialAuth);

// Protected routes (require authentication)
router.post('/logout', logout);
router.put('/update-password', updatePassword);
router.get('/me', getCurrentUser);

module.exports = router;






