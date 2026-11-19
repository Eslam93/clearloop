-- Row-level security, roles and the few privileged functions.
--
-- The app connects as clearloop_app: no superuser, no BYPASSRLS, not the owner of any table. Every
-- tenant table forces row-level security, so a query that forgets a tenant filter still only sees
-- the tenant set for the transaction by withTenant(). With no tenant set, it sees nothing.
--
-- Policy shape and the rls_gaps() check are ported from the postgres-data-layer pieces of the
-- author's ToolKit.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'clearloop_app') then
    create role clearloop_app nologin nosuperuser nobypassrls noinherit;
  end if;
end
$$;

-- The tenant for this transaction, or null when none is set.
create function app_current_tenant() returns uuid
  language sql stable parallel safe
as $$ select nullif(current_setting('app.tenant_id', true), '')::uuid $$;

-- Tenant isolation for the app role, plus a maintenance policy for the role that runs migrations
-- (it owns the security-definer functions below, which need to look across tenants).
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'business_calendars', 'sla_policies', 'customers', 'requests', 'request_events',
    'notifications', 'idempotency_keys', 'presence', 'customer_links'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'create policy tenant_isolation on %I for all to clearloop_app
         using (tenant_id = app_current_tenant()) with check (tenant_id = app_current_tenant())', t);
    execute format(
      'create policy maintenance on %I for all to %I using (true) with check (true)', t, current_user);
  end loop;

  alter table tenants enable row level security;
  alter table tenants force row level security;
  create policy tenant_isolation on tenants for all to clearloop_app
    using (id = app_current_tenant()) with check (id = app_current_tenant());
  execute format(
    'create policy maintenance on tenants for all to %I using (true) with check (true)', current_user);

  -- Global by design and closed to the app role: reachable only through rate_limit_hit().
  alter table rate_limits enable row level security;
  alter table rate_limits force row level security;
  execute format(
    'create policy maintenance on rate_limits for all to %I using (true) with check (true)', current_user);
end
$$;

grant usage on schema public to clearloop_app;
grant select, insert, update on
  tenants, users, business_calendars, sla_policies, customers, requests, notifications, customer_links
  to clearloop_app;
grant select, insert, update, delete on idempotency_keys, presence to clearloop_app;
-- The event log is append-only for the app: no update, no delete.
grant select, insert on request_events to clearloop_app;

-- Privileged functions. Each one answers one narrow question across tenants. Functions are
-- executable by PUBLIC by default, so every grant below is explicit.

-- Counts a hit for a key in a fixed window and says whether it is still within the limit.
create function rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n integer;
begin
  insert into rate_limits (key, window_start, hits) values (p_key, w, 1)
    on conflict (key, window_start) do update set hits = rate_limits.hits + 1
    returning hits into n;
  return n <= p_max;
end
$$;

-- A delivery webhook carries the provider's message id and nothing else: find whose it is.
create function tenant_for_provider_message(p_provider_message_id text)
  returns uuid
  language sql stable security definer set search_path = public, pg_temp
as $$ select tenant_id from notifications where provider_message_id = p_provider_message_id $$;

-- A customer status link carries a token: find the tenant only if the link is live.
create function tenant_for_link(p_token_hash text)
  returns uuid
  language sql stable security definer set search_path = public, pg_temp
as $$
  select tenant_id from customer_links
  where token_hash = p_token_hash and revoked_at is null and expires_at > now()
$$;

-- Tenants whose outbox has a delivery due, for the sweeper.
create function tenants_with_due_outbox(p_limit integer)
  returns setof uuid
  language sql stable security definer set search_path = public, pg_temp
as $$
  select distinct tenant_id from notifications
  where delivery_state = 'queued' and next_attempt_at <= now()
  limit p_limit
$$;

-- Deletes expired sandboxes (everything they own cascades) and old rate-limit windows.
create function purge_expired_tenants()
  returns integer
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  delete from tenants where expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  return n;
end
$$;

-- Every table the app role can touch must force row-level security and have a policy for it.
-- CI fails on any row this returns.
create function rls_gaps()
  returns table (table_name text, problem text)
  language sql stable security definer set search_path = public, pg_temp
as $$
  select c.relname::text,
         case
           when not c.relrowsecurity then 'row level security is off'
           when not c.relforcerowsecurity then 'row level security is not forced'
           else 'no policy for clearloop_app'
         end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and has_table_privilege('clearloop_app', c.oid, 'select, insert, update, delete')
    and (
      not c.relrowsecurity
      or not c.relforcerowsecurity
      or not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
          and 'clearloop_app'::name = any (p.roles)
      )
    )
$$;

revoke execute on function
  rate_limit_hit(text, integer, integer),
  tenant_for_provider_message(text),
  tenant_for_link(text),
  tenants_with_due_outbox(integer),
  purge_expired_tenants(),
  rls_gaps()
  from public;

grant execute on function
  rate_limit_hit(text, integer, integer),
  tenant_for_provider_message(text),
  tenant_for_link(text),
  tenants_with_due_outbox(integer),
  purge_expired_tenants(),
  rls_gaps()
  to clearloop_app;
