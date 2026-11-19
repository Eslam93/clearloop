// A real Postgres for local development and tests, started from npm (embedded-postgres), so the
// project needs no Docker and no account. CI uses a Postgres service container instead.

import { existsSync, mkdirSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

export interface LocalPostgres {
  port: number;
  /** A connection string for `database` as the owner (superuser) role. */
  ownerUrl(database: string): string;
  createDatabase(name: string): Promise<void>;
  dropDatabase(name: string): Promise<void>;
  stop(): Promise<void>;
}

export interface StartOptions {
  dataDir: string;
  port: number;
  /** Keep the data directory between runs (dev) or remove it on stop (tests). */
  persistent: boolean;
  user?: string;
  password?: string;
}

/** CREATE DATABASE in UTF-8 whatever the cluster's default encoding is. */
export function createDatabaseSql(client: pg.Client, name: string): string {
  return `create database ${client.escapeIdentifier(name)} with encoding 'UTF8' lc_collate 'C' lc_ctype 'C' template template0`;
}

export async function startLocalPostgres(options: StartOptions): Promise<LocalPostgres> {
  const user = options.user ?? "postgres";
  const password = options.password ?? "postgres";
  const initialised = existsSync(`${options.dataDir}/PG_VERSION`);
  mkdirSync(options.dataDir, { recursive: true });

  const server = new EmbeddedPostgres({
    databaseDir: options.dataDir,
    port: options.port,
    user,
    password,
    persistent: options.persistent,
    // UTF-8 always. On Windows initdb otherwise picks the system code page (WIN1252), which cannot
    // store Arabic.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (message) => {
      const text = String(message);
      if (/FATAL|PANIC/.test(text)) process.stderr.write(`[postgres] ${text}\n`);
    },
  });
  if (!initialised) await server.initialise();
  await server.start();

  const ownerUrl = (database: string) =>
    `postgres://${user}:${password}@localhost:${options.port}/${database}`;

  async function admin<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
    const client = new pg.Client({ connectionString: ownerUrl("postgres") });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  return {
    port: options.port,
    ownerUrl,
    createDatabase: (name) =>
      admin(async (client) => {
        const found = await client.query("select 1 from pg_database where datname = $1", [name]);
        if (found.rowCount === 0) await client.query(createDatabaseSql(client, name));
      }),
    dropDatabase: (name) =>
      admin(async (client) => {
        await client.query(`drop database if exists ${client.escapeIdentifier(name)} with (force)`);
      }),
    stop: () => server.stop(),
  };
}
