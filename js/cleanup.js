/**
 * Controlled, local-only IndexedDB cleanup helpers.
 *
 * This module deliberately has no UI and never runs cleanup on import. The
 * destructive adapter defaults to dry-run and requires a verified backup,
 * exact IDs, an environment, and a generated confirmation phrase.
 */

export const DATABASE_NAME = 'field_capture_qcm';
export const V2_STORES = Object.freeze([
  'projects',
  'images',
  'image_blobs',
  'qcm_results',
  'shotlist_status',
  'exports',
  'uecs_lite_queue',
]);
export const V3_STORES = Object.freeze([
  ...V2_STORES,
  'sync_inbox',
  'sync_outbox',
  'auth_session',
  'device_context',
  'handoff_receipts',
  'cleanup_manifests',
  'audit_tombstones',
]);

const PENDING_STATUSES = new Set([
  'queued_for_field_capture',
  'pending',
  'draft',
  'imported',
  'imported_not_started',
  'assigned_not_accepted',
  'queued',
]);
const PROTECTED_STATUSES = new Set([
  'accepted',
  'active',
  'active_capture',
  'field_capture_in_progress',
  'completed',
  'complete',
  'completed_capture',
  'field_capture_complete',
  'ready_for_export',
  'ready_for_uecs_lite',
  'exported',
  'submitted',
  'released',
  'archived',
  'retired',
]);
const SECRET_KEY = /(secret|password|passphrase|token|authorization|cookie|api[_-]?key|access[_-]?key|refresh[_-]?key|private[_-]?key|credential)/i;
const SIGNED_URL_KEY = /(signed|presigned|download|upload)[_-]?url/i;
const PROJECT_ID_KEYS = ['project_id', 'projectId', 'uecs_project_id'];
const STATUS_KEYS = [
  'field_packet_status',
  'project_status',
  'capture_status',
  'lifecycle_status',
  'record_status',
  'status',
];
const EXCLUDED_GLOBAL_STORES = new Set([
  'auth_session',
  'device_context',
  'cleanup_manifests',
  'audit_tombstones',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function present(value) {
  if (value == null || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
}

export function normalizeCleanupStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, '_')
    .replace(/_+/g, '_');
}

export function isPendingCleanupStatus(value) {
  return PENDING_STATUSES.has(normalizeCleanupStatus(value));
}

export function getProjectStatuses(project = {}) {
  const values = STATUS_KEYS.map((key) => project[key]);
  if (project.assignment && typeof project.assignment === 'object') {
    values.push(project.assignment.status);
  }
  return [...new Set(values.map(normalizeCleanupStatus).filter(Boolean))];
}

function recordProjectId(record) {
  if (!record || typeof record !== 'object') return null;
  for (const key of PROJECT_ID_KEYS) {
    if (present(record[key])) return String(record[key]);
  }
  return null;
}

function isSignedUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    const keys = [...url.searchParams.keys()].map((key) => key.toLowerCase());
    return keys.some((key) =>
      /(^x-amz-|signature|sig|token|credential|expires|policy|key-pair-id)/.test(key)
    );
  } catch {
    return false;
  }
}

/**
 * Returns a deep JSON-safe copy with credentials and signed URLs removed.
 * Blob/File values are represented by metadata because JSON cannot restore
 * their bytes; eligible projects are required to have no blobs.
 */
export function sanitizeBackupValue(value, key = '', seen = new WeakSet()) {
  if (SECRET_KEY.test(key) || SIGNED_URL_KEY.test(key)) return '[REDACTED]';
  if (typeof value === 'string' && isSignedUrl(value)) return '[REDACTED_SIGNED_URL]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { __type: 'Blob', size: value.size, type: value.type };
  }
  if (typeof value !== 'object') return undefined;
  if (seen.has(value)) throw new TypeError('Cannot back up cyclic data');
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((item) => sanitizeBackupValue(item, '', seen));
    seen.delete(value);
    return result;
  }
  const result = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    const sanitized = sanitizeBackupValue(childValue, childKey, seen);
    if (sanitized !== undefined) result[childKey] = sanitized;
  }
  seen.delete(value);
  return result;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

