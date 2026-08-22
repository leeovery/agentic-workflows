# Investigation Plan

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

Form hypotheses and agree the shape of the analysis before deep tracing begins. The seed material, symptoms, and knowledge base results often carry a strong lead — recon turns them into an explicit plan the user can steer.

**If the Hypotheses section already holds an agreed plan** (a checkpoint depth and at least one hypothesis) — this is a resume:

→ Proceed to **D. Resume Position**.

## A. Recon

A bounded first pass — enough to form hypotheses, never the investigation itself:

- Re-read the seed material and gathered symptoms; note any hypothesis they already carry
- Locate the entry points implicated by the symptoms and skim the surrounding code
- Check what the contextual query surfaced — a prior investigation may already point at the mechanism

Form the initial hypotheses. Each needs a one-line basis (what points at it), not proof, and an id (`H1`, `H2`, …) — the ledger's stable reference, assigned here and never reused. If the seed material already pinpoints the cause, say so — a single near-confirmed hypothesis is a valid plan.

Deep tracing belongs to code analysis. If recon starts confirming rather than forming, stop — that work belongs after the plan is agreed.

→ Proceed to **B. Present Plan**.

---

## B. Present Plan

Choose the checkpoint depth to propose:

- **`straight-through`** — the bug looks contained, the mechanism is near-confirmed, or the trace lines are few. Analysis runs without check-ins; the next gate is findings sign-off.
- **`check-ins`** — multiple systems, speculative hypotheses, intermittent symptoms, or anywhere the user's knowledge could redirect the trace. Analysis pauses briefly as hypotheses resolve.

The depth is a suggestion — the user decides.

Open with one markdown sentence above the display — what we think is happening and where the analysis will look, in product terms.

Write the payload to `.workflows/.cache/{work_unit}/investigation/{topic}/board.json` with the Write tool — `{"hypotheses": [{"id": "H1", "claim": "{hypothesis}", "status": "suspected", "rows": [["Basis", "{one-line basis}"]]}], "trace_lines": ["{code path or area to trace, in intended order}"], "depth": "{depth:[straight-through|check-ins]}", "depth_reasoning": "{one-line reasoning}"}` — then fetch the plan, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render hypothesis-board {work_unit}.investigation.{topic} --file .workflows/.cache/{work_unit}/investigation/{topic}/board.json --variant plan
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **C. Record**.

#### If the user adjusts

Incorporate the changes — add or drop hypotheses, re-order trace lines, switch the depth.

→ Return to **B. Present Plan**.

---

## C. Record

Write the agreed plan into the Hypotheses section of the investigation file: the checkpoint depth, then each hypothesis under its id with status `[suspected]` and its basis. Commit (`investigation({work_unit}): investigation plan`).

→ Return to caller.

---

## D. Resume Position

The plan was agreed in an earlier session — re-render the position from the ledger; never re-run recon over settled state.

Open with one markdown sentence above the display — what we think is happening and where the remaining analysis will look, in product terms.

Write the payload to `.workflows/.cache/{work_unit}/investigation/{topic}/board.json` with the Write tool — every hypothesis in the ledger at its current status, each carrying the rows the ledger holds for it, labelled for what they carry and one line apiece: `{"hypotheses": [{"id": "H1", "claim": "{hypothesis}", "status": "{status:[suspected|tracing|confirmed|ruled-out]}", "rows": [["{label}", "{value}"]]}], "depth": "{depth:[straight-through|check-ins]}", "remaining": "{unresolved hypotheses and open trace lines, or \"all hypotheses resolved\"}"}` — then fetch the board, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render hypothesis-board {work_unit}.investigation.{topic} --file .workflows/.cache/{work_unit}/investigation/{topic}/board.json --variant resume
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to caller.

#### If the user revises

Incorporate the changes into the ledger — existing statuses preserved, new hypotheses enter as `[suspected]` — and commit.

→ Return to **D. Resume Position**.
