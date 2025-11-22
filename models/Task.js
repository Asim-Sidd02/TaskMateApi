const mongoose = require('mongoose');

const validStatuses = ['not started', 'active', 'completed'];

const TaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  status: { type: String, enum: validStatuses, default: 'not started' },
  done: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

TaskSchema.pre('save', function (next) {
  this.done = (this.status === 'completed');
  this.updatedAt = Date.now();
  next();
});

TaskSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  if (!update.$set) update.$set = {};

  const hasStatusTopLevel = Object.prototype.hasOwnProperty.call(update, 'status');
  const hasStatusInSet = Object.prototype.hasOwnProperty.call(update.$set, 'status');

  if (hasStatusTopLevel) {
    update.$set.status = update.status;
    delete update.status;
  }

  if (hasStatusInSet) {
    update.$set.done = (update.$set.status === 'completed');
  } else if (hasStatusTopLevel) {
    update.$set.done = (update.$set.status === 'completed');
  }

  update.$set.updatedAt = Date.now();

  this.setUpdate(update);
  next();
});

module.exports = mongoose.model('Task', TaskSchema);
