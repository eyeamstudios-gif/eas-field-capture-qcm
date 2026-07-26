# Controlled local IndexedDB cleanup runbook

This procedure is for authorized removal of abandoned, not-started local project
records from one browser profile. It does not clean server data, other devices,
or other browser profiles. Cleanup is always a dry-run unless every execution
control is supplied explicitly.

## Safety rules

- Never clean a device while capture, import, export, sync, or reconciliation is
  running.
- Never infer IDs from a display name. Use exact `project_id` values from the
  generated preview.
- Do not clean projects with images/blobs, completed checklist work,
  notes/annotations, QCM activity, submissions/exports, sync/custody events,
  accepted/completed/released/archived status, a legal hold or retention rule,
  evidence/UECS linkage, or a valid ClientFlow handoff requiring reconciliation.
- Save the preview, backup, and manifest outside browser storage before any
  execution attempt. Preserve them according to the applicable audit policy.
- Do not edit the generated backup or manifest. A changed byte invalidates the
  SHA-256 authorization.
- Do not put credentials, tokens, or signed URLs into operator notes. Backup
  generation redacts known secret fields and signed URLs.
- Do not use the application's older `deleteProject` helper for controlled
  cleanup. It does not provide these eligibility, backup, exact-ID, confirmation,
  and audit controls.

## Storage compatibility

The inventory recognizes the IndexedDB v2 stores:

`projects`, `images`, `image_blobs`, `qcm_results`, `shotlist_status`,
`exports`, and `uecs_lite_queue`.

It also recognizes the current v3 sync, handoff, cleanup-manifest, and
audit-tombstone stores. Unknown later stores are inventoried by `project_id` and
stores named for sync/custody are treated as protected activity.

The tooling opens the existing database without a version number, so it cannot
upgrade it. A hard delete is refused unless `audit_tombstones` is available in
the same transaction. Consequently, an original v2 database without a supported
soft-retirement field must first be migrated by the application; the cleanup
tool will not silently perform an unaudited delete.

## 1. Prepare the environment

1. Confirm the exact browser profile and deployment origin.
2. Record an unambiguous environment label, for example
   `field-tablet-07-production`. Do not use only `prod`.
3. Stop capture and sync activity and keep the application tab open.
4. Open browser developer tools on the application origin.
5. Import the cleanup module:

```js
const cleanup = await import('/js/cleanup.js');
const db = await cleanup.openCleanupDatabase();
```

Opening the database performs no cleanup.

## 2. Generate and review a dry-run preview

Inventory all records:

```js
const snapshot = await cleanup.readIndexedDbSnapshot(db);
const preview = cleanup.buildCleanupPreview(snapshot, {
  environment: 'field-tablet-07-production',
});
console.log(JSON.stringify(preview, null, 2));
```

The preview is machine-readable JSON and has `dry_run: true`. Review every
assessment and reason. Identify the exact eligible IDs that the authorized
request intends to retire.

Generate a second, exact-ID-scoped preview:

```js
const exactIds = ['exact-project-id-1'];
const exactPreview = cleanup.buildCleanupPreview(snapshot, {
  environment: 'field-tablet-07-production',
  projectIds: exactIds,
});
console.log(JSON.stringify(exactPreview, null, 2));
```

Stop if:

- `unknown_project_ids` is not empty;
- `eligible_project_ids` differs from the authorized exact ID list;
- any blocked reason is unexpected; or
- the database name, version, stores, profile, or environment is unexpected.

Save `exactPreview` as `cleanup-preview.json`.

## 3. Create and verify the backup and manifest

```js
const backup = cleanup.createCleanupBackup(snapshot, exactPreview);
const parsedVerification = cleanup.verifyCleanupBackup(
  cleanup.canonicalJson(backup),
  { projectIds: exactIds }
);
if (!parsedVerification.valid) throw new Error(parsedVerification.errors.join(', '));

const { manifest, backup_json } = await cleanup.createCleanupManifest(
  backup,
  exactPreview
);
console.log(JSON.stringify(manifest, null, 2));
```

Save the exact `backup_json` bytes as `cleanup-backup.json` and the manifest as
`cleanup-manifest.json`. Parse the saved backup from disk in a separate local
tool and confirm:

- JSON parsing succeeds;
- `schema` is `field-capture-qcm.cleanup-backup/v1`;
- `project_ids` exactly matches the approved sorted IDs;
- every `record_counts` value equals the corresponding parsed store array
  length;
- the project count equals the exact ID count; and
- no secret or signed URL was included.

Re-load the saved backup text into the application context and verify it again:

```js
const savedBackupText = /* exact text read from cleanup-backup.json */;
const savedBackupCheck = cleanup.verifyCleanupBackup(savedBackupText, {
  projectIds: exactIds,
});
if (!savedBackupCheck.valid) throw new Error(savedBackupCheck.errors.join(', '));
const savedBackup = savedBackupCheck.backup;
```

Compute `SHA-256(canonicalJson(savedBackup))` and compare it with
`manifest.backup_sha256`. `createCleanupManifest` performs this calculation;
the independent comparison checks that the saved artifact is the same artifact.

## 4. Authorization and controlled execution

Execution requires all of the following:

- `dryRun: false`;
- the exact environment string from the manifest;
- the exact sorted project IDs from the manifest;
- the verified backup object;
- the matching manifest and SHA-256 checksum; and
- the exact generated confirmation phrase.

Generate, read aloud, and independently review the phrase:

```js
const confirmationPhrase = cleanup.buildConfirmationPhrase(manifest);
console.log(confirmationPhrase);
```

Before execution, call `validateCleanupExecution` with the proposed request and
require `valid: true`. Have a second authorized reviewer compare the phrase,
environment, exact IDs, preview, backup counts, and checksum.

When approved, the same fully populated request is passed to
`executeIndexedDbCleanup(db, request)`. Do not run that call during a dry run.
Immediately before its transaction, the adapter re-inventories the live
database and refuses execution if an ID disappeared, changed, or became
ineligible.

Within one read/write transaction the adapter:

1. saves the executed manifest when the store exists;
2. soft-retires records when the project model already supports retirement; or
3. writes an audit tombstone and hard-deletes the project-associated records.

Any request or transaction error aborts the operation.

## 5. Post-operation verification

1. Take a fresh snapshot and exact-ID preview.
2. For soft retirement, confirm each project remains present with
   `lifecycle_status: "retired"`, `is_retired: true`, `retired_at`, and the
   cleanup manifest ID.
3. For hard deletion, confirm project-associated records are absent and each
   ID has an `audit_tombstones` record with the manifest ID and backup checksum.
4. Confirm unrelated project and global records are unchanged.
5. Retain the preview, backup, manifest, confirmation, result, and
   post-operation verification together.

## Restore procedure

Restore only to the same application data model after an authorized rollback
decision. Restoration is an additive `put` operation: existing records with the
same keys are overwritten. Therefore, first stop capture/sync and verify that
no replacement work has been created for the retired IDs.

1. Confirm the target origin, browser profile, database name, and environment.
2. Load `cleanup-backup.json` as text and `cleanup-manifest.json` as JSON.
3. Verify backup parsing, exact IDs, per-store counts, and secrets checks:

```js
const check = cleanup.verifyCleanupBackup(savedBackupText, {
  projectIds: manifest.project_ids,
});
if (!check.valid) throw new Error(check.errors.join(', '));
```

4. Independently recompute the checksum and require an exact match:

```js
const checksum = await cleanup.sha256Checksum(
  cleanup.canonicalJson(check.backup)
);
if (checksum !== manifest.backup_sha256) throw new Error('Checksum mismatch');
```

5. Inspect every target key for conflicts. Stop and escalate if any record was
   newly created or changed after cleanup.
6. With approval, restore in one transaction:

```js
const result = await cleanup.restoreIndexedDbBackup(
  db,
  check.backup,
  manifest.backup_sha256
);
console.log(result);
```

7. Take a fresh snapshot. Confirm all backup store counts and exact project IDs
   are present, then test the projects read-only in the application.
8. Preserve the prior tombstone and cleanup manifest as audit history. Do not
   delete either merely because a restore succeeded.

Blob payloads are intentionally not expected in eligible backups. If a backup
contains only Blob metadata, it is not byte-restorable and the restore must be
stopped and escalated.
