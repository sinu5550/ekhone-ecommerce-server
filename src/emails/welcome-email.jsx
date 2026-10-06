const React = require('react');
const { Html, Head, Body, Container, Section, Text, Hr } = require('@react-email/components');

const WelcomeEmail = ({ userEmail, dashboardUrl }) => {
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
                        'Welcome to Ekhone!'
                    )
                ),
                React.createElement(
                    Section,
                    { style: contentStyle },
                    React.createElement(
                        Text,
                        { style: greetingStyle },
                        'Hello and Welcome!'
                    ),
                    React.createElement(
                        Text,
                        { style: messageStyle },
                        'We\'re thrilled to have you join the Ekhone community! Your account has been successfully verified and you\'re all set to start exploring.'
                    ),
                    React.createElement(
                        Section,
                        { style: highlightBoxStyle },
                        React.createElement(
                            Text,
                            { style: highlightTitleStyle },
                            '✓ Your Account is Ready'
                        ),
                        React.createElement(
                            Text,
                            { style: highlightTextStyle },
                            `Email: ${userEmail}`
                        )
                    ),
                    React.createElement(
                        Text,
                        { style: sectionTitleStyle },
                        'What\'s Next?'
                    ),
                    React.createElement(
                        Section,
                        { style: featureListStyle },
                        React.createElement(
                            Text,
                            { style: featureItemStyle },
                            '• Browse our extensive product catalog'
                        ),
                        React.createElement(
                            Text,
                            { style: featureItemStyle },
                            '• Create your wishlist'
                        ),
                        React.createElement(
                            Text,
                            { style: featureItemStyle },
                            '• Enjoy exclusive member benefits'
                        ),
                        React.createElement(
                            Text,
                            { style: featureItemStyle },
                            '• Track your orders in real-time'
                        )
                    ),
                    React.createElement(
                        Section,
                        { style: buttonContainerStyle },
                        React.createElement(
                            'a',
                            {
                                href: dashboardUrl,
                                style: buttonStyle
                            },
                            'Go to Dashboard'
                        )
                    ),
                    React.createElement(
                        Text,
                        { style: messageStyle },
                        'Ekhone is dedicated to providing you the best e-commerce shopping experience with quality products and dependable service.'
                    )
                ),
                React.createElement(Hr, { style: hrStyle }),
                React.createElement(
                    Section,
                    { style: footerStyle },
                    React.createElement(
                        Text,
                        { style: footerTextStyle },
                        'Need help getting started? Feel free to reach out to our support team anytime.'
                    ),
                    React.createElement(
                        Text,
                        { style: footerTextStyle },
                        'Happy Shopping!'
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
    background: 'linear-gradient(135deg, #14b8a6 0%, #0891b2 100%)',
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
    fontSize: '32px',
    fontWeight: 'bold',
    margin: '0',
    textAlign: 'center'
};

const contentStyle = {
    padding: '40px 30px'
};

const greetingStyle = {
    fontSize: '20px',
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

const highlightBoxStyle = {
    backgroundColor: '#f0fdfa',
    border: '2px solid #14b8a6',
    borderRadius: '8px',
    padding: '20px',
    margin: '24px 0'
};

const highlightTitleStyle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#14b8a6',
    margin: '0 0 12px 0'
};

const highlightTextStyle = {
    fontSize: '16px',
    color: '#4b5563',
    margin: '4px 0'
};

const sectionTitleStyle = {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '32px 0 16px 0'
};

const featureListStyle = {
    margin: '0 0 32px 0'
};

const featureItemStyle = {
    fontSize: '16px',
    lineHeight: '28px',
    color: '#4b5563',
    margin: '8px 0',
    paddingLeft: '0'
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

module.exports = { WelcomeEmail };