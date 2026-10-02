const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    // Prisma errors
    if (err.code === 'P2002') {
        return res.status(400).json({
            success: false,
            message: 'Duplicate field value entered',
            data: null
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            success: false,
            message: 'Record not found',
            data: null
        });
    }

    // Default error
    return res.status(500).json({
        success: false,
        message: 'Internal server error',
        data: null
    });
};

module.exports = errorHandler;