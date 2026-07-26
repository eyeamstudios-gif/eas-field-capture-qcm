-- ClientFlow -> Field Capture QCM control plane.
-- Forward-only: historical packets, assignments, receipts, replays and audit rows are append-only.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(display_name) between 1 and 160),
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clientflow_identity_mappings (
  id uuid primary key default gen_random_uuid(),
  clientflow_user_id text not null unique check (length(clientflow_user_id) between 1 and 200),
  user_id uuid not null unique references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table public.field_projects (
  id uuid primary key default gen_random_uuid(),
  clientflow_request_id text not null unique check (length(clientflow_request_id) between 1 and 200),
  clientflow_project_id text not null unique check (length(clientflow_project_id) between 1 and 200),
  clientflow_appointment_id text not null unique check (length(clientflow_appointment_id) between 1 and 200),
  uecs_project_id text not null unique check (length(uecs_project_id) between 1 and 200),
  status text not null check (status in ('scheduled','active','completed','revoked')),
  client_name text not null check (length(client_name) between 1 and 240),
  project_address text not null check (length(project_address) between 1 and 500),
  service_pathway text not null check (service_pathway like 'XPD%'),
  schedule_start timestamptz not null,
  schedule_end timestamptz not null,
  schedule_timezone text not null,
  correlation_id uuid not null,
  packet_id text not null,
  packet_version text not null,
  packet_revision integer not null check (packet_revision > 0),
  capture_plan jsonb not null check (
    jsonb_typeof(capture_plan) = 'object'
    and capture_plan->>'locked' = 'true'
  ),
  current_packet_snapshot_id uuid,
  source_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (schedule_end > schedule_start),
  check ((status = 'revoked') = (revoked_at is not null))
);

create table public.packet_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.field_projects(id) on delete restrict,
  revision integer not null check (revision > 0),
  event_id uuid not null unique,
  packet_id text not null,
  packet_version text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  packet jsonb not null check (jsonb_typeof(packet) = 'object'),
  reason text,
  created_at timestamptz not null default now(),
  unique (project_id, revision)
);

alter table public.field_projects
  add constraint field_projects_current_snapshot_fk
  foreign key (current_packet_snapshot_id) references public.packet_snapshots(id) on delete restrict;

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.field_projects(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  source_event_id uuid not null,
  roles text[] not null default '{}',
  capabilities text[] not null default '{}',
  access_starts_at timestamptz not null,
  access_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  check (cardinality(roles) > 0),
  check (access_ends_at > access_starts_at),
  check ((ended_at is null) = (end_reason is null))
);
create unique index project_assignments_one_open
  on public.project_assignments(project_id, user_id) where ended_at is null;

create table public.integration_receipts (
  id uuid primary key default gen_random_uuid(),
  integration text not null,
  idempotency_key text not null,
  event_id uuid not null,
  event_type text not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  project_id uuid references public.field_projects(id) on delete restrict,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  unique (integration, idempotency_key),
  unique (integration, event_id)
);

