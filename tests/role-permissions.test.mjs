import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const OWNER_EMAIL = 'ggjonasgameryt@gmail.com';

// Hierarchy: owner (4) > admin (3) > moderator (2) > supporter (1) > user (0)
const ROLE_WEIGHTS = {
  owner: 4,
  admin: 3,
  moderator: 2,
  supporter: 1,
  user: 0
};

function getEffectiveRole(userEmail, assignedRole) {
  if (userEmail && userEmail.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    return 'owner';
  }
  if (['admin', 'moderator', 'supporter'].includes(assignedRole)) {
    return assignedRole;
  }
  return 'user';
}

function hasPermission(userRole, requiredRole) {
  const currentWeight = ROLE_WEIGHTS[userRole] || 0;
  const targetWeight = ROLE_WEIGHTS[requiredRole] || 0;
  return currentWeight >= targetWeight;
}

function canAccessTab(userRole, tab) {
  switch (tab) {
    case 'chat':
    case 'tickets':
      return hasPermission(userRole, 'supporter'); // all staff
    case 'moderation':
      return hasPermission(userRole, 'moderator');
    case 'team':
    case 'audit':
    case 'system':
    case 'arm32mod':
      return hasPermission(userRole, 'admin'); // Admin & Owner only
    default:
      return false;
  }
}

function canClaimTicket(userRole) {
  return hasPermission(userRole, 'supporter');
}

function canAssignTicket(assignerRole, targetUserRole) {
  // Can only assign if assigner is staff and has equal or higher authority, or is at least mod
  if (!hasPermission(assignerRole, 'moderator')) return false;
  return true;
}

describe('Team & Role RBAC Permissions Test Suite', () => {
  it('correctly maps OWNER_EMAIL to permanent owner role', () => {
    assert.strictEqual(getEffectiveRole('ggjonasgameryt@gmail.com', 'user'), 'owner');
    assert.strictEqual(getEffectiveRole('GGJONASGAMERYT@GMAIL.COM', 'supporter'), 'owner');
    assert.strictEqual(getEffectiveRole('other@user.com', 'admin'), 'admin');
    assert.strictEqual(getEffectiveRole('other@user.com', 'invalid_role'), 'user');
  });

  it('enforces tab access by role hierarchy', () => {
    // Owner can access all
    assert.strictEqual(canAccessTab('owner', 'system'), true);
    assert.strictEqual(canAccessTab('owner', 'audit'), true);
    assert.strictEqual(canAccessTab('owner', 'moderation'), true);
    assert.strictEqual(canAccessTab('owner', 'tickets'), true);

    // Admin can access audit and system, but normal user cannot
    assert.strictEqual(canAccessTab('admin', 'system'), true);
    assert.strictEqual(canAccessTab('admin', 'arm32mod'), true);
    assert.strictEqual(canAccessTab('moderator', 'arm32mod'), false);
    assert.strictEqual(canAccessTab('user', 'arm32mod'), false);
    assert.strictEqual(canAccessTab('moderator', 'system'), false);
    assert.strictEqual(canAccessTab('supporter', 'system'), false);
    assert.strictEqual(canAccessTab('user', 'system'), false);

    // Supporter can access tickets and chat, but not moderation
    assert.strictEqual(canAccessTab('supporter', 'tickets'), true);
    assert.strictEqual(canAccessTab('supporter', 'chat'), true);
    assert.strictEqual(canAccessTab('supporter', 'moderation'), false);

    // Regular user cannot access any staff tabs
    assert.strictEqual(canAccessTab('user', 'chat'), false);
    assert.strictEqual(canAccessTab('user', 'tickets'), false);
  });

  it('validates ticket claims and assignments', () => {
    assert.strictEqual(canClaimTicket('supporter'), true);
    assert.strictEqual(canClaimTicket('moderator'), true);
    assert.strictEqual(canClaimTicket('admin'), true);
    assert.strictEqual(canClaimTicket('user'), false);

    // Moderator+ can assign tickets
    assert.strictEqual(canAssignTicket('moderator', 'supporter'), true);
    assert.strictEqual(canAssignTicket('supporter', 'moderator'), false);
  });
});
