const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase admin client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// Sign Up Controller
exports.signUp = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // 1. Check if email already exists in Supabase
        const { data: allUsers, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            return res.status(500).json({
                success: false,
                error: 'Server error'
            });
        }

        // 2. Find user with this email
        const existingUser = allUsers.users.find(user => user.email === email);

        // 3. If user exists AND IS VERIFIED → show error
        if (existingUser && existingUser.email_confirmed_at) {
            return res.status(400).json({
                success: false,
                error: 'Email already registered. Please login.'
            });
        }

        // 4. If user exists BUT IS NOT VERIFIED → DELETE IT
        if (existingUser && !existingUser.email_confirmed_at) {
            console.log('Deleting unverified user:', email);
            await supabase.auth.admin.deleteUser(existingUser.id);
        }

        // 5. Now create new user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: false,
            user_metadata: {
                full_name: name || ''
               
            }
        });

        if (authError) {
            return res.status(400).json({
                success: false,
                error: authError.message
            });
        }

        // 6. Send verification email
        try {
            await axios.post(
                `${process.env.API_URL}/api/emails`,
                {
                    type: 'verification',
                    email: email,
                    password: password,
                    isPasswordReset: false,
                    origin: req.headers.origin || process.env.ADMIN_FRONTEND_URL
                }
            );
        } catch (emailError) {
            // If email fails, delete the user
            await supabase.auth.admin.deleteUser(authData.user.id);

            return res.status(500).json({
                success: false,
                error: 'Failed to send verification email'
            });
        }

        // 7. Success response
        return res.status(201).json({
            success: true,
            message: 'Account created. Check email for verification.',
            data: {
                user: {
                    id: authData.user.id,
                    email: authData.user.email
                  
                }
            }
        });

    } catch (error) {
        console.error('SignUp error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};


// Add this NEW function after signUp function
exports.resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Send verification email again
        await axios.post(
            `${process.env.API_URL}/api/emails`,
            {
                type: 'verification',
                email: email,
                isPasswordReset: false
            }
        );

        return res.json({
            success: true,
            message: 'New verification code sent'
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        return res.status(500).json({ error: 'Failed to resend code' });
    }
};


// Verify OTP Controller
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp, isPasswordReset } = req.body;

        console.log('🔐 Verifying OTP for:', email, '| Type:', isPasswordReset ? 'password-reset' : 'signup');

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: 'Email and OTP are required'
            });
        }

        // Verify OTP with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: isPasswordReset ? 'recovery' : 'email'
        });

        if (error) {
            console.error('❌ OTP verification failed:', error.message);
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification code'
            });
        }

        console.log('✅ OTP verified successfully');

        // If it's not a password reset, send welcome email
        if (!isPasswordReset && data.user) {
            try {
                console.log('📧 Sending welcome email...');
                await axios.post(
                    `${process.env.API_URL}/api/emails`, 
                    {
                        type: 'welcome',
                        email: email,
                        origin: req.headers.origin || process.env.ADMIN_FRONTEND_URL
                    },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 5000
                    }
                );
                console.log('✅ Welcome email sent');
            } catch (emailError) {
                console.error('⚠️ Welcome email error:', emailError.message);
                // Continue even if welcome email fails
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Verification successful',
            data: {
                user: data.user,
                session: data.session
            }
        });

    } catch (error) {
        console.error('❌ Verify OTP error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Login Controller - UPDATED TO SUPPORT BOTH EMAIL
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                error: 'Password is required'
            });
        }

        let loginIdentifier = email;

        if (!loginIdentifier) {
            return res.status(400).json({
                success: false,
                error: 'Email  is required'
            });
        }

        // Sign in with Supabase using email and password
        const { data, error } = await supabase.auth.signInWithPassword({
            email: loginIdentifier,
            password: password
        });

        if (error) {
            console.error('❌ Login failed:', error.message);

            if (error.message.includes('Invalid login credentials')) {
                return res.status(401).json({
                    success: false,
                    error: email ? 'Invalid  password' : 'Invalid email or password'
                });
            }

            if (error.message.includes('Email not confirmed')) {
                return res.status(401).json({
                    success: false,
                    error: 'Please verify your email before logging in'
                });
            }

            return res.status(401).json({
                success: false,
                error: error.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                user: data.user,
                session: data.session
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Request Password Reset
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        // Send password reset email via your email service
        try {
            console.log('📧 Sending password reset email...');
            await axios.post(
                `${process.env.API_URL}/api/emails`,
                {
                    type: 'verification',
                    email: email,
                    isPasswordReset: true,
                    origin: req.headers.origin || process.env.ADMIN_FRONTEND_URL
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                }
            );

            console.log('✅ Password reset email sent');
        } catch (emailError) {
            console.error('❌ Password reset email failed:', emailError.response?.data || emailError.message);
            // Don't reveal if email exists or not for security
        }

        return res.status(200).json({
            success: true,
            message: 'If that email exists, a password reset code has been sent'
        });

    } catch (error) {
        console.error('❌ Password reset request error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Update Password
exports.updatePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const authHeader = req.headers.authorization;

        console.log('🔒 Password update requested');

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                error: 'New password is required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const token = authHeader.split(' ')[1];

        // Get user from token first
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        // Update user password
        const { data, error } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (error) {
            console.error('❌ Password update failed:', error);
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        console.log('✅ Password updated successfully');

        // Send confirmation email
        try {
            await axios.post(
                `${process.env.API_URL}/api/emails`, // FIXED: Changed from /api/resend to /api/emails
                {
                    type: 'password-reset-confirmation',
                    email: data.user.email,
                    origin: req.headers.origin || process.env.ADMIN_FRONTEND_URL
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000
                }
            );
        } catch (emailError) {
            console.error('⚠️ Confirmation email error:', emailError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('❌ Update password error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Logout Controller
exports.logout = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const token = authHeader.split(' ')[1];

        // Revoke the session
        const { error } = await supabase.auth.admin.signOut(token);

        if (error) {
            console.error('❌ Logout error:', error);
            // Return success anyway since client will clear tokens
        }

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('❌ Logout error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const token = authHeader.split(' ')[1];

        // Get user from token
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
        
        return res.status(200).json({ data: { user } });

    } catch (error) {
        console.error('❌ Get current user error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

// Refresh Token
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }

        const { data, error } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired refresh token'
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                session: data.session
            }
        });

    } catch (error) {
        console.error('❌ Refresh token error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

