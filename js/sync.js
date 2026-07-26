/**
 * Offline-first assigned-project inbox/outbox synchronization.
 * Local writes always complete first; network delivery is best-effort and idempotent.
 */

import { getUsableSession } from './auth.js';
import {
  getProject,
  getSyncOutboxEvents,
  quarantineProjectMutations,
  saveHandoffReceipt,
  saveProject,
  saveSyncInboxRecord,
  saveSyncOutboxEvent,
  updateSyncOutboxEvent,
} from './storage.js';

function createUuid(prefixSeed = 'evt') {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const seed = `${prefixSeed}-${Date.now()}-${Math.random()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const hex = hash.toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex}${hex}`.slice(0, 36);
}

export const SYNC_EVENT_TYPES = new Set([
  'assignment_received',
  'assignment_accepted',
  'field_work_started',
  'capture_item_completed',
  'field_submission_ready',
  'field_submission_completed',
  'qcm_started',
  'qcm_returned',
  'qcm_accepted',
  'field_access_revoked',
  'sync_conflict',
]);

const ROLE_PERMISSIONS = {
  PRIMARY_OPERATOR: new Set(['view', 'capture', 'checklist', 'notes', 'submit']),
  ASSISTANT_OPERATOR: new Set(['view', 'capture', 'notes']),
  REMOTE_PILOT_IN_COMMAND: new Set(['view', 'aerial_capture', 'attest']),
  VISUAL_OBSERVER: new Set(['view', 'participation']),
  FIELD_SUPERVISOR: new Set(['view', 'capture', 'checklist', 'notes', 'submit', 'supervise']),
  QCM_REVIEWER: new Set(['view', 'qcm_review']),
  READ_ONLY_OBSERVER: new Set(['view']),
};

function nowIso() {
  return new Date().toISOString();
}

export function getAssignmentAccess(project, now = new Date()) {
  const assignment = project?.assignment;
  if (!assignment) return { allowed: false, reason: 'No approved assignment is cached.' };
  if (['revoked', 'expired'].includes(assignment.status)) {
    return { allowed: false, reason: `Assignment is ${assignment.status}.` };
  }
  const timestamp = now.getTime();
  if (assignment.access_starts_at && new Date(assignment.access_starts_at).getTime() > timestamp) {
    return { allowed: false, reason: 'Assignment access window has not started.' };
  }
  if (assignment.access_ends_at && new Date(assignment.access_ends_at).getTime() <= timestamp) {
    return { allowed: false, reason: 'Assignment access window has expired.' };
  }
  return { allowed: true, reason: null };
}

export function canPerformProjectAction(project, action, now = new Date()) {
  const access = getAssignmentAccess(project, now);
  if (!access.allowed) return access;
  const permissions = ROLE_PERMISSIONS[project.assignment.role] || new Set();
  if (!permissions.has(action)) {
    return { allowed: false, reason: `${project.assignment.role || 'Unknown role'} cannot ${action}.` };
  }
  if (project.mutation_quarantined && action !== 'view') {
    return { allowed: false, reason: project.mutation_quarantine_reason || 'Mutations are quarantined.' };
  }
  return { allowed: true, reason: null };
}

export async function queueStatusEvent(projectId, type, payload = {}) {
  if (!SYNC_EVENT_TYPES.has(type)) throw new Error(`Unsupported sync event: ${type}`);
  const project = await getProject(projectId);
  const event = {
    event_id: payload.event_id || createUuid('evt'),
    project_id: projectId,
    server_project_id: project?.server_project_id || payload.server_project_id || null,
    event_type: type,
    occurred_at: payload.occurred_at || nowIso(),
    correlation_id: payload.correlation_id || createUuid('corr'),
    sequence: Number(payload.sequence || Date.now()),
    payload: { ...payload, event_id: undefined },
    status: 'pending',
    attempts: 0,
    created_at: nowIso(),
  };
  await saveSyncOutboxEvent(event);
  return event;
}

async function authorizedFetch(path, options = {}) {
  const session = await getUsableSession({ allowExpiredOffline: false });
  if (!session?.access_token) throw new Error('Online authentication is required to synchronize.');
  return fetch(path, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

export async function pullAssignedProjects({ cursor = null } = {}) {
  if (!navigator.onLine) return { status: 'offline', downloaded: 0 };
  const url = new URL('/api/sync/assigned-projects', window.location.origin);
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await authorizedFetch(url.toString());
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Assignment synchronization failed.');

  const session = await getUsableSession();
  let downloaded = 0;
  for (const incoming of payload.projects || []) {
    const projectId = incoming.uecs_project_id || incoming.project_id || incoming.id;
    const local = await getProject(projectId);
    const sourceAssignment = incoming.assignment || incoming.assignments?.[0];
    const assignment = sourceAssignment
      ? {
          ...sourceAssignment,
          assignment_id: sourceAssignment.assignment_id || sourceAssignment.id,
          role: sourceAssignment.role || sourceAssignment.roles?.[0],
          status:
            sourceAssignment.status ||
            (sourceAssignment.ended_at ? incoming.status === 'revoked' ? 'revoked' : 'expired' : 'approved'),
        }
      : null;
    if (!assignment) continue;

    if (['revoked', 'expired'].includes(assignment.status)) {
      const revokedProject = {
        ...(local || incoming.project || incoming),
        assignment,
        project_id: projectId,
        local_owner_account_id: session.account_id,
        server_revision: incoming.revision || Number(local?.server_revision || 0) + 1,
        sync_status: assignment.status,
        mutation_quarantined: !!local?.unsynchronized_changes,
        mutation_quarantine_reason: local?.unsynchronized_changes
          ? 'Access ended while local work was unsynchronized; supervisor reconciliation is required.'
          : `Field access is ${assignment.status}.`,
        synced_at: nowIso(),
      };
      await saveProject(revokedProject);
      await queueStatusEvent(projectId, 'field_access_revoked', {
        assignment_id: assignment.assignment_id,
        status: assignment.status,
      });
      downloaded += 1;
      continue;
    }

    if (local?.unsynchronized_changes && incoming.revision > Number(local.server_revision || 0)) {
      await quarantineProjectMutations(projectId, 'Server scope changed while local work was unsynchronized.');
      await queueStatusEvent(projectId, 'sync_conflict', {
        local_revision: local.server_revision,
        server_revision: incoming.revision,
      });
      continue;
    }

    const project = {
      ...(incoming.packet?.packet?.project || incoming.packet?.packet || {}),
      ...(incoming.project || incoming),
      project_id: projectId,
      server_project_id: incoming.id || incoming.server_project_id,
      assignment,
      local_owner_account_id: session.account_id,
      server_revision: incoming.revision || incoming.packet?.revision || 1,
      synced_at: nowIso(),
      sync_status: 'synced',
      governance_locked: true,
    };
    await saveProject(project);
    await saveSyncInboxRecord({
      inbox_id: `${projectId}:${project.server_revision}`,
      project_id: projectId,
      revision: project.server_revision,
      received_at: nowIso(),
      status: 'applied',
    });
    await queueStatusEvent(projectId, 'assignment_received', {
      correlation_id: incoming.correlation_id,
      assignment_id: assignment.assignment_id,
    });
    downloaded += 1;
  }

  for (const receipt of payload.receipts || []) {
    await saveHandoffReceipt(receipt);
  }
  return { status: 'synced', downloaded, cursor: payload.next_cursor || payload.cursor || null };
}

export async function flushSyncOutbox() {
  if (!navigator.onLine) return { status: 'offline', sent: 0, pending: 0 };
  const events = await getSyncOutboxEvents('pending');
  if (!events.length) return { status: 'idle', sent: 0, pending: 0 };
  let sent = 0;
  for (const event of events) {
    if (!event.server_project_id) continue;
    const response = await authorizedFetch('/api/sync/status-events', {
      method: 'POST',
      body: JSON.stringify({
        schema_version: 'fieldcapture.status.v1',
        client_event_id: event.event_id,
        project_id: event.server_project_id,
        ...(event.payload?.device_id ? { device_id: event.payload.device_id } : {}),
        status: event.event_type,
        event_at: event.occurred_at,
        data: {
          ...event.payload,
          correlation_id: event.correlation_id,
          sequence: event.sequence,
          local_project_id: event.project_id,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      await updateSyncOutboxEvent(event.event_id, {
        attempts: Number(event.attempts || 0) + 1,
        last_error: payload.error || `HTTP ${response.status}`,
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      });
      continue;
    }
    await updateSyncOutboxEvent(event.event_id, {
      status: 'sent',
      sent_at: nowIso(),
      attempts: Number(event.attempts || 0) + 1,
      last_error: null,
    });
    sent += 1;
  }
  return { status: 'synced', sent, pending: events.length - sent };
}

export async function synchronizeNow(options = {}) {
  if (!navigator.onLine) return { status: 'offline', pull: null, push: null };
  const pull = await pullAssignedProjects(options);
  let push;
  try {
    push = await flushSyncOutbox();
  } catch (error) {
    push = { status: 'retry_pending', error: error.message };
  }
  return { status: 'complete', pull, push };
}
