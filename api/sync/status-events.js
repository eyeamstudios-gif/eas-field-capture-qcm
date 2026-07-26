import { errorResponse, json, requireMethod } from '../../lib/server/http.js';
import { sha256 } from '../../lib/server/receiver-auth.js';
import { formatSchemaErrors, statusEventSchema } from '../../lib/server/schemas.js';
import { authenticatedClient } from '../../lib/server/supabase.js';

const MAX_BODY_BYTES = 128 * 1024;

export async function POST(request) {
  const methodError = requireMethod(request, 'POST');
  if (methodError) return methodError;
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'application_json_required');
  }

  let auth;
  try {
    auth = await authenticatedClient(request);
  } catch {
    return errorResponse(503, 'sync_not_configured');
  }
  if (auth.error) return errorResponse(401, auth.error);

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) return errorResponse(413, 'payload_too_large');
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, 'invalid_json');
  }
  const parsed = statusEventSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, 'schema_validation_failed', formatSchemaErrors(parsed.error));
  }

  const eventHash = sha256(rawBody);
  const { data: existing, error: readError } = await auth.client
    .from('status_outbox')
    .select('id, event_hash')
    .eq('user_id', auth.user.id)
    .eq('client_event_id', parsed.data.client_event_id)
    .maybeSingle();
  if (readError) return errorResponse(500, 'status_event_read_failed');
  if (existing) {
    if (existing.event_hash !== eventHash) return errorResponse(409, 'idempotency_conflict');
    return json(200, {
      schema_version: 'fieldcapture.status-receipt.v1',
      status: 'accepted',
      duplicate: true,
      event_id: existing.id,
      client_event_id: parsed.data.client_event_id,
    });
  }

  const { data, error } = await auth.client
    .from('status_outbox')
    .insert({
      project_id: parsed.data.project_id,
      user_id: auth.user.id,
      device_id: parsed.data.device_id ?? null,
      client_event_id: parsed.data.client_event_id,
      event_hash: eventHash,
      status: parsed.data.status,
      event_at: parsed.data.event_at,
      data: parsed.data.data,
    })
    .select('id, client_event_id')
    .single();
  if (error?.code === '23505') return errorResponse(409, 'concurrent_idempotency_conflict');
  if (error?.code === '42501') return errorResponse(403, 'project_access_denied');
  if (error) return errorResponse(500, 'status_event_write_failed');

  return json(201, {
    schema_version: 'fieldcapture.status-receipt.v1',
    status: 'accepted',
    duplicate: false,
    event_id: data.id,
    client_event_id: data.client_event_id,
  });
}