export async function sha256Checksum(value, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
  const bytes =
    value instanceof Uint8Array
      ? value
      : new TextEncoder().encode(typeof value === 'string' ? value : canonicalJson(value));
  const digest = await cryptoImpl.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function containsMeaningfulKey(value, pattern, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, child]) => {
    if (pattern.test(key) && present(child)) return true;
    return child && typeof child === 'object' && containsMeaningfulKey(child, pattern, seen);
  });
}

function checklistComplete(project, shotlistRecords) {
  if (
    project.checklist_complete === true ||
    project.checklist_completed === true ||
    present(project.checklist_completed_at)
  ) {
    return true;
  }
  return shotlistRecords.some((record) => {
    if (
      record.complete === true ||
      record.completed === true ||
      present(record.completed_at) ||
      normalizeCleanupStatus(record.status) === 'completed'
    ) {
      return true;
    }
    const items = [...asArray(record.items), ...asArray(record.zones), ...asArray(record.checklist)];
    return items.some(
      (item) =>
        item?.complete === true ||
        item?.completed === true ||
        item?.captured === true ||
        normalizeCleanupStatus(item?.status) === 'completed'
    );
  });
}

function hasHoldOrRetention(project) {
  return (
    project.legal_hold === true ||
    project.on_legal_hold === true ||
    present(project.legal_hold_id) ||
    present(project.retention_until) ||
    present(project.retain_until) ||
    present(project.retention_policy) ||
    project.do_not_delete === true
  );
}

function hasProtectedLifecycleMarker(project) {
  return (
    project.accepted === true ||
    project.completed === true ||
    project.released === true ||
    project.archived === true ||
    project.is_archived === true ||
    present(project.accepted_at) ||
    present(project.completed_at) ||
    present(project.released_at) ||
    present(project.archived_at) ||
    present(project.assignment?.accepted_at)
  );
}

function hasEvidenceOrUecsLink(project) {
  return (
    project.evidence === true ||
    present(project.evidence_id) ||
    present(project.evidence_ids) ||
    present(project.evidence_linkage) ||
    present(project.uecs_project_id) ||
    present(project.uecs_id) ||
    present(project.uecs_record_id) ||
    present(project.uecs_linkage)
  );
}

function validClientFlowHandoff(project, inventory) {
  const linked =
    project.linked_to_clientflow === true ||
    present(project.clientflow_request_id) ||
    normalizeCleanupStatus(project.field_handoff_source) === 'clientflow';
  const issued =
    project.field_handoff_issued === true ||
    ['issued', 'received', 'accepted', 'pending_reconciliation'].includes(
      normalizeCleanupStatus(project.field_handoff_status)
    ) ||
    present(project.field_handoff_issued_at) ||
    present(project.field_handoff_packet_type);
  return linked && (issued || inventory.records.handoff_receipts.length > 0);
}

/**
 * Builds per-project inventories from an IndexedDB-shaped snapshot:
 * { dbName, dbVersion, stores: { projects: [], images: [], ... } }.
 */
export function buildCleanupInventory(snapshot) {
  const stores = snapshot?.stores || {};
  const projects = asArray(stores.projects);
  const imageProjectById = new Map(
    asArray(stores.images)
      .filter((record) => present(record?.image_id) && recordProjectId(record))
      .map((record) => [String(record.image_id), recordProjectId(record)])
  );
  const storeNames = Object.keys(stores).sort();

  return projects.map((project) => {
    const projectId = recordProjectId(project);
    const records = {};
    for (const storeName of storeNames) {
      if (storeName === 'projects' || EXCLUDED_GLOBAL_STORES.has(storeName)) continue;
      records[storeName] = asArray(stores[storeName]).filter((record) => {
        if (recordProjectId(record) === projectId) return true;
        if (
          (storeName === 'image_blobs' || storeName === 'qcm_results') &&
          present(record?.image_id)
        ) {
          return imageProjectById.get(String(record.image_id)) === projectId;
        }
        return false;
      });
    }
    for (const knownStore of V3_STORES) {
      if (
        knownStore !== 'projects' &&
        !EXCLUDED_GLOBAL_STORES.has(knownStore) &&
        !records[knownStore]
      ) {
        records[knownStore] = [];
      }
    }
    return { project_id: projectId, project, records };
  });
}

