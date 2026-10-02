const axios = require('axios');
const BaseCourierService = require('./baseCourierService');

class PathaoService extends BaseCourierService {
    constructor() {
        super('PATHAO');
    }

    get clientId() {
        return process.env.PATHAO_CLIENT_ID;
    }

    get clientSecret() {
        return process.env.PATHAO_CLIENT_SECRET;
    }

    get username() {
        return process.env.PATHAO_CLIENT_EMAIL || process.env.PATHAO_USERNAME;
    }

    get password() {
        return process.env.PATHAO_CLIENT_PASSWORD || process.env.PATHAO_PASSWORD;
    }

    get storeId() {
        return process.env.PATHAO_STORE_ID ? parseInt(process.env.PATHAO_STORE_ID) : null;
    }

    get baseUrl() {
        return process.env.PATHAO_BASE_URL || 'https://courier-api-sandbox.pathao.com';
    }

    /**
     * Cache bearer token in-memory to avoid fetching token on every call
     */
    _accessToken = null;
    _tokenExpiresAt = null;

    /**
     * Check if live Pathao credentials are configured in environment variables
     */
    isLiveConfigured() {
        return Boolean(this.clientId && this.clientSecret && this.username && this.password);
    }

    /**
     * Obtain access token using Pathao OAuth password grant
     */
    async _getAccessToken() {
        if (this._accessToken && this._tokenExpiresAt && Date.now() < this._tokenExpiresAt) {
            return this._accessToken;
        }

        if (!this.isLiveConfigured()) {
            throw new Error("Pathao credentials (PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_CLIENT_EMAIL, PATHAO_CLIENT_PASSWORD) are not configured.");
        }

        const payload = {
            client_id: this.clientId,
            client_secret: this.clientSecret,
            username: this.username,
            password: this.password,
            grant_type: 'password'
        };

        const response = await axios.post(`${this.baseUrl}/aladdin/api/v1/issue-token`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        if (response.data?.access_token) {
            this._accessToken = response.data.access_token;
            // Set expiration with a 5 minute safety buffer
            const expiresInSec = response.data.expires_in || 3600;
            this._tokenExpiresAt = Date.now() + (expiresInSec - 300) * 1000;
            return this._accessToken;
        }

        throw new Error("Failed to obtain Pathao access token");
    }

    /**
     * Clean and format 11-digit Bangladeshi mobile number
     */
    _formatPhoneNumber(phone) {
        if (!phone) return '';
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('880') && cleaned.length === 13) {
            cleaned = cleaned.substring(2);
        }
        return cleaned;
    }

