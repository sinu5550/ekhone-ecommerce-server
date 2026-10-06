// controllers/emailController.js (updated)
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const { render } = require('@react-email/render');
const PDFGenerator = require('../services/pdfGenerator.js'); // You'll need to create this

const resend = new Resend(process.env.RESEND_API_KEY);

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

const emailTemplates = {
    verification: require('../emails/verification-email.jsx').VerificationEmail,
    welcome: require('../emails/welcome-email.jsx').WelcomeEmail,
    passwordResetConfirmation: require('../emails/password-reset-confirmation-email.jsx').PasswordResetConfirmationEmail,
    orderConfirmation: require('../emails/order-confirmation-email.jsx')
};

const fromAddresses = {
    verification: 'Ahmed Siyan <info@ahmedsiyan.online>',
    welcome: 'Ahmed Siyan <info@ahmedsiyan.online>',
    passwordResetConfirmation: 'Ahmed Siyan <auth@ahmedsiyan.online>',
    orderConfirmation: 'Ahmed Siyan <info@ahmedsiyan.online>',
    bulk: 'Ahmed Siyan <noreply@ahmedsiyan.online>'
};


// Add this new function for sending order confirmation
exports.sendOrderConfirmation = async (req, res) => {
    try {
        const {
            // Order main details
            orderNumber,
            customer,
            shippingAddress,
            orderItems,
            orderDate,
            totalAmount,
            discount,
            voucher_promo,
            tax,
            shippingCost,
            grandTotal,
            paidAmount,
            dueAmount,
            note,
            paymentMethod,
            status
        } = req.body;

        // Validate required fields
        if (!orderNumber || !customer?.email || !orderItems || orderItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required order information',
                required: ['orderNumber', 'customer.email', 'orderItems']
            });
        }

        // Calculate estimated delivery (5 days from order date)
        const estimatedDelivery = new Date(new Date(orderDate).getTime() + 5 * 24 * 60 * 60 * 1000)
            .toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

        // Format products for PDF (ensure consistent structure)
        const productsForPdf = orderItems.map(item => ({
            name: item.product?.productName || 'Product',
            sku: item.sku || item.product?.sku || 'N/A',
            quantity: item.quantity,
            price: parseFloat(item.unitPrice || 0),
            lineTotal: parseFloat(item.lineTotal || 0)
        }));

        // Generate PDF receipt
        let pdfAttachment = null;
        try {
            console.log('Generating PDF for order:', orderNumber);
            const pdfBuffer = await PDFGenerator.generateOrderReceipt({
                orderNumber,
                customerName: customer?.fullName,
                customerEmail: customer?.email,
                customerPhone: customer?.phone,
                orderDate: new Date(orderDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                products: productsForPdf,
                subtotal: parseFloat(totalAmount || 0),
                discount: parseFloat(discount || 0),
                voucher_promo: parseFloat(voucher_promo || 0),
                tax: parseFloat(tax || 0),
                shippingCost: parseFloat(shippingCost || 0),
                grandTotal: parseFloat(grandTotal || 0),
                paidAmount: parseFloat(paidAmount || 0),
                dueAmount: parseFloat(dueAmount || 0),
                paymentMethod,
                shippingAddress: {
                    recipientName: shippingAddress?.recipientName,
                    phoneNumber: shippingAddress?.phoneNumber,
                    address: shippingAddress?.address,
                    city: shippingAddress?.city,
                    upazila: shippingAddress?.upazila,
                    district: shippingAddress?.district,
                    postalCode: shippingAddress?.postalCode,
                    country: shippingAddress?.country || 'Bangladesh'
                },
                note
            });

            pdfAttachment = {
                filename: `Ekhone_Order_${orderNumber}.pdf`,
                content: pdfBuffer.toString('base64'),
                contentType: 'application/pdf'
            };
            console.log('PDF generated successfully');
        } catch (pdfError) {
            console.error('Error generating PDF:', pdfError);
            // Continue without PDF if PDF generation fails
        }

        // Render email HTML with the correct field names
        const emailHtml = await render(
            emailTemplates.orderConfirmation({
                orderNumber,
                customer,
                shippingAddress,
                orderItems,
                orderDate,
                totalAmount: parseFloat(totalAmount || 0),
                discount: parseFloat(discount || 0),
                voucher_promo: parseFloat(voucher_promo || 0),
                tax: parseFloat(tax || 0),
                shippingCost: parseFloat(shippingCost || 0),
                grandTotal: parseFloat(grandTotal || 0),
                paidAmount: parseFloat(paidAmount || 0),
                dueAmount: parseFloat(dueAmount || 0),
                note,
                paymentMethod,
                status,
                estimatedDelivery
            })
        );

        // Send email
        const emailOptions = {
            from: fromAddresses.orderConfirmation,
            to: customer?.email,
            subject: `Order Confirmation #${orderNumber} - Ekhone`,
            html: emailHtml,
            replyTo: 'info@ekhone.com'
        };

        // Add PDF attachment if generated
        if (pdfAttachment) {
            emailOptions.attachments = [pdfAttachment];
        }

        const data = await resend.emails.send(emailOptions);

        return res.status(200).json({
            success: true,
            message: 'Order confirmation email sent successfully',
            orderNumber,
            emailId: data?.id,
            pdfAttached: !!pdfAttachment
        });

    } catch (error) {
        console.error('Error sending order confirmation:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to send order confirmation email',
            details: error.message
        });
    }
};

