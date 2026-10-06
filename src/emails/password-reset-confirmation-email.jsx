const React = require('react');
const { Html, Head, Body, Container, Section, Text, Hr } = require('@react-email/components');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://ekhone.com').replace(/\/+$/, '');
const LOGO_URL = `${FRONTEND_URL}/ekhone.png`;

const PasswordResetConfirmationEmail = ({ userEmail, loginUrl }) => {
    return React.createElement(
        Html,
        null,
        React.createElement(
            Head,
            null,
            React.createElement('meta', { charSet: 'utf-8' }),
            React.createElement('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' })
        ),
        React.createElement(
            Body,
            { style: mainStyle },
            React.createElement(
                Container,
                { style: containerStyle },
                React.createElement(
                    Section,
                    { style: headerStyle },
                    React.createElement('img', {
                        src: LOGO_URL,
                        alt: 'Ekhone Logo',
                        style: logoStyle
                    }),
                    React.createElement(
                        Text,
                        { style: titleStyle },
                        '🔒 Password Reset Successful'
                    )
                ),
                React.createElement(
                    Section,
                    { style: contentStyle },
                    React.createElement(
                        Text,
                        { style: greetingStyle },
                        'Hello!'
                    ),
                    React.createElement(
                        Text,
                        { style: messageStyle },
                        'Your password has been successfully reset. You can now log in to your Ekhone account using your new password.'
                    ),
                    React.createElement(
                        Section,
                        { style: successBoxStyle },
                        React.createElement(
                            Text,
                            { style: successIconStyle },
                            '✓'
                        ),
                        React.createElement(
                            Text,
                            { style: successTitleStyle },
                            'Password Updated'
                        ),
                        React.createElement(
                            Text,
                            { style: successTextStyle },
                            `Account: ${userEmail}`
                        ),
                        React.createElement(
                            Text,
                            { style: successTextStyle },
                            `Updated: ${new Date().toLocaleString('en-US', {
                                dateStyle: 'full',
                                timeStyle: 'short'
                            })}`
                        )
                    ),
                    React.createElement(
                        Section,
                        { style: buttonContainerStyle },
                        React.createElement(
                            'a',
                            {
                                href: loginUrl,
                                style: buttonStyle
                            },
                            'Sign In Now'
                        )
                    ),
                    React.createElement(
                        Section,
                        { style: securityBoxStyle },
                        React.createElement(
                            Text,
                            { style: securityTitleStyle },
                            '🛡️ Security Notice'
                        ),
                        React.createElement(
                            Text,
                            { style: securityTextStyle },
                            'If you did not request this password reset, please contact our support team immediately. Your account security is important to us.'
                        )
                    ),
                    React.createElement(
                        Text,
                        { style: tipsTitle },
                        'Security Tips:'
                    ),
                    React.createElement(
                        Section,
                        { style: tipsListStyle },
                        React.createElement(
                            Text,
                            { style: tipItemStyle },
                            '• Never share your password with anyone'
                        ),
                        React.createElement(
                            Text,
                            { style: tipItemStyle },
                            '• Use a strong, unique password'
                        ),
                        React.createElement(
                            Text,
                            { style: tipItemStyle },
                            '• Enable two-factor authentication when available'
                        ),
                        React.createElement(
                            Text,
                            { style: tipItemStyle },
                            '• Change your password regularly'
                        )
                    )
                ),
                React.createElement(Hr, { style: hrStyle }),
                React.createElement(
                    Section,
                    { style: footerStyle },
                    React.createElement(
                        Text,
                        { style: footerTextStyle },
                        'If you need any assistance, our support team is here to help.'
                    ),
                    React.createElement(
                        Text,
                        { style: footerTextStyle },
                        'Best regards,'
                    ),
                    React.createElement(
                        Text,
                        { style: footerTextStyle },
                        'The Ekhone Team'
                    ),
                    React.createElement(
                        Text,
                        { style: disclaimerStyle },
                        '© 2026 Ekhone. All rights reserved.'
                    )
                )
            )
        )
    );
};

// Styles
const mainStyle = {
    backgroundColor: '#f6f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
    padding: '40px 0'
};

const containerStyle = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '0',
    maxWidth: '600px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
};

const headerStyle = {
    background: 'linear-gradient(135deg, #059669 0%, #14b8a6 100%)',
    padding: '40px 20px',
    textAlign: 'center'
};

const logoStyle = {
    width: '120px',
    height: 'auto',
    marginBottom: '20px'
};

const titleStyle = {
    color: '#ffffff',
    fontSize: '28px',
    fontWeight: 'bold',
    margin: '0',
    textAlign: 'center'
};

const contentStyle = {
    padding: '40px 30px'
};

const greetingStyle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 16px 0'
};

const messageStyle = {
    fontSize: '16px',
    lineHeight: '24px',
    color: '#4b5563',
    margin: '0 0 24px 0'
};

const successBoxStyle = {
    backgroundColor: '#ecfdf5',
    border: '2px solid #059669',
    borderRadius: '8px',
    padding: '24px',
    textAlign: 'center',
    margin: '24px 0'
};

const successIconStyle = {
    fontSize: '48px',
    color: '#059669',
    margin: '0 0 12px 0',
    display: 'block'
};

const successTitleStyle = {
    fontSize: '20px',
    fontWeight: '600',
    color: '#059669',
    margin: '0 0 12px 0'
};

const successTextStyle = {
    fontSize: '14px',
    color: '#4b5563',
    margin: '4px 0'
};

const buttonContainerStyle = {
    textAlign: 'center',
    margin: '32px 0'
};

const buttonStyle = {
    backgroundColor: '#14b8a6',
    color: '#ffffff',
    padding: '14px 40px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '16px',
    display: 'inline-block',
    boxShadow: '0 4px 6px rgba(20, 184, 166, 0.3)'
};

const securityBoxStyle = {
    backgroundColor: '#fef3c7',
    border: '2px solid #f59e0b',
    borderRadius: '8px',
    padding: '20px',
    margin: '24px 0'
};

const securityTitleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#d97706',
    margin: '0 0 8px 0'
};

const securityTextStyle = {
    fontSize: '14px',
    color: '#92400e',
    margin: '0',
    lineHeight: '20px'
};

const tipsTitle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '24px 0 12px 0'
};

const tipsListStyle = {
    margin: '0 0 24px 0'
};

const tipItemStyle = {
    fontSize: '14px',
    lineHeight: '24px',
    color: '#4b5563',
    margin: '4px 0'
};

const hrStyle = {
    borderColor: '#e5e7eb',
    margin: '32px 0'
};

const footerStyle = {
    padding: '0 30px 40px 30px'
};

const footerTextStyle = {
    fontSize: '16px',
    color: '#4b5563',
    margin: '4px 0'
};

const disclaimerStyle = {
    fontSize: '12px',
    color: '#9ca3af',
    margin: '20px 0 0 0',
    textAlign: 'center'
};

module.exports = { PasswordResetConfirmationEmail };