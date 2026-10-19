import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translations } from '../dashboard/src/i18n/translations.ts';

// Logic under test: Ticket Safety Rules
function canClaimTicket(userUid, ticketReporterId) {
  if (userUid === ticketReporterId) {
    return { allowed: false, reason: 'self_handling_forbidden' };
  }
  return { allowed: true };
}

function canAssignTicket(assignerUid, assigneeUid, ticketReporterId) {
  if (assigneeUid === ticketReporterId) {
    return { allowed: false, reason: 'cannot_assign_to_reporter' };
  }
  return { allowed: true };
}

function canCreateTicket(existingOpenTickets, newTitle, category, userEmail, username, description, targetUser = '') {
  if (!newTitle?.trim() || !description?.trim()) {
    return { allowed: false, reason: 'missing_fields' };
  }

  // Self-report protection including explicit targetUser
  if (category === 'report') {
    const fullText = `${newTitle} ${description}`.toLowerCase();
    const emailIdent = (userEmail || '').toLowerCase();
    const userIdent = (username || '').toLowerCase();
    const target = (targetUser || '').trim().toLowerCase();

    if (
      (target && (target === emailIdent || target === userIdent || (emailIdent && target.includes(emailIdent)))) ||
      (emailIdent && fullText.includes(emailIdent)) ||
      (userIdent && fullText.includes(userIdent))
    ) {
      return { allowed: false, reason: 'self_report_forbidden' };
    }
  }

  // Duplicate open ticket protection
  const hasDuplicate = existingOpenTickets.some(
    t => (t.status === 'open' || t.status === 'in_progress') &&
         t.title.trim().toLowerCase() === newTitle.trim().toLowerCase()
  );
  if (hasDuplicate) {
    return { allowed: false, reason: 'duplicate_open_ticket' };
  }

  return { allowed: true };
}

function canReplyToTicket(ticketStatus) {
  if (ticketStatus === 'closed' || ticketStatus === 'resolved') {
    return { allowed: false, reason: 'ticket_closed_locked' };
  }
  return { allowed: true };
}

function getMessageTheme(senderId, reporterId, senderRole) {
  if (senderRole === 'system') {
    return { type: 'system', color: 'slate', badge: 'System' };
  }
  if (senderId === reporterId || senderRole === 'user') {
    return { type: 'requester', color: 'cyan', badge: 'Ticket Creator' };
  }
  return { type: 'staff', color: 'indigo', badge: 'Staff Support' };
}

function getTicketStatusBadgeLabel(status, lang = 'de') {
  const dict = translations[lang] || translations.en;
  switch (status) {
    case 'open':
      return dict.statusOpen;
    case 'in_progress':
      return dict.statusInProgress;
    case 'resolved':
      return dict.statusResolved;
    case 'closed':
      return dict.statusClosed;
    default:
      return status;
  }
}

