---
name: prose-test
description: Run prose-logic test cases — a walker agent executes workflow prose against a materialised fixture world, an asserting agent judges the path taken and the world delta. Scope by diff (default), case ids, or --all.
---

# Prose Test

Run prose-test cases (design: `design/prose-tests.md`; runner:
`tests/prose/run.cjs`). Cases are Given-When-Then: a world is arranged
from a committed fixture, an agent acts by walking the real prose, and a
second agent asserts the resulting path and world. Walks cost tokens —
this skill runs on command only, never as part of a routine gate.

## Step 1: Select

Parse the arguments:

- Case ids (comma or space separated) → `node tests/prose/run.cjs select --cases <a,b>`
- `--all` → `node tests/prose/run.cjs select --all`
- `--diff <ref>` → `node tests/prose/run.cjs select --diff <ref>`
- No arguments → `node tests/prose/run.cjs select --diff main`

If the selection is empty: report that no cases intersect and stop.
Otherwise show the selected case ids and proceed.

## Step 2: Arrange and act

Cases are independent — run up to 4 concurrently. Per case:

1. **World** (skip when the case has no world): `node tests/prose/run.cjs world <id>` — note the returned path.
2. **Walk**: `node tests/prose/run.cjs prompt <id> [--world <dir>]`, then dispatch a subagent (model: **sonnet**) with that prompt **verbatim and unmodified**. Never hand-assemble a walker prompt, and never mention any expectation — the `prompt` command's output is the whole contract, and it cannot contain assert.md. Save the returned transcript to a scratch file.

## Step 3: Assert

`node tests/prose/run.cjs assert <id> [--world <dir>]` produces the
asserting agent's prompt: the expected path, any further claims, and the
code-computed world delta. Dispatch a second subagent (model: **sonnet**)
with that prompt plus the walk transcript.

It returns a verdict in four parts: path (per step, each PASS quoting the
transcript line that shows it), world (every difference in the delta
enumerated and classified volatile or material), markers, and the overall
verdict. A path PASS without a quote is invalid — treat as FAIL.

`UNSCRIPTED QUESTION`, `AMBIGUOUS`, or `DEVIATION` markers in a transcript
are findings in their own right — carry them into the report even when
every claim passed.

## Step 4: Escalate failures

Any FAIL:

1. Build a **fresh** world and re-run the walk on model: **opus**, then re-assert.
2. Both fail → confirmed finding.
3. Sonnet-fail / Opus-pass → disagreement: report both walks with the divergent lines quoted. Never auto-resolve.

## Step 5: Report and clean up

Report a verdict table: case id, path passed/total, world verdict,
markers, escalations. Quote the evidence for every failure. Findings are
findings — never edit prose, cases, or snapshots mid-run; report and stop.

Destroy every world (`node tests/prose/run.cjs destroy --world <dir>`)
except one you are actively citing in a failure report; name any world
kept so it can be removed later.

## Rules

- The walker never sees `assert.md` — only the `prompt` command's output reaches it.
- A failing case is a finding either way: broken prose, or a stale case. The report says which is suspected; the user decides.
- Never regenerate snapshots or edit cases to make a run pass.
