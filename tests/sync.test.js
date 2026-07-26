import test from 'node:test';
import assert from 'node:assert/strict';
import { canPerformProjectAction, getAssignmentAccess } from '../js/sync.js';

function project(overrides = {}) {
  return {
    assignment: {
      assignment_id: 'assignment-1',
      status: 'approved',
      role: 'PRIMARY_OPERATOR',
      access_starts_at: '2026-07-26T10:00:00.000Z',
      access_ends_at: '2026-07-26T18:00:00.000Z',
    },
    ...overrides,
  };
}

const duringWindow = new Date('2026-07-26T12:00:00.000Z');

test('approved assignment permits access during its window', () => {
  assert.equal(getAssignmentAccess(project(), duringWindow).allowed, true);
});

test('future, expired, and revoked assignments fail closed', () => {
  assert.equal(getAssignmentAccess(project(), new Date('2026-07-26T09:00:00.000Z')).allowed, false);
  assert.equal(getAssignmentAccess(project(), new Date('2026-07-26T18:00:00.000Z')).allowed, false);
  assert.equal(
    getAssignmentAccess(project({ assignment: { ...project().assignment, status: 'revoked' } }), duringWindow)
      .allowed,
    false
  );
});

test('role permissions keep QCM and read-only users from field capture', () => {
  const qcm = project({ assignment: { ...project().assignment, role: 'QCM_REVIEWER' } });
  const observer = project({ assignment: { ...project().assignment, role: 'READ_ONLY_OBSERVER' } });
  assert.equal(canPerformProjectAction(qcm, 'qcm_review', duringWindow).allowed, true);
  assert.equal(canPerformProjectAction(qcm, 'capture', duringWindow).allowed, false);
  assert.equal(canPerformProjectAction(observer, 'view', duringWindow).allowed, true);
  assert.equal(canPerformProjectAction(observer, 'notes', duringWindow).allowed, false);
});

test('quarantine preserves view access while blocking mutation', () => {
  const quarantined = project({
    mutation_quarantined: true,
    mutation_quarantine_reason: 'Unsynchronized work requires reconciliation.',
  });
  assert.equal(canPerformProjectAction(quarantined, 'view', duringWindow).allowed, true);
  assert.equal(canPerformProjectAction(quarantined, 'capture', duringWindow).allowed, false);
});
