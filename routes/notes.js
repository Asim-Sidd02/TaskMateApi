// routes/notes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Note = require('../models/Note');
const User = require('../models/User');
const { isOwner, canEdit, canView } = require('../utils/permissions');

const router = express.Router();

// list notes (owned or collaborated) - populate collaborator user basic info
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const filter = { $or: [{ userId }, { 'collaborators.userId': userId }] };

    // populate collaborator user basic info (username, email) for frontend
    const notes = await Note.find(filter)
      .populate('collaborators.userId', 'username email')
      .sort({ pinned: -1, updatedAt: -1 })
      .lean();

    return res.json(notes);
  } catch (err) {
    console.error('Notes list error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// create note
router.post(
  '/',
  body('title').optional().isString(),
  body('content').optional().isString(),
  body('pinned').optional().isBoolean(),
  body('tags').optional().isArray(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });

    try {
      const { title = '', content = '', pinned = false, tags = [] } = req.body;
      const note = new Note({
        userId: req.user.id,
        title,
        content,
        pinned: !!pinned,
        tags: Array.isArray(tags) ? tags : []
      });
      await note.save();
      // populate collaborator info (none initially) for consistency
      const saved = await Note.findById(note._id).populate('collaborators.userId', 'username email').lean();
      return res.status(201).json(saved);
    } catch (err) {
      console.error('Create note error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// get note
router.get('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).populate('collaborators.userId', 'username email').lean();
    if (!note) return res.status(404).json({ message: 'Note not found' });

    // pass full req.user so permission helper can use id & email
    if (!canView(note, req.user)) return res.status(403).json({ message: 'Forbidden' });
    return res.json(note);
  } catch (err) {
    console.error('Get note error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// update note
router.put(
  '/:id',
  body('title').optional().isString(),
  body('content').optional().isString(),
  body('pinned').optional().isBoolean(),
  body('tags').optional().isArray(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });

    try {
      const note = await Note.findById(req.params.id);
      if (!note) return res.status(404).json({ message: 'Note not found' });

      if (!canEdit(note, req.user)) return res.status(403).json({ message: 'Forbidden' });

      const allowed = ['title', 'content', 'pinned', 'tags'];
      for (const k of allowed) {
        if (req.body[k] !== undefined) note[k] = req.body[k];
      }

      await note.save();
      const saved = await Note.findById(note._id).populate('collaborators.userId', 'username email').lean();
      return res.json(saved);
    } catch (err) {
      console.error('Update note error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// delete note (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!isOwner(note, req.user)) return res.status(403).json({ message: 'Only owner can delete' });

    await Note.deleteOne({ _id: note._id });
    return res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete note error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Collaborator endpoints for notes
 */

// POST /notes/:id/share
router.post(
  '/:id/share',
  body('userId').optional().isString(),
  body('email').optional().isEmail(),
  body('role').isIn(['editor', 'viewer']).withMessage('invalid role'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input', errors: errors.array() });

    try {
      const note = await Note.findById(req.params.id);
      if (!note) return res.status(404).json({ message: 'Note not found' });

      if (!isOwner(note, req.user)) return res.status(403).json({ message: 'Only owner can share' });

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

      if (note.userId.toString() === targetUser._id.toString()) return res.status(400).json({ message: 'User already owner' });

      const existing = note.collaborators.find(c => c.userId && c.userId.toString() === targetUser._id.toString());
      if (existing) existing.role = req.body.role;
      else note.collaborators.push({ userId: targetUser._id, role: req.body.role });

      await note.save();
      const saved = await Note.findById(note._id).populate('collaborators.userId', 'username email').lean();
      return res.status(200).json({
        message: 'Collaborator added/updated',
        collaborator: { id: targetUser._id, email: targetUser.email, role: req.body.role },
        note: saved
      });
    } catch (err) {
      console.error('Share note error:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /notes/:id/collaborators
router.get('/:id/collaborators', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).populate('collaborators.userId', 'username email').lean();
    if (!note) {
      console.error('List note collaborators: note not found id=', req.params.id);
      return res.status(404).json({ message: 'Note not found' });
    }

    console.log('List note collaborators: req.user=', req.user);
    console.log('List note collaborators: note.owner=', note.userId, 'collaborators=', note.collaborators);

    if (!canView(note, req.user)) {
      console.warn('List note collaborators: permission denied - caller=', req.user, 'noteId=', req.params.id);
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Normalize collaborators for frontend consumption:
    const normalized = (note.collaborators || []).map(c => {
      const userObj = c.userId && typeof c.userId === 'object' ? c.userId : null;
      return {
        id: userObj && userObj._id ? userObj._id : (c.userId ? c.userId : null),
        username: userObj && userObj.username ? userObj.username : (c.username ? c.username : null),
        email: userObj && userObj.email ? userObj.email : (c.email ? c.email : null),
        role: c.role || null,
        addedAt: c.addedAt || c.createdAt || null,
        collabId: c._id ? c._id : null
      };
    });

    return res.json(normalized);
  } catch (err) {
    console.error('List note collaborators error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /notes/:id/collaborators/:collabId
router.delete('/:id/collaborators/:collabId', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    if (!isOwner(note, req.user)) return res.status(403).json({ message: 'Only owner can remove collaborators' });

    const before = note.collaborators.length;
    note.collaborators = note.collaborators.filter(c => c._id.toString() !== req.params.collabId);
    if (note.collaborators.length === before) return res.status(404).json({ message: 'Collaborator not found' });

    await note.save();
    const saved = await Note.findById(note._id).populate('collaborators.userId', 'username email').lean();
    return res.json({ message: 'Removed', note: saved });
  } catch (err) {
    console.error('Remove note collaborator error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
