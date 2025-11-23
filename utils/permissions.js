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
  return { id: caller.id ? _toIdString(caller.id) : (caller._id ? _toIdString(caller._id) : null),
           email: caller.email ? String(caller.email).toLowerCase() : null };
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
    if (c.userId && callerNorm.id && _toIdString(c.userId) === callerNorm.id) {
      return c.role === 'editor' || c.role === 'owner';
    }
    if (c.email && callerNorm.email && String(c.email).toLowerCase() === callerNorm.email) {
      return c.role === 'editor' || c.role === 'owner';
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
  // match by userId if present, else by email
  for (const c of collabs) {
    if (c.userId && callerNorm.id && _toIdString(c.userId) === callerNorm.id) return true;
    if (c.email && callerNorm.email && String(c.email).toLowerCase() === callerNorm.email) return true;
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