// Update your existing sendEmail function
exports.sendEmail = async (req, res) => {
    try {
        const { type, email, password, isPasswordReset, origin } = req.body;

        if (!email || !type) {
            return res.status(400).json({
                success: false,
                error: 'Email and type are required'
            });
        }

        let data;

        switch (type) {
            case 'verification':
                if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Service configuration error'
                    });
                }

                const { data: linkData, error } = await supabase.auth.admin.generateLink({
                    type: isPasswordReset ? 'recovery' : 'signup',
                    email,
                    password: isPasswordReset ? undefined : password,
                });

                if (error) {
                    console.error('❌ Supabase generateLink error:', error);
                    return res.status(400).json({
                        success: false,
                        error: error.message || 'Failed to generate verification link'
                    });
                }

                if (!linkData?.properties?.email_otp) {
                    return res.status(400).json({
                        success: false,
                        error: 'Failed to generate OTP'
                    });
                }

                if (!process.env.RESEND_API_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Email service configuration error'
                    });
                }

                const emailHtml = await render(
                    emailTemplates.verification({
                        otp: linkData.properties.email_otp,
                        isPasswordReset: !!isPasswordReset,
                    })
                );

                data = await resend.emails.send({
                    from: fromAddresses.verification,
                    to: email,
                    subject: isPasswordReset
                        ? 'Reset your password - Ekhone'
                        : 'Verify your email - Ekhone',
                    html: emailHtml,
                });
                break;

            case 'welcome':
                const dashboardUrl = origin
                    ? `${origin}/my-account`
                    : `${req.protocol}://${req.get('host')}/my-account`;

                const welcomeEmailHtml = await render(
                    emailTemplates.welcome({
                        userEmail: email,
                        dashboardUrl,
                    })
                );

                data = await resend.emails.send({
                    from: fromAddresses.welcome,
                    to: email,
                    subject: 'Welcome to Ekhone! 🎉',
                    html: welcomeEmailHtml,
                });
                break;

            case 'password-reset-confirmation':
                const loginUrl = origin
                    ? `${origin}/login`
                    : `${req.protocol}://${req.get('host')}/login`;

                const resetEmailHtml = await render(
                    emailTemplates.passwordResetConfirmation({
                        userEmail: email,
                        loginUrl,
                    })
                );

                data = await resend.emails.send({
                    from: fromAddresses.passwordResetConfirmation,
                    to: email,
                    subject: 'Your password has been reset - Ekhone',
                    html: resetEmailHtml,
                });
                break;

            case 'order-confirmation':
                // This case can call the sendOrderConfirmation function
                // or you can handle it here
                return await exports.sendOrderConfirmation(req, res);

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Invalid email type'
                });
        }

        return res.status(200).json({
            success: true,
            message: 'Email sent successfully'
        });
    } catch (error) {
        let statusCode = 500;
        if (error.message.includes('template') || error.message.includes('configuration')) {
            statusCode = 503;
        }

        return res.status(statusCode).json({
            success: false,
            error: 'Failed to send email'
        });
    }
};


exports.sendBulkEmail = async (req, res) => {
    try {
        const { emails, subject, html } = req.body;

        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid emails array is required'
            });
        }

        const results = await Promise.allSettled(
            emails.map(email =>
                resend.emails.send({
                    from: fromAddresses.bulk,
                    to: email,
                    subject: subject || 'Notification from Ekhone',
                    html: html || '<p>You have a new notification</p>',
                })
            )
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return res.status(200).json({
            success: true,
            message: `Sent ${successful} emails, ${failed} failed`,
            results: {
                successful,
                failed,
                total: emails.length
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Failed to send bulk emails'
        });
    }
};

exports.getEmailStatus = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Email ID is required'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Email status endpoint',
            id
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

