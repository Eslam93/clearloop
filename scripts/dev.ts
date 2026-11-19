// `pnpm dev`: a real Postgres (embedded, no Docker), migrated, then the Next.js dev server.
// The database lives in .pg/ and survives restarts. Nothing here needs an account or a key.

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { LOCAL } from "@clearloop/db/env";
import { startLocalPostgres } from "@clearloop/db/local";
import { migrate } from "@clearloop/db/migrate";

async function main() {
  const external = Boolean(process.env.DATABASE_URL);
  let stop = async () => {};
  if (!external) {
    process.stdout.write(`starting Postgres on port ${LOCAL.port} (data in .pg/)\n`);
    const pg = await startLocalPostgres({
      dataDir: resolve(".pg"),
      port: LOCAL.port,
      persistent: true,
      user: LOCAL.ownerUser,
      password: LOCAL.ownerPassword,
    });
    stop = () => pg.stop();
    await pg.createDatabase(LOCAL.database);
    const ran = await migrate(pg.ownerUrl(LOCAL.database), { appPassword: LOCAL.appPassword });
    process.stdout.write(ran.length ? `migrated: ${ran.join(", ")}\n` : "database up to date\n");
  }

  const next = spawn("pnpm", ["--filter", "@clearloop/web", process.argv[2] === "start" ? "start" : "dev"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, CLEARLOOP_LOCAL: external ? process.env.CLEARLOOP_LOCAL : "1" },
  });
  const shutdown = async () => {
    next.kill();
    await stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  next.on("exit", async (code) => {
    await stop();
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
