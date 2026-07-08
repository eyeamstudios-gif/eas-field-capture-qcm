import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildCompletedFieldPacket, buildFieldCaptureReportHtml } from '../js/export.js';
import { SERVICE_PATHWAYS } from '../js/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const validPacket = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'valid-uecs-packet.json'), 'utf8')
);

function baseProject() {
  return {
    project_id: 'uecs_proj_67890',
    uecs_project_id: 'uecs_proj_67890',
    clientflow_request_id: 'cf_req_12345',
    client_name: 'Jane Homeowner',
    project_address: '123 Main St',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
    service_pathway: SERVICE_PATHWAYS.XPD_BASELINE,
    documentation_control_classification: 'UECS Lite',
    default_capture_method: 'field_capture_qcm',
    admin_review_required: true,
    field_user: 'Field Tech',
    created_at: '2026-07-08T12:00:00.000Z',
    capture_policy_profile: validPacket.capture_policy_profile,
  };
}

function readyCoverage() {
  return {
    readiness: 'READY_FOR_ADMIN_REVIEW',
    requiredZonesComplete: 2,
    requiredZonesTotal: 2,
    accepted: 30,
    captured: 30,
    targetMin: 25,
    targetMax: 45,
    packageReadiness: 100,
    statusMessage: 'Ready for admin review.',
    warnings: 0,
    retakes: 0,
    missingZones: [],
    missingViews: [],
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

const sampleImages = [
  {
    image_id: 'img_1',
    project_id: 'uecs_proj_67890',
    zone: 'front',
    zone_name: 'Front Elevation',
    accepted: true,
    qcm_score: 92,
    qcm_status: 'PASS',
    wide_or_closeup: 'Wide Context',
  },
];

test('completed field packet includes mandatory export fields', () => {
  const packet = buildCompletedFieldPacket(
    baseProject(),
    sampleImages,
    baseShotList(),
    readyCoverage()
  );

  assert.equal(packet.source_system, 'Field_Capture_QCM');
  assert.equal(packet.target_system, 'UECS_Lite');
  assert.equal(packet.packet_type, 'completed_field_packet');
  assert.equal(packet.clientflow_request_id, 'cf_req_12345');
  assert.equal(packet.uecs_project_id, 'uecs_proj_67890');
  assert.equal(packet.client_name, 'Jane Homeowner');
  assert.equal(packet.project_address, '123 Main St');
  assert.equal(packet.capture_method_used, 'field_capture_qcm');
  assert.equal(packet.image_count, 1);
  assert.equal(packet.admin_review_required, true);
  assert.ok(packet.exported_at);
  assert.ok(packet.image_manifest);
  assert.equal(packet.xpd_only, true);
});

test('field capture HTML summary includes admin handoff details', () => {
  const project = baseProject();
  const html = buildFieldCaptureReportHtml(
    project,
    sampleImages,
    baseShotList(),
    readyCoverage(),
    {
      completedPacket: buildCompletedFieldPacket(
        project,
        sampleImages,
        baseShotList(),
        readyCoverage()
      ),
    }
  );

  assert.ok(html.includes('Internal Field Capture Summary'));
  assert.ok(html.includes('Jane Homeowner'));
  assert.ok(html.includes('Capture Checklist Completion'));
  assert.ok(html.includes('Admin Review Required'));
  assert.ok(html.includes('Image Count'));
  assert.ok(!html.toLowerCase().includes('inspection conclusion'));
});
