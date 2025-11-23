// models/Task.js
const mongoose = require('mongoose');

const CollaboratorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['editor','commenter','viewer','owner'], default: 'editor' },
  addedAt: { type: Date, default: Date.now }
}, { _id: true });

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner
  collaborators: { type: [CollaboratorSchema], default: [] },

  title: { type: String, required: true },
  description: { type: String, default: '' },

  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },

  status: { type: String, enum: ['not started','active','completed'], default: 'not started' },
  done: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TaskSchema.pre('save', function (next) {
  if (this.status === 'completed') this.done = true;
  else this.done = false;
  this.updatedAt = Date.now();
  next();
});

TaskSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (!update) return next();
  if (update.status) update.done = (update.status === 'completed');
  update.updatedAt = Date.now();
  this.setUpdate(update);
  next();
});

TaskSchema.index({ 'collaborators.userId': 1 });
TaskSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Task', TaskSchema);
