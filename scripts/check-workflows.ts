// Checks that every GitHub Actions workflow is safe to run on a stranger's pull
// request. Ported from the ci_workflow checker in the author's ToolKit (Python)
// so this repository keeps a single runtime.
//
//   pnpm check:workflows            # every file in .github/workflows
//   pnpm check:workflows a.yml b.yml
//
// Refuses:
// - the pull_request_target and workflow_run triggers, which run with the
//   repository's secrets and write token on code a pull request controls;
// - a workflow without top-level `permissions`, and any write permission;
// - any read of the `secrets` context, and `secrets: inherit`;
// - `uses:` not pinned to a version tag or a full commit SHA (local `./` exempt);
// - github.event, github.head_ref or inputs read in a `${{ }}` inside a `run:`
//   script, and `${{ env.* }}` there too: pass values through env and read
//   them in the shell instead;
// - a job without timeout-minutes (jobs that call a reusable workflow exempt).
//
// Exit 0 when clean, 1 with one line per finding.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const FORBIDDEN_TRIGGERS = ["pull_request_target", "workflow_run"];

const PINNED = /@(v\d+(\.\d+){0,2}|[0-9a-f]{40})$/;
// An expression runs from `${{` to the first `}}` outside a quoted string.
const EXPRESSION = /\$\{\{((?:'[^']*'|[^'])*?)\}\}/g;
// github['event'] reads the same property as github.event; quoted text is never a reference.
const INDEX = /\[\s*'([^']*)'\s*\]/g;
const QUOTED = /'[^']*'/g;
const SECRETS = /(?<![\w.-])secrets(?![\w-])/i;
const INJECTION = /(?<![\w.-])(?:github\s*\.\s*(?:event|head_ref)|inputs)(?![\w-])/i;
const ENV = /(?<![\w.-])env(?![\w-])/i;

type Node = unknown;
type Mapping = Record<string, Node>;

const isMapping = (value: Node): value is Mapping =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function* expressions(text: string): Generator<string> {
  for (const match of text.matchAll(EXPRESSION)) {
    yield match[1].replace(INDEX, ".$1").replace(QUOTED, " ");
  }
}

function* strings(node: Node): Generator<string> {
  if (typeof node === "string") yield node;
  else if (Array.isArray(node)) for (const item of node) yield* strings(item);
  else if (isMapping(node)) {
    for (const [key, value] of Object.entries(node)) {
      yield key;
      yield* strings(value);
    }
  }
}

function triggers(document: Mapping): string[] {
  // YAML 1.1 parsers read a bare `on` as true; the `yaml` package (1.2) keeps "on".
  const on = document.on ?? document.true;
  if (typeof on === "string") return [on];
  if (Array.isArray(on)) return on.map(String);
  if (isMapping(on)) return Object.keys(on);
  return [];
}

function* permissionProblems(where: string, permissions: Node): Generator<string> {
  if (typeof permissions === "string") {
    if (permissions !== "read-all" && permissions !== "none") {
      yield `${where}: permissions ${permissions} grants write`;
    }
    return;
  }
  if (!isMapping(permissions)) return;
  for (const [scope, level] of Object.entries(permissions)) {
    if (level !== "read" && level !== "none") {
      yield `${where}: permission ${scope}: ${String(level)} grants write`;
    }
  }
}

function usesProblem(uses: string): string | null {
  if (uses.startsWith("./")) return null;
  if (uses.startsWith("docker://")) {
    const image = uses.slice("docker://".length).split("/").at(-1) ?? "";
    const ok = uses.includes("@sha256:") || (image.includes(":") && !image.endsWith(":latest"));
    return ok ? null : `uses ${uses} has no pinned tag`;
  }
  return PINNED.test(uses) ? null : `uses ${uses} is not pinned to a version or a SHA`;
}

function* jobProblems(name: string, job: Mapping): Generator<string> {
  const where = `job ${name}`;
  if ("permissions" in job) yield* permissionProblems(where, job.permissions);
  if (!("timeout-minutes" in job) && !("uses" in job)) yield `${where}: no timeout-minutes`;
  if (typeof job.uses === "string") {
    const found = usesProblem(job.uses);
    if (found) yield `${where}: ${found}`;
  }
  const steps = Array.isArray(job.steps) ? job.steps : [];
  for (const [index, step] of steps.entries()) {
    if (!isMapping(step)) continue;
    const label = `${where}, step ${typeof step.name === "string" ? step.name : index + 1}`;
    if (typeof step.uses === "string") {
      const found = usesProblem(step.uses);
      if (found) yield `${label}: ${found}`;
    }
    if (typeof step.run !== "string") continue;
    const read = [...expressions(step.run)];
    if (read.some((names) => INJECTION.test(names))) {
      yield `${label}: puts event data straight into the script; pass it through env`;
    }
    if (read.some((names) => ENV.test(names))) {
      yield `${label}: expands env into the script; read the variable in the shell instead`;
    }
  }
}

/** One line per problem in a workflow's text; empty when it is clean. */
export function problems(text: string): string[] {
  let document: Node;
  try {
    document = parse(text);
  } catch (error) {
    return [`not valid YAML: ${(error as Error).message}`];
  }
  if (!isMapping(document) || !isMapping(document.jobs)) return ["no jobs"];

  const found = triggers(document)
    .filter((t) => FORBIDDEN_TRIGGERS.includes(t))
    .map((t) => `trigger ${t} runs with secrets on code a pull request controls`);

  if (!("permissions" in document)) {
    found.push("no top-level permissions: the token gets the repository's default");
  } else {
    found.push(...permissionProblems("workflow", document.permissions));
  }

  const jobs = Object.entries(document.jobs).map(
    ([name, job]) => [name, isMapping(job) ? job : {}] as const,
  );
  const readsSecrets = [...strings(document)].some((value) =>
    [...expressions(value)].some((names) => SECRETS.test(names)),
  );
  if (readsSecrets || jobs.some(([, job]) => String(job.secrets) === "inherit")) {
    found.push("uses secrets: a stranger's pull request must be able to run every job");
  }
  for (const [name, job] of jobs) found.push(...jobProblems(name, job));
  return found;
}

function main(args: string[]): number {
  const dir = ".github/workflows";
  const paths = args.length
    ? args
    : readdirSync(dir)
        .filter((f) => /\.ya?ml$/.test(f))
        .sort()
        .map((f) => join(dir, f));
  if (paths.length === 0) {
    process.stderr.write("no workflow files found\n");
    return 1;
  }
  let failed = false;
  for (const path of paths) {
    for (const line of problems(readFileSync(path, "utf8"))) {
      process.stderr.write(`${path}: ${line}\n`);
      failed = true;
    }
  }
  if (!failed) process.stdout.write(`workflows clean: ${paths.join(", ")}\n`);
  return failed ? 1 : 0;
}

if (process.argv[1]?.endsWith("check-workflows.ts")) {
  process.exit(main(process.argv.slice(2)));
}
