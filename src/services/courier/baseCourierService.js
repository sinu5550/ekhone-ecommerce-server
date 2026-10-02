/**
 * Base Courier Service Interface
 * All courier providers (Steadfast, Pathao, RedX, etc.) must implement this interface.
 */
class BaseCourierService {
    constructor(courierName) {
        if (this.constructor === BaseCourierService) {
            throw new Error("BaseCourierService is an abstract class and cannot be instantiated directly.");
        }
        this.courierName = courierName;
    }

    /**
     * Create a new shipment / consignment with the courier
     * @param {Object} payload
     * @param {string} payload.invoice - Unique invoice or order number
     * @param {string} payload.recipientName - Customer full name
     * @param {string} payload.recipientPhone - Customer 11-digit phone number
     * @param {string} payload.recipientAddress - Full delivery address
     * @param {number} payload.codAmount - Cash on delivery amount in BDT
     * @param {string} [payload.note] - Optional delivery instruction
     * @returns {Promise<{ success: boolean, consignmentId: string, trackingCode: string, courierStatus: string, raw: Object }>}
     */
    async createShipment(payload) {
        throw new Error("Method createShipment() must be implemented.");
    }

    /**
     * Get tracking / delivery status by consignment ID
     * @param {string|number} consignmentId
     * @returns {Promise<{ success: boolean, deliveryStatus: string, normalizedStatus: string, raw: Object }>}
     */
    async getStatusByConsignmentId(consignmentId) {
        throw new Error("Method getStatusByConsignmentId() must be implemented.");
    }

    /**
     * Get tracking / delivery status by tracking code
     * @param {string} trackingCode
     * @returns {Promise<{ success: boolean, deliveryStatus: string, normalizedStatus: string, raw: Object }>}
     */
    async getStatusByTrackingCode(trackingCode) {
        throw new Error("Method getStatusByTrackingCode() must be implemented.");
    }

    /**
     * Get current courier account balance
     * @returns {Promise<{ success: boolean, balance: number, raw: Object }>}
     */
    async getBalance() {
        throw new Error("Method getBalance() must be implemented.");
    }

    /**
     * Normalize courier-specific delivery status to system standard status
     * @param {string} rawStatus
     * @returns {string}
     */
    normalizeStatus(rawStatus) {
        throw new Error("Method normalizeStatus() must be implemented.");
    }
}

module.exports = BaseCourierService;
