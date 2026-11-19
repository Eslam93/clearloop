// Fails when any demo data can be found in what the browser downloads (.next/static).
// Tenant data reaches the page only through server rendering for that tenant's session; if a
// client component ever imports the seed again (v1's bug), its strings land in the bundle and
// this check fails the build.
//
//   pnpm check:bundle [dir]

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Strings that exist only in the sandbox seed (server-only).
export const CANARIES = [
  "Driver app crash on cold start",
  "POS reconciliation fails for store",
  "Nour Logistics",
  "Falcon Retail",
  "Pearl Clinics",
  "strips the keychain",
];

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

export function findCanaries(dir: string): Array<{ file: string; canary: string }> {
  const found: Array<{ file: string; canary: string }> = [];
  for (const file of files(dir)) {
    const text = readFileSync(file, "utf8");
    for (const canary of CANARIES) if (text.includes(canary)) found.push({ file, canary });
  }
  return found;
}

if (process.argv[1]?.endsWith("check-bundle.ts")) {
  const dir = process.argv[2] ?? "apps/web/.next/static";
  const found = findCanaries(dir);
  for (const f of found) process.stderr.write(`${f.file}: contains "${f.canary}"\n`);
  if (found.length) process.exit(1);
  process.stdout.write(`no tenant data in ${dir}\n`);
}
