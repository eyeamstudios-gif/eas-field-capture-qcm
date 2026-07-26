import { z } from 'zod';

const id = z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const isoDateTime = z.iso.datetime({ offset: true });
const capability = z.enum([
  'project.read',
  'capture.mobile',
  'capture.true_camera',
  'capture.drone',
  'capture.360',
  'capture.rtk',
  'capture.lidar',
  'checklist.write',
  'notes.write',
  'submission.write',
  'attestation.write',
  'supervision.write',
  'qcm.review',
  'status.write',
  'drone.rpic',
]);
const role = z.enum([
  'PRIMARY_OPERATOR',
  'ASSISTANT_OPERATOR',
  'REMOTE_PILOT_IN_COMMAND',
  'VISUAL_OBSERVER',
  'FIELD_SUPERVISOR',
  'QCM_REVIEWER',
  'READ_ONLY_OBSERVER',
]);
const captureMethod = z.enum(['mobile_camera', 'true_camera', 'drone', 'camera_360', 'rtk', 'lidar']);

const assignment = z.strictObject({
  clientflow_user_id: id,
  roles: z.array(role).min(1).max(8),
  capabilities: z.array(capability).max(16),
  access_starts_at: isoDateTime,
  access_ends_at: isoDateTime,
}).superRefine((value, ctx) => {
  if (Date.parse(value.access_ends_at) <= Date.parse(value.access_starts_at)) {
    ctx.addIssue({ code: 'custom', path: ['access_ends_at'], message: 'must be after access_starts_at' });
  }
  if (value.roles.includes('REMOTE_PILOT_IN_COMMAND') && !value.capabilities.includes('drone.rpic')) {
    ctx.addIssue({ code: 'custom', path: ['capabilities'], message: 'REMOTE_PILOT_IN_COMMAND requires drone.rpic' });
  }
});

const project = z.strictObject({
  clientflow_request_id: id,
  clientflow_project_id: id,
  clientflow_appointment_id: id,
  uecs_project_id: id,
  client_name: z.string().trim().min(1).max(240),
  project_address: z.string().trim().min(1).max(500),
  service_pathway: z.string().trim().min(3).max(200).startsWith('XPD'),
});

const schedule = z.strictObject({
  status: z.literal('confirmed'),
  starts_at: isoDateTime,
  ends_at: isoDateTime,
  timezone: z.string().min(1).max(100),
}).superRefine((value, ctx) => {
  if (Date.parse(value.ends_at) <= Date.parse(value.starts_at)) {
    ctx.addIssue({ code: 'custom', path: ['ends_at'], message: 'must be after starts_at' });
  }
});

const packet = z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, 'packet cannot be empty');
const capturePlan = z.strictObject({
  locked: z.literal(true),
  required_capture_methods: z.array(captureMethod).min(1),
  allowed_capture_methods: z.array(captureMethod).min(1),
  items: z.array(z.strictObject({
    item_id: id,
    label: z.string().trim().min(1).max(240),
    required: z.boolean(),
    capture_method: captureMethod,
  })).min(1).max(500),
}).superRefine((value, ctx) => {
  const allowed = new Set(value.allowed_capture_methods);
  for (const method of value.required_capture_methods) {
    if (!allowed.has(method)) {
      ctx.addIssue({ code: 'custom', path: ['required_capture_methods'], message: `${method} must also be allowed` });
    }
  }
  value.items.forEach((item, index) => {
    if (!allowed.has(item.capture_method)) {
      ctx.addIssue({ code: 'custom', path: ['items', index, 'capture_method'], message: 'capture method is not allowed' });
    }
  });
});

const base = {
  event_id: z.uuid(),
  correlation_id: z.uuid(),
  idempotency_key: id,
  source_system: z.literal('ClientFlow'),
  packet_id: id,
  packet_version: z.string().trim().min(1).max(40),
  packet_revision: z.number().int().positive(),
  occurred_at: isoDateTime,
};

function requireIndependentRpic(value, ctx) {
  const userIds = value.assignments.map((a) => a.clientflow_user_id);
  if (new Set(userIds).size !== userIds.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['assignments'],
      message: 'clientflow_user_id must be unique within assignments',
    });
  }
  const droneRequired = value.capture_plan.required_capture_methods.includes('drone');
  const droneOperators = value.assignments.filter((a) => a.capabilities.includes('capture.drone'));
  if (!droneRequired && droneOperators.length === 0) return;
  if (droneRequired && droneOperators.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['assignments'], message: 'drone capture plan requires capture.drone capability' });
    return;
  }
  const operatorIds = new Set(droneOperators.map((a) => a.clientflow_user_id));
  const hasIndependentRpic = value.assignments.some(
    (a) => a.roles.includes('REMOTE_PILOT_IN_COMMAND')
      && a.capabilities.includes('drone.rpic')
      && !operatorIds.has(a.clientflow_user_id),
  );
  if (!hasIndependentRpic) {
    ctx.addIssue({
      code: 'custom',
      path: ['assignments'],
      message: 'drone capture requires a separately mapped REMOTE_PILOT_IN_COMMAND with drone.rpic capability',
    });
  }
}

export const handoffSchema = z.strictObject({
  schema_version: z.literal('clientflow.handoff.v1'),
  ...base,
  project,
  confirmed_schedule: schedule,
  capture_plan: capturePlan,
  packet,
  assignments: z.array(assignment).min(1).max(100),
}).superRefine(requireIndependentRpic);

export const amendmentSchema = z.strictObject({
  schema_version: z.literal('clientflow.amendment.v1'),
  ...base,
  project,
  confirmed_schedule: schedule,
  capture_plan: capturePlan,
  packet,
  assignments: z.array(assignment).min(1).max(100).optional(),
  reason: z.string().trim().min(1).max(500),
}).superRefine((value, ctx) => {
  if (value.assignments) requireIndependentRpic(value, ctx);
});

export const revocationSchema = z.strictObject({
  schema_version: z.literal('clientflow.revocation.v1'),
  event_id: z.uuid(),
  correlation_id: z.uuid(),
  idempotency_key: id,
  source_system: z.literal('ClientFlow'),
  occurred_at: isoDateTime,
  project: z.strictObject({
    clientflow_request_id: id,
    clientflow_project_id: id.optional(),
    clientflow_appointment_id: id.optional(),
    uecs_project_id: id,
  }),
  reason: z.string().trim().min(1).max(500),
});

export const statusEventSchema = z.strictObject({
  schema_version: z.literal('fieldcapture.status.v1'),
  client_event_id: z.uuid(),
  project_id: z.uuid(),
  device_id: z.uuid().optional(),
  status: z.enum([
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
  ]),
  event_at: isoDateTime,
  data: z.record(z.string(), z.unknown()).default({}),
});

export function toRpcPayload(event) {
  const schedule = event.confirmed_schedule;
  return {
    ...event.project,
    correlation_id: event.correlation_id,
    ...(event.packet_id ? { packet_id: event.packet_id } : {}),
    ...(event.packet_version ? { packet_version: event.packet_version } : {}),
    ...(event.packet_revision ? { packet_revision: event.packet_revision } : {}),
    ...(event.capture_plan ? { capture_plan: event.capture_plan } : {}),
    ...(schedule && {
      schedule_start: schedule.starts_at,
      schedule_end: schedule.ends_at,
      schedule_timezone: schedule.timezone,
    }),
    source_version: event.schema_version,
  };
}

export function formatSchemaErrors(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
}
