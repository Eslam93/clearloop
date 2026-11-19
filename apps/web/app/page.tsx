import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { CURRENT_USER, getVisibleRequests } from "@/lib/data";

// Server component. The dataset is read and tenant-scoped here, so only the
// current tenant's rows are serialized for the browser.
export default async function DashboardPage() {
  // Render per request, never at build time: a prerendered page freezes "now"
  // at the build date while the browser recomputes it with today's date.
  await connection();
  const now = new Date();

  return (
    <Dashboard
      initialRequests={getVisibleRequests(now)}
      currentUser={CURRENT_USER}
      nowIso={now.toISOString()}
    />
  );
}