export function assessCleanupEligibility(inventory) {
  const project = inventory?.project || {};
  const records = inventory?.records || {};
  const statuses = getProjectStatuses(project);
  const reasons = [];
  if (!present(inventory?.project_id)) reasons.push('missing_project_id');
  if (!statuses.some(isPendingCleanupStatus)) reasons.push('not_pending_status');
  if (
    statuses.some((status) => PROTECTED_STATUSES.has(status)) ||
    hasProtectedLifecycleMarker(project)
  ) {
    reasons.push('protected_lifecycle_status');
  }
  if (asArray(records.images).length) reasons.push('has_images');
  if (asArray(records.image_blobs).length) reasons.push('has_image_blobs');
  if (checklistComplete(project, asArray(records.shotlist_status))) reasons.push('completed_checklist');
  if (
    containsMeaningfulKey(project, /(note|notes|annotation|annotations)$/i) ||
    Object.values(records).some((items) =>
      asArray(items).some((item) => containsMeaningfulKey(item, /(note|notes|annotation|annotations)$/i))
    )
  ) {
    reasons.push('has_notes_or_annotations');
  }
  if (asArray(records.qcm_results).length || present(project.qcm_status) || present(project.qcm_result)) {
    reasons.push('has_qcm_activity');
  }
  if (
    Object.entries(records).some(
      ([name, items]) => /qcm/i.test(name) && asArray(items).length
    )
  ) {
    reasons.push('has_qcm_activity');
  }
  if (
    asArray(records.exports).length ||
    asArray(records.uecs_lite_queue).length ||
    Object.entries(records).some(
      ([name, items]) => /(submission|export)/i.test(name) && asArray(items).length
    ) ||
    present(project.exported_at) ||
    present(project.submitted_at) ||
    present(project.submission_id)
  ) {
    reasons.push('has_submission_or_export');
  }
  if (
    asArray(records.sync_inbox).length ||
    asArray(records.sync_outbox).length ||
    asArray(records.handoff_receipts).length ||
    Object.entries(records).some(
      ([name, items]) => /(sync|custody|chain_of_custody)/i.test(name) && asArray(items).length
    )
  ) {
    reasons.push('has_sync_or_custody_events');
  }
  if (hasHoldOrRetention(project)) reasons.push('legal_hold_or_retention');
  if (
    Object.entries(records).some(
      ([name, items]) => /(legal_hold|retention)/i.test(name) && asArray(items).length
    )
  ) {
    reasons.push('legal_hold_or_retention');
  }
  if (
    hasEvidenceOrUecsLink(project) ||
    Object.entries(records).some(
      ([name, items]) => /(evidence|uecs)/i.test(name) && asArray(items).length
    )
  ) {
    reasons.push('evidence_or_uecs_linkage');
  }
  if (validClientFlowHandoff(project, inventory)) reasons.push('clientflow_handoff_requires_reconciliation');

  return {
    project_id: inventory?.project_id || null,
    eligible: reasons.length === 0,
    statuses,
    reasons: [...new Set(reasons)].sort(),
    record_counts: Object.fromEntries(
      Object.entries(records)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, items]) => [name, asArray(items).length])
    ),
  };
}

export function buildCleanupPreview(snapshot, options = {}) {
  const environment = String(options.environment || '').trim();
  const requestedIds = options.projectIds == null
    ? null
    : [...new Set(asArray(options.projectIds).map(String))].sort();
  const inventory = buildCleanupInventory(snapshot);
  const assessments = inventory.map(assessCleanupEligibility);
  const existingIds = new Set(assessments.map((item) => item.project_id));
  const unknown_project_ids = requestedIds?.filter((id) => !existingIds.has(id)) || [];
  const selected = requestedIds
    ? assessments.filter((item) => requestedIds.includes(item.project_id))
    : assessments;
  const eligible_project_ids = selected
    .filter((item) => item.eligible)
    .map((item) => item.project_id)
    .sort();

  return {
    schema: 'field-capture-qcm.cleanup-preview/v1',
    dry_run: true,
    environment,
    database: {
      name: snapshot?.dbName || DATABASE_NAME,
      version: snapshot?.dbVersion ?? null,
      stores: Object.keys(snapshot?.stores || {}).sort(),
    },
    requested_project_ids: requestedIds,
    eligible_project_ids,
    unknown_project_ids,
    blocked: selected.filter((item) => !item.eligible),
    assessments: selected,
  };
}

