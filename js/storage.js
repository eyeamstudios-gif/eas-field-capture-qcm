/**
 * EAS Field Capture QCM — IndexedDB + localStorage Storage
 */

const DB_NAME = 'field_capture_qcm';
const DB_VERSION = 3;
const ACTIVE_PROJECT_KEY = 'fcq_active_project_id';
const AUTH_SESSION_KEY = 'current';

let db = null;

function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains('projects')) {
        database.createObjectStore('projects', { keyPath: 'project_id' });
      }
      if (!database.objectStoreNames.contains('images')) {
        const imgStore = database.createObjectStore('images', { keyPath: 'image_id' });
        imgStore.createIndex('project_id', 'project_id', { unique: false });
      }
      if (!database.objectStoreNames.contains('qcm_results')) {
        const qcmStore = database.createObjectStore('qcm_results', { keyPath: 'image_id' });
        qcmStore.createIndex('project_id', 'project_id', { unique: false });
      }
      if (!database.objectStoreNames.contains('shotlist_status')) {
        database.createObjectStore('shotlist_status', { keyPath: 'project_id' });
      }
      if (!database.objectStoreNames.contains('exports')) {
        database.createObjectStore('exports', { keyPath: 'export_id' });
      }
      if (!database.objectStoreNames.contains('image_blobs')) {
        database.createObjectStore('image_blobs', { keyPath: 'image_id' });
      }
      if (!database.objectStoreNames.contains('uecs_lite_queue')) {
        const queueStore = database.createObjectStore('uecs_lite_queue', { keyPath: 'queue_id' });
        queueStore.createIndex('project_id', 'project_id', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }
      if (!database.objectStoreNames.contains('sync_inbox')) {
        const inboxStore = database.createObjectStore('sync_inbox', { keyPath: 'inbox_id' });
        inboxStore.createIndex('project_id', 'project_id', { unique: false });
        inboxStore.createIndex('received_at', 'received_at', { unique: false });
      }
      if (!database.objectStoreNames.contains('sync_outbox')) {
        const outboxStore = database.createObjectStore('sync_outbox', { keyPath: 'event_id' });
        outboxStore.createIndex('project_id', 'project_id', { unique: false });
        outboxStore.createIndex('status', 'status', { unique: false });
        outboxStore.createIndex('created_at', 'created_at', { unique: false });
      }
      if (!database.objectStoreNames.contains('auth_session')) {
        database.createObjectStore('auth_session', { keyPath: 'session_id' });
      }
      if (!database.objectStoreNames.contains('device_context')) {
        database.createObjectStore('device_context', { keyPath: 'device_id' });
      }
      if (!database.objectStoreNames.contains('handoff_receipts')) {
        const receiptStore = database.createObjectStore('handoff_receipts', { keyPath: 'receipt_id' });
        receiptStore.createIndex('project_id', 'project_id', { unique: false });
      }
      if (!database.objectStoreNames.contains('cleanup_manifests')) {
        database.createObjectStore('cleanup_manifests', { keyPath: 'manifest_id' });
      }
      if (!database.objectStoreNames.contains('audit_tombstones')) {
        const tombstoneStore = database.createObjectStore('audit_tombstones', { keyPath: 'tombstone_id' });
        tombstoneStore.createIndex('project_id', 'project_id', { unique: false });
      }
    };
  });
}

function tx(storeNames, mode = 'readonly') {
  return openDB().then((database) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    return database.transaction(names, mode);
  });
}

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project) {
  const transaction = await tx('projects', 'readwrite');
  await promisifyRequest(transaction.objectStore('projects').put(project));
}

export async function getProject(projectId) {
  const transaction = await tx('projects');
  return promisifyRequest(transaction.objectStore('projects').get(projectId));
}

export async function getAllProjects() {
  const transaction = await tx('projects');
  return promisifyRequest(transaction.objectStore('projects').getAll());
}

export async function deleteProject(projectId) {
  const transaction = await tx(
    ['projects', 'images', 'qcm_results', 'shotlist_status', 'image_blobs'],
    'readwrite'
  );
  await promisifyRequest(transaction.objectStore('projects').delete(projectId));

  const images = await getProjectImages(projectId);
  for (const img of images) {
    transaction.objectStore('images').delete(img.image_id);
    transaction.objectStore('qcm_results').delete(img.image_id);
    transaction.objectStore('image_blobs').delete(img.image_id);
  }
  transaction.objectStore('shotlist_status').delete(projectId);
}

export async function saveImage(imageMeta, blob = null) {
  const transaction = await tx(['images', 'image_blobs'], 'readwrite');
  await promisifyRequest(transaction.objectStore('images').put(imageMeta));
  if (blob) {
    await promisifyRequest(
      transaction.objectStore('image_blobs').put({ image_id: imageMeta.image_id, blob })
    );
  }
}

export async function getProjectImages(projectId) {
  const transaction = await tx('images');
  const index = transaction.objectStore('images').index('project_id');
  return promisifyRequest(index.getAll(projectId));
}

export async function getImage(imageId) {
  const transaction = await tx('images');
  return promisifyRequest(transaction.objectStore('images').get(imageId));
}

export async function getImageBlob(imageId) {
  const transaction = await tx('image_blobs');
  const record = await promisifyRequest(transaction.objectStore('image_blobs').get(imageId));
  return record?.blob || null;
}

export async function saveQcmResult(result) {
  const transaction = await tx('qcm_results', 'readwrite');
  await promisifyRequest(transaction.objectStore('qcm_results').put(result));
}

export async function getProjectQcmResults(projectId) {
  const transaction = await tx('qcm_results');
  const index = transaction.objectStore('qcm_results').index('project_id');
  return promisifyRequest(index.getAll(projectId));
}

export async function saveShotListStatus(status) {
  const transaction = await tx('shotlist_status', 'readwrite');
  await promisifyRequest(transaction.objectStore('shotlist_status').put(status));
}

export async function getShotListStatus(projectId) {
  const transaction = await tx('shotlist_status');
  return promisifyRequest(transaction.objectStore('shotlist_status').get(projectId));
}

export async function saveExportRecord(record) {
  const transaction = await tx('exports', 'readwrite');
  await promisifyRequest(transaction.objectStore('exports').put(record));
}

export async function getProjectExports(projectId) {
  const transaction = await tx('exports');
  const all = await promisifyRequest(transaction.objectStore('exports').getAll());
  return all.filter((r) => r.project_id === projectId);
}

export async function saveUecsLiteQueueRecord(record) {
  const transaction = await tx('uecs_lite_queue', 'readwrite');
  await promisifyRequest(transaction.objectStore('uecs_lite_queue').put(record));
}

export async function getUecsLiteQueueRecord(queueId) {
  const transaction = await tx('uecs_lite_queue');
  return promisifyRequest(transaction.objectStore('uecs_lite_queue').get(queueId));
}

export async function updateUecsLiteQueueRecord(queueId, updates) {
  const existing = await getUecsLiteQueueRecord(queueId);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...updates,
    queue_id: queueId,
    updated_at: new Date().toISOString(),
  };
  await saveUecsLiteQueueRecord(updated);
  return updated;
}

export async function getLatestUecsLiteQueueRecord(projectId) {
  const records = await getUecsLiteQueueRecords(projectId);
  if (!records.length) return null;
  records.sort((a, b) => new Date(b.updated_at || b.queued_at) - new Date(a.updated_at || a.queued_at));
  return records[0];
}

export async function getUecsLiteQueueRecords(projectId = null) {
  const transaction = await tx('uecs_lite_queue');
  const store = transaction.objectStore('uecs_lite_queue');
  if (projectId) {
    return promisifyRequest(store.index('project_id').getAll(projectId));
  }
  return promisifyRequest(store.getAll());
}

export async function saveAuthSession(session) {
  const transaction = await tx('auth_session', 'readwrite');
  await promisifyRequest(
    transaction.objectStore('auth_session').put({
      ...session,
      session_id: AUTH_SESSION_KEY,
      updated_at: new Date().toISOString(),
    })
  );
}

export async function getAuthSession() {
  const transaction = await tx('auth_session');
  return promisifyRequest(transaction.objectStore('auth_session').get(AUTH_SESSION_KEY));
}

export async function clearAuthSession() {
  const transaction = await tx('auth_session', 'readwrite');
  await promisifyRequest(transaction.objectStore('auth_session').delete(AUTH_SESSION_KEY));
  setActiveProjectId(null);
}

export async function saveDeviceContext(context) {
  const transaction = await tx('device_context', 'readwrite');
  await promisifyRequest(transaction.objectStore('device_context').put(context));
}

export async function getDeviceContexts() {
  const transaction = await tx('device_context');
  return promisifyRequest(transaction.objectStore('device_context').getAll());
}

export async function saveSyncInboxRecord(record) {
  const transaction = await tx('sync_inbox', 'readwrite');
  await promisifyRequest(transaction.objectStore('sync_inbox').put(record));
}

export async function getSyncInboxRecords(projectId = null) {
  const transaction = await tx('sync_inbox');
  const store = transaction.objectStore('sync_inbox');
  if (projectId) return promisifyRequest(store.index('project_id').getAll(projectId));
  return promisifyRequest(store.getAll());
}

export async function saveSyncOutboxEvent(event) {
  const transaction = await tx('sync_outbox', 'readwrite');
  await promisifyRequest(transaction.objectStore('sync_outbox').put(event));
}

export async function getSyncOutboxEvents(status = null) {
  const transaction = await tx('sync_outbox');
  const store = transaction.objectStore('sync_outbox');
  if (status) return promisifyRequest(store.index('status').getAll(status));
  return promisifyRequest(store.getAll());
}

export async function updateSyncOutboxEvent(eventId, updates) {
  const transaction = await tx('sync_outbox', 'readwrite');
  const store = transaction.objectStore('sync_outbox');
  const existing = await promisifyRequest(store.get(eventId));
  if (!existing) return null;
  const updated = { ...existing, ...updates, event_id: eventId, updated_at: new Date().toISOString() };
  await promisifyRequest(store.put(updated));
  return updated;
}

export async function saveHandoffReceipt(receipt) {
  const transaction = await tx('handoff_receipts', 'readwrite');
  await promisifyRequest(transaction.objectStore('handoff_receipts').put(receipt));
}

export async function getProjectHandoffReceipts(projectId) {
  const transaction = await tx('handoff_receipts');
  return promisifyRequest(
    transaction.objectStore('handoff_receipts').index('project_id').getAll(projectId)
  );
}

export async function saveCleanupManifest(manifest) {
  const transaction = await tx('cleanup_manifests', 'readwrite');
  await promisifyRequest(transaction.objectStore('cleanup_manifests').put(manifest));
}

export async function getCleanupManifest(manifestId) {
  const transaction = await tx('cleanup_manifests');
  return promisifyRequest(transaction.objectStore('cleanup_manifests').get(manifestId));
}

export async function saveAuditTombstone(tombstone) {
  const transaction = await tx('audit_tombstones', 'readwrite');
  await promisifyRequest(transaction.objectStore('audit_tombstones').put(tombstone));
}

export async function getProjectsForAccount(accountId) {
  const projects = await getAllProjects();
  if (!accountId) return [];
  return projects.filter((project) => project.local_owner_account_id === accountId);
}

export async function quarantineProjectMutations(projectId, reason) {
  const project = await getProject(projectId);
  if (!project) return null;
  const updated = {
    ...project,
    mutation_quarantined: true,
    mutation_quarantine_reason: reason,
    mutation_quarantined_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await saveProject(updated);
  return updated;
}

export function setActiveProjectId(projectId) {
  if (projectId) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
  } else {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

export function getActiveProjectId() {
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export async function initStorage() {
  try {
    await openDB();
    return true;
  } catch (err) {
    console.error('IndexedDB init failed:', err);
    return false;
  }
}

export async function getImageDataUrl(imageId) {
  const blob = await getImageBlob(imageId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
