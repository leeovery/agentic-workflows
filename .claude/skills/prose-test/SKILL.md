---
name: prose-test
description: Run prose-logic test cases — walker agents execute workflow prose against materialised fixture worlds, graders check the transcripts, deterministic state assertions run in code. Scope by diff (default), case ids, or --all.
---

# Prose Test

Run prose-test cases (design: `design/prose-tests.md`; runner:
`tests/prose/run.cjs`). Walks cost tokens — this skill runs on command
only, never as part of a routine gate.

## Step 1: Select

Parse the arguments:

- Case ids (comma or space separated) → `node tests/prose/run.cjs select --cases <a,b>`
- `--all` → `node tests/prose/run.cjs select --all`
- `--diff <ref>` → `node tests/prose/run.cjs select --diff <ref>`
- No arguments → `node tests/prose/run.cjs select --diff main`

If the selection is empty: report that no cases intersect and stop.
Otherwise show the selected case ids and proceed.

## Step 2: Walk and grade each case

Cases are independent — run up to 4 concurrently. Per case:

1. **World** (skip for `world=null` cases): `node tests/prose/run.cjs world <id>` — note the returned path.
2. **Walker**: `node tests/prose/run.cjs prompt <id> [--world <dir>]`, then dispatch a subagent (model: **sonnet**) with that prompt **verbatim and unmodified**. Never hand-assemble a walker prompt and never mention any expectation to the walker — the `prompt` command's output is the whole contract. Save the returned transcript to a scratch file.
3. **Deterministic grade**: `node tests/prose/run.cjs grade <id> [--world <dir>]` — state assertions pass/fail in code; the output also lists the routing claims.
4. **Grader**: dispatch a second subagent (model: **sonnet**) with: the transcript, the routing claims, and the case's scoped prose files. Instructions: verdict per claim, PASS only with a quoted line from the transcript (and prose where relevant) that satisfies it; FAIL must state what is missing or contradicting. A PASS without a quote is invalid — treat as FAIL and re-grade.

A walker that returns `UNSCRIPTED QUESTION` or `AMBIGUOUS` is a finding
in itself — carry it into the report even if claims pass.

## Step 3: Escalate failures

Any failed claim (state or routing):

1. Build a **fresh** world and re-run the walker on model: **opus**, then re-grade.
2. Both fail → confirmed finding.
3. Sonnet-fail / Opus-pass → disagreement: report both walks with the divergent lines quoted. Never auto-resolve.

## Step 4: Report and clean up

Report a verdict table: case id, state assertions passed/total, routing
claims passed/total, escalations, findings. Quote the evidence for every
failure. Findings are findings — never edit prose or cases mid-run;
report and stop.

Destroy every world (`node tests/prose/run.cjs destroy --world <dir>`)
except one you are actively citing in a failure report; name any world
kept so it can be removed later.

## Rules

- The walker never sees `expect:` claims — only the `prompt` command's output reaches it.
- A failing case is a finding either way: broken prose or a stale case. The report says which is suspected, the user decides.
- Never regenerate fixtures or edit cases to make a run pass.
