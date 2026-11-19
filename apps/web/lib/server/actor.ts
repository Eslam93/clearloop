import "server-only";

// Who is acting. The tenant comes from the signed session; the persona inside it (an account
// manager, a second one for the two-window demo, or an engineer driving status changes) comes from
// the `as` query parameter on pages and the x-clearloop-as header on API calls. Either way it must
// name a user of the session's tenant, which row-level security guarantees.

import { eq, schema, type Tx, type User } from "@clearloop/db";
import { ApiError } from "./http";

export const DEFAULT_PERSONA = "sarah";
export const PERSONA_HEADER = "x-clearloop-as";

export async function resolveActor(tx: Tx, handle: string | null | undefined): Promise<User> {
  const wanted = handle && /^[a-z]{2,20}$/.test(handle) ? handle : DEFAULT_PERSONA;
  const [user] = await tx.select().from(schema.users).where(eq(schema.users.handle, wanted)).limit(1);
  if (user) return user;
  const [fallback] = await tx
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, DEFAULT_PERSONA))
    .limit(1);
  if (!fallback) throw new ApiError("no_session", "This sandbox has no users.");
  return fallback;
}
