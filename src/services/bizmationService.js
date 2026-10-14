const axios = require('axios');
const crypto = require('crypto');

/**
 * BizMationService
 * Handles communication with the BizMation Inventory Management API.
 * All outgoing calls are non-blocking and fail-safe to guarantee zero disruption
 * to internal order processing.
 */
class BizMationService {
    static getBaseUrl() {
        return process.env.BIZMATION_BASE_URL || 'https://api.bizmation.io';
    }

    static getAccessToken() {
        return process.env.BIZMATION_ACCESS_TOKEN || '';
    }

    static getInventoryId() {
        const id = process.env.BIZMATION_INVENTORY_ID;
        return id ? Number(id) : null;
    }

    static isConfigured() {
        return Boolean(this.getAccessToken() && this.getInventoryId());
    }

    /**
     * Standardize Bangladeshi mobile number to 01XXXXXXXXX format (11 digits, regex ^01\d{9}$)
     * Handles +8801..., 8801..., dashes, spaces, etc.
     */
    static formatMobileNumber(phone) {
        if (!phone) return '';
        let cleaned = String(phone).replace(/\D/g, '');

        if (cleaned.startsWith('8801')) {
            cleaned = cleaned.substring(2);
        } else if (cleaned.startsWith('801')) {
            cleaned = cleaned.substring(1);
        }

        const validBangladeshiRegex = /^01\d{9}$/;
        return validBangladeshiRegex.test(cleaned) ? cleaned : '';
    }

    /**
     * Formats attributes into BizMation format: "Key1::Value1,,Key2::Value2,,"
     * @param {Object|Array|string} rawAttrs
     * @returns {string}
     */
    static formatAttributesString(rawAttrs) {
        if (!rawAttrs) return '';

        let pairs = [];

        if (typeof rawAttrs === 'string') {
            // Check if already in Key::Value,, format
            if (rawAttrs.includes('::')) {
                return rawAttrs.endsWith(',,') ? rawAttrs : `${rawAttrs},,`;
            }
            try {
                const parsed = JSON.parse(rawAttrs);
                return this.formatAttributesString(parsed);
            } catch (_) {
                // Return plain string wrapped
                return `Option::${rawAttrs},,`;
            }
        }

        if (Array.isArray(rawAttrs)) {
            rawAttrs.forEach(item => {
                if (typeof item === 'object' && item !== null) {
                    const key = item.key || item.name || item.title || 'Option';
                    const value = item.value || item.val || '';
                    if (value) pairs.push(`${key}::${value}`);
                } else if (item) {
                    pairs.push(`Option::${item}`);
                }
            });
        } else if (typeof rawAttrs === 'object' && rawAttrs !== null) {
            Object.entries(rawAttrs).forEach(([k, v]) => {
                if (v !== undefined && v !== null && String(v).trim() !== '') {
                    pairs.push(`${k}::${v}`);
                }
            });
        }

        if (pairs.length === 0) return '';
        return `${pairs.join(',,')},,`;
    }

    /**
     * Helper to extract client IP from express request
     */
    static getClientIp(req) {
        if (!req) return '127.0.0.1';
        return (
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.socket?.remoteAddress ||
            req.ip ||
            '127.0.0.1'
        );
    }

    /**
     * Helper to extract User Agent from express request
     */
    static getUserAgent(req) {
        if (!req) return 'EkhoneServer/1.0';
        return req.headers['user-agent'] || 'EkhoneServer/1.0';
    }

