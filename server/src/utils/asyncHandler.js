const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        const isValidStatusCode = (code) => Number.isInteger(code) && code >= 100 && code <= 599;
        const statusCode = isValidStatusCode(error.statusCode)
            ? error.statusCode
            : isValidStatusCode(error.status)
            ? error.status
            : isValidStatusCode(error.code)
            ? error.code
            : 500;

        console.error("API Error caught in asyncHandler:", error.message || error);

        res.status(statusCode).json({
            success: false,
            message: error.message || "Internal Server Error",
            errors: error.errors || [],
        });
    }
};

export { asyncHandler };
