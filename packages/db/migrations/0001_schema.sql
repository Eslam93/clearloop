-- ClearLoop schema v2.
--
-- Every table carries tenant_id, and every reference to another tenant-owned row is a composite
-- foreign key on (tenant_id, id). A row can therefore never point at another tenant's row, even
-- through a bug: the database refuses it, independent of row-level security (0002).

create table tenants (
  id                     uuid primary key,
  name                   text        not null,
  created_at             timestamptz not null default now(),
  -- Sandboxes expire; a cleanup job deletes them and everything they own.
  expires_at             timestamptz,
  -- The demo runs on a virtual clock: real time plus this offset. The time machine moves it.
  clock_offset_ms        bigint      not null default 0,
  -- The customer status page ships off by default (v1 NOTES gated it on validation).
  customer_portal_enabled boolean    not null default false,
  -- The device simulator's "phone offline" switch, used to show retries.
  device_offline         boolean     not null default false,
  seed_version           integer     not null default 1
);

create table users (
  tenant_id  uuid not null references tenants (id) on delete cascade,
  id         uuid not null default gen_random_uuid() primary key,
  handle     text not null,
  name       text not null,
  role       text not null check (role in ('am', 'engineer', 'lead')),
  team       text,
  unique (tenant_id, id),
  unique (tenant_id, handle)
);

create table business_calendars (
  tenant_id  uuid not null references tenants (id) on delete cascade,
  id         uuid not null default gen_random_uuid() primary key,
  name       text not null,
  -- The full calendar (zone, work week, hours, holidays, Ramadan rule) as the
  -- @clearloop/business-time package reads it.
  definition jsonb not null,
  unique (tenant_id, id)
);

create table sla_policies (
  tenant_id      uuid    not null references tenants (id) on delete cascade,
  id             uuid    not null default gen_random_uuid() primary key,
  tier           text    not null check (tier in ('standard', 'pro', 'vip')),
  priority       text    not null check (priority in ('low', 'normal', 'high', 'urgent')),
  target_minutes integer not null check (target_minutes > 0),
  unique (tenant_id, id),
  unique (tenant_id, tier, priority)
);

create table customers (
  tenant_id          uuid not null references tenants (id) on delete cascade,
  id                 uuid not null default gen_random_uuid() primary key,
  name               text not null,
  tier               text not null check (tier in ('standard', 'pro', 'vip')),
  owner_user_id      uuid not null,
  calendar_id        uuid not null,
  preferred_language text not null check (preferred_language in ('ar', 'en')),
  preferred_channel  text not null check (preferred_channel in ('whatsapp', 'email')),
  contact_name       text not null,
  -- When the customer last messaged us. WhatsApp allows free text only within 24 hours of it.
  last_inbound_at    timestamptz,
  unique (tenant_id, id),
  foreign key (tenant_id, owner_user_id) references users (tenant_id, id),
  foreign key (tenant_id, calendar_id) references business_calendars (tenant_id, id)
);

create table requests (
  tenant_id     uuid        not null references tenants (id) on delete cascade,
  id            uuid        not null default gen_random_uuid() primary key,
  number        integer     not null,
  customer_id   uuid        not null,
  title         text        not null,
  status        text        not null check (status in
                  ('new', 'triage', 'in_progress', 'blocked', 'waiting_on_customer', 'resolved')),
  priority      text        not null check (priority in ('low', 'normal', 'high', 'urgent')),
  team          text        not null,
  -- Increments on every status or ETA change, and only then. Notify sends the version the account
  -- manager saw; a mismatch is a 409 (part2-technical.md, edge case 2).
  version       integer     not null default 1,
  eta_at        timestamptz,
  opened_at     timestamptz not null,
  resolved_at   timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, number),
  foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade
);

create index requests_customer on requests (tenant_id, customer_id);
create index requests_status on requests (tenant_id, status);

-- The event log. Append-only: the app role may only select and insert (0002), and no role may
-- update a row (trigger below). Requests are a projection kept in step in the same transaction.
create table request_events (
  id           bigint generated always as identity primary key,
  tenant_id    uuid        not null references tenants (id) on delete cascade,
  request_id   uuid        not null,
  type         text        not null check (type in (
                 'created', 'status_changed', 'note_added', 'eta_set',
                 'customer_pinged', 'update_sent', 'delivery_updated')),
  visibility   text        not null check (visibility in ('internal', 'customer')),
  actor_user_id uuid,
  -- Virtual time (the tenant's clock), so the time machine moves events too.
  occurred_at  timestamptz not null,
  data         jsonb       not null default '{}'::jsonb,
  -- The writing transaction. The live stream only reads events whose transaction is older than
  -- every transaction still running, so a slow commit with a lower id is never skipped.
  xid          xid8        not null default pg_current_xact_id(),
  recorded_at  timestamptz not null default now(),
  foreign key (tenant_id, request_id) references requests (tenant_id, id) on delete cascade,
  foreign key (tenant_id, actor_user_id) references users (tenant_id, id)
);

create index request_events_stream on request_events (tenant_id, id);
create index request_events_request on request_events (tenant_id, request_id, occurred_at);

create function forbid_event_update() returns trigger language plpgsql as $$
begin
  raise exception 'request_events is append-only: % is not allowed', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger request_events_append_only
  before update on request_events
  for each row execute function forbid_event_update();

create table notifications (
  tenant_id           uuid        not null references tenants (id) on delete cascade,
  id                  uuid        not null default gen_random_uuid() primary key,
  request_id          uuid        not null,
  customer_id         uuid        not null,
  actor_user_id       uuid        not null,
  -- out_of_band: the account manager told the customer some other way and logged it.
  channel             text        not null check (channel in ('whatsapp', 'email', 'out_of_band')),
  template            text        not null,
  language            text        not null check (language in ('ar', 'en')),
  body                text        not null,
  note                text,
  status_at_send      text        not null,
  request_version     integer     not null,
  body_hash           text        not null,
  idempotency_key     text,
  delivery_state      text        not null check (delivery_state in
                        ('queued', 'sent', 'delivered', 'read', 'failed', 'logged')),
  attempts            integer     not null default 0,
  next_attempt_at     timestamptz,
  last_error          text,
  provider_message_id text unique,
  sent_at             timestamptz not null,
  delivered_at        timestamptz,
  read_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, request_id) references requests (tenant_id, id) on delete cascade,
  foreign key (tenant_id, customer_id) references customers (tenant_id, id) on delete cascade,
  foreign key (tenant_id, actor_user_id) references users (tenant_id, id)
);

create index notifications_request on notifications (tenant_id, request_id, created_at);
create index notifications_outbox on notifications (tenant_id, next_attempt_at)
  where delivery_state = 'queued';

-- Idempotency-Key replay store. The key is scoped to tenant and purpose; the fingerprint of the
-- body means the same key with a different body is refused (422) instead of replayed.
create table idempotency_keys (
  tenant_id   uuid        not null references tenants (id) on delete cascade,
  scope       text        not null,
  key         text        not null,
  fingerprint text        not null,
  status_code integer     not null,
  response    jsonb       not null,
  created_at  timestamptz not null default now(),
  primary key (tenant_id, scope, key)
);

create table presence (
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  user_id    uuid        not null,
  request_id uuid,
  seen_at    timestamptz not null default now(),
  primary key (tenant_id, user_id),
  foreign key (tenant_id, user_id) references users (tenant_id, id) on delete cascade,
  foreign key (tenant_id, request_id) references requests (tenant_id, id) on delete cascade
);

create table customer_links (
  tenant_id  uuid        not null references tenants (id) on delete cascade,
  id         uuid        not null default gen_random_uuid() primary key,
  request_id uuid        not null,
  -- Only the SHA-256 of the token is stored; the token itself exists in the link alone.
  token_hash text        not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, request_id) references requests (tenant_id, id) on delete cascade
);

-- Rate limits are global (one visitor creating sandboxes is not tenant data). The app role has no
-- access to the table; it can only call rate_limit_hit() (0002).
create table rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null,
  primary key (key, window_start)
);
