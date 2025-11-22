const { verifyAccessToken } = require('../utils/tokens');

module.exports = function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ message: 'Authorization required' });
    }

    const parts = auth.split(' ').filter(Boolean);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return res.status(401).json({ message: 'Authorization required (Bearer token)' });
    }

    const token = parts[1];

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      console.error('authMiddleware: token verify failed:', err.message || err);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (!payload || !payload.sub) {
      console.error('authMiddleware: token payload missing sub', payload);
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    req.user = {
      id: String(payload.sub),
      email: payload.email || null,
      username: payload.username || null
    };

    if (process.env.NODE_ENV !== 'production') {
      console.debug('authMiddleware: user=', req.user);
    }

    next();
  } catch (err) {
    console.error('authMiddleware unexpected error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
