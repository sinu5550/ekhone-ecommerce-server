const React = require('react');
const { Html, Head, Body, Container, Section, Text, Button, Hr, Img } = require('@react-email/components');

const VerificationEmail = ({ otp, isPasswordReset = false }) => {
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
                        src: 'https://res.cloudinary.com/dddwxyeod/image/upload/v1791266680/kxqzfzinzbnhecdcqxiq.png',
                        alt: 'Ekhone Logo',
                        style: logoStyle
                    }),
                    React.createElement(
                        Text,
                        { style: titleStyle },
                        isPasswordReset ? 'Reset Your Password' : 'Verify Your Email'
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
                        isPasswordReset
                            ? 'We received a request to reset your password. Use the verification code below to complete the process:'
                            : 'Thank you for signing up with Ekhone! Please use the verification code below to verify your email address:'
                    ),
                    React.createElement(
                        Section,
                        { style: otpContainerStyle },
                        React.createElement(
                            Text,
                            { style: otpStyle },
                            otp
                        )
                    ),
                    React.createElement(
                        Text,
                        { style: noteStyle },
                        'This code will expire in 10 minutes for security purposes.'
                    ),
                    React.createElement(
                        Text,
                        { style: messageStyle },
                        'If you didn\'t request this, please ignore this email or contact our support team.'
                    )
                ),
                React.createElement(Hr, { style: hrStyle }),
                React.createElement(
                    Section,
                    { style: footerStyle },
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
    backgroundColor: '#14b8a6',
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

const otpContainerStyle = {
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    padding: '24px',
    textAlign: 'center',
    margin: '32px 0',
    border: '2px dashed #14b8a6'
};

const otpStyle = {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#14b8a6',
    letterSpacing: '8px',
    margin: '0',
    textAlign: 'center',
    fontFamily: 'monospace'
};

const noteStyle = {
    fontSize: '14px',
    color: '#6b7280',
    margin: '24px 0',
    textAlign: 'center',
    fontStyle: 'italic'
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

module.exports = { VerificationEmail };