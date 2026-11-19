// Guard-removal checks: each guard is removed on purpose, and the test that claims it must then
// fail. A test that still passes with its guard removed proves nothing.
//
//   pnpm guards            # every guard
//   pnpm guards rls        # guards whose name contains "rls"
//
// Database guards are broken by SQL applied after migration (GUARD_BREAK, see
// packages/db/tests/global-setup.ts). Code guards are broken by an exact text replacement in the
// source, restored afterwards. If the text is no longer there, the guard is stale and this script
// fails, so a refactor cannot silently retire a check.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface Guard {
  name: string;
  claim: string;
  /** Breaks the guard and returns a function that restores it. */
  break: () => () => void;
  command: string[];
  env?: Record<string, string>;
}

const DB_TESTS = ["pnpm", "--filter", "@clearloop/db", "test"];
const WEB_INTEGRATION = ["pnpm", "--filter", "@clearloop/web", "test:integration"];
const WEB_UNIT = ["pnpm", "--filter", "@clearloop/web", "test"];

function replaceIn(file: string, from: string, to: string): () => () => void {
  return () => {
    const original = readFileSync(file, "utf8");
    if (!original.includes(from)) throw new Error(`stale guard: ${file} no longer contains:\n${from}`);
    writeFileSync(file, original.replace(from, to));
    return () => writeFileSync(file, original);
  };
}

const noop = () => () => {};

const GUARDS: Guard[] = [
  {
    name: "rls-on-requests",
    claim: "A tenant sees only its own rows",
    break: noop,
    env: { GUARD_BREAK: "disable_rls" },
    command: DB_TESTS,
  },
  {
    name: "rls-gaps",
    claim: "Every table the app can touch has a row-level security policy",
    break: noop,
    env: { GUARD_BREAK: "uncovered_table" },
    command: DB_TESTS,
  },
  {
    name: "event-log-trigger",
    claim: "The event log cannot be rewritten, even by the owner",
    break: noop,
    env: { GUARD_BREAK: "drop_append_only_trigger" },
    command: DB_TESTS,
  },
  {
    name: "event-log-grants",
    claim: "The app role cannot update or delete events",
    break: noop,
    env: { GUARD_BREAK: "grant_event_update" },
    command: DB_TESTS,
  },
  {
    name: "version-check",
    claim: "A stale notify returns 409 with a fresh snapshot",
    break: replaceIn(
      "apps/web/lib/server/requests.ts",
      "if (body.request_version !== request.version) throw await staleError(tx, request, body.request_version);",
      "",
    ),
    command: WEB_INTEGRATION,
  },
  {
    name: "duplicate-guard",
    claim: "Two account managers notifying at once send one message",
    break: replaceIn("apps/web/lib/server/requests.ts", "if (!body.allow_repeat) {", "if (false) {"),
    command: WEB_INTEGRATION,
  },
  {
    name: "internal-note-block",
    claim: "Internal notes never reach a customer",
    break: replaceIn(
      "apps/web/lib/domain/presend.ts",
      'findings.push({ id: "internal_note", severity: "block", match: run });',
      'findings.push({ id: "internal_note", severity: "warn", match: run });',
    ),
    command: WEB_UNIT,
  },
  {
    name: "redaction",
    claim: "The customer status page never shows an internal note",
    break: replaceIn("apps/web/lib/domain/redact.ts", 'if (e.visibility !== "customer") continue;', ""),
    command: WEB_UNIT,
  },
  {
    name: "webhook-signature",
    claim: "Webhooks reject bad signatures",
    break: replaceIn(
      "apps/web/lib/server/webhooks.ts",
      'if (!verifyWebhook(rawBody, signature)) throw new ApiError("bad_signature", "The signature does not match.");',
      "",
    ),
    command: WEB_INTEGRATION,
  },
  {
    name: "bundle-canary",
    claim: "Other tenants' data never reaches the browser",
    break: () => {
      const file = join("apps/web/.next/static/chunks", "guard-canary.js");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, 'console.log("Driver app crash on cold start");');
      return () => rmSync(file, { force: true });
    },
    command: ["pnpm", "check:bundle"],
  },
];

const filter = process.argv[2];
const selected = GUARDS.filter((g) => !filter || g.name.includes(filter));
let failures = 0;

function run(command: string[], env: Record<string, string> = {}): number | null {
  const [cmd, ...args] = command;
  return spawnSync(cmd!, args, {
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  }).status;
}

// A guard only counts if its tests pass with the guard in place. Otherwise a suite failing for an
// unrelated reason (no database, a broken build) would look like a proven guard.
for (const command of new Set(selected.map((g) => JSON.stringify(g.command)))) {
  const parsed = JSON.parse(command) as string[];
  if (run(parsed) !== 0) {
    process.stdout.write(`baseline failed with every guard in place: ${parsed.join(" ")}
`);
    process.exit(1);
  }
  process.stdout.write(`baseline green: ${parsed.join(" ")}
`);
}

for (const guard of selected) {
  process.stdout.write(`\n▸ ${guard.name}: removing the guard for "${guard.claim}"\n`);
  let restore: () => void = () => {};
  try {
    restore = guard.break();
    if (run(guard.command, guard.env) === 0) {
      failures++;
      process.stdout.write(`  ✗ the tests still passed with the guard removed\n`);
    } else {
      process.stdout.write(`  ✓ the tests failed, as they should\n`);
    }
  } catch (error) {
    failures++;
    process.stdout.write(`  ✗ ${(error as Error).message}\n`);
  } finally {
    restore();
  }
}

process.stdout.write(`\n${selected.length - failures}/${selected.length} guards proven\n`);
process.exit(failures ? 1 : 0);