export function createCleanupBackup(snapshot, preview, createdAt = new Date().toISOString()) {
  const exactIds = [...new Set(asArray(preview?.eligible_project_ids).map(String))].sort();
  const inventories = buildCleanupInventory(snapshot).filter((item) =>
    exactIds.includes(item.project_id)
  );
  const stores = { projects: inventories.map((item) => item.project) };
  for (const inventory of inventories) {
    for (const [storeName, records] of Object.entries(inventory.records)) {
      stores[storeName] ||= [];
      stores[storeName].push(...records);
    }
  }
  const sanitizedStores = sanitizeBackupValue(stores);
  const record_counts = Object.fromEntries(
    Object.entries(sanitizedStores)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, records]) => [name, asArray(records).length])
  );
  return {
    schema: 'field-capture-qcm.cleanup-backup/v1',
    created_at: createdAt,
    environment: preview?.environment || '',
    source_database: preview?.database || {},
    project_ids: exactIds,
    record_counts,
    stores: sanitizedStores,
  };
}

function containsUnsafeBackupData(value, key = '') {
  if (SECRET_KEY.test(key) || SIGNED_URL_KEY.test(key)) {
    return value !== '[REDACTED]' && value !== '[REDACTED_SIGNED_URL]';
  }
  if (typeof value === 'string') {
    return isSignedUrl(value) || /^(bearer\s+\S+|basic\s+\S+)$/i.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => containsUnsafeBackupData(item));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([childKey, child]) =>
      containsUnsafeBackupData(child, childKey)
    );
  }
  return false;
}

export function verifyCleanupBackup(backupOrJson, expected = {}) {
  const errors = [];
  let backup;
  try {
    backup = typeof backupOrJson === 'string' ? JSON.parse(backupOrJson) : backupOrJson;
  } catch {
    return { valid: false, errors: ['backup_json_parse_failed'], backup: null };
  }
  if (!backup || backup.schema !== 'field-capture-qcm.cleanup-backup/v1') {
    errors.push('unsupported_backup_schema');
  }
  if (!backup?.stores || typeof backup.stores !== 'object') errors.push('missing_backup_stores');
  const actualCounts = {};
  for (const [storeName, records] of Object.entries(backup?.stores || {})) {
    if (!Array.isArray(records)) errors.push(`store_not_array:${storeName}`);
    actualCounts[storeName] = asArray(records).length;
  }
  for (const [storeName, expectedCount] of Object.entries(backup?.record_counts || {})) {
    if (actualCounts[storeName] !== expectedCount) errors.push(`count_mismatch:${storeName}`);
  }
  const actualProjectIds = asArray(backup?.stores?.projects)
    .map(recordProjectId)
    .filter(Boolean)
    .sort();
  const declaredIds = asArray(backup?.project_ids).map(String).sort();
  if (canonicalJson(actualProjectIds) !== canonicalJson(declaredIds)) {
    errors.push('project_id_count_or_value_mismatch');
  }
  if (
    expected.projectIds &&
    canonicalJson(declaredIds) !== canonicalJson(asArray(expected.projectIds).map(String).sort())
  ) {
    errors.push('unexpected_project_ids');
  }
  if (containsUnsafeBackupData(backup)) {
    errors.push('backup_contains_secret_or_signed_url');
  }
  return { valid: errors.length === 0, errors, backup, actual_counts: actualCounts };
}

export async function createCleanupManifest(backup, preview, options = {}) {
  const verification = verifyCleanupBackup(backup, {
    projectIds: preview?.eligible_project_ids,
  });
  if (!verification.valid) throw new Error(`Backup verification failed: ${verification.errors.join(', ')}`);
  const backupJson = canonicalJson(backup);
  const backupChecksum = await sha256Checksum(backupJson, options.crypto);
  const manifest = {
    schema: 'field-capture-qcm.cleanup-manifest/v1',
    manifest_id: options.manifestId || `cleanup_${backupChecksum.slice(0, 16)}`,
    created_at: options.createdAt || new Date().toISOString(),
    environment: preview.environment,
    database: preview.database,
    dry_run: true,
    project_ids: [...preview.eligible_project_ids].sort(),
    backup_sha256: backupChecksum,
    backup_record_counts: backup.record_counts,
  };
  return { manifest, backup_json: backupJson };
}

