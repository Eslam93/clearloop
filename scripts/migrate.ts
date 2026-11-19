// `pnpm db:migrate`: applies migrations to the database in DATABASE_URL_OWNER (the owner role),
// and gives the clearloop_app role LOGIN with APP_DB_PASSWORD when that is set.
// Used for Neon (or any Postgres) before deploying; local development migrates on `pnpm dev`.

import { migrate } from "@clearloop/db/migrate";

const owner = process.env.DATABASE_URL_OWNER;
if (!owner) {
  console.error("Set DATABASE_URL_OWNER to the owner role's connection string.");
  process.exit(1);
}
const ran = await migrate(owner, { appPassword: process.env.APP_DB_PASSWORD, log: (line) => console.log(line) });
console.log(ran.length ? `applied ${ran.length} migration(s)` : "already up to date");
