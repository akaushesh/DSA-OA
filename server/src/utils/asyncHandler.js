const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        const isValidStatusCode = (code) => Number.isInteger(code) && code >= 100 && code <= 599;
        const statusCode = isValidStatusCode(error.code) ? error.code : 500;

        res.status(statusCode).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};

export { asyncHandler };
