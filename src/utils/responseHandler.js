
const successResponse = (res, messageOrData, data = null, status = 200) => {
    if (Array.isArray(messageOrData) || typeof messageOrData === 'object') {
        return res.status(status).json(messageOrData);
    }

    return res.status(status).json({
        success: true,
        message: messageOrData,
        data,
    });
};


const errorResponse = (res, message, status = 500, stack = null) => {
    const body = { success: false, message };
    if (process.env.NODE_ENV !== 'production' && stack) body.stack = stack;
    return res.status(status).json(body);
};


module.exports = { successResponse, errorResponse };
