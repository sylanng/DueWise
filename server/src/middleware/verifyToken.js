// server/src/middleware/verifyToken.js
// Every route except /api/health needs: Authorization: Bearer <Firebase ID token>
import { ApiError } from './errorHandler.js';

// verifyIdToken(token) -> { uid, email }; throws if the token is bad or expired
export function createVerifyToken(verifyIdToken) {
  return async function verifyToken(req, res, next) {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new ApiError(401, 'Please sign in to continue.', 'auth/missing-token'));
    }
    try {
      const decoded = await verifyIdToken(token);
      req.user = { uid: decoded.uid, email: decoded.email };
      return next();
    } catch (err) {
      const expired = err?.code === 'auth/id-token-expired';
      return next(
        new ApiError(
          401,
          expired ? 'Your session expired. Please sign in again.' : 'Your sign-in could not be verified. Please sign in again.',
          expired ? 'auth/id-token-expired' : 'auth/invalid-token'
        )
      );
    }
  };
}