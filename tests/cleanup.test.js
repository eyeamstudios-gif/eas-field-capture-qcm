import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  V2_STORES,
  normalizeCleanupStatus,
  isPendingCleanupStatus,
  getProjectStatuses,
  sanitizeBackupValue,
  canonicalJson,
  sha256Checksum,
  buildCleanupInventory,
  assessCleanupEligibility,
  buildCleanupPreview,
  createCleanupBackup,
  verifyCleanupBackup,
  createCleanupManifest,
  buildConfirmationPhrase,
  validateCleanupExecution,
  hardDeleteProjectWithTombstone,
  openCleanupDatabase,
} from '../js/cleanup.js';

function project(overrides = {}) {
  return {
    project_id: 'project-draft-1',
    field_packet_status: 'queued_for_field_capture',
    created_at: '2026-07-26T12:00:00.000Z',
    ...overrides,
  };
}

function snapshot(projects = [project()], overrides = {}) {
  return {
    dbName: 'field_capture_qcm',
    dbVersion: 2,
    stores: {
      projects,
      images: [],
      image_blobs: [],
      qcm_results: [],
      shotlist_status: [],
      exports: [],
      uecs_lite_queue: [],
      ...overrides,
    },
  };
}

test('v2 store contract names all current legacy stores', () => {
  assert.deepEqual(V2_STORES, [
    'projects',
    'images',
    'image_blobs',
    'qcm_results',
    'shotlist_status',
    'exports',
    'uecs_lite_queue',
  ]);
});

test('pending status aliases normalize and map conservatively', () => {
  for (const status of [
    'queued_for_field_capture',
    'Pending',
    'draft',
    'imported',
    'imported-not-started',
    'assigned not accepted',
    'queued',
  ]) {
    assert.equal(isPendingCleanupStatus(status), true, status);
  }
  assert.equal(normalizeCleanupStatus(' Assigned / Not-Accepted '), 'assigned_not_accepted');
  assert.equal(isPendingCleanupStatus('field_capture_in_progress'), false);
  assert.deepEqual(
    getProjectStatuses({
      field_packet_status: 'queued_for_field_capture',
      assignment: { status: 'assigned-not-accepted' },
    }),
    ['queued_for_field_capture', 'assigned_not_accepted']
  );
});

test('a pristine pending project is eligible', () => {
  const [inventory] = buildCleanupInventory(snapshot());
  assert.deepEqual(assessCleanupEligibility(inventory), {
    project_id: 'project-draft-1',
    eligible: true,
    statuses: ['queued_for_field_capture'],
    reasons: [],
    record_counts: {
      exports: 0,
      handoff_receipts: 0,
      image_blobs: 0,
      images: 0,
      qcm_results: 0,
      shotlist_status: 0,
      sync_inbox: 0,
      sync_outbox: 0,
      uecs_lite_queue: 0,
    },
  });
});

test('inventory associates blob and QCM records through image IDs', () => {
  const data = snapshot([project(), project({ project_id: 'other' })], {
    images: [{ image_id: 'img-1', project_id: 'project-draft-1' }],
    image_blobs: [{ image_id: 'img-1', blob: { size: 3 } }],
    qcm_results: [{ image_id: 'img-1', qcm_status: 'PASS' }],
  });
  const inventory = buildCleanupInventory(data)[0];
  assert.equal(inventory.records.images.length, 1);
  assert.equal(inventory.records.image_blobs.length, 1);
  assert.equal(inventory.records.qcm_results.length, 1);
  assert.deepEqual(assessCleanupEligibility(inventory).reasons, [
    'has_image_blobs',
    'has_images',
    'has_qcm_activity',
  ]);
});

test('eligibility excludes every protected content category', () => {
  const cases = [
    ['completed lifecycle', snapshot([project({ project_status: 'completed' })]), 'protected_lifecycle_status'],
    ['accepted timestamp', snapshot([project({ accepted_at: '2026-07-25T12:00:00Z' })]), 'protected_lifecycle_status'],
    ['completed checklist', snapshot([project()], {
      shotlist_status: [{ project_id: 'project-draft-1', zones: [{ captured: true }] }],
    }), 'completed_checklist'],
    ['notes', snapshot([project({ annotations: ['do not remove'] })]), 'has_notes_or_annotations'],
    ['QCM', snapshot([project({ qcm_status: 'pending' })]), 'has_qcm_activity'],
    ['export', snapshot([project()], {
      exports: [{ export_id: 'exp-1', project_id: 'project-draft-1' }],
    }), 'has_submission_or_export'],
    ['queue', snapshot([project()], {
      uecs_lite_queue: [{ queue_id: 'q-1', project_id: 'project-draft-1' }],
    }), 'has_submission_or_export'],
    ['sync', snapshot([project()], {
      sync_outbox: [{ event_id: 'event-1', project_id: 'project-draft-1' }],
    }), 'has_sync_or_custody_events'],
    ['custody in later store', snapshot([project()], {
      custody_events: [{ event_id: 'custody-1', project_id: 'project-draft-1' }],
    }), 'has_sync_or_custody_events'],
    ['future submission store', snapshot([project()], {
      submission_receipts: [{ receipt_id: 'submit-1', project_id: 'project-draft-1' }],
    }), 'has_submission_or_export'],
    ['future QCM store', snapshot([project()], {
      qcm_reviews: [{ review_id: 'review-1', project_id: 'project-draft-1' }],
    }), 'has_qcm_activity'],
    ['legal hold', snapshot([project({ legal_hold: true })]), 'legal_hold_or_retention'],
    ['retention', snapshot([project({ retention_until: '2030-01-01' })]), 'legal_hold_or_retention'],
    ['evidence', snapshot([project({ evidence_id: 'ev-1' })]), 'evidence_or_uecs_linkage'],
    ['future evidence store', snapshot([project()], {
      evidence_links: [{ link_id: 'ev-link-1', project_id: 'project-draft-1' }],
    }), 'evidence_or_uecs_linkage'],
    ['UECS linkage', snapshot([project({ uecs_project_id: 'uecs-1' })]), 'evidence_or_uecs_linkage'],
    ['ClientFlow handoff', snapshot([project({
      linked_to_clientflow: true,
      clientflow_request_id: 'cf-1',
      field_handoff_issued: true,
    })]), 'clientflow_handoff_requires_reconciliation'],
  ];
  for (const [name, data, expected] of cases) {
    const assessment = assessCleanupEligibility(buildCleanupInventory(data)[0]);
    assert.equal(assessment.eligible, false, name);
    assert.ok(assessment.reasons.includes(expected), `${name}: ${assessment.reasons}`);
  }
});

test('non-pending and mixed protected statuses are blocked', () => {
  const noStatus = assessCleanupEligibility(buildCleanupInventory(snapshot([
    project({ field_packet_status: undefined }),
  ]))[0]);
  assert.ok(noStatus.reasons.includes('not_pending_status'));

  const mixed = assessCleanupEligibility(buildCleanupInventory(snapshot([
    project({ assignment: { status: 'accepted' } }),
  ]))[0]);
  assert.ok(mixed.reasons.includes('protected_lifecycle_status'));
});

test('preview is deterministic, machine-readable, dry-run, and exact-ID scoped', () => {
  const data = snapshot([
    project({ project_id: 'b' }),
    project({ project_id: 'a', notes: 'preserve' }),
  ]);
  const preview = buildCleanupPreview(data, {
    environment: 'local-device-prod',
    projectIds: ['missing', 'b'],
  });
  assert.equal(preview.dry_run, true);
  assert.deepEqual(preview.requested_project_ids, ['b', 'missing']);
  assert.deepEqual(preview.eligible_project_ids, ['b']);
  assert.deepEqual(preview.unknown_project_ids, ['missing']);
  assert.deepEqual(JSON.parse(JSON.stringify(preview)), preview);
});

test('backup is scoped, redacts secrets and signed URLs, and verifies counts', () => {
  const data = snapshot([
    project({
      project_id: 'safe',
      api_key: 'secret-value',
      reference_url: 'https://example.test/file?X-Amz-Signature=abc&X-Amz-Expires=60',
      public_url: 'https://example.test/public',
    }),
    project({ project_id: 'not-selected' }),
  ]);
  const preview = buildCleanupPreview(data, {
    environment: 'local-test',
    projectIds: ['safe'],
  });
  const backup = createCleanupBackup(data, preview, '2026-07-26T13:00:00.000Z');
  assert.deepEqual(backup.project_ids, ['safe']);
  assert.equal(backup.stores.projects[0].api_key, '[REDACTED]');
  assert.equal(backup.stores.projects[0].reference_url, '[REDACTED_SIGNED_URL]');
  assert.equal(backup.stores.projects[0].public_url, 'https://example.test/public');
  assert.equal(verifyCleanupBackup(canonicalJson(backup), { projectIds: ['safe'] }).valid, true);

  const tampered = structuredClone(backup);
  tampered.record_counts.projects = 2;
  assert.ok(verifyCleanupBackup(tampered).errors.includes('count_mismatch:projects'));
});

test('sanitizer handles nested credentials and rejects cycles', () => {
  assert.deepEqual(
    sanitizeBackupValue({ nested: { authorization: 'Bearer value', ordinary: true } }),
    { nested: { authorization: '[REDACTED]', ordinary: true } }
  );
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => sanitizeBackupValue(cyclic), /cyclic/);
});

test('canonical JSON and SHA-256 are deterministic', async () => {
  assert.equal(canonicalJson({ z: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"z":1}');
  assert.equal(
    await sha256Checksum('abc', webcrypto),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('manifest binds exact IDs, counts, environment, and backup checksum', async () => {
  const data = snapshot([project({ project_id: 'safe' })]);
  const preview = buildCleanupPreview(data, {
    environment: 'technician-device-01',
    projectIds: ['safe'],
  });
  const backup = createCleanupBackup(data, preview, '2026-07-26T13:00:00.000Z');
  const result = await createCleanupManifest(backup, preview, {
    crypto: webcrypto,
    manifestId: 'cleanup-test',
    createdAt: '2026-07-26T13:01:00.000Z',
  });
  assert.equal(result.manifest.manifest_id, 'cleanup-test');
  assert.equal(result.manifest.environment, 'technician-device-01');
  assert.deepEqual(result.manifest.project_ids, ['safe']);
  assert.equal(result.manifest.backup_sha256.length, 64);
  assert.equal(result.backup_json, canonicalJson(backup));
});

test('execution validation requires all independent controls', async () => {
  const data = snapshot([project({ project_id: 'safe' })]);
  const preview = buildCleanupPreview(data, {
    environment: 'local-production',
    projectIds: ['safe'],
  });
  const backup = createCleanupBackup(data, preview);
  const { manifest } = await createCleanupManifest(backup, preview, { crypto: webcrypto });
  const authorized = {
    dryRun: false,
    environment: manifest.environment,
    projectIds: ['safe'],
    manifest,
    backup,
    confirmationPhrase: buildConfirmationPhrase(manifest),
  };
  assert.deepEqual(await validateCleanupExecution(authorized, webcrypto), {
    valid: true,
    errors: [],
    project_ids: ['safe'],
  });

  const denied = await validateCleanupExecution({
    ...authorized,
    dryRun: true,
    environment: 'wrong',
    projectIds: ['other'],
    confirmationPhrase: 'yes',
  }, webcrypto);
  assert.equal(denied.valid, false);
  assert.ok(denied.errors.includes('dry_run_is_default'));
  assert.ok(denied.errors.includes('environment_mismatch'));
  assert.ok(denied.errors.includes('project_ids_not_exact'));
  assert.ok(denied.errors.includes('confirmation_phrase_mismatch'));
});

test('tampered backup fails checksum authorization', async () => {
  const data = snapshot([project({ project_id: 'safe' })]);
  const preview = buildCleanupPreview(data, { environment: 'local', projectIds: ['safe'] });
  const backup = createCleanupBackup(data, preview);
  const { manifest } = await createCleanupManifest(backup, preview, { crypto: webcrypto });
  const tampered = structuredClone(backup);
  tampered.stores.projects[0].created_at = 'changed';
  const result = await validateCleanupExecution({
    dryRun: false,
    environment: 'local',
    projectIds: ['safe'],
    manifest,
    backup: tampered,
    confirmationPhrase: buildConfirmationPhrase(manifest),
  }, webcrypto);
  assert.ok(result.errors.includes('backup_checksum_mismatch'));
});

test('hard delete helper writes tombstone before deleting keyed records', () => {
  const operations = [];
  const stores = {
    audit_tombstones: { name: 'audit_tombstones', keyPath: 'tombstone_id', put: (v) => operations.push(['put-tombstone', v]) },
    projects: { name: 'projects', keyPath: 'project_id', delete: (v) => operations.push(['delete-project', v]) },
    images: { name: 'images', keyPath: 'image_id', delete: (v) => operations.push(['delete-image', v]) },
  };
  const transaction = {
    objectStoreNames: ['audit_tombstones', 'projects', 'images'],
    objectStore: (name) => stores[name],
  };
  hardDeleteProjectWithTombstone(
    transaction,
    {
      project_id: 'safe',
      project: project({ project_id: 'safe' }),
      records: { images: [{ image_id: 'img-1', project_id: 'safe' }] },
    },
    {
      manifest_id: 'manifest-1',
      backup_sha256: 'a'.repeat(64),
      environment: 'local',
    },
    '2026-07-26T14:00:00.000Z'
  );
  assert.equal(operations[0][0], 'put-tombstone');
  assert.deepEqual(operations.slice(1), [
    ['delete-project', 'safe'],
    ['delete-image', 'img-1'],
  ]);
});

test('hard delete refuses databases without transactional tombstones', () => {
  const transaction = {
    objectStoreNames: ['projects'],
    objectStore: () => ({ delete() {} }),
  };
  assert.throws(
    () => hardDeleteProjectWithTombstone(
      transaction,
      { project_id: 'safe', project: project(), records: {} },
      { manifest_id: 'm', backup_sha256: 'a'.repeat(64), environment: 'local' },
      new Date().toISOString()
    ),
    /audit_tombstones/
  );
});

test('database adapter opens without a version and refuses accidental creation', async () => {
  let openedWith;
  const existing = {
    open(...args) {
      openedWith = args;
      const request = {};
      queueMicrotask(() => {
        request.result = { name: 'field_capture_qcm' };
        request.onsuccess();
      });
      return request;
    },
  };
  const db = await openCleanupDatabase(existing);
  assert.equal(db.name, 'field_capture_qcm');
  assert.deepEqual(openedWith, ['field_capture_qcm']);

  const missing = {
    open() {
      const request = { transaction: { abort() {} } };
      queueMicrotask(() => request.onupgradeneeded());
      return request;
    },
  };
  await assert.rejects(openCleanupDatabase(missing), /does not exist/);
});
