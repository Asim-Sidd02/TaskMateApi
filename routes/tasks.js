
const express = require('express');
const { body, validationResult } = require('express-validator');
const Task = require('../models/Task');
const auth = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['not started', 'active', 'completed'];

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const tasks = await Task.find(filter).sort({ endDate: 1, createdAt: -1 }).lean();
    res.json(tasks);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post(
  '/',
  body('title').isString().notEmpty().withMessage('title is required'),
  body('description').optional().isString(),
  body('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date'),
  body('status').optional().isIn(VALID_STATUSES).withMessage('invalid status'),
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
      res.status(201).json(task);
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.put(
  '/:id',
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date'),
  body('status').optional().isIn(VALID_STATUSES).withMessage('invalid status'),
  body('done').optional().isBoolean(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });

    try {
      const id = req.params.id;
      const updates = {};
      const allowed = ['title', 'description', 'startDate', 'endDate', 'status', 'done'];

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          if (key === 'startDate' || key === 'endDate') {
            updates[key] = req.body[key] ? new Date(req.body[key]) : null;
          } else {
            updates[key] = req.body[key];
          }
        }
      }

      const task = await Task.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        updates,
        { new: true, runValidators: true, context: 'query' }
      );

      if (!task) return res.status(404).json({ message: 'Task not found' });
      res.json(task);
    } catch (err) {
      console.error('Update task error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const task = await Task.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
