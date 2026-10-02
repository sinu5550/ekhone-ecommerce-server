const axios = require('axios');
const BaseCourierService = require('./baseCourierService');

class SteadfastService extends BaseCourierService {
    constructor() {
        super('STEADFAST');
    }

    get apiKey() {
        return process.env.STEADFAST_API_KEY;
    }

    get secretKey() {
        return process.env.STEADFAST_SECRET_KEY;
    }

    get baseUrl() {
        return process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';
    }

    /**
     * Get Axios request headers with Steadfast authentication
     */
    _getHeaders() {
        if (!this.apiKey || !this.secretKey) {
            throw new Error("Steadfast API credentials are missing in server environment variables.");
        }
        return {
            'Api-Key': this.apiKey,
            'Secret-Key': this.secretKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    /**
     * Clean and format 11-digit Bangladeshi mobile number
     */
    _formatPhoneNumber(phone) {
        if (!phone) return '';
        // Strip out non-digits
        let cleaned = phone.replace(/\D/g, '');
        // If it starts with 880 (country code), remove 88
        if (cleaned.startsWith('880') && cleaned.length === 13) {
            cleaned = cleaned.substring(2);
        }
        return cleaned;
    }

    /**
     * Create shipment / consignment on Steadfast
     */
    async createShipment({
        invoice,
        recipientName,
        recipientPhone,
        recipientAddress,
        codAmount = 0,
        note = '',
        deliveryType = 0
    }) {
        try {
            const formattedPhone = this._formatPhoneNumber(recipientPhone);

            if (!invoice) {
                throw new Error("Invoice / Order number is required for Steadfast shipment creation.");
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

            const payload = {
                invoice: String(invoice),
                recipient_name: recipientName.trim().substring(0, 100),
                recipient_phone: formattedPhone,
                recipient_address: recipientAddress.trim(),
                cod_amount: Math.max(0, parseFloat(codAmount) || 0),
                note: note ? String(note).substring(0, 250) : '',
                delivery_type: deliveryType === 1 ? 1 : 0
            };

            const response = await axios.post(`${this.baseUrl}/create_order`, payload, {
                headers: this._getHeaders(),
                timeout: 15000
            });

            if (response.data && (response.data.status === 200 || response.data.consignment)) {
                const consignment = response.data.consignment || {};
                return {
                    success: true,
                    consignmentId: String(consignment.consignment_id || response.data.consignment_id || ''),
                    trackingCode: String(consignment.tracking_code || response.data.tracking_code || ''),
                    invoice: String(consignment.invoice || invoice),
                    courierStatus: consignment.status || 'in_review',
                    normalizedStatus: this.normalizeStatus(consignment.status || 'in_review'),
                    raw: response.data
                };
            }

            throw new Error(response.data?.message || "Failed to create consignment in Steadfast");
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.response?.data?.errors 
                ? JSON.stringify(error.response.data.errors) 
                : error.message;
            console.error("Steadfast createShipment error:", errorMsg);
            throw new Error(`Steadfast API Error: ${errorMsg}`);
        }
    }

    /**
     * Check delivery status by consignment ID
     */
    async getStatusByConsignmentId(consignmentId) {
        try {
            if (!consignmentId) throw new Error("Consignment ID is required.");

            const response = await axios.get(`${this.baseUrl}/status_by_cid/${consignmentId}`, {
                headers: this._getHeaders(),
                timeout: 10000
            });

            const deliveryStatus = response.data?.delivery_status || 'unknown';
            return {
                success: true,
                deliveryStatus: deliveryStatus,
                normalizedStatus: this.normalizeStatus(deliveryStatus),
                isReturned: this.isReturnedStatus(deliveryStatus),
                raw: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`Steadfast status_by_cid error for CID ${consignmentId}:`, errorMsg);
            throw new Error(`Steadfast status check failed: ${errorMsg}`);
        }
    }

    /**
     * Check delivery status by tracking code
     */
    async getStatusByTrackingCode(trackingCode) {
        try {
            if (!trackingCode) throw new Error("Tracking code is required.");

            const response = await axios.get(`${this.baseUrl}/status_by_tracking_code/${trackingCode}`, {
                headers: this._getHeaders(),
                timeout: 10000
            });

            const deliveryStatus = response.data?.delivery_status || 'unknown';
            return {
                success: true,
                deliveryStatus: deliveryStatus,
                normalizedStatus: this.normalizeStatus(deliveryStatus),
                isReturned: this.isReturnedStatus(deliveryStatus),
                raw: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`Steadfast status_by_tracking_code error for Code ${trackingCode}:`, errorMsg);
            throw new Error(`Steadfast tracking check failed: ${errorMsg}`);
        }
    }

    /**
     * Check delivery status by invoice number
     */
    async getStatusByInvoice(invoice) {
        try {
            if (!invoice) throw new Error("Invoice number is required.");

            const response = await axios.get(`${this.baseUrl}/status_by_invoice/${invoice}`, {
                headers: this._getHeaders(),
                timeout: 10000
            });

            const deliveryStatus = response.data?.delivery_status || 'unknown';
            return {
                success: true,
                deliveryStatus: deliveryStatus,
                normalizedStatus: this.normalizeStatus(deliveryStatus),
                isReturned: this.isReturnedStatus(deliveryStatus),
                raw: response.data
            };
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error(`Steadfast status_by_invoice error for Invoice ${invoice}:`, errorMsg);
            throw new Error(`Steadfast invoice status check failed: ${errorMsg}`);
        }
    }

    /**
     * Get current merchant account balance
     */
    async getBalance() {
        try {
            const response = await axios.get(`${this.baseUrl}/get_balance`, {
                headers: this._getHeaders(),
                timeout: 10000
            });

            if (response.data && response.data.status === 200) {
                return {
                    success: true,
                    balance: parseFloat(response.data.current_balance) || 0,
                    raw: response.data
                };
            }

            throw new Error("Unable to fetch balance from Steadfast.");
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message;
            console.error("Steadfast getBalance error:", errorMsg);
            throw new Error(`Steadfast balance check failed: ${errorMsg}`);
        }
    }

    /**
     * Check fraud / return history for a phone number
     */
    async checkFraud(phone) {
        try {
            const formattedPhone = this._formatPhoneNumber(phone);
            const response = await axios.get(`${this.baseUrl}/fraud_check/${formattedPhone}`, {
                headers: this._getHeaders(),
                timeout: 10000
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error("Steadfast fraud_check error:", error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Normalize Steadfast delivery statuses to standard system ShipmentStatus
     */
    normalizeStatus(rawStatus) {
        if (!rawStatus) return 'Pending';
        const lower = String(rawStatus).toLowerCase().trim();

        if (lower.includes('return')) return 'Returned';
        if (lower === 'in_review') return 'InReview';
        if (lower === 'pending') return 'Pending';
        if (lower === 'delivered' || lower === 'delivered_approval_pending') return 'Delivered';
        if (lower === 'partial_delivered' || lower === 'partial_delivered_approval_pending') return 'PartialDelivered';
        if (lower === 'cancelled' || lower === 'cancelled_approval_pending') return 'Cancelled';
        if (lower === 'hold') return 'Hold';
        if (lower === 'in_transit' || lower === 'picked' || lower === 'received_by_hub') return 'InTransit';

        return 'InTransit';
    }

    /**
     * Determine if a status represents a return or cancellation where items should be returned to inventory
     */
    isReturnedStatus(status) {
        if (!status) return false;
        const lower = String(status).toLowerCase().trim();
        const returnKeywords = [
            'cancelled',
            'cancelled_approval_pending',
            'return',
            'returned',
            'return_received',
            'return_in_transit',
            'packet_returned'
        ];
        return returnKeywords.some(keyword => lower === keyword || lower.includes('return') || lower.includes('cancel'));
    }
}

module.exports = SteadfastService;
