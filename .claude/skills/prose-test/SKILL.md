---
name: prose-test
description: Run prose-logic test cases — one orchestrator agent per case walks the real prose against a materialised world and asserts the result, reporting back a verdict. Scope by diff (default), case ids, or --all.
---

# Prose Test

Run prose-test cases (design: `design/prose-tests.md`; runner:
`tests/prose/run.cjs`). Each case is dispatched to a **prose-orchestrator**
agent that owns the whole run — world, walk, delta, assertion, cleanup —
and returns only a verdict. Transcripts never enter this session.

Walks cost tokens: this skill runs on command only, never as part of a
routine gate.

## Step 1: Select

Parse the arguments:

- Case ids (comma or space separated) → `node tests/prose/run.cjs select --cases <a,b>`
- `--all` → `node tests/prose/run.cjs select --all`
- `--diff <ref>` → `node tests/prose/run.cjs select --diff <ref>`
- No arguments → `node tests/prose/run.cjs select --diff main`

If the selection is empty: report that no cases intersect and stop.
Otherwise show the selected case ids and proceed.

## Step 2: Dispatch one orchestrator per case

Cases are independent — dispatch up to 4 concurrently, each a
**prose-orchestrator** agent whose prompt is the case id and the
instruction to run it end to end.

Never run the walker or asserter yourself, and never read a case's
`assert.md` — the orchestrator owns that boundary, and anything you learn
about an expected result can leak into a later dispatch.

## Step 3: Collate

Report a verdict table from what the orchestrators returned: case id,
verdict, path steps passed, world, markers. Quote the evidence line for
every failure.

A `DISAGREEMENT` verdict means Sonnet and Opus reached different
conclusions on the same case — surface both, resolve neither.

`UNSCRIPTED QUESTION`, `AMBIGUOUS` and `DEVIATION` markers are findings
in their own right; carry them into the report even when every case
passed.

## Rules

- Findings are findings. Never edit prose, cases, or snapshots to make a run pass — report and stop.
- A failing case is a finding either way: broken prose, or a stale case. Say which is suspected; the user decides.
- Never regenerate a snapshot as part of a run.