describe('Support Ticket Safety & Role Color Distinction', () => {
  it('prevents staff/owner from claiming their own ticket', () => {
    const ownerUid = 'user_owner_123';
    const result = canClaimTicket(ownerUid, ownerUid);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'self_handling_forbidden');

    // Different user claiming is allowed
    const staffUid = 'staff_456';
    const allowedResult = canClaimTicket(staffUid, ownerUid);
    assert.strictEqual(allowedResult.allowed, true);
  });

  it('prevents assigning ticket to the ticket creator', () => {
    const reporterUid = 'reporter_789';
    const adminUid = 'admin_001';
    
    // Assigning to reporter itself is forbidden
    const failAssign = canAssignTicket(adminUid, reporterUid, reporterUid);
    assert.strictEqual(failAssign.allowed, false);
    assert.strictEqual(failAssign.reason, 'cannot_assign_to_reporter');

    // Assigning to another staff is allowed
    const okAssign = canAssignTicket(adminUid, 'staff_999', reporterUid);
    assert.strictEqual(okAssign.allowed, true);
  });

  it('blocks filing self-reports against one own email, username, or targetUser field', () => {
    const userEmail = 'testuser@godhand.org';
    const username = 'TestAdmin';

    // 1. Text includes userEmail
    const selfReport1 = canCreateTicket([], 'Report on testuser@godhand.org', 'report', userEmail, username, 'He did something');
    assert.strictEqual(selfReport1.allowed, false);
    assert.strictEqual(selfReport1.reason, 'self_report_forbidden');

    // 2. Text includes username
    const selfReport2 = canCreateTicket([], 'Abuse report', 'report', userEmail, username, 'User testadmin broke rules');
    assert.strictEqual(selfReport2.allowed, false);
    assert.strictEqual(selfReport2.reason, 'self_report_forbidden');

    // 3. targetUser field matches userEmail
    const selfReport3 = canCreateTicket([], 'Suspicious actions', 'report', userEmail, username, 'Details here', 'testuser@godhand.org');
    assert.strictEqual(selfReport3.allowed, false);
    assert.strictEqual(selfReport3.reason, 'self_report_forbidden');

    // 4. targetUser field matches username
    const selfReport4 = canCreateTicket([], 'Suspicious actions', 'report', userEmail, username, 'Details here', 'TestAdmin');
    assert.strictEqual(selfReport4.allowed, false);
    assert.strictEqual(selfReport4.reason, 'self_report_forbidden');

    // Valid report against another user is allowed
    const validReport = canCreateTicket([], 'Bug report', 'report', userEmail, username, 'External user otherplayer griefed', 'otherplayer');
    assert.strictEqual(validReport.allowed, true);
  });

  it('blocks duplicate open tickets with identical titles', () => {
    const existing = [
      { id: '1', title: 'Server crash on ARM32', status: 'open' }
    ];

    const duplicateAttempt = canCreateTicket(existing, 'Server crash on ARM32', 'bug', 'u@a.com', 'user', 'Details');
    assert.strictEqual(duplicateAttempt.allowed, false);
    assert.strictEqual(duplicateAttempt.reason, 'duplicate_open_ticket');

    const differentTitle = canCreateTicket(existing, 'New feature request', 'other', 'u@a.com', 'user', 'Details');
    assert.strictEqual(differentTitle.allowed, true);
  });

  it('locks reply input when ticket is closed or resolved', () => {
    assert.strictEqual(canReplyToTicket('open').allowed, true);
    assert.strictEqual(canReplyToTicket('in_progress').allowed, true);
    assert.strictEqual(canReplyToTicket('resolved').allowed, false);
    assert.strictEqual(canReplyToTicket('closed').allowed, false);
  });

  it('distinguishes message colors between ticket creator (cyan), staff (indigo), and system (slate)', () => {
    const reporterId = 'rep_1';
    
    // Message from ticket creator
    const creatorMsg = getMessageTheme(reporterId, reporterId, 'user');
    assert.strictEqual(creatorMsg.color, 'cyan');
    assert.strictEqual(creatorMsg.badge, 'Ticket Creator');

    // Message from staff
    const staffMsg = getMessageTheme('staff_1', reporterId, 'admin');
    assert.strictEqual(staffMsg.color, 'indigo');
    assert.strictEqual(staffMsg.badge, 'Staff Support');

    // System message
    const sysMsg = getMessageTheme('SYSTEM', reporterId, 'system');
    assert.strictEqual(sysMsg.color, 'slate');
    assert.strictEqual(sysMsg.badge, 'System');
  });

  it('correctly labels status closed as Geschlossen in DE and Closed in EN', () => {
    assert.strictEqual(getTicketStatusBadgeLabel('closed', 'de'), 'Geschlossen');
    assert.strictEqual(getTicketStatusBadgeLabel('closed', 'en'), 'Closed');
    assert.strictEqual(getTicketStatusBadgeLabel('resolved', 'de'), 'Gelöst');
    assert.strictEqual(getTicketStatusBadgeLabel('resolved', 'en'), 'Resolved');
  });

  it('verifies all required ticket safety and filter keys exist with 100% EN/DE parity', () => {
    const requiredKeys = [
      'assign',
      'assignCase',
      'selectTeamMember',
      'closeTicket',
      'reopenTicket',
      'ticketClosedNotice',
      'ticketClosedSuccess',
      'ticketReopenedSuccess',
      'selfHandlingWarning',
      'selfReportError',
      'ticketRequesterBadge',
      'staffSupportBadge',
      'systemMessageBadge',
      'expandAllFolders',
      'collapseAllFolders',
      'filterAll',
      'filterOpen',
      'filterInProgress',
      'filterResolved',
      'filterClosed',
      'targetUserLabel',
      'targetUserPlaceholder',
      'unassigned'
    ];

    for (const key of requiredKeys) {
      assert.ok(translations.en[key], `Missing EN key: ${key}`);
      assert.ok(translations.de[key], `Missing DE key: ${key}`);
      assert.notStrictEqual(translations.en[key].trim(), '');
      assert.notStrictEqual(translations.de[key].trim(), '');
    }
  });

  it('verifies robust expandAll / collapseAll logic works correctly when initial state is empty', () => {
    const tree = [
      {
        path: 'src',
        type: 'folder',
        children: [
          { path: 'src/main', type: 'folder', children: [] }
        ]
      },
      { path: 'gradle', type: 'folder', children: [] }
    ];

    // Initial state: empty expandedFolders record
    let expandedFolders = {};

    const isFolderExpanded = (path, depth) => {
      return expandedFolders[path] !== undefined ? Boolean(expandedFolders[path]) : depth < 2;
    };

    const isAnyFolderOpen = (items, depth = 0) => {
      for (const item of items) {
        if (item.type === 'folder') {
          if (isFolderExpanded(item.path, depth)) return true;
          if (item.children && isAnyFolderOpen(item.children, depth + 1)) return true;
        }
      }
      return false;
    };

    // Initially, depth < 2 folders are visually expanded
    assert.strictEqual(isAnyFolderOpen(tree), true);

    // Clicking "Collapse All" should collapse EVERYTHING because folders are currently open
    const hasAnyOpen1 = isAnyFolderOpen(tree);
    assert.strictEqual(hasAnyOpen1, true);
    const targetState1 = !hasAnyOpen1; // false (collapse all)
    assert.strictEqual(targetState1, false);

    const newMap1 = {};
    const traverse = (items, state) => {
      for (const item of items) {
        if (item.type === 'folder') {
          newMap1[item.path] = state;
          if (item.children) traverse(item.children, state);
        }
      }
    };
    traverse(tree, targetState1);
    expandedFolders = newMap1;

    // Now all folders are collapsed
    assert.strictEqual(isAnyFolderOpen(tree), false);

    // Clicking again should EXPAND all folders
    const hasAnyOpen2 = isAnyFolderOpen(tree);
    assert.strictEqual(hasAnyOpen2, false);
    const targetState2 = !hasAnyOpen2; // true (expand all)
    assert.strictEqual(targetState2, true);

    const newMap2 = {};
    const traverse2 = (items, state) => {
      for (const item of items) {
        if (item.type === 'folder') {
          newMap2[item.path] = state;
          if (item.children) traverse2(item.children, state);
        }
      }
    };
    traverse2(tree, targetState2);
    expandedFolders = newMap2;

    // Now all folders are expanded
    assert.strictEqual(isAnyFolderOpen(tree), true);
  });
});
