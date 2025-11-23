// models/Note.js
const mongoose = require('mongoose');

const CollaboratorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['editor','viewer','owner'], default: 'editor' },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const NoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collaborators: { type: [CollaboratorSchema], default: [] },

  title: { type: String, trim: true, default: '' },
  content: { type: String, trim: true, default: '' },
  pinned: { type: Boolean, default: false },
  tags: { type: [String], default: [] },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

NoteSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

NoteSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update) {
    update.updatedAt = Date.now();
    this.setUpdate(update);
  }
  next();
});

NoteSchema.index({ 'collaborators.userId': 1 });
NoteSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Note', NoteSchema);
