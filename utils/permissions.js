// utils/permissions.js
function isOwner(resource, userId) {
  if (!resource) return false;
  if (!resource.userId) return false;
  return resource.userId.toString() === userId.toString();
}

function getCollaborator(resource, userId) {
  if (!resource || !resource.collaborators) return null;
  return resource.collaborators.find(c => c.userId.toString() === userId.toString()) || null;
}

function canEdit(resource, userId) {
  if (!resource) return false;
  if (isOwner(resource, userId)) return true;
  const c = getCollaborator(resource, userId);
  return !!c && (c.role === 'editor' || c.role === 'owner');
}

function canComment(resource, userId) {
  if (!resource) return false;
  if (isOwner(resource, userId)) return true;
  const c = getCollaborator(resource, userId);
  return !!c && ['commenter', 'editor', 'owner'].includes(c.role);
}

function canView(resource, userId) {
  if (!resource) return false;
  if (isOwner(resource, userId)) return true;
  const c = getCollaborator(resource, userId);
  return !!c && ['viewer', 'commenter', 'editor', 'owner'].includes(c.role);
}

module.exports = {
  isOwner,
  getCollaborator,
  canEdit,
  canComment,
  canView
};
