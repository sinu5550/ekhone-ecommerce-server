const React = require('react');
const { Html, Head, Body, Container, Section, Text, Hr, Row, Column } = require('@react-email/components');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://ekhone.com').replace(/\/+$/, '');
const LOGO_URL = `${FRONTEND_URL}/ekhone.png`;

const OrderConfirmationEmail = ({
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
}) => {

    // Format date
    const formattedOrderDate = new Date(orderDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Calculate estimated delivery (5 days from order date)
    const estimatedDelivery = new Date(new Date(orderDate).getTime() + 5 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

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

                // Header Section
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
                        'Thank You for Your Order!'
                    ),
                    React.createElement(
                        Text,
                        { style: headerSubtitleStyle },
                        `Order #${orderNumber}`
                    )
                ),

                // Content Section
                React.createElement(
                    Section,
                    { style: contentStyle },

                    // Greeting
                    React.createElement(
                        Text,
                        { style: greetingStyle },
                        `Hi ${customer?.fullName || 'Valued Customer'},`
                    ),
                    React.createElement(
                        Text,
                        { style: messageStyle },
                        "We've received your order and it's being processed. You'll receive a shipping confirmation once your items are on their way."
                    ),

                    // Order Info Box
                    React.createElement(
                        Section,
                        { style: orderInfoBoxStyle },
                        React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                null,
                                React.createElement(
                                    Text,
                                    { style: orderInfoLabelStyle },
                                    'Order Date:'
                                ),
                                React.createElement(
                                    Text,
                                    { style: orderInfoValueStyle },
                                    formattedOrderDate
                                )
                            ),
                            React.createElement(
                                Column,
                                null,
                                React.createElement(
                                    Text,
                                    { style: orderInfoLabelStyle },
                                    'Estimated Delivery:'
                                ),
                                React.createElement(
                                    Text,
                                    { style: orderInfoValueStyle },
                                    estimatedDelivery
                                )
                            )
                        ),
                        React.createElement(
                            Row,
                            { style: { marginTop: '15px' } },
                            React.createElement(
                                Column,
                                null,
                                React.createElement(
                                    Text,
                                    { style: orderInfoLabelStyle },
                                    'Payment Method:'
                                ),
                                React.createElement(
                                    Text,
                                    { style: orderInfoValueStyle },
                                    paymentMethod || 'Not specified'
                                )
                            ),
                            React.createElement(
                                Column,
                                null,
                                React.createElement(
                                    Text,
                                    { style: orderInfoLabelStyle },
                                    'Order Status:'
                                ),
                                React.createElement(
                                    Text,
                                    { style: { ...orderInfoValueStyle, color: '#14b8a6' } },
                                    status || 'Confirmed'
                                )
                            )
                        )
                    ),

                    // Order Items Section
                    React.createElement(
                        Text,
                        { style: sectionTitleStyle },
                        'Order Summary'
                    ),

                    // Table Header
                    React.createElement(
                        Section,
                        { style: tableHeaderStyle },
                        React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '50%' } },
                                React.createElement(
                                    Text,
                                    { style: tableHeaderTextStyle },
                                    'Product'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '15%' } },
                                React.createElement(
                                    Text,
                                    { style: tableHeaderTextStyle },
                                    'SKU'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '10%', textAlign: 'center' } },
                                React.createElement(
                                    Text,
                                    { style: tableHeaderTextStyle },
                                    'Qty'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '25%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: tableHeaderTextStyle },
                                    'Price'
                                )
                            )
                        )
                    ),

                    // Product Items
                    ...(orderItems || []).map((item, index) =>
                        React.createElement(
                            Section,
                            {
                                key: item.id || index,
                                style: index === orderItems.length - 1 ? lastItemStyle : itemStyle
                            },
                            React.createElement(
                                Row,
                                null,
                                React.createElement(
                                    Column,
                                    { style: { width: '50%' } },
                                    React.createElement(
                                        Text,
                                        { style: productNameStyle },
                                        item.product?.productName || 'Product'
                                    )
                                ),
                                React.createElement(
                                    Column,
                                    { style: { width: '15%' } },
                                    React.createElement(
                                        Text,
                                        { style: itemTextStyle },
                                        item.sku || item.product?.sku || 'N/A'
                                    )
                                ),
                                React.createElement(
                                    Column,
                                    { style: { width: '10%', textAlign: 'center' } },
                                    React.createElement(
                                        Text,
                                        { style: itemTextStyle },
                                        item.quantity
                                    )
                                ),
                                React.createElement(
                                    Column,
                                    { style: { width: '25%', textAlign: 'right' } },
                                    React.createElement(
                                        Text,
                                        { style: itemTextStyle },
                                        `৳${parseFloat(item.unitPrice || 0).toFixed(2)}`
                                    )
                                )
                            )
                        )
                    ),

                    // Price Breakdown
                    React.createElement(
                        Section,
                        { style: priceBreakdownStyle },

                        // Subtotal (totalAmount)
                        React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: priceLabelStyle },
                                    'Subtotal:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: priceValueStyle },
                                    `৳${parseFloat(totalAmount || 0).toFixed(2)}`
                                )
                            )
                        ),

                        // Discount
                        parseFloat(discount || 0) > 0 && React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: priceLabelStyle },
                                    'Discount:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: promoDiscountStyle },
                                    `-৳${parseFloat(discount).toFixed(2)}`
                                )
                            )
                        ),

                        // Voucher/Promo
                        parseFloat(voucher_promo || 0) > 0 && React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: priceLabelStyle },
                                    note?.includes('Coupon Code') ? 'Coupon Discount:' : 'Voucher Discount:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: promoDiscountStyle },
                                    `-৳${parseFloat(voucher_promo).toFixed(2)}`
                                )
                            )
                        ),

                        // Tax
                        parseFloat(tax || 0) > 0 && React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: priceLabelStyle },
                                    'Tax:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: priceValueStyle },
                                    `৳${parseFloat(tax).toFixed(2)}`
                                )
                            )
                        ),

                        // Shipping Cost
                        React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: priceLabelStyle },
                                    'Shipping:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: priceValueStyle },
                                    parseFloat(shippingCost || 0) === 0 ? 'Free' : `৳${parseFloat(shippingCost).toFixed(2)}`
                                )
                            )
                        ),

                        React.createElement(Hr, { style: hrStyle }),

                        // Grand Total
                        React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: totalLabelStyle },
                                    'Grand Total:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: totalValueStyle },
                                    `৳${parseFloat(grandTotal || 0).toFixed(2)}`
                                )
                            )
                        ),

                        // Payment Status
                        React.createElement(
                            Row,
                            { style: { marginTop: '15px' } },
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: priceLabelStyle },
                                    'Paid Amount:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: priceValueStyle },
                                    `৳${parseFloat(paidAmount || 0).toFixed(2)}`
                                )
                            )
                        ),

                        parseFloat(dueAmount || 0) > 0 && React.createElement(
                            Row,
                            null,
                            React.createElement(
                                Column,
                                { style: { width: '70%' } },
                                React.createElement(
                                    Text,
                                    { style: { ...priceLabelStyle, color: '#dc2626' } },
                                    'Due Amount:'
                                )
                            ),
                            React.createElement(
                                Column,
                                { style: { width: '30%', textAlign: 'right' } },
                                React.createElement(
                                    Text,
                                    { style: { ...priceValueStyle, color: '#dc2626', fontWeight: '600' } },
                                    `৳${parseFloat(dueAmount).toFixed(2)}`
                                )
                            )
                        )
                    ),

                    // Billing & Shipping Address
                    React.createElement(
                        Row,
                        { style: addressRowStyle },
                        React.createElement(
                            Column,
                            { style: { width: '48%' } },
                            React.createElement(
                                Text,
                                { style: addressTitleStyle },
                                'Shipping Address'
                            ),
                            React.createElement(
                                Text,
                                { style: addressTextStyle },
                                ...(() => {
                                    const elements = [];
                                    const name = shippingAddress?.recipientName || customer?.fullName;
                                    if (name) elements.push(name, React.createElement('br'));
                                    
                                    if (shippingAddress?.address) {
                                        elements.push(shippingAddress.address, React.createElement('br'));
                                    }

                                    // City / Upazila line
                                    const cityUpazila = [shippingAddress?.upazila, shippingAddress?.city]
                                        .filter(Boolean)
                                        .filter((v, i, arr) => arr.indexOf(v) === i)
                                        .join(', ');
                                    if (cityUpazila) elements.push(cityUpazila, React.createElement('br'));

                                    // District / Postal code / Division line
                                    const distDiv = [shippingAddress?.district, shippingAddress?.division]
                                        .filter(Boolean)
                                        .filter(v => v !== shippingAddress?.city && v !== shippingAddress?.upazila)
                                        .filter((v, i, arr) => arr.indexOf(v) === i)
                                        .join(', ');
                                    const postal = shippingAddress?.postalCode ? ` - ${shippingAddress.postalCode}` : '';
                                    if (distDiv || postal) {
                                        elements.push(`${distDiv}${postal}`, React.createElement('br'));
                                    }

                                    elements.push(shippingAddress?.country || 'Bangladesh', React.createElement('br'), React.createElement('br'));
                                    elements.push(React.createElement('strong', null, 'Phone: '), shippingAddress?.phoneNumber || customer?.phone || 'Not provided');
                                    return elements;
                                })()
                            )
                        ),
                        React.createElement(
                            Column,
                            { style: { width: '48%' } },
                            React.createElement(
                                Text,
                                { style: addressTitleStyle },
                                'Customer Information'
                            ),
                            React.createElement(
                                Text,
                                { style: addressTextStyle },
                                React.createElement('strong', null, 'Name: '),
                                customer?.fullName,
                                React.createElement('br'),
                                React.createElement('strong', null, 'Email: '),
                                customer?.email,
                                React.createElement('br'),
                                React.createElement('strong', null, 'Phone: '),
                                customer?.phone || 'Not provided'
                            )
                        )
                    ),


                    // Buttons
                    React.createElement(
                        Section,
                        { style: buttonContainerStyle },
                        React.createElement(
                            'a',
                            {
                                href: `https://www.ekhone.com/my-account/orders/${orderNumber}`,
                                style: buttonStyle
                            },
                            'View Order Details'
                        ),
                        React.createElement(
                            'a',
                            {
                                href: 'https://www.ekhone.com/track-order',
                                style: secondaryButtonStyle
                            },
                            'Track Order'
                        )
                    )
                ),

                React.createElement(Hr, { style: hrStyle }),

                // Footer
                React.createElement(
                    Section,
                    { style: footerStyle },
                    React.createElement(
                        Text,
                        { style: footerTextStyle },
                        'Need help with your order? Contact our support team.'
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

const headerSubtitleStyle = {
    color: '#ffffff',
    fontSize: '16px',
    margin: '10px 0 0 0',
    opacity: '0.9'
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

const orderInfoBoxStyle = {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '20px',
    margin: '24px 0',
    border: '1px solid #e2e8f0'
};

const orderInfoLabelStyle = {
    fontSize: '12px',
    color: '#64748b',
    margin: '0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const orderInfoValueStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#0f172a',
    margin: '4px 0 0 0'
};

const sectionTitleStyle = {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '32px 0 16px 0'
};

const tableHeaderStyle = {
    backgroundColor: '#f8fafc',
    padding: '12px',
    borderRadius: '6px 6px 0 0',
    marginTop: '16px'
};

const tableHeaderTextStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#475569',
    margin: '0'
};

const itemStyle = {
    padding: '12px',
    borderBottom: '1px solid #e2e8f0'
};

const lastItemStyle = {
    padding: '12px'
};

const productNameStyle = {
    fontSize: '14px',
    fontWeight: '500',
    color: '#0f172a',
    margin: '0'
};

const itemTextStyle = {
    fontSize: '14px',
    color: '#475569',
    margin: '0'
};

const priceBreakdownStyle = {
    backgroundColor: '#f8fafc',
    padding: '20px',
    borderRadius: '8px',
    margin: '24px 0'
};

const priceLabelStyle = {
    fontSize: '14px',
    color: '#64748b',
    margin: '4px 0'
};

const priceValueStyle = {
    fontSize: '14px',
    color: '#0f172a',
    margin: '4px 0',
    fontWeight: '500'
};

const promoDiscountStyle = {
    fontSize: '14px',
    color: '#16a34a',
    margin: '4px 0',
    fontWeight: '500'
};

const totalLabelStyle = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#0f172a',
    margin: '0'
};

const totalValueStyle = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#14b8a6',
    margin: '0'
};

const addressRowStyle = {
    margin: '32px 0'
};

const addressTitleStyle = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1e293b',
    margin: '0 0 12px 0'
};

const addressTextStyle = {
    fontSize: '14px',
    lineHeight: '22px',
    color: '#475569',
    margin: '0'
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

const secondaryButtonStyle = {
    backgroundColor: '#ffffff',
    color: '#14b8a6',
    padding: '14px 40px',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: '600',
    fontSize: '16px',
    display: 'inline-block',
    border: '2px solid #14b8a6',
    marginLeft: '12px'
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



module.exports = OrderConfirmationEmail;