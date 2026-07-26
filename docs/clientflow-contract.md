# ClientFlow control-plane contract

## Transport and authentication

All integration routes accept `POST` with `Content-Type: application/json`. Bodies are limited to 1 MiB and validated as strict, versioned JSON (unknown properties are rejected).

ClientFlow sends:

- `Idempotency-Key`: exactly equal to the body `idempotency_key`
- `X-ClientFlow-Timestamp`: Unix seconds, within 300 seconds of receiver time
- `X-ClientFlow-Content-SHA256`: lowercase SHA-256 hex of the exact UTF-8 request body
- `X-ClientFlow-Signature`: `sha256=<hex HMAC>`, where the HMAC-SHA256 input is `<timestamp>.<exact request body>`

The receiver verifies the body hash and HMAC with constant-time comparisons before schema acceptance. A reused idempotency key returns the original receipt only when event type and body hash match; changed content conflicts. Event IDs are replay-protected independently.

Required server-only environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (integration receiver only)
- `CLIENTFLOW_HANDOFF_SECRET` (or alias `CLIENTFLOW_WEBHOOK_SECRET`)
- `SUPABASE_PUBLISHABLE_KEY` (preferred) or `SUPABASE_ANON_KEY` (sync/config APIs)

Missing configuration fails closed. Payloads, signatures, JWTs, and secrets are never logged.

## Integration routes

- `POST /api/integrations/clientflow/v1/handoffs`
- `POST /api/integrations/clientflow/v1/amendments`
- `POST /api/integrations/clientflow/v1/revocations`

Common handoff/amendment fields: `event_id`, `correlation_id`, `idempotency_key`, `source_system: "ClientFlow"`, `packet_id`, `packet_version`, `packet_revision`, and offset-aware `occurred_at`.

A handoff uses `schema_version: "clientflow.handoff.v1"` and includes:

```json
{
  "project": {
    "clientflow_request_id": "cf-100",
    "clientflow_project_id": "cf-proj-100",
    "clientflow_appointment_id": "cf-appt-100",
    "uecs_project_id": "uecs-100",
    "client_name": "Example",
    "project_address": "100 Main St",
    "service_pathway": "XPD Exterior Baseline Snapshot"
  },
  "confirmed_schedule": {
    "status": "confirmed",
    "starts_at": "2026-07-27T13:00:00.000Z",
    "ends_at": "2026-07-27T17:00:00.000Z",
    "timezone": "America/New_York"
  },
  "capture_plan": {
    "locked": true,
    "required_capture_methods": ["mobile_camera"],
    "allowed_capture_methods": ["mobile_camera"],
    "items": [{
      "item_id": "front",
      "label": "Front elevation",
      "required": true,
      "capture_method": "mobile_camera"
    }]
  },
  "packet": {},
  "assignments": [{
    "clientflow_user_id": "cf-user-1",
    "roles": ["PRIMARY_OPERATOR"],
    "capabilities": ["project.read", "capture.mobile", "checklist.write", "submission.write", "status.write"],
    "access_starts_at": "2026-07-27T12:00:00.000Z",
    "access_ends_at": "2026-07-27T18:00:00.000Z"
  }]
}
```

Every `clientflow_user_id` must already have an immutable mapping to an active Field Capture / Supabase profile. Email is never used as silent identity authority.

Supported project roles:

- `PRIMARY_OPERATOR`
- `ASSISTANT_OPERATOR`
- `REMOTE_PILOT_IN_COMMAND`
- `VISUAL_OBSERVER`
- `FIELD_SUPERVISOR`
- `QCM_REVIEWER`
- `READ_ONLY_OBSERVER`

Drone capability is independent from mobile/true-camera capability. If `capture_plan.required_capture_methods` includes `drone`, or any assignment has `capture.drone`, a different assigned user must hold `REMOTE_PILOT_IN_COMMAND` with `drone.rpic`.

An amendment uses `schema_version: "clientflow.amendment.v1"`, a complete project + confirmed schedule + locked capture plan + replacement packet snapshot, a reason, and optionally a complete replacement assignment set. Historical packet snapshots are never overwritten.

A revocation uses `schema_version: "clientflow.revocation.v1"`, project identity, correlation/idempotency metadata, and a reason. It closes active assignments and marks the project revoked without deleting packet, custody, or assignment history.

Successful writes return:

```json
{
  "schema_version": "clientflow.receipt.v1",
  "event_id": "uuid",
  "idempotency_key": "source-key",
  "status": "accepted",
  "project_id": "uuid",
  "packet_revision": 1,
  "received_at": "timestamp"
}
```

## Authenticated field sync (offline-first)

Field Capture remains offline-first. Supabase/Vercel are the secure control plane and synchronization backend, not an always-online runtime dependency.

- First sign-in, initial assignment download, and final server-confirmed handoff may require connectivity.
- Capture, QCM, progress saving, and completion staging continue locally without connectivity.
- Local writes always complete first; network delivery is best-effort with retries and idempotency.

Sync routes require `Authorization: Bearer <Supabase user JWT>`.

- `GET /api/config` returns publishable sync configuration only.
- `GET /api/sync/assigned-projects?cursor=<ISO timestamp>&limit=100` returns projects previously or currently assigned to the caller, including revoked/expired assignment state so offline devices can learn revocations. Maximum limit is 200.
- `POST /api/sync/status-events` accepts strict `fieldcapture.status.v1` events with UUID `client_event_id`, server `project_id`, optional `device_id`, status, offset-aware `event_at`, and object `data`. Reuse of the same client event UUID with a different body hash conflicts.

Supported status events:

- `assignment_received`
- `assignment_accepted`
- `field_work_started`
- `capture_item_completed`
- `field_submission_ready`
- `field_submission_completed`
- `qcm_started`
- `qcm_returned`
- `qcm_accepted`
- `field_access_revoked`
- `sync_conflict`

## Data and operational guarantees

RLS is enabled on every public table. Integration tables have no authenticated-write policies. Privileged event mutation is atomic in a private `security definer` function reached through a public `security invoker` wrapper granted only to `service_role`.

Identity mappings, packet snapshots, receipts, replay records, and audit events cannot be updated or deleted. Assignment changes close existing records and append replacements. Revocation preserves all snapshots. The migration is forward-only and is not applied automatically.

## Secret rotation

1. Generate a new `CLIENTFLOW_HANDOFF_SECRET`.
2. Update Field Capture server env and ClientFlow publisher simultaneously for a dual-accept window if needed.
3. Rotate Supabase service-role keys only on the server; never place them in browser builds.
4. Invalidate replay/idempotency conflicts are expected during overlapping secret rollout if body signatures change; prefer cutover with matched publisher/receiver secrets.

## Reconciliation runbook

1. If sync fails, continue local capture; outbox retries when online.
2. If a server packet revision changes while local unsynchronized work exists, the device quarantines mutations and emits `sync_conflict`.
3. Supervisor reconciliation reviews quarantine reason, preserves originals, and resumes only after conflict resolution.
4. Cleanup of pending/test local projects uses the dry-run cleanup tooling in `docs/cleanup-runbook.md`; never broad-delete completed or custody-bearing records.
