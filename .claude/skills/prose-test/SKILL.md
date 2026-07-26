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
model, verdict, deterministic checks, path steps passed, world, markers.
Quote the evidence line for every failure.

Carry the checks through as reported. They were decided in code before
any agent saw the case, so they are the one part of a verdict that rests
on nothing's judgement — summarising them, or taking a green overall
verdict as proof they passed, puts an assumption back where a fact was.

The model column comes from the harness record, not from any agent's
say-so. An edited agent definition does not reach a running session until
its plugins are reloaded, so a run can silently use the previous model —
if the column disagrees with what the agent definitions declare, say so
and treat every verdict in the run as unproven.

A `FLAKY` verdict means a failure did not reproduce on a second run from
a fresh world — surface both runs, resolve neither.

`UNSCRIPTED QUESTION`, `AMBIGUOUS` and `DEVIATION` markers are findings
in their own right; carry them into the report even when every case
passed.

## Rules

- **Never fix anything during or after a run.** Not the prose, not a
  case, not a snapshot, not the harness — however small, however obvious,
  however certain you are. Every failure, every flake, and every pass
  carrying notes is surfaced to the user, and what to do about it is
  decided together. A test that repairs what it finds destroys the record
  of what it found, and the first fix reached for is regularly aimed at
  the wrong layer: correct prose has been called defective, and a case
  has been blamed for a fault in the judging.
- **A pass with notes is not a clean pass.** Markers are findings in
  their own right and always warrant a look. A walker that wandered and
  corrected itself did not fail the prose — but the same wander recurring
  on the same step is prose that reads misleadingly however correct it
  is, and that is only ever visible if every one is surfaced.
- A failing case is a finding either way: broken prose, or a stale case. Say which is suspected; the user decides.
- Never regenerate a snapshot as part of a run.
