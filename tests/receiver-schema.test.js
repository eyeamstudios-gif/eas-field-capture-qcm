import test from 'node:test';
import assert from 'node:assert/strict';
import { handoffSchema, revocationSchema, statusEventSchema } from '../lib/server/schemas.js';

function capturePlan(extraMethods = []) {
  const methods = ['mobile_camera', ...extraMethods];
  return {
    locked: true,
    required_capture_methods: methods,
    allowed_capture_methods: methods,
    items: [{
      item_id: 'item-front',
      label: 'Front elevation',
      required: true,
      capture_method: 'mobile_camera',
    }],
  };
}

function handoff() {
  return {
    schema_version: 'clientflow.handoff.v1',
    event_id: '7a7509dc-2ac0-4e43-9bdf-3563eb578a5d',
    correlation_id: '3c0f3b2c-7d5d-4b2f-8c2b-1f0b0a0d1111',
    idempotency_key: 'handoff-001',
    source_system: 'ClientFlow',
    packet_id: 'packet-100',
    packet_version: '1.0.0',
    packet_revision: 1,
    occurred_at: '2026-07-26T13:00:00.000Z',
    project: {
      clientflow_request_id: 'cf-100',
      clientflow_project_id: 'cf-proj-100',
      clientflow_appointment_id: 'cf-appt-100',
      uecs_project_id: 'uecs-100',
      client_name: 'Test Client',
      project_address: '100 Test Street',
      service_pathway: 'XPD Exterior Baseline Snapshot',
    },
    confirmed_schedule: {
      status: 'confirmed',
      starts_at: '2026-07-27T13:00:00.000Z',
      ends_at: '2026-07-27T17:00:00.000Z',
      timezone: 'America/New_York',
    },
    capture_plan: capturePlan(),
    packet: { capture_policy_profile: { allowed_enhancements: ['standard_camera'] } },
    assignments: [{
      clientflow_user_id: 'field-user-1',
      roles: ['PRIMARY_OPERATOR'],
      capabilities: ['project.read', 'capture.mobile', 'checklist.write', 'submission.write', 'status.write'],
      access_starts_at: '2026-07-27T12:00:00.000Z',
      access_ends_at: '2026-07-27T18:00:00.000Z',
    }],
  };
}

test('strict v1 handoff accepts a confirmed mapped assignment shape', () => {
  assert.equal(handoffSchema.safeParse(handoff()).success, true);
});

test('strict schema rejects unknown keys and unconfirmed schedules', () => {
  assert.equal(handoffSchema.safeParse({ ...handoff(), unexpected: true }).success, false);
  const unconfirmed = handoff();
  unconfirmed.confirmed_schedule.status = 'tentative';
  assert.equal(handoffSchema.safeParse(unconfirmed).success, false);
});

test('drone capture requires a separate RPIC assignment', () => {
  const event = handoff();
  event.capture_plan = capturePlan(['drone']);
  event.assignments[0].roles = ['PRIMARY_OPERATOR'];
  event.assignments[0].capabilities.push('capture.drone', 'drone.rpic');
  assert.equal(handoffSchema.safeParse(event).success, false);

  event.assignments[0].capabilities = event.assignments[0].capabilities.filter((c) => c !== 'drone.rpic');
  event.assignments.push({
    clientflow_user_id: 'rpic-user-1',
    roles: ['REMOTE_PILOT_IN_COMMAND'],
    capabilities: ['drone.rpic', 'attestation.write', 'status.write'],
    access_starts_at: '2026-07-27T12:00:00.000Z',
    access_ends_at: '2026-07-27T18:00:00.000Z',
  });
  assert.equal(handoffSchema.safeParse(event).success, true);
});

test('an external user can appear only once per assignment set', () => {
  const event = handoff();
  event.assignments.push({ ...event.assignments[0] });
  assert.equal(handoffSchema.safeParse(event).success, false);
});

test('revocation and status event schemas are versioned and strict', () => {
  assert.equal(revocationSchema.safeParse({
    schema_version: 'clientflow.revocation.v1',
    event_id: 'fbaf169d-8520-4364-aad4-8f3401bf9750',
    correlation_id: '4d1f4c3d-8e6e-5c3f-8d3c-2a1c1b1e2222',
    idempotency_key: 'revoke-001',
    source_system: 'ClientFlow',
    occurred_at: '2026-07-26T13:00:00.000Z',
    project: { clientflow_request_id: 'cf-100', uecs_project_id: 'uecs-100' },
    reason: 'Customer cancelled',
  }).success, true);
  assert.equal(statusEventSchema.safeParse({
    schema_version: 'fieldcapture.status.v1',
    client_event_id: 'a28f60ca-6af4-43f3-846c-d6e49bba0616',
    project_id: 'ab42f150-9e88-44c5-ad97-d3eef724f616',
    status: 'field_work_started',
    event_at: '2026-07-27T13:05:00.000Z',
    data: {},
  }).success, true);
});
