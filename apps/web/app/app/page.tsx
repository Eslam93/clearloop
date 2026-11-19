import { withTenant } from "@clearloop/db";
import type { Metadata } from "next";
import { Console } from "@/components/console/console";
import { NoSandbox } from "@/components/no-sandbox";
import { resolveActor } from "@/lib/server/actor";
import { loadConsole } from "@/lib/server/console";
import { readSession } from "@/lib/server/session";
import { currentTenant } from "@/lib/server/tenant";
import { VIEW_IDS, type ViewId } from "@/lib/view/types";

export const metadata: Metadata = { title: "Console", robots: { index: false } };

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; view?: string; r?: string }>;
}) {
  const { as, view, r } = await searchParams;
  const session = await readSession();
  if (!session) return <NoSandbox />;

  // Everything below runs with the session's tenant set: row-level security scopes every query.
  const data = await withTenant({ tenantId: session.tenantId }, async (tx) => {
    if (!(await currentTenant(tx))) return null;
    const actor = await resolveActor(tx, as);
    return loadConsole(tx, actor);
  });
  if (!data) return <NoSandbox expired />;

  const initialView: ViewId = VIEW_IDS.includes(view as ViewId) ? (view as ViewId) : "owed";
  const number = Number(r);
  return (
    <Console
      data={data}
      persona={data.actor.handle}
      initialView={initialView}
      initialRequest={Number.isInteger(number) && number > 0 ? number : null}
    />
  );
}
