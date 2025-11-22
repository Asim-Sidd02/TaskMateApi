const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    refreshTokens: { type: [RefreshTokenSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
