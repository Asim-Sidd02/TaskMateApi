// utils/permissions.js
function isOwner(doc, caller) {
  if (!doc) return false;
  const callerNorm = _normalizeCaller(caller);
  const ownerId = _toIdString(doc.userId);
  if (ownerId && callerNorm.id) return ownerId === callerNorm.id;
  return false;
}
function _normalizeCaller(caller) {
  if (!caller) return { id: null, email: null };
  if (typeof caller === 'string') return { id: caller, email: null };
  // caller is likely req.user
  const id = caller.id ?? caller._id ?? caller.sub ?? null;
  const email = caller.email ? String(caller.email).toLowerCase() : null;
  return { id: _toIdString(id), email };
}
function _toIdString(v) {
  if (!v && v !== 0) return null;
  if (typeof v === 'string') return v;
  // Mongoose ObjectId or populated user object
  if (typeof v === 'object') {
    if (v._id) {
      try { return v._id.toString(); } catch (e) { return String(v._id); }
    }
    if (v.id) {
      try { return v.id.toString(); } catch (e) { return String(v.id); }
    }
    try { return v.toString(); } catch (e) { return null; }
  }
  return null;
}


function getCollaborator(resource, userId) {
  if (!resource || !resource.collaborators) return null;
  return resource.collaborators.find(c => c.userId.toString() === userId.toString()) || null;
}

function _normalizeCaller(caller) {
  if (!caller) return { id: null, email: null };
  if (typeof caller === 'string') return { id: caller, email: null };
  return { id: caller.id ? _toIdString(caller.id) : (caller._id ? _toIdString(caller._id) : null),
           email: caller.email ? String(caller.email).toLowerCase() : null };
}

function canEdit(doc, caller) {
  if (!doc) return false;
  const callerNorm = _normalizeCaller(caller);
  if (isOwner(doc, callerNorm)) return true;

  const collabs = Array.isArray(doc.collaborators) ? doc.collaborators : [];
  for (const c of collabs) {
    const collabUserId = _toIdString(c.userId);
    const collabEmail = c.email ? String(c.email).toLowerCase() : null;
    const role = c.role ? String(c.role).toLowerCase() : '';
    if (collabUserId && callerNorm.id && collabUserId === callerNorm.id) {
      if (role === 'editor' || role === 'owner') return true;
    }
    if (collabEmail && callerNorm.email && collabEmail === callerNorm.email) {
      if (role === 'editor' || role === 'owner') return true;
    }
  }
  return false;
}

function canComment(resource, userId) {
  if (!resource) return false;
  if (isOwner(resource, userId)) return true;
  const c = getCollaborator(resource, userId);
  return !!c && ['commenter', 'editor', 'owner'].includes(c.role);
}

function canView(doc, caller) {
  if (!doc) return false;
  const callerNorm = _normalizeCaller(caller);
  if (isOwner(doc, callerNorm)) return true;

  const collabs = Array.isArray(doc.collaborators) ? doc.collaborators : [];
  for (const c of collabs) {
    // collaborator may have userId (ObjectId/string), or email field when invited by email
    const collabUserId = _toIdString(c.userId);
    const collabEmail = c.email ? String(c.email).toLowerCase() : null;
    if (collabUserId && callerNorm.id && collabUserId === callerNorm.id) return true;
    if (collabEmail && callerNorm.email && collabEmail === callerNorm.email) return true;
  }
  return false;
}

module.exports = {
  isOwner,
  getCollaborator,
  canEdit,
  canComment,
  canView
};
