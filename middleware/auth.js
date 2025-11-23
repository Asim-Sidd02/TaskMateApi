// middleware/auth.js - core part
const { verifyAccessToken } = require('../utils/tokens');

module.exports = function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization required' });
    }
    const token = auth.split(' ')[1];
    let payload;
    try {
      payload = verifyAccessToken(token); // may throw
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = {
      id: payload.sub ? payload.sub.toString() : null,
      email: payload.email || null,
      username: payload.username || null,
    };

    if (!req.user.id) return res.status(401).json({ message: 'Invalid token payload' });

    next();
  } catch (err) {
    console.error('authMiddleware unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
