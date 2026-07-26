import { errorResponse, json, requireMethod } from '../../lib/server/http.js';
import { authenticatedClient } from '../../lib/server/supabase.js';

export async function GET(request) {
  const methodError = requireMethod(request, 'GET');
  if (methodError) return methodError;

  let auth;
  try {
    auth = await authenticatedClient(request);
  } catch {
    return errorResponse(503, 'sync_not_configured');
  }
  if (auth.error) return errorResponse(401, auth.error);

  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  if (cursor && !Number.isFinite(Date.parse(cursor))) return errorResponse(400, 'invalid_cursor');
  const requestedLimit = Number(url.searchParams.get('limit') || 100);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
    return errorResponse(400, 'invalid_limit');
  }
  const limit = Math.min(requestedLimit, 200);

  let query = auth.client
    .from('field_projects')
    .select(`
      id, clientflow_request_id, clientflow_project_id, clientflow_appointment_id,
      uecs_project_id, status, client_name, project_address, service_pathway,
      schedule_start, schedule_end, schedule_timezone, correlation_id, packet_id,
      packet_version, packet_revision, capture_plan, updated_at, revoked_at,
      packet:packet_snapshots!field_projects_current_snapshot_fk(
        id, revision, packet_id, packet_version, packet, created_at
      ),
      assignments:project_assignments(
        id, roles, capabilities, access_starts_at, access_ends_at, ended_at, end_reason
      )
    `)
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (cursor) query = query.gt('updated_at', cursor);

  const { data, error } = await query;
  if (error) return errorResponse(500, 'sync_read_failed');

  const projects = (data || []).map((row) => {
    const openAssignments = (row.assignments || []).filter((assignment) => !assignment.ended_at);
    const closedAssignments = (row.assignments || []).filter((assignment) => assignment.ended_at);
    const assignmentSource =
      openAssignments[0] ||
      closedAssignments.sort((a, b) => Date.parse(b.ended_at || 0) - Date.parse(a.ended_at || 0))[0] ||
      null;
    const assignment = assignmentSource
      ? {
          assignment_id: assignmentSource.id,
          role: assignmentSource.roles?.[0] || null,
          roles: assignmentSource.roles || [],
          capabilities: assignmentSource.capabilities || [],
          access_starts_at: assignmentSource.access_starts_at,
          access_ends_at: assignmentSource.access_ends_at,
          status:
            row.status === 'revoked' || assignmentSource.end_reason === 'revoked'
              ? 'revoked'
              : assignmentSource.ended_at
                ? 'expired'
                : 'approved',
        }
      : null;

    return {
      id: row.id,
      project_id: row.uecs_project_id,
      uecs_project_id: row.uecs_project_id,
      clientflow_request_id: row.clientflow_request_id,
      clientflow_project_id: row.clientflow_project_id,
      clientflow_appointment_id: row.clientflow_appointment_id,
      status: row.status,
      client_name: row.client_name,
      project_address: row.project_address,
      service_pathway: row.service_pathway,
      confirmed_schedule_start: row.schedule_start,
      schedule_start: row.schedule_start,
      schedule_end: row.schedule_end,
      schedule_timezone: row.schedule_timezone,
      correlation_id: row.correlation_id,
      packet_id: row.packet_id,
      packet_version: row.packet_version,
      revision: row.packet_revision,
      capture_plan: row.capture_plan,
      updated_at: row.updated_at,
      revoked_at: row.revoked_at,
      assignment,
      assignments: row.assignments || [],
      packet: row.packet || null,
      project: {
        project_id: row.uecs_project_id,
        uecs_project_id: row.uecs_project_id,
        clientflow_request_id: row.clientflow_request_id,
        clientflow_project_id: row.clientflow_project_id,
        clientflow_appointment_id: row.clientflow_appointment_id,
        client_name: row.client_name,
        project_address: row.project_address,
        service_pathway: row.service_pathway,
        confirmed_schedule_start: row.schedule_start,
        schedule_start: row.schedule_start,
        schedule_end: row.schedule_end,
        schedule_timezone: row.schedule_timezone,
        packet_version: row.packet_version,
        capture_plan: row.capture_plan,
        governance_locked: true,
        field_packet_status:
          row.status === 'revoked' ? 'field_access_revoked' : 'queued_for_field_capture',
        linked_to_clientflow: true,
      },
    };
  });

  const nextCursor = projects.length ? projects[projects.length - 1].updated_at : cursor;
  return json(200, {
    schema_version: 'fieldcapture.assigned-projects.v1',
    projects,
    next_cursor: nextCursor || null,
    has_more: projects.length === limit,
  });
}
