// ============================================================
// middleware/auth.js  — JWT authentication middleware
// Protects routes that require a logged-in parent.
// Usage: router.use(authenticateParent)  or
//        router.get('/route', authenticateParent, handler)
// ============================================================

const jwt = require('jsonwebtoken');

/**
 * Verifies the Bearer token in the Authorization header.
 * On success  → attaches req.parentId and calls next().
 * On failure  → returns 401/403 JSON error.
 */
const authenticateParent = (req, res, next) => {
  // Expected header format: "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  try {
    // jwt.verify throws if the token is invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.parentId = decoded.parentId; // Make parent ID available to route handlers
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(403).json({ error: 'Invalid token. Access denied.' });
  }
};

module.exports = { authenticateParent };
