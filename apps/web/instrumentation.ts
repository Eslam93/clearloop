// Runs once when a server instance starts.
export async function register() {
  // On Vercel's Fluid compute, let the platform close idle Postgres connections before an instance
  // suspends, so the pool does not hold connections the database still counts.
  if (process.env.VERCEL && process.env.NEXT_RUNTIME === "nodejs") {
    const [{ attachDatabasePool }, { databasePool }] = await Promise.all([
      import("@vercel/functions"),
      import("@clearloop/db"),
    ]);
    attachDatabasePool(databasePool());
  }
}
