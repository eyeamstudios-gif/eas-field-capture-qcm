import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  validateUecsLiteImport,
  applyCapturePolicyProfile,
  validateExportGate,
  buildQueueRecord,
  transitionQueueStatus,
  sanitizeClientFacingText,
  QUEUE_STATUSES,
  FIELD_PACKET_STATUSES,
} from '../js/governance.js';
import { SERVICE_PATHWAYS } from '../js/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const validPacket = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'valid-uecs-packet.json'), 'utf8')
);

function baseProject(overrides = {}) {
  return {
    project_id: 'uecs_proj_67890',
    uecs_project_id: 'uecs_proj_67890',
    clientflow_request_id: 'cf_req_12345',
    client_name: 'Jane Homeowner',
    project_address: '123 Main St',
    service_pathway: SERVICE_PATHWAYS.XPD_BASELINE,
    documentation_control_classification: 'UECS Lite',
    default_capture_method: 'field_capture_qcm',
    admin_review_required: true,
    field_user: 'Field Tech',
    created_at: '2026-07-08T12:00:00.000Z',
    capture_policy_profile: validPacket.capture_policy_profile,
    ...overrides,
  };
}

function readyCoverage(overrides = {}) {
  return {
    readiness: 'READY_FOR_ADMIN_REVIEW',
    requiredZonesComplete: 5,
    requiredZonesTotal: 5,
    accepted: 30,
    ...overrides,
  };
}

function baseShotList() {
  return {
    zones: [
      { id: 'front', name: 'Front Elevation', required: true, captured: true, minWide: 1, minCloseup: 0 },
      { id: 'rear', name: 'Rear Elevation', required: true, captured: true, minWide: 1, minCloseup: 0 },
    ],
  };
}

test('valid UECS Lite packet import succeeds', () => {
  const result = validateUecsLiteImport(validPacket);
  assert.equal(result.valid, true);
  assert.equal(result.project.clientflow_request_id, 'cf_req_12345');
  assert.equal(result.project.uecs_project_id, 'uecs_proj_67890');
  assert.equal(result.project.xpd_only, true);
  assert.equal(result.project.field_packet_status, FIELD_PACKET_STATUSES.QUEUED_FOR_FIELD_CAPTURE);
});

test('invalid non-XPD packet is rejected', () => {
  const packet = {
    ...validPacket,
    service_pathway: 'EAS Full Documentation',
  };
  const result = validateUecsLiteImport(packet);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('service_pathway')));
});

test('missing required fields are rejected', () => {
  const packet = { ...validPacket };
  delete packet.client_name;
  delete packet.clientflow_request_id;
  const result = validateUecsLiteImport(packet);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('client_name'));
  assert.ok(result.errors.includes('clientflow_request_id'));
});

test('xpd_only must be true', () => {
  const result = validateUecsLiteImport({ ...validPacket, xpd_only: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('xpd_only')));
});

test('unsupported packet version is rejected', () => {
  const result = validateUecsLiteImport({ ...validPacket, packet_version: '9.9.9' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('packet_version')));
});

test('auto-population applies capture policy profile authorizations', () => {
  const project = {
    enhanced_camera_capture: true,
    aerial_documentation: true,
    reference_360_capture: true,
  };
  applyCapturePolicyProfile(project, validPacket.capture_policy_profile);
  assert.equal(project.enhanced_camera_capture, true);
  assert.equal(project.aerial_documentation, false);
  assert.equal(project.reference_360_capture, false);
  assert.ok(project.capture_policy_notes.includes('Ground-based XPD baseline'));
});

test('export is blocked until required capture items are complete', () => {
  const project = baseProject();
  const shotList = baseShotList();
  const incompleteCoverage = {
    readiness: 'FIELD_CAPTURE_INCOMPLETE',
    requiredZonesComplete: 1,
    requiredZonesTotal: 5,
    accepted: 2,
  };
  const gate = validateExportGate(project, incompleteCoverage, shotList);
  assert.equal(gate.valid, false);
  assert.ok(gate.errors.some((error) => error.includes('checklist')));
});

test('export gate passes when capture checklist is complete', () => {
  const project = baseProject();
  const gate = validateExportGate(project, readyCoverage(), baseShotList());
  assert.equal(gate.valid, true);
});

test('admin review flag is preserved in export gate context', () => {
  const project = baseProject({ admin_review_required: true });
  assert.equal(project.admin_review_required, true);
  const gate = validateExportGate(project, readyCoverage(), baseShotList());
  assert.equal(gate.valid, true);
});

test('queue lifecycle transitions update metadata', () => {
  const project = baseProject();
  const queued = buildQueueRecord({ project, status: QUEUE_STATUSES.ACTIVE_CAPTURE });
  assert.equal(queued.status, QUEUE_STATUSES.ACTIVE_CAPTURE);
  assert.ok(queued.created_at);
  assert.equal(queued.export_count, 0);

  const exported = transitionQueueStatus(queued, QUEUE_STATUSES.EXPORTED, {
    validation_status: 'export_validated',
  });
  assert.equal(exported.status, QUEUE_STATUSES.EXPORTED);
  assert.equal(exported.export_count, 1);
  assert.ok(exported.last_exported_at);
  assert.ok(exported.updated_at);
});

test('sanitizeClientFacingText removes forbidden terminology', () => {
  const input = 'No inspection conclusion or insurance coverage determination.';
  const sanitized = sanitizeClientFacingText(input);
  assert.ok(!sanitized.toLowerCase().includes('inspection conclusion'));
  assert.ok(sanitized.includes('[redacted]'));
});
