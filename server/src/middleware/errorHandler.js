// server/src/middleware/errorHandler.js

// Throw this from any route: throw new ApiError(404, 'Installment not found.')
export class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(req, res, next) {
  next(new ApiError(404, 'That endpoint does not exist.', 'not-found'));
}

// Every error leaves the API as JSON: { message, code?, details? }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON.', code: 'bad-json' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.', code: 'too-large' });
  }
  console.error(err); // full detail stays in the server log, never in the response
  return res.status(500).json({ message: 'Something went wrong on the server. Please try again.', code: 'server-error' });
}