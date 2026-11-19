// Run with: pnpm test:scripts
import assert from "node:assert/strict";
import { test } from "node:test";
import { problems } from "./check-workflows.ts";

const clean = `
name: CI
on: { pull_request: {} }
permissions: { contents: read }
jobs:
  a:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - run: echo "$TITLE"
        env:
          TITLE: \${{ github.event.pull_request.title }}
`;

test("a safe workflow has no problems", () => {
  assert.deepEqual(problems(clean), []);
});

test("refuses pull_request_target", () => {
  const text = clean.replace("pull_request: {}", "pull_request_target: {}");
  assert.match(problems(text).join("\n"), /trigger pull_request_target/);
});

test("refuses a missing permissions block and any write permission", () => {
  assert.match(problems(clean.replace("permissions: { contents: read }", "")).join(), /no top-level permissions/);
  assert.match(problems(clean.replace("contents: read", "contents: write")).join(), /grants write/);
});

test("refuses unpinned actions", () => {
  assert.match(problems(clean.replace("checkout@v4", "checkout@main")).join(), /not pinned/);
});

test("refuses event data and env expanded inside a script", () => {
  const injected = clean.replace('echo "$TITLE"', 'echo "${{ github.event.pull_request.title }}"');
  assert.match(problems(injected).join(), /event data straight into the script/);
  const indexed = clean.replace('echo "$TITLE"', "echo \"${{ github['head_ref'] }}\"");
  assert.match(problems(indexed).join(), /event data straight into the script/);
  const env = clean.replace('echo "$TITLE"', 'echo "${{ env.TITLE }}"');
  assert.match(problems(env).join(), /expands env into the script/);
});

test("refuses secrets in any spelling", () => {
  const text = clean.replace("${{ github.event.pull_request.title }}", "${{ SECRETS['TOKEN'] }}");
  assert.match(problems(text).join(), /uses secrets/);
});

test("refuses a job without a timeout", () => {
  assert.match(problems(clean.replace("timeout-minutes: 5", "")).join(), /no timeout-minutes/);
});
