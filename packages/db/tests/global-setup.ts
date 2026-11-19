// One fresh, migrated database per test run.
//
// - CI sets TEST_DATABASE_OWNER_URL to a Postgres service container (its superuser).
// - Locally, an embedded Postgres starts on a spare port with a throwaway data directory.
//
// Tests then get two connection strings: the owner's, for setting up fixtures and for the
// guard-removal checks, and the app role's, which is what every claim is tested through.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import type { TestProject } from "vitest/node";
import { createDatabaseSql, startLocalPostgres } from "../src/local";
import { migrate } from "../src/migrate";

const APP_PASSWORD = "clearloop_app_test";

declare module "vitest" {
  export interface ProvidedContext {
    ownerUrl: string;
    appUrl: string;
  }
}

function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

export default async function setup(project: TestProject) {
  const database = `clearloop_test_${process.pid}`;
  let adminUrl: string;
  let stop: () => Promise<void> = async () => {};

  if (process.env.TEST_DATABASE_OWNER_URL) {
    adminUrl = process.env.TEST_DATABASE_OWNER_URL;
  } else {
    const dataDir = mkdtempSync(join(tmpdir(), "clearloop-pg-"));
    const port = 54400 + (process.pid % 500);
    const server = await startLocalPostgres({ dataDir, port, persistent: false });
    adminUrl = server.ownerUrl("postgres");
    stop = async () => {
      await server.stop();
      rmSync(dataDir, { recursive: true, force: true });
    };
  }

  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${admin.escapeIdentifier(database)} with (force)`);
  await admin.query(createDatabaseSql(admin, database));
  await admin.end();

  const ownerUrl = withDatabase(adminUrl, database);
  await migrate(ownerUrl, { appPassword: APP_PASSWORD });

  const app = new URL(ownerUrl);
  app.username = "clearloop_app";
  app.password = APP_PASSWORD;

  project.provide("ownerUrl", ownerUrl);
  project.provide("appUrl", app.toString());

  return async () => {
    const cleanup = new pg.Client({ connectionString: adminUrl });
    await cleanup.connect();
    await cleanup.query(`drop database if exists ${cleanup.escapeIdentifier(database)} with (force)`);
    await cleanup.end();
    await stop();
  };
}