    /**
     * Send Successful Order to BizMation (POST /api/orders/store)
     * Non-blocking, wrapped in try-catch.
     *
     * @param {Object} order - Complete order object from database
     * @param {Object} [req] - Optional express req object for IP / User Agent / Checkout URL
     */
    static async sendSuccessfulOrder(order, req = null) {
        if (!this.isConfigured()) {
            console.log('[BizMation] Skipping outgoing call: BIZMATION_ACCESS_TOKEN or BIZMATION_INVENTORY_ID not configured.');
            return null;
        }

        try {
            const customerName =
                order.shippingAddress?.recipientName ||
                order.customer?.fullName ||
                'Customer';

            const rawMobile =
                order.shippingAddress?.phoneNumber ||
                order.customer?.phone ||
                '';

            const mobileNumber = this.formatMobileNumber(rawMobile);
            if (!mobileNumber) {
                console.warn(`[BizMation] Order #${order.orderNumber || order.id} skipped: invalid mobile number "${rawMobile}".`);
                return null;
            }

            const customerAddress =
                order.shippingAddress?.address ||
                [
                    order.shippingAddress?.upazila,
                    order.shippingAddress?.city,
                    order.shippingAddress?.district
                ].filter(Boolean).join(', ') ||
                'Address not provided';

            // Format items into BizMation structure
            const orderItems = [];

            // 1. Regular Order Items
            if (Array.isArray(order.orderItems)) {
                for (const item of order.orderItems) {
                    const title =
                        item.product?.productName ||
                        item.productName ||
                        item.name ||
                        `Product #${item.productId}`;

                    const rawAttributes =
                        item.productVariant?.attributes ||
                        item.attributes ||
                        null;

                    const attributesStr = this.formatAttributesString(rawAttributes);

                    const orderItemObj = {
                        type: 'Title',
                        product_title: String(title).trim(),
                        price: parseFloat(item.unitPrice || item.price || 0),
                        quantity: parseInt(item.quantity || 1, 10),
                    };

                    if (attributesStr) {
                        orderItemObj.attributes = attributesStr;
                    }

                    orderItems.push(orderItemObj);
                }
            }

            // 2. Bundle Order Items (if any were kept as bundle records)
            if (Array.isArray(order.bundleOrderItems)) {
                for (const bundleItem of order.bundleOrderItems) {
                    const bundleTitle =
                        bundleItem.bundle?.name ||
                        `Bundle #${bundleItem.bundleId}`;

                    orderItems.push({
                        type: 'Title',
                        product_title: String(bundleTitle).trim(),
                        price: parseFloat(bundleItem.unitPrice || 0),
                        quantity: parseInt(bundleItem.quantity || 1, 10),
                    });
                }
            }

            if (orderItems.length === 0) {
                console.warn(`[BizMation] Order #${order.orderNumber || order.id} has no valid items. Skipping.`);
                return null;
            }

            // Extract context info
            const userIp = req ? this.getClientIp(req) : '127.0.0.1';
            const userAgent = req ? this.getUserAgent(req) : 'EkhoneServer/1.0';
            const checkoutUrl = req ? (req.headers.referer || req.headers.origin || '') : '';
            const uuidToken = order.orderNumber || String(order.id) || crypto.randomUUID();

            // In our system:
            // item.unitPrice is ALREADY the discounted final selling price per item (e.g. ৳3500 after ৳3000 product discount).
            // BizMation calculates: Grand Total = (Sum of item price * quantity) - discount + delivery_charge.
            // Therefore, 'discount' passed to BizMation must ONLY include order-level extra discounts (voucher_promo, coupons, loyalty points).
            // If we also subtracted product-level discount here, BizMation would double-discount the order (3500 - 3000 = 500).
            const orderLevelDiscount = parseFloat(order.voucher_promo || 0);

            const payload = {
                uu_id: String(uuidToken),
                name: String(customerName).trim(),
                address: String(customerAddress).trim(),
                mobile_number: mobileNumber,
                delivery_charge: parseFloat(order.shippingCost || 0),
                discount: orderLevelDiscount,
                check_duplicate_order: 'No',
                user_ip: userIp,
                user_agent: userAgent,
                inventory_id: this.getInventoryId(),
                note: order.note ? String(order.note).trim() : '',
                url: checkoutUrl,
                order_items: orderItems,
            };

            const endpoint = `${this.getBaseUrl()}/api/orders/store`;
            console.log(`[BizMation] Dispatching Order #${order.orderNumber || order.id} to ${endpoint}`);

            const response = await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${this.getAccessToken()}`,
                },
                timeout: 10000,
            });

            console.log(`[BizMation] Order #${order.orderNumber || order.id} stored successfully:`, response.data);
            return response.data;
        } catch (error) {
            console.error(
                `[BizMation Error] Failed to send order #${order?.orderNumber || order?.id}:`,
                error.response?.data || error.message
            );
            return null;
        }
    }

    /**
     * Send Failed / Abandoned / Invalid checkout order attempt to BizMation (POST /api/orders/custom-ft)
     * Non-blocking, wrapped in try-catch.
     *
     * @param {Object} rawBody - Request body from customer order attempt
     * @param {Object} req - Express req object
     */
    static async sendFailedOrder(rawBody = {}, req = null) {
        if (!this.isConfigured()) {
            return null;
        }

        try {
            const rawPhone =
                rawBody.customer?.phone ||
                rawBody.shippingAddress?.phoneNumber ||
                rawBody.phone ||
                '';

            const mobileNumber = this.formatMobileNumber(rawPhone);
            if (!mobileNumber) {
                // BizMation requires valid phone number even for abandoned orders
                return null;
            }

            const customerName =
                rawBody.customer?.fullName ||
                rawBody.shippingAddress?.recipientName ||
                rawBody.name ||
                'Guest Customer';

            const customerAddress =
                rawBody.customer?.address ||
                rawBody.shippingAddress?.address ||
                rawBody.address ||
                'Address not provided';

            const productDatas = [];
            const rawItems = Array.isArray(rawBody.items) ? rawBody.items : [];

            for (const item of rawItems) {
                const title = item.productName || item.product?.productName || item.title || `Item #${item.productId || ''}`;
                const rawAttrs = item.variant?.attributes || item.attributes || null;
                const attributesStr = this.formatAttributesString(rawAttrs);

                const itemObj = {
                    type: 'Title',
                    product_title: String(title).trim(),
                    selling_price: parseFloat(item.price || item.unitPrice || 0),
                    quantity: parseInt(item.quantity || 1, 10),
                };

                if (attributesStr) {
                    itemObj.attributes = attributesStr;
                }

                productDatas.push(itemObj);
            }

            if (productDatas.length === 0) {
                productDatas.push({
                    type: 'Title',
                    product_title: 'Unspecified Item',
                    selling_price: 0,
                    quantity: 1,
                });
            }

            const userIp = req ? this.getClientIp(req) : '127.0.0.1';
            const userAgent = req ? this.getUserAgent(req) : 'EkhoneServer/1.0';

            const payload = {
                uid: String(rawBody.orderNumber || crypto.randomUUID()),
                inventory_id: this.getInventoryId(),
                shipping_name: String(customerName).trim(),
                shipping_mobile_number: mobileNumber,
                shipping_address: String(customerAddress).trim(),
                shipping_charge: String(rawBody.shippingCost || 0),
                user_ip: userIp,
                user_agent: [userAgent],
                product_datas: productDatas,
            };

            const endpoint = `${this.getBaseUrl()}/api/orders/custom-ft`;
            console.log(`[BizMation] Dispatching failed/abandoned order attempt for ${mobileNumber} to ${endpoint}`);

            const response = await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${this.getAccessToken()}`,
                },
                timeout: 10000,
            });

            console.log(`[BizMation] Failed order logged successfully:`, response.data);
            return response.data;
        } catch (error) {
            console.error(
                `[BizMation Error] Failed to log failed/abandoned order:`,
                error.response?.data || error.message
            );
            return null;
        }
    }
}

module.exports = BizMationService;
