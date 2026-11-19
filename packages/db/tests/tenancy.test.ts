// The tenancy claims, tested through the app role (never the owner, which skips row-level security).

import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  purgeExpiredTenants,
  rateLimitHit,
  tenantForLink,
  tenantForProviderMessage,
  withTenant,
} from "../src/client";
import { requests } from "../src/schema";
import {
  appClient,
  asTenant,
  makeTenant,
  ownerClient,
  TENANT_TABLES,
  type TenantFixture,
} from "./fixtures";

let owner: pg.Client;
let app: pg.Client;
let a: TenantFixture;
let b: TenantFixture;

beforeAll(async () => {
  owner = await ownerClient();
  app = await appClient();
  a = await makeTenant(owner, "A");
  b = await makeTenant(owner, "B");
});

afterAll(async () => {
  await app.end();
  await owner.end();
  await closeDatabase();
});

describe("the app role", () => {
  it("is not a superuser and cannot bypass row-level security", async () => {
    const { rows } = await owner.query(
      "select rolsuper, rolbypassrls from pg_roles where rolname = 'clearloop_app'",
    );
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("can touch no table that lacks forced row-level security and a policy", async () => {
    const { rows } = await app.query("select * from rls_gaps()");
    expect(rows).toEqual([]);
  });
});

describe("isolation", () => {
  it("sees no rows in any table when no tenant is set", async () => {
    for (const table of TENANT_TABLES) {
      const { rows } = await app.query(`select count(*)::int as n from ${table}`);
      expect({ table, n: rows[0].n }).toEqual({ table, n: 0 });
    }
  });

  it("sees only the current tenant's rows, even with no filter in the query", async () => {
    const seenByA = await withTenant({ tenantId: a.tenantId }, (tx) => tx.select().from(requests));
    expect(seenByA.map((r) => r.title)).toEqual([a.title]);

    const seenByB = await withTenant({ tenantId: b.tenantId }, (tx) => tx.select().from(requests));
    expect(seenByB.map((r) => r.title)).toEqual([b.title]);
  });

  it("finds nothing when asking for another tenant's request by id", async () => {
    const { rowCount } = await asTenant(app, a.tenantId, () =>
      app.query("select * from requests where id = $1", [b.requestId]),
    );
    expect(rowCount).toBe(0);
  });

  it("cannot write rows into another tenant", async () => {
    await expect(
      asTenant(app, a.tenantId, () =>
        app.query(
          `insert into requests (tenant_id, number, customer_id, title, status, priority, team, opened_at)
           values ($1, 99, $2, 'planted', 'new', 'low', 'Platform', now())`,
          [b.tenantId, b.customerId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot change another tenant's rows", async () => {
    const { rowCount } = await asTenant(app, a.tenantId, () =>
      app.query("update requests set title = 'changed' where id = $1", [b.requestId]),
    );
    expect(rowCount).toBe(0);
  });

  it("cannot point a row at another tenant's row, even as the owner", async () => {
    // Composite foreign keys on (tenant_id, id) refuse this before row-level security is involved.
    await expect(
      owner.query(
        `insert into requests (tenant_id, number, customer_id, title, status, priority, team, opened_at)
         values ($1, 98, $2, 'cross-linked', 'new', 'low', 'Platform', now())`,
        [a.tenantId, b.customerId],
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("the event log", () => {
  it("refuses updates and deletes from the app role", async () => {
    for (const statement of [
      "update request_events set visibility = 'internal'",
      "delete from request_events",
    ]) {
      await expect(asTenant(app, a.tenantId, () => app.query(statement))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("refuses updates even from the owner", async () => {
    await expect(owner.query("update request_events set visibility = 'internal'")).rejects.toThrow(
      /append-only/,
    );
  });
});

describe("privileged functions", () => {
  it("keeps the app away from global tables except through the functions", async () => {
    for (const table of ["rate_limits", "schema_migrations"]) {
      await expect(app.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);
    }
  });

  it("rate limits by key and window", async () => {
    const key = `test:${randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimitHit(key, 60, 3));
    expect(results).toEqual([true, true, true, false]);
  });

  it("resolves a provider message id to its tenant and nothing else", async () => {
    const providerId = `wamid.${randomUUID()}`;
    await owner.query(
      `insert into notifications (tenant_id, request_id, customer_id, actor_user_id, channel, template,
         language, body, status_at_send, request_version, body_hash, delivery_state, sent_at,
         provider_message_id)
       values ($1, $2, $3, $4, 'whatsapp', 'status_update', 'en', 'body', 'in_progress', 1, 'h',
         'sent', now(), $5)`,
      [b.tenantId, b.requestId, b.customerId, b.userId, providerId],
    );
    expect(await tenantForProviderMessage(providerId)).toBe(b.tenantId);
    expect(await tenantForProviderMessage("wamid.unknown")).toBeNull();
  });

  it("resolves a customer link only while it is live", async () => {
    const hash = (token: string) => createHash("sha256").update(token).digest("hex");
    const insert = (token: string, expiresAt: string, revoked: boolean) =>
      owner.query(
        `insert into customer_links (tenant_id, request_id, token_hash, expires_at, revoked_at)
         values ($1, $2, $3, $4, $5)`,
        [a.tenantId, a.requestId, hash(token), expiresAt, revoked ? new Date() : null],
      );
    await insert("live", "2999-01-01", false);
    await insert("expired", "2000-01-01", false);
    await insert("revoked", "2999-01-01", true);

    expect(await tenantForLink(hash("live"))).toBe(a.tenantId);
    expect(await tenantForLink(hash("expired"))).toBeNull();
    expect(await tenantForLink(hash("revoked"))).toBeNull();
  });

  it("purges expired sandboxes and everything they own", async () => {
    const old = await makeTenant(owner, "Expired", { expiresAt: new Date(Date.now() - 1000) });
    expect(await purgeExpiredTenants()).toBeGreaterThanOrEqual(1);
    for (const table of ["tenants", "requests", "request_events", "customers"]) {
      const column = table === "tenants" ? "id" : "tenant_id";
      const { rows } = await owner.query(
        `select count(*)::int as n from ${table} where ${column} = $1`,
        [old.tenantId],
      );
      expect({ table, n: rows[0].n }).toEqual({ table, n: 0 });
    }
    // The live tenants are untouched.
    const { rows } = await owner.query("select count(*)::int as n from tenants where id = any($1)", [
      [a.tenantId, b.tenantId],
    ]);
    expect(rows[0].n).toBe(2);
  });
});