export function buildConfirmationPhrase(manifest) {
  const environment = String(manifest?.environment || '').trim();
  const ids = asArray(manifest?.project_ids).map(String).sort().join(',');
  return `RETIRE ${environment} ${ids} SHA256:${manifest?.backup_sha256 || ''}`;
}

export async function validateCleanupExecution(request, cryptoImpl = globalThis.crypto) {
  const errors = [];
  if (request?.dryRun !== false) errors.push('dry_run_is_default');
  const manifest = request?.manifest;
  if (!manifest || manifest.schema !== 'field-capture-qcm.cleanup-manifest/v1') {
    errors.push('invalid_manifest');
  }
  if (!present(request?.environment) || request?.environment !== manifest?.environment) {
    errors.push('environment_mismatch');
  }
  const exactIds = asArray(request?.projectIds).map(String).sort();
  const manifestIds = asArray(manifest?.project_ids).map(String).sort();
  if (canonicalJson(exactIds) !== canonicalJson(manifestIds) || new Set(exactIds).size !== exactIds.length) {
    errors.push('project_ids_not_exact');
  }
  const verification = verifyCleanupBackup(request?.backup, { projectIds: manifestIds });
  if (!verification.valid) errors.push(...verification.errors);
  if (verification.valid) {
    const checksum = await sha256Checksum(canonicalJson(verification.backup), cryptoImpl);
    if (checksum !== manifest.backup_sha256) errors.push('backup_checksum_mismatch');
  }
  if (request?.confirmationPhrase !== buildConfirmationPhrase(manifest)) {
    errors.push('confirmation_phrase_mismatch');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], project_ids: manifestIds };
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function transactionPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  });
}

export function openCleanupDatabase(indexedDBImpl = globalThis.indexedDB, name = DATABASE_NAME) {
  if (!indexedDBImpl) return Promise.reject(new Error('IndexedDB is unavailable'));
  return new Promise((resolve, reject) => {
    // Omitting a version prevents this tooling from upgrading an existing DB.
    const request = indexedDBImpl.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
    request.onupgradeneeded = () => {
      request.transaction?.abort();
      reject(new Error(`Database ${name} does not exist; cleanup will not create it`));
    };
  });
}

export async function readIndexedDbSnapshot(database) {
  const storeNames = Array.from(database.objectStoreNames);
  if (!storeNames.includes('projects')) throw new Error('IndexedDB projects store is missing');
  const transaction = database.transaction(storeNames, 'readonly');
  const reads = Object.fromEntries(
    storeNames.map((storeName) => [storeName, requestPromise(transaction.objectStore(storeName).getAll())])
  );
  const stores = {};
  for (const [storeName, read] of Object.entries(reads)) stores[storeName] = await read;
  await transactionPromise(transaction);
  return { dbName: database.name, dbVersion: database.version, stores };
}

function supportsSoftRetire(project) {
  return ['lifecycle_status', 'record_status', 'retired_at', 'is_retired'].some((key) =>
    Object.prototype.hasOwnProperty.call(project, key)
  );
}

function deleteMatchingRecords(store, records) {
  for (const record of records) {
    const key = store.keyPath;
    if (typeof key !== 'string' || !present(record[key])) {
      throw new Error(`Cannot safely identify key in store ${store.name}`);
    }
    store.delete(record[key]);
  }
}

/**
 * Transactional hard-delete primitive. It refuses to operate without an
 * audit_tombstones store in the same transaction.
 */
export function hardDeleteProjectWithTombstone(transaction, inventory, manifest, now) {
  if (!Array.from(transaction.objectStoreNames).includes('audit_tombstones')) {
    throw new Error('Hard delete refused: audit_tombstones store is unavailable');
  }
  const projectId = inventory.project_id;
  transaction.objectStore('audit_tombstones').put({
    tombstone_id: `${manifest.manifest_id}:${projectId}`,
    project_id: projectId,
    manifest_id: manifest.manifest_id,
    backup_sha256: manifest.backup_sha256,
    retired_at: now,
    environment: manifest.environment,
  });
  transaction.objectStore('projects').delete(projectId);
  for (const [storeName, records] of Object.entries(inventory.records)) {
    if (!records.length || !Array.from(transaction.objectStoreNames).includes(storeName)) continue;
    deleteMatchingRecords(transaction.objectStore(storeName), records);
  }
}

