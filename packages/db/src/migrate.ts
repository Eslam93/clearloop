// Applies migrations/NNNN_*.sql in order, each in its own transaction, as the owner role.
// Applied files are recorded in schema_migrations, so running it again only applies new files.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

/** Creates the database in a connection string if it does not exist yet, in UTF-8. */
export async function ensureDatabase(ownerUrl: string): Promise<boolean> {
  const target = new URL(ownerUrl);
  const name = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(ownerUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const found = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (found.rowCount) return false;
    await client.query(
      `create database ${client.escapeIdentifier(name)} with encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0`,
    );
    return true;
  } finally {
    await client.end();
  }
}

export interface MigrateOptions {
  /** When set, the clearloop_app role is given LOGIN with this password. */
  appPassword?: string;
  log?: (line: string) => void;
}

export async function migrate(ownerUrl: string, options: MigrateOptions = {}): Promise<string[]> {
  const log = options.log ?? (() => {});
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query(
      `create table if not exists schema_migrations (
         version text primary key,
         applied_at timestamptz not null default now())`,
    );
    const applied = new Set(
      (await client.query<{ version: string }>("select version from schema_migrations")).rows.map(
        (r) => r.version,
      ),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f))
      .sort();

    const ran: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const text = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(text);
        await client.query("insert into schema_migrations (version) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`migration ${file} failed: ${(error as Error).message}`);
      }
      ran.push(file);
      log(`applied ${file}`);
    }

    if (options.appPassword) {
      await client.query(
        `alter role clearloop_app login password ${client.escapeLiteral(options.appPassword)}`,
      );
    }
    return ran;
  } finally {
    await client.end();
  }
}
