// The only doors into the database for application code.
//
// - withTenant(ctx, fn): a transaction with the tenant set. Row-level security scopes every query
//   in it to that tenant. There is deliberately no exported raw handle, so code that forgets the
//   tenant has nothing to call and does not compile.
// - A few named privileged calls (rate limits, webhook and link lookups, the sweeper), each backed
//   by one narrow security-definer function in migrations/0002_security.sql.

import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { appDatabaseUrl } from "./env";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface TenantContext {
  tenantId: string;
  /** The acting user, recorded for auditing. Optional for system work such as the sweeper. */
  userId?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let pool: pg.Pool | undefined;
let database: Database | undefined;

function getDatabase(): Database {
  if (!database) {
    pool = new pg.Pool({
      connectionString: appDatabaseUrl(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
    });
    database = drizzle(pool, { schema });
  }
  return database;
}

/** The pool, for platform hooks such as Vercel's attachDatabasePool. Not for queries. */
export function databasePool(): pg.Pool {
  getDatabase();
  return pool!;
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}

export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(ctx.tenantId)) throw new Error("withTenant needs a tenant id");
  if (ctx.userId && !UUID.test(ctx.userId)) throw new Error("withTenant got a malformed user id");
  return getDatabase().transaction(async (tx) => {
    // `true`: the settings last for this transaction only, which is safe with connection pooling.
    await tx.execute(
      sql`select set_config('app.tenant_id', ${ctx.tenantId}, true),
                 set_config('app.user_id', ${ctx.userId ?? ""}, true)`,
    );
    return fn(tx);
  });
}

async function scalar<T>(query: ReturnType<typeof sql>): Promise<T> {
  const result = await getDatabase().execute(query);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return (row ? Object.values(row)[0] : null) as T;
}

/** True while `key` is within `max` hits in the current `windowSeconds` window. Counts this hit. */
export function rateLimitHit(key: string, windowSeconds: number, max: number): Promise<boolean> {
  return scalar<boolean>(sql`select rate_limit_hit(${key}, ${windowSeconds}, ${max})`);
}

export function tenantForProviderMessage(providerMessageId: string): Promise<string | null> {
  return scalar<string | null>(sql`select tenant_for_provider_message(${providerMessageId})`);
}

export function tenantForLink(tokenHash: string): Promise<string | null> {
  return scalar<string | null>(sql`select tenant_for_link(${tokenHash})`);
}

export async function tenantsWithDueOutbox(limit: number): Promise<string[]> {
  const result = await getDatabase().execute(sql`select tenants_with_due_outbox(${limit}) as id`);
  return result.rows.map((row) => String((row as { id: string }).id));
}

export function purgeExpiredTenants(): Promise<number> {
  return scalar<number>(sql`select purge_expired_tenants()`);
}