/**
 * Executes only after all controls validate. Callers should normally invoke
 * this once with dryRun omitted to obtain a preview, save the backup/manifest,
 * then invoke again with dryRun:false and the exact verified artifacts.
 */
export async function executeIndexedDbCleanup(database, request = {}) {
  if (request.dryRun !== false) {
    const snapshot = await readIndexedDbSnapshot(database);
    return { executed: false, preview: buildCleanupPreview(snapshot, request) };
  }
  const validation = await validateCleanupExecution(request);
  if (!validation.valid) throw new Error(`Cleanup authorization failed: ${validation.errors.join(', ')}`);

  const snapshot = await readIndexedDbSnapshot(database);
  const preview = buildCleanupPreview(snapshot, {
    environment: request.environment,
    projectIds: validation.project_ids,
  });
  if (
    preview.unknown_project_ids.length ||
    canonicalJson(preview.eligible_project_ids) !== canonicalJson(validation.project_ids)
  ) {
    throw new Error('Live inventory changed or one or more project IDs are no longer eligible');
  }
  const inventories = buildCleanupInventory(snapshot).filter((item) =>
    validation.project_ids.includes(item.project_id)
  );
  const availableStores = Array.from(database.objectStoreNames);
  const useHardDelete = inventories.some((item) => !supportsSoftRetire(item.project));
  if (useHardDelete && !availableStores.includes('audit_tombstones')) {
    throw new Error('Hard delete refused: this database version has no transactional audit tombstone store');
  }
  const storesNeeded = new Set(['projects']);
  if (availableStores.includes('cleanup_manifests')) storesNeeded.add('cleanup_manifests');
  if (useHardDelete) storesNeeded.add('audit_tombstones');
  for (const inventory of inventories) {
    for (const [storeName, records] of Object.entries(inventory.records)) {
      if (records.length && availableStores.includes(storeName)) storesNeeded.add(storeName);
    }
  }
  const transaction = database.transaction([...storesNeeded], 'readwrite');
  const now = request.now || new Date().toISOString();
  if (availableStores.includes('cleanup_manifests')) {
    transaction.objectStore('cleanup_manifests').put({
      ...request.manifest,
      dry_run: false,
      executed_at: now,
    });
  }
  for (const inventory of inventories) {
    if (supportsSoftRetire(inventory.project)) {
      transaction.objectStore('projects').put({
        ...inventory.project,
        lifecycle_status: 'retired',
        is_retired: true,
        retired_at: now,
        cleanup_manifest_id: request.manifest.manifest_id,
        updated_at: now,
      });
    } else {
      hardDeleteProjectWithTombstone(transaction, inventory, request.manifest, now);
    }
  }
  await transactionPromise(transaction);
  return {
    executed: true,
    environment: request.environment,
    project_ids: validation.project_ids,
    manifest_id: request.manifest.manifest_id,
  };
}

export async function restoreIndexedDbBackup(database, backupOrJson, expectedChecksum) {
  const verification = verifyCleanupBackup(backupOrJson);
  if (!verification.valid) throw new Error(`Backup verification failed: ${verification.errors.join(', ')}`);
  const checksum = await sha256Checksum(canonicalJson(verification.backup));
  if (checksum !== expectedChecksum) throw new Error('Restore refused: backup checksum mismatch');
  const availableStores = Array.from(database.objectStoreNames);
  const restoreStores = Object.entries(verification.backup.stores)
    .filter(([storeName, records]) => availableStores.includes(storeName) && records.length);
  const transaction = database.transaction(
    [...new Set(restoreStores.map(([storeName]) => storeName))],
    'readwrite'
  );
  for (const [storeName, records] of restoreStores) {
    const store = transaction.objectStore(storeName);
    for (const record of records) store.put(record);
  }
  await transactionPromise(transaction);
  return { restored: true, project_ids: verification.backup.project_ids, checksum };
}
