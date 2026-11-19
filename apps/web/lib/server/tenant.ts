import "server-only";

import { schema, sql, type Tx } from "@clearloop/db";
import { virtualNow } from "@/lib/domain/clock";

/** The current tenant's row (row-level security returns only that one). */
export async function currentTenant(tx: Tx) {
  const [tenant] = await tx.select().from(schema.tenants).limit(1);
  return tenant ?? null;
}

/** The current tenant's virtual now. Every write timestamps with this. */
export async function virtualNowFor(tx: Tx): Promise<number> {
  const result = await tx.execute(
    sql`select clock_offset_ms from tenants where id = app_current_tenant()`,
  );
  const offset = Number((result.rows[0] as { clock_offset_ms?: string | number } | undefined)?.clock_offset_ms ?? 0);
  return virtualNow(offset);
}
