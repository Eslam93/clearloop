import { randomUUID } from "node:crypto";
import pg from "pg";
import { inject } from "vitest";

export async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

export const ownerClient = () => connect(inject("ownerUrl"));
export const appClient = () => connect(inject("appUrl"));

export interface TenantFixture {
  tenantId: string;
  userId: string;
  customerId: string;
  requestId: string;
  title: string;
}

/** A minimal tenant written as the owner, so fixtures do not depend on the code under test. */
export async function makeTenant(
  owner: pg.Client,
  label: string,
  options: { expiresAt?: Date } = {},
): Promise<TenantFixture> {
  const tenantId = randomUUID();
  const userId = randomUUID();
  const calendarId = randomUUID();
  const customerId = randomUUID();
  const requestId = randomUUID();
  const title = `Request owned by ${label} ${tenantId.slice(0, 8)}`;

  await owner.query("insert into tenants (id, name, expires_at) values ($1, $2, $3)", [
    tenantId,
    `Tenant ${label}`,
    options.expiresAt ?? null,
  ]);
  await owner.query(
    "insert into users (tenant_id, id, handle, name, role) values ($1, $2, 'am', $3, 'am')",
    [tenantId, userId, `AM of ${label}`],
  );
  await owner.query(
    "insert into business_calendars (tenant_id, id, name, definition) values ($1, $2, 'Default', '{}')",
    [tenantId, calendarId],
  );
  await owner.query(
    `insert into customers (tenant_id, id, name, tier, owner_user_id, calendar_id,
                            preferred_language, preferred_channel, contact_name)
     values ($1, $2, $3, 'pro', $4, $5, 'en', 'whatsapp', 'Contact')`,
    [tenantId, customerId, `Customer of ${label}`, userId, calendarId],
  );
  await owner.query(
    `insert into requests (tenant_id, id, number, customer_id, title, status, priority, team, opened_at)
     values ($1, $2, 1, $3, $4, 'in_progress', 'high', 'Platform', now())`,
    [tenantId, requestId, customerId, title],
  );
  await owner.query(
    `insert into request_events (tenant_id, request_id, type, visibility, occurred_at)
     values ($1, $2, 'created', 'customer', now())`,
    [tenantId, requestId],
  );
  return { tenantId, userId, customerId, requestId, title };
}

/** Runs `fn` in a transaction on `client` with the tenant set, the way withTenant does. */
export async function asTenant<T>(
  client: pg.Client,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export const TENANT_TABLES = [
  "tenants",
  "users",
  "business_calendars",
  "sla_policies",
  "customers",
  "requests",
  "request_events",
  "notifications",
  "idempotency_keys",
  "presence",
  "customer_links",
] as const;
