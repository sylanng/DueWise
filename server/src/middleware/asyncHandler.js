// Sends errors from async route handlers to the error handler (works on Express 4 and 5)
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);