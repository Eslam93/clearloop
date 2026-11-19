import "server-only";

import { ApiError } from "./http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An id from a URL. Anything that is not a UUID is simply not found. */
export async function requestIdFrom(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID.test(id)) throw new ApiError("not_found", "No such request.");
  return id;
}
