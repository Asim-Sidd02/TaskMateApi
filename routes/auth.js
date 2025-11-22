// routes/auth.js
console.log('routes/auth.js loaded');

const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwtDecode = require('jsonwebtoken'); // for decode in logout
const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');

const router = express.Router();

const PASSWORD_MIN = 8;
const USERNAME_MIN = 3;
const MAX_REFRESH_TOKENS = 8;

// POST /register
router.post(
  '/register',
  body('username').isString().trim().isLength({ min: USERNAME_MIN }).withMessage(`username must be at least ${USERNAME_MIN} characters`),
  body('email').isEmail().withMessage('valid email required'),
  body('password').isLength({ min: PASSWORD_MIN }).withMessage(`password must be at least ${PASSWORD_MIN} characters`),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });

    const { username, email, password } = req.body;
    const cleanUsername = (username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    try {
      const existing = await User.findOne({
        $or: [{ email: cleanEmail }, { username: cleanUsername }]
      });

      if (existing) {
        if (existing.email === cleanEmail) return res.status(409).json({ message: 'Email already in use' });
        return res.status(409).json({ message: 'Username already in use' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const user = new User({
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        refreshTokens: []
      });

      await user.save();

      const accessToken = signAccessToken({ _id: user._id, email: user.email, username: user.username });
      const refreshToken = signRefreshToken({ _id: user._id });

      user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });

      if (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
        user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS);
      }

      await user.save();

      return res.status(201).json({
        message: 'User registered',
        user: { id: user._id, username: user.username, email: user.email },
        tokens: { accessToken, refreshToken }
      });
    } catch (err) {
      console.error('Register error:', err);

      if (err && err.code === 11000) {
        const dupKey = Object.keys(err.keyValue || {})[0];
        return res.status(409).json({ message: `${dupKey} already exists` });
      }

      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /login
router.post(
  '/login',
  body('email').isEmail().withMessage('valid email required'),
  body('password').isString().notEmpty().withMessage('password required'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid credentials', errors: errors.array() });

    const { email, password } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    try {
      const user = await User.findOne({ email: cleanEmail });
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

      const accessToken = signAccessToken({ _id: user._id, email: user.email, username: user.username });
      const refreshToken = signRefreshToken({ _id: user._id });

      user.refreshTokens.push({ token: refreshToken, createdAt: new Date() });
      if (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
        user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS);
      }
      await user.save();

      return res.json({
        message: 'Logged in',
        user: { id: user._id, username: user.username, email: user.email },
        tokens: { accessToken, refreshToken }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token required' });

  try {
    const payload = verifyRefreshToken(refreshToken);
    const userId = payload.sub;
    if (!userId) return res.status(401).json({ message: 'Invalid refresh token' });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'Invalid refresh token' });

    const found = user.refreshTokens.find(rt => rt.token === refreshToken);
    if (!found) {
      user.refreshTokens = [];
      await user.save();
      return res.status(401).json({ message: 'Refresh token not recognized' });
    }

    user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
    const newRefresh = signRefreshToken({ _id: user._id });
    user.refreshTokens.push({ token: newRefresh, createdAt: new Date() });

    if (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
      user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_TOKENS);
    }

    await user.save();

    const newAccess = signAccessToken({ _id: user._id, email: user.email, username: user.username });
    return res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// POST /logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(200).json({ message: 'Logged out' });

    let decoded;
    try {
      decoded = jwtDecode.decode(refreshToken);
    } catch (e) {
      decoded = null;
    }

    if (!decoded || !decoded.sub) return res.status(200).json({ message: 'Logged out' });

    // Atomic update to avoid triggering full-document validation
    await User.updateOne(
      { _id: decoded.sub },
      { $pull: { refreshTokens: { token: refreshToken } } }
    );

    return res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
