import "server-only";

import { withTenant, type Tx, type User } from "@clearloop/db";
import { virtualNow } from "@/lib/domain/clock";
import { PERSONA_HEADER, resolveActor } from "./actor";
import { ApiError } from "./http";
import { readSession } from "./session";
import { currentTenant } from "./tenant";

export interface TenantRouteContext {
  tx: Tx;
  tenantId: string;
  actor: User;
  now: number;
  tenant: NonNullable<Awaited<ReturnType<typeof currentTenant>>>;
}

/**
 * Runs `fn` in a transaction for the session's tenant, as the persona the request names.
 * The tenant comes only from the signed session cookie.
 */
export async function inSessionTenant<T>(
  request: Request,
  fn: (ctx: TenantRouteContext) => Promise<T>,
): Promise<T> {
  const session = await readSession();
  if (!session) throw new ApiError("no_session", "Your sandbox has expired. Start a fresh one.");
  return withTenant({ tenantId: session.tenantId }, async (tx) => {
    const tenant = await currentTenant(tx);
    if (!tenant) throw new ApiError("no_session", "Your sandbox has expired. Start a fresh one.");
    const actor = await resolveActor(tx, request.headers.get(PERSONA_HEADER));
    return fn({ tx, tenantId: session.tenantId, actor, now: virtualNow(tenant.clockOffsetMs), tenant });
  });
}
