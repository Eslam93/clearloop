// The SQL migrations are the source of truth; the Drizzle schema is a typed mirror for queries.
// This fails when the two disagree on a table's columns.

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../src/schema";
import { ownerClient } from "./fixtures";

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, PgTable),
);

describe("schema mirror", () => {
  it("covers every table in the database", async () => {
    const owner = await ownerClient();
    const { rows } = await owner.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'schema_migrations'`,
    );
    await owner.end();
    const mirrored = tables.map((t) => getTableConfig(t).name).sort();
    expect(mirrored).toEqual(rows.map((r) => r.table_name).sort());
  });

  it.each(tables.map((t) => [getTableConfig(t).name, t] as const))(
    "%s has the same columns as the database",
    async (name, table) => {
      const owner = await ownerClient();
      const { rows } = await owner.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1`,
        [name],
      );
      await owner.end();
      const mirrored = getTableConfig(table).columns.map((c) => c.name).sort();
      expect(mirrored).toEqual(rows.map((r) => r.column_name).sort());
    },
  );
});