    /**
     * Create shipment / consignment on Pathao
     */
    async createShipment({
        invoice,
        recipientName,
        recipientPhone,
        recipientAddress,
        codAmount = 0,
        note = '',
        deliveryType = 48,
        itemWeight = 0.5,
        cityId = 1,
        zoneId = 1,
        areaId = 1
    }) {
        try {
            const formattedPhone = this._formatPhoneNumber(recipientPhone);

            if (!invoice) {
                throw new Error("Invoice / Order number is required for Pathao shipment creation.");
            }
            if (!recipientName || recipientName.trim().length === 0) {
                throw new Error("Recipient name is required.");
            }
            if (!formattedPhone || formattedPhone.length !== 11) {
                throw new Error(`Valid 11-digit recipient phone number is required. Provided: ${recipientPhone}`);
            }
            if (!recipientAddress || recipientAddress.trim().length === 0) {
                throw new Error("Recipient address is required.");
            }

            // If live credentials are not present in .env, simulate successful response for development/testing
            if (!this.isLiveConfigured()) {
                console.warn("[PATHAO COURIER] Live credentials not found. Generating sandbox consignment mock.");
                const mockConsignmentId = `PTH-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
                const mockTrackingCode = `TRK-PTH-${Math.floor(100000 + Math.random() * 900000)}`;

                return {
                    success: true,
                    consignmentId: mockConsignmentId,
                    trackingCode: mockTrackingCode,
                    invoice: String(invoice),
                    courierStatus: 'Pending',
                    normalizedStatus: 'Pending',
                    raw: {
                        mode: 'sandbox_simulation',
                        message: 'Dispatched via Pathao simulation. To connect live API, add PATHAO_CLIENT_ID and credentials to .env.'
                    }
                };
            }

            // Live Pathao API integration
            const token = await this._getAccessToken();
            const payload = {
                store_id: this.storeId || 1,
                merchant_order_id: String(invoice),
                recipient_name: recipientName.trim().substring(0, 100),
                recipient_phone: formattedPhone,
                recipient_address: recipientAddress.trim(),
                recipient_city: parseInt(cityId) || 1,
                recipient_zone: parseInt(zoneId) || 1,
                recipient_area: parseInt(areaId) || 1,
                delivery_type: deliveryType === 12 ? 12 : 48, // 48 = Normal Delivery (24-48 hours)
                item_type: 2, // 2 = Parcel
                special_instruction: note ? String(note).substring(0, 250) : '',
                item_quantity: 1,
                item_weight: parseFloat(itemWeight) || 0.5,
                amount_to_collect: Math.max(0, Math.round(parseFloat(codAmount) || 0)),
                item_description: 'Ecommerce Products'
            };

            const response = await axios.post(`${this.baseUrl}/aladdin/api/v1/orders`, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 15000
            });

            if (response.data && (response.data.type === 'success' || response.data.code === 200 || response.data.data)) {
                const orderData = response.data.data || {};
                const consignmentId = String(orderData.consignment_id || '');
                return {
                    success: true,
                    consignmentId: consignmentId,
                    trackingCode: consignmentId, // Pathao tracks by consignment_id
                    invoice: String(orderData.merchant_order_id || invoice),
                    courierStatus: orderData.order_status || 'Pending',
                    normalizedStatus: this.normalizeStatus(orderData.order_status || 'Pending'),
                    raw: response.data
                };
            }

            throw new Error(response.data?.message || "Failed to create consignment in Pathao");

        } catch (error) {
            const errorMsg = error.response?.data?.message || (error.response?.data?.errors ? JSON.stringify(error.response.data.errors) : error.message);
            console.error("Pathao createShipment error:", errorMsg);
            throw new Error(`Pathao API Error: ${errorMsg}`);
        }
    }

    /**
     * Check delivery status by consignment ID
     */
    async getStatusByConsignmentId(consignmentId) {
        try {
            if (!consignmentId) throw new Error("Consignment ID is required.");

            if (!this.isLiveConfigured()) {
                return {
                    success: true,
                    deliveryStatus: 'In_Transit',
                    normalizedStatus: 'InTransit',
                    isReturned: false,
                    raw: { mode: 'sandbox_simulation' }
                };
            }

            const token = await this._getAccessToken();
            const response = await axios.get(`${this.baseUrl}/aladdin/api/v1/orders/${consignmentId}/info`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            const orderData = response.data?.data || {};
            const deliveryStatus = orderData.order_status || 'Unknown';

            return {
                success: true,
                deliveryStatus: deliveryStatus,
                normalizedStatus: this.normalizeStatus(deliveryStatus),
                isReturned: this.isReturnedStatus(deliveryStatus),
                raw: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`Pathao status error for Consignment ${consignmentId}:`, errorMsg);
            throw new Error(`Pathao status check failed: ${errorMsg}`);
        }
    }

    /**
     * Check delivery status by tracking code
     */
    async getStatusByTrackingCode(trackingCode) {
        return this.getStatusByConsignmentId(trackingCode);
    }

    /**
     * Check delivery status by invoice number
     */
    async getStatusByInvoice(invoice) {
        return this.getStatusByConsignmentId(invoice);
    }

    /**
     * Get Pathao balance or account summary
     */
    async getBalance() {
        return {
            success: true,
            balance: 0,
            raw: { note: "Pathao balance is managed through merchant bank settlement" }
        };
    }

    /**
     * Normalize Pathao delivery statuses to standard system ShipmentStatus
     */
    normalizeStatus(rawStatus) {
        if (!rawStatus) return 'Pending';
        const lower = String(rawStatus).toLowerCase().trim().replace(/[\s_-]+/g, '');

        if (lower.includes('return')) return 'Returned';
        if (lower.includes('cancel')) return 'Cancelled';
        if (lower.includes('deliver') && !lower.includes('partial')) return 'Delivered';
        if (lower.includes('partialdeliver')) return 'PartialDelivered';
        if (lower.includes('hold')) return 'Hold';
        if (lower.includes('intransit') || lower.includes('hub') || lower.includes('picked') || lower.includes('assigned')) return 'InTransit';
        if (lower.includes('pending') || lower.includes('request')) return 'InReview';

        return 'InTransit';
    }

    /**
     * Determine if status indicates returned/cancelled item for inventory restoration
     */
    isReturnedStatus(status) {
        if (!status) return false;
        const lower = String(status).toLowerCase().trim().replace(/[\s_-]+/g, '');
        return lower.includes('return') || lower.includes('cancel');
    }
}

module.exports = PathaoService;
