// routes/tasks.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const User = require('../models/User');
const { isOwner, canEdit, canView } = require('../utils/permissions');

const router = express.Router();

const VALID_STATUSES = ['not started', 'active', 'completed'];

// LIST tasks - returns tasks user owns or collaborates on
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const filter = {
      $or: [
        { userId },
        { 'collaborators.userId': userId }
      ]
    };
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    const tasks = await Task.find(filter).sort({ endDate: 1, createdAt: -1 }).lean();
    return res.json(tasks);
  } catch (err) {
    console.error('Tasks list error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET single task (must have view)
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!canView(task, req.user.id)) return res.status(403).json({ message: 'Forbidden' });
    return res.json(task);
  } catch (err) {
    console.error('Get task error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// CREATE task (owner is req.user)
router.post(
  '/',
  body('title').isString().notEmpty().withMessage('title is required'),
  body('description').optional().isString(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('status').optional().isIn(VALID_STATUSES),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });

    try {
      const { title, description, startDate, endDate, status } = req.body;
      const task = new Task({
        userId: req.user.id,
        title,
        description: description || '',
        startDate: startDate ? new Date(startDate) : Date.now(),
        endDate: endDate ? new Date(endDate) : undefined,
        status: status && VALID_STATUSES.includes(status) ? status : 'not started'
      });
      await task.save();
      return res.status(201).json(task);
    } catch (err) {
      console.error('Create task error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// UPDATE task (owner or editor)
router.put(
  '/:id',
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
  body('status').optional().isIn(VALID_STATUSES),
  body('done').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });

    try {
      const id = req.params.id;
      const task = await Task.findById(id);
      if (!task) return res.status(404).json({ message: 'Task not found' });

      if (!canEdit(task, req.user.id)) return res.status(403).json({ message: 'Forbidden' });

      const allowed = ['title', 'description', 'startDate', 'endDate', 'status', 'done'];
      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          if (key === 'startDate' || key === 'endDate') {
            task[key] = req.body[key] ? new Date(req.body[key]) : null;
          } else {
            task[key] = req.body[key];
          }
        }
      }

      await task.save();
      return res.json(task);
    } catch (err) {
      console.error('Update task error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// DELETE task (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!isOwner(task, req.user.id)) return res.status(403).json({ message: 'Only owner can delete' });

    await Task.deleteOne({ _id: task._id });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Collaborators API
 */

// POST /tasks/:id/share  -> add or update collaborator (owner only)
router.post(
  '/:id/share',
  body('userId').optional().isString(),
  body('email').optional().isEmail(),
  body('role').isIn(['editor', 'commenter', 'viewer']).withMessage('invalid role'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });
    try {
      const task = await Task.findById(req.params.id);
      if (!task) return res.status(404).json({ message: 'Task not found' });

      if (!isOwner(task, req.user.id)) return res.status(403).json({ message: 'Only owner can share' });

      let targetUser = null;
      if (req.body.userId) {
        targetUser = await User.findById(req.body.userId);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });
      } else if (req.body.email) {
        targetUser = await User.findOne({ email: req.body.email.toLowerCase() });
        if (!targetUser) return res.status(404).json({ message: 'User not found by email' });
      } else {
        return res.status(400).json({ message: 'userId or email required' });
      }

      // prevent adding owner as collaborator
      if (task.userId.toString() === targetUser._id.toString()) {
        return res.status(400).json({ message: 'User is already owner' });
      }

      const existing = task.collaborators.find(c => c.userId.toString() === targetUser._id.toString());
      if (existing) {
        existing.role = req.body.role;
      } else {
        task.collaborators.push({ userId: targetUser._id, role: req.body.role });
      }

      await task.save();
      return res.status(200).json({ message: 'Collaborator added/updated', collaborator: { id: targetUser._id, email: targetUser.email, role: req.body.role } });
    } catch (err) {
      console.error('Share task error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET collaborators
router.get('/:id/collaborators', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('collaborators.userId', 'username email').lean();
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!canView(task, req.user.id)) return res.status(403).json({ message: 'Forbidden' });

    return res.json(task.collaborators);
  } catch (err) {
    console.error('List collaborators error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE collaborator (owner only)
router.delete('/:id/collaborators/:collabId', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (!isOwner(task, req.user.id)) return res.status(403).json({ message: 'Only owner can remove collaborators' });

    const before = task.collaborators.length;
    task.collaborators = task.collaborators.filter(c => c._id.toString() !== req.params.collabId);
    if (task.collaborators.length === before) return res.status(404).json({ message: 'Collaborator not found' });

    await task.save();
    return res.json({ message: 'Removed' });
  } catch (err) {
    console.error('Remove collaborator error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
