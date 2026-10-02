const SteadfastService = require('./steadfastService');
const PathaoService = require('./pathaoService');

// Registry of courier adapters
const courierServices = {
    STEADFAST: new SteadfastService(),
    PATHAO: new PathaoService(),
};

/**
 * Get courier service instance by provider name
 * @param {string} [name='STEADFAST']
 * @returns {import('./baseCourierService')}
 */
function getCourierService(name = 'STEADFAST') {
    const key = String(name).toUpperCase();
    const service = courierServices[key];
    if (!service) {
        throw new Error(`Courier provider "${name}" is not supported. Available: ${Object.keys(courierServices).join(', ')}`);
    }
    return service;
}

/**
 * Register a new courier service dynamically in future
 * @param {string} name
 * @param {BaseCourierService} serviceInstance
 */
function registerCourierService(name, serviceInstance) {
    const key = String(name).toUpperCase();
    courierServices[key] = serviceInstance;
}

module.exports = {
    getCourierService,
    registerCourierService,
    SteadfastService,
    PathaoService
};

