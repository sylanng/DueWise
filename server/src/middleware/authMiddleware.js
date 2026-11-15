
const { getAuth } = require('firebase-admin/auth');

// Middleware to verify Firebase ID tokens
const verifyToken = async (req, res, next) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;

    // Check if the token exists
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.',
      });
    }

    // Extract the Firebase ID token
    const token = authHeader.split(' ')[1];

    // Verify the token using Firebase Admin SDK
    const decodedToken = await getAuth().verifyIdToken(token);

    // Attach the verified user information to the request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
    };

    // Continue to the next middleware or route
    next();

  } catch (error) {
    console.error('Authentication error:', error.message);

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
};

module.exports = verifyToken;
