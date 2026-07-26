import { errorResponse, json, requireMethod } from './http.js';
import { verifyReceiverAuth } from './receiver-auth.js';
import { formatSchemaErrors, toRpcPayload } from './schemas.js';
import { receiverEnvironment, serviceClient } from './supabase.js';

const MAX_BODY_BYTES = 1024 * 1024;

export function createClientFlowReceiver(eventType, schema) {
  return async function handler(request) {
    const methodError = requireMethod(request, 'POST');
    if (methodError) return methodError;
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
      return errorResponse(415, 'application_json_required');
    }

    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) return errorResponse(413, 'payload_too_large');

    let env;
    try {
      env = receiverEnvironment();
    } catch {
      return errorResponse(503, 'receiver_not_configured');
    }

    let rawBody;
    try {
      rawBody = await request.text();
    } catch {
      return errorResponse(400, 'body_read_failed');
    }
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return errorResponse(413, 'payload_too_large');
    }

    const auth = verifyReceiverAuth({
      rawBody,
      secret: env.webhookSecret,
      signature: request.headers.get('x-clientflow-signature'),
      timestamp: request.headers.get('x-clientflow-timestamp'),
      payloadHash: request.headers.get('x-clientflow-content-sha256'),
    });
    if (!auth.ok) return errorResponse(401, auth.code);

    let input;
    try {
      input = JSON.parse(rawBody);
    } catch {
      return errorResponse(400, 'invalid_json');
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return errorResponse(422, 'schema_validation_failed', formatSchemaErrors(parsed.error));
    }

    const headerKey = request.headers.get('idempotency-key');
    if (!headerKey || headerKey !== parsed.data.idempotency_key) {
      return errorResponse(400, 'idempotency_key_mismatch');
    }

    const client = serviceClient(env);
    const { data, error } = await client.rpc('accept_clientflow_event', {
      p_event_type: eventType,
      p_event_id: parsed.data.event_id,
      p_idempotency_key: parsed.data.idempotency_key,
      p_payload_hash: auth.payloadHash,
      p_signature_digest: auth.signatureDigest,
      p_project: toRpcPayload(parsed.data),
      p_packet: parsed.data.packet || {},
      p_assignments: parsed.data.assignments ?? null,
      p_reason: parsed.data.reason ?? null,
    });

    if (error) {
      if (error.message?.includes('idempotency_conflict') || error.code === '23505') {
        return errorResponse(409, 'idempotency_or_replay_conflict');
      }
      if (error.message?.includes('unmapped_clientflow_user') || error.code === '23503') {
        return errorResponse(422, 'unmapped_clientflow_user');
      }
      if (error.message?.includes('project_not_found') || error.code === 'P0002') {
        return errorResponse(404, 'project_not_found');
      }
      if (error.message?.includes('project_revoked')) {
        return errorResponse(409, 'project_revoked');
      }
      return errorResponse(500, 'control_plane_write_failed');
    }

    return json(200, data);
  };
}