create table public.integration_replay_records (
  integration text not null,
  event_id uuid not null,
  signature_digest text not null check (signature_digest ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (integration, event_id),
  check (expires_at > received_at)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  project_id uuid references public.field_projects(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null,
  action text not null,
  event_id uuid,
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  occurred_at timestamptz not null default now()
);

create table public.status_outbox (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.field_projects(id) on delete restrict,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  device_id uuid,
  client_event_id uuid not null,
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  status text not null check (length(status) between 1 and 100),
  event_at timestamptz not null,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (user_id, client_event_id)
);

create table public.device_registrations (
  id uuid primary key,
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  label text check (length(label) <= 160),
  platform text not null check (platform in ('web','ios','android')),
  public_key text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.status_outbox
  add constraint status_outbox_device_fk
  foreign key (device_id) references public.device_registrations(id) on delete restrict;

create table public.sync_cursors (
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  device_id uuid not null references public.device_registrations(id) on delete restrict,
  cursor_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index field_projects_status_schedule_idx on public.field_projects(status, schedule_start);
create index packet_snapshots_project_created_idx on public.packet_snapshots(project_id, created_at desc);
create index project_assignments_user_window_idx on public.project_assignments(user_id, access_starts_at, access_ends_at) where ended_at is null;
create index project_assignments_project_idx on public.project_assignments(project_id);
create index replay_expiry_idx on public.integration_replay_records(expires_at);
create index audit_project_time_idx on public.audit_events(project_id, occurred_at desc);
create index status_outbox_delivery_idx on public.status_outbox(delivered_at, created_at) where delivered_at is null;
create index device_registrations_user_idx on public.device_registrations(user_id) where revoked_at is null;

create function private.reject_mutation()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'immutable_record' using errcode = '55000';
end;
$$;

create trigger identity_mappings_immutable before update or delete on public.clientflow_identity_mappings
for each row execute function private.reject_mutation();
create trigger packet_snapshots_immutable before update or delete on public.packet_snapshots
for each row execute function private.reject_mutation();
create trigger receipts_immutable before update or delete on public.integration_receipts
for each row execute function private.reject_mutation();
create trigger replay_records_immutable before update or delete on public.integration_replay_records
for each row execute function private.reject_mutation();
create trigger audit_events_immutable before update or delete on public.audit_events
for each row execute function private.reject_mutation();
create trigger assignments_no_delete before delete on public.project_assignments
for each row execute function private.reject_mutation();

alter table public.profiles enable row level security;
alter table public.clientflow_identity_mappings enable row level security;
alter table public.field_projects enable row level security;
alter table public.packet_snapshots enable row level security;
alter table public.project_assignments enable row level security;
alter table public.integration_receipts enable row level security;
alter table public.integration_replay_records enable row level security;
alter table public.audit_events enable row level security;
alter table public.status_outbox enable row level security;
alter table public.device_registrations enable row level security;
alter table public.sync_cursors enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated
using (user_id = (select auth.uid()));
create policy mappings_read_self on public.clientflow_identity_mappings for select to authenticated
using (user_id = (select auth.uid()));
create policy assignments_read_self on public.project_assignments for select to authenticated
using (user_id = (select auth.uid()));
create policy assigned_projects_read on public.field_projects for select to authenticated using (
  exists (
    select 1 from public.project_assignments a
    where a.project_id = field_projects.id and a.user_id = (select auth.uid())
  )
);
create policy assigned_packets_read on public.packet_snapshots for select to authenticated using (
  exists (
    select 1 from public.project_assignments a
    join public.field_projects fp on fp.id = a.project_id
    where a.project_id = packet_snapshots.project_id
      and a.user_id = (select auth.uid()) and a.ended_at is null
      and fp.status <> 'revoked'
      and now() between a.access_starts_at and a.access_ends_at
  )
);
create policy status_outbox_read_self on public.status_outbox for select to authenticated
using (user_id = (select auth.uid()));
create policy status_outbox_insert_self on public.status_outbox for insert to authenticated
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.project_assignments a
    where a.project_id = status_outbox.project_id and a.user_id = (select auth.uid()) and a.ended_at is null
      and now() between a.access_starts_at and a.access_ends_at
  )
);
create policy devices_manage_self on public.device_registrations for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cursors_manage_self on public.sync_cursors for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.profiles, public.clientflow_identity_mappings, public.field_projects,
  public.packet_snapshots, public.project_assignments, public.integration_receipts,
  public.integration_replay_records, public.audit_events, public.status_outbox,
  public.device_registrations, public.sync_cursors from anon, authenticated;
grant select on public.profiles, public.clientflow_identity_mappings, public.field_projects,
  public.packet_snapshots, public.project_assignments to authenticated;
grant select, insert on public.status_outbox to authenticated;
grant select, insert, update on public.device_registrations, public.sync_cursors to authenticated;
grant usage, select on sequence public.audit_events_id_seq to service_role;
grant all on public.profiles, public.clientflow_identity_mappings, public.field_projects,
  public.packet_snapshots, public.project_assignments, public.integration_receipts,
  public.integration_replay_records, public.audit_events, public.status_outbox,
  public.device_registrations, public.sync_cursors to service_role;

create function private.require_service_role()
returns void language plpgsql stable security invoker set search_path = pg_catalog as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
end;
$$;

create function private.resolve_assignments(p_assignments jsonb)
returns table(user_id uuid, roles text[], capabilities text[], access_starts_at timestamptz, access_ends_at timestamptz)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select m.user_id,
    array(select jsonb_array_elements_text(a.item->'roles')),
    array(select jsonb_array_elements_text(a.item->'capabilities')),
    (a.item->>'access_starts_at')::timestamptz,
    (a.item->>'access_ends_at')::timestamptz
  from jsonb_array_elements(p_assignments) a(item)
  join public.clientflow_identity_mappings m on m.clientflow_user_id = a.item->>'clientflow_user_id'
  join public.profiles p on p.user_id = m.user_id and p.active
$$;

create function private.accept_clientflow_event(
  p_event_type text,
  p_event_id uuid,
  p_idempotency_key text,
  p_payload_hash text,
  p_signature_digest text,
  p_project jsonb,
  p_packet jsonb,
  p_assignments jsonb,
  p_reason text default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_existing public.integration_receipts%rowtype;
  v_project public.field_projects%rowtype;
  v_snapshot_id uuid;
  v_revision integer;
  v_response jsonb;
  v_expected integer;
  v_resolved integer;
begin
  perform private.require_service_role();
  select * into v_existing from public.integration_receipts
    where integration = 'clientflow' and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> p_payload_hash or v_existing.event_type <> p_event_type then
      raise exception 'idempotency_conflict' using errcode = '23505';
    end if;
    return v_existing.response_body;
  end if;

  insert into public.integration_replay_records(integration, event_id, signature_digest, expires_at)
  values ('clientflow', p_event_id, p_signature_digest, now() + interval '24 hours');

  if p_event_type = 'handoff' then
    v_expected := jsonb_array_length(p_assignments);
    select count(*) into v_resolved from private.resolve_assignments(p_assignments);
    if v_expected <> v_resolved then
      raise exception 'unmapped_clientflow_user' using errcode = '23503';
    end if;

    insert into public.field_projects(
      clientflow_request_id, clientflow_project_id, clientflow_appointment_id, uecs_project_id,
      status, client_name, project_address, service_pathway, schedule_start, schedule_end,
      schedule_timezone, correlation_id, packet_id, packet_version, packet_revision,
      capture_plan, source_version
    ) values (
      p_project->>'clientflow_request_id', p_project->>'clientflow_project_id',
      p_project->>'clientflow_appointment_id', p_project->>'uecs_project_id', 'scheduled',
      p_project->>'client_name', p_project->>'project_address', p_project->>'service_pathway',
      (p_project->>'schedule_start')::timestamptz, (p_project->>'schedule_end')::timestamptz,
      p_project->>'schedule_timezone', (p_project->>'correlation_id')::uuid,
      p_project->>'packet_id', p_project->>'packet_version',
      (p_project->>'packet_revision')::integer, p_project->'capture_plan', p_project->>'source_version'
    ) returning * into v_project;
    v_revision := 1;
  else
    select * into v_project from public.field_projects
      where clientflow_request_id = p_project->>'clientflow_request_id'
        and uecs_project_id = p_project->>'uecs_project_id' for update;
    if not found then raise exception 'project_not_found' using errcode = 'P0002'; end if;
    if v_project.status = 'revoked' and p_event_type <> 'revocation' then
      raise exception 'project_revoked' using errcode = '55000';
    end if;
    if p_event_type = 'amendment' then
      select coalesce(max(revision), 0) + 1 into v_revision
        from public.packet_snapshots where project_id = v_project.id;
    else
      v_revision := null;
    end if;
  end if;

  if p_event_type in ('handoff','amendment') then
    insert into public.packet_snapshots(
      project_id, revision, event_id, packet_id, packet_version, payload_hash, packet, reason
    )
    values (
      v_project.id, v_revision, p_event_id, p_project->>'packet_id',
      p_project->>'packet_version', p_payload_hash, p_packet, p_reason
    )
    returning id into v_snapshot_id;

    update public.field_projects set
      client_name = p_project->>'client_name',
      project_address = p_project->>'project_address',
      service_pathway = p_project->>'service_pathway',
      schedule_start = (p_project->>'schedule_start')::timestamptz,
      schedule_end = (p_project->>'schedule_end')::timestamptz,
      schedule_timezone = p_project->>'schedule_timezone',
      correlation_id = (p_project->>'correlation_id')::uuid,
      packet_id = p_project->>'packet_id',
      packet_version = p_project->>'packet_version',
      packet_revision = (p_project->>'packet_revision')::integer,
      capture_plan = p_project->'capture_plan',
      current_packet_snapshot_id = v_snapshot_id,
      source_version = p_project->>'source_version',
      updated_at = now()
    where id = v_project.id;

    if p_event_type = 'amendment' and p_assignments is not null then
      v_expected := jsonb_array_length(p_assignments);
      select count(*) into v_resolved from private.resolve_assignments(p_assignments);
      if v_expected <> v_resolved then raise exception 'unmapped_clientflow_user' using errcode = '23503'; end if;
      update public.project_assignments set ended_at = now(), end_reason = 'superseded'
        where project_id = v_project.id and ended_at is null;
    end if;

    if p_event_type = 'handoff' or p_assignments is not null then
      insert into public.project_assignments(
        project_id, user_id, source_event_id, roles, capabilities, access_starts_at, access_ends_at
      )
      select v_project.id, r.user_id, p_event_id, r.roles, r.capabilities, r.access_starts_at, r.access_ends_at
      from private.resolve_assignments(p_assignments) r;
    end if;
  elsif p_event_type = 'revocation' then
    update public.project_assignments set ended_at = now(), end_reason = coalesce(p_reason, 'revoked')
      where project_id = v_project.id and ended_at is null;
    update public.field_projects set status = 'revoked', revoked_at = now(), updated_at = now()
      where id = v_project.id;
  else
    raise exception 'unsupported_event_type' using errcode = '22023';
  end if;

  insert into public.audit_events(project_id, source, action, event_id, details)
  values (v_project.id, 'clientflow', p_event_type, p_event_id,
    jsonb_build_object('payload_hash', p_payload_hash, 'revision', v_revision));

  v_response := jsonb_build_object(
    'schema_version', 'clientflow.receipt.v1',
    'event_id', p_event_id,
    'idempotency_key', p_idempotency_key,
    'status', 'accepted',
    'project_id', v_project.id,
    'packet_revision', case when p_event_type = 'revocation' then null else v_revision end,
    'received_at', now()
  );
  insert into public.integration_receipts(
    integration, idempotency_key, event_id, event_type, payload_hash, project_id, response_body
  ) values ('clientflow', p_idempotency_key, p_event_id, p_event_type, p_payload_hash, v_project.id, v_response);
  return v_response;
end;
$$;

revoke all on function private.reject_mutation() from public;
revoke all on function private.require_service_role() from public;
revoke all on function private.resolve_assignments(jsonb) from public;
revoke all on function private.accept_clientflow_event(text,uuid,text,text,text,jsonb,jsonb,jsonb,text) from public;
grant usage on schema private to service_role;
grant execute on function private.accept_clientflow_event(text,uuid,text,text,text,jsonb,jsonb,jsonb,text) to service_role;

-- PostgREST exposes only public; this invoker wrapper is executable solely by service_role.
create function public.accept_clientflow_event(
  p_event_type text,
  p_event_id uuid,
  p_idempotency_key text,
  p_payload_hash text,
  p_signature_digest text,
  p_project jsonb,
  p_packet jsonb,
  p_assignments jsonb,
  p_reason text default null
) returns jsonb
language sql security invoker
set search_path = pg_catalog, private
as $$
  select private.accept_clientflow_event(
    p_event_type, p_event_id, p_idempotency_key, p_payload_hash, p_signature_digest,
    p_project, p_packet, p_assignments, p_reason
  )
$$;
revoke all on function public.accept_clientflow_event(text,uuid,text,text,text,jsonb,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.accept_clientflow_event(text,uuid,text,text,text,jsonb,jsonb,jsonb,text) to service_role;
