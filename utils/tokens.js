// utils/tokens.js
const jwt = require('jsonwebtoken');

function _getUserId(input) {
  if (!input) return null;
  if (typeof input === 'string' && input.trim() !== '') return input;
  if (typeof input === 'object') {
    if (input.sub) return input.sub.toString ? input.sub.toString() : String(input.sub);
    if (input._id) return input._id.toString ? input._id.toString() : String(input._id);
    if (input.id) return input.id.toString ? input.id.toString() : String(input.id);
  }
  return null;
}

function _requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`${name} environment variable is not set`);
  return val;
}

const signAccessToken = (userOrPayload) => {
  const secret = _requireEnv('JWT_ACCESS_SECRET');
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
  const sub = _getUserId(userOrPayload);
  if (!sub) throw new Error('Cannot sign access token: missing user id (sub).');

  const payload = { sub };
  if (userOrPayload && typeof userOrPayload === 'object') {
    if (userOrPayload.email) payload.email = userOrPayload.email;
    if (userOrPayload.username) payload.username = userOrPayload.username;
  }
  return jwt.sign(payload, secret, { expiresIn });
};

const signRefreshToken = (userOrPayload) => {
  const secret = _requireEnv('JWT_REFRESH_SECRET');
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
  const sub = _getUserId(userOrPayload);
  if (!sub) throw new Error('Cannot sign refresh token: missing user id (sub).');
  const payload = { sub };
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyAccessToken = (token) => {
  const secret = _requireEnv('JWT_ACCESS_SECRET');
  return jwt.verify(token, secret);
};

const verifyRefreshToken = (token) => {
  const secret = _requireEnv('JWT_REFRESH_SECRET');
  return jwt.verify(token, secret);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
