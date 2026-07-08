import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  validateUecsLiteImport,
  buildQueueRecord,
  transitionQueueStatus,
  validateExportGate,
  QUEUE_STATUSES,
  FIELD_PACKET_STATUSES,
} from '../js/governance.js';
import { buildCompletedFieldPacket } from '../js/export.js';
import { SERVICE_PATHWAYS } from '../js/utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const validPacket = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'valid-uecs-packet.json'), 'utf8')
);

test('offline import → capture → export flow works with in-memory queue records', () => {
  const importResult = validateUecsLiteImport(validPacket);
  assert.equal(importResult.valid, true);

  const project = {
    ...importResult.project,
    project_status: FIELD_PACKET_STATUSES.FIELD_CAPTURE_IN_PROGRESS,
    field_packet_status: FIELD_PACKET_STATUSES.FIELD_CAPTURE_IN_PROGRESS,
    field_user: 'Offline Tech',
  };

  let queueRecord = buildQueueRecord({
    project,
    status: QUEUE_STATUSES.ACTIVE_CAPTURE,
    validationStatus: 'import_validated',
  });

  const shotList = {
    zones: [
      { id: 'front', name: 'Front Elevation', required: true, captured: true, minWide: 1, minCloseup: 0 },
      { id: 'rear', name: 'Rear Elevation', required: true, captured: true, minWide: 1, minCloseup: 0 },
    ],
  };

  const images = [
    {
      image_id: 'img_offline_1',
      project_id: project.project_id,
      zone: 'front',
      zone_name: 'Front Elevation',
      accepted: true,
      qcm_score: 90,
      qcm_status: 'PASS',
      wide_or_closeup: 'Wide Context',
    },
  ];

  const coverage = {
    readiness: 'READY_FOR_ADMIN_REVIEW',
    requiredZonesComplete: 2,
    requiredZonesTotal: 2,
    accepted: 1,
    captured: 1,
    targetMin: 25,
    targetMax: 45,
    packageReadiness: 100,
    statusMessage: 'Ready for admin review.',
    warnings: 0,
    retakes: 0,
    missingZones: [],
    missingViews: [],
  };

  queueRecord = transitionQueueStatus(queueRecord, QUEUE_STATUSES.READY_FOR_EXPORT, {
    readiness: coverage.readiness,
    accepted_images: coverage.accepted,
    validation_status: 'capture_complete',
  });
  assert.equal(queueRecord.status, QUEUE_STATUSES.READY_FOR_EXPORT);

  const exportGate = validateExportGate(project, coverage, shotList);
  assert.equal(exportGate.valid, true);

  const completedPacket = buildCompletedFieldPacket(project, images, shotList, coverage);
  queueRecord = transitionQueueStatus(queueRecord, QUEUE_STATUSES.EXPORTED, {
    packet: completedPacket,
    validation_status: 'export_validated',
  });

  assert.equal(queueRecord.status, QUEUE_STATUSES.EXPORTED);
  assert.equal(queueRecord.export_count, 1);
  assert.equal(completedPacket.service_pathway, SERVICE_PATHWAYS.XPD_BASELINE);
  assert.equal(completedPacket.operator_name, 'Offline Tech');
});
