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

Form the initial hypotheses. Each needs a one-line basis (what points at it), not proof. If the seed material already pinpoints the cause, say so — a single near-confirmed hypothesis is a valid plan.

Deep tracing belongs to code analysis. If recon starts confirming rather than forming, stop — that work belongs after the plan is agreed.

→ Proceed to **B. Present Plan**.

---

## B. Present Plan

Choose the checkpoint depth to propose:

- **`straight-through`** — the bug looks contained, the mechanism is near-confirmed, or the trace lines are few. Analysis runs without check-ins; the next gate is findings sign-off.
- **`check-ins`** — multiple systems, speculative hypotheses, intermittent symptoms, or anywhere the user's knowledge could redirect the trace. Analysis pauses briefly as hypotheses resolve.

The depth is a suggestion — the user decides.

> *Output the next fenced block as a code block:*

```
Investigation Plan: {work_unit}

Hypotheses:
  1. {hypothesis} [suspected]
     {one-line basis}

  2. ...

Trace lines:
  • {code path or area to trace, in intended order}

Depth: {depth:[straight-through|check-ins]} — {one-line reasoning}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Does this plan look right?

- **`y`/`yes`** — Proceed with the analysis as planned
- **Adjust** — Tell me what to change: hypotheses, trace lines, or depth
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **C. Record**.

#### If the user adjusts

Incorporate the changes — add or drop hypotheses, re-order trace lines, switch the depth.

→ Return to **B. Present Plan**.

---

## C. Record

Write the agreed plan into the Hypotheses section of the investigation file: the checkpoint depth, then each hypothesis with status `[suspected]` and its basis. Commit (`investigation({work_unit}): investigation plan`).

→ Return to caller.

---

## D. Resume Position

The plan was agreed in an earlier session — re-render the position from the ledger; never re-run recon over settled state.

> *Output the next fenced block as a code block:*

```
Investigation Plan: {work_unit} (resumed)

Board:
  • {hypothesis} [{status}]
  • ...

Depth: {depth:[straight-through|check-ins]}

Remaining: {unresolved hypotheses and open trace lines, or "all hypotheses resolved"}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Picking up where we left off — still good?

- **`y`/`yes`** — Continue as agreed
- **Revise** — Tell me what to change: hypotheses, trace lines, or depth
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Return to caller.

#### If the user revises

Incorporate the changes into the ledger — existing statuses preserved, new hypotheses enter as `[suspected]` — and commit.

→ Return to **D. Resume Position**.
