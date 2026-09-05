# Scope the Assessment

*Reference for **[workflow-baseline](../SKILL.md)***

---

Survey the codebase, propose the area list, and persist the approved scope. Two entry modes: a fresh assessment (from Step 0), or **expand** (from manage — `mode = expand`, adding or deepening areas on a completed baseline).

## A. Survey

#### If `mode` is `expand`

The user has named what to add or deepen — survey only that ground, then propose it alongside the existing map, skipping the fresh-assessment framing. New ground becomes a new kebab-case area named after the concern; **deepening an existing area reuses its name** — its earlier agenda and doc are extended at research and authoring, never replaced.

→ Proceed to **B. Confirm**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> I'll take a quick look at the codebase first — enough to propose a set of areas worth assessing, not a full audit. Then we shape the list together before any deeper research runs.
```

Survey briefly — README and docs, dependency manifests, top-level structure, route/entry files, the largest modules. Minutes of reads, not an audit; the goal is a defensible area list, nothing deeper.

Compose the proposed areas:

- **The fixed spine** — always present: `overview` (what the product is, who uses it, its verdict), `glossary` (the domain vocabulary and the code that backs it), `boundaries` (modules, surfaces, and the integration map).
- **Concern areas** — 3–8 more, sized to the codebase: one per load-bearing concern — an entity and its lifecycle, a pipeline, a subsystem, a seam to an external system. Name each in kebab-case after the concern, not the directory. Names are dot- and slash-free — an area name is the doc's knowledge-base identity, and dots are refused there.

→ Proceed to **B. Confirm**.

## B. Confirm

Write the proposal payload to `.workflows/.cache/baseline/scope.json` with the Write tool — `{"mode": "{fresh|expand}", "areas": [{"name": "{area:(kebabcase)}", "detail": "{one line: what it covers and why it earns a doc}"}]}` — then fetch the gate and emit its `DISPLAY: baseline scope` and `MENU: baseline scope gate` sections verbatim, each per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-scope-gate --file .workflows/.cache/baseline/scope.json
```

**STOP.** Wait for user response.

**If the user adjusts:**

Apply the changes, rewrite the payload, and re-render the gate.

**STOP.** Wait for user response.

**If `back` and `mode` is `expand`:**

Nothing is persisted.

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

**If `back` and the assessment is fresh:**

Nothing is persisted — the assessment stays available from the workflow-start manage menu whenever you want it.

**STOP.** Do not proceed — terminal condition.

**If `approve`:**

→ Proceed to **C. Persist**.

## C. Persist

Register each newly approved area, then set the status — the status write is last, so an interrupted session never claims an in-progress baseline with unregistered areas (one call per field):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.areas.{area} pending
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.status in-progress
```

A deepened area is set back to `pending` the same way — its agenda and doc survive and are extended downstream.

Hold each area's one-line coverage description in context — the research dispatch passes it to the area's researcher.

Commit with the message matching the mode — `baseline: open the assessment ({N} areas)`, or for expand `baseline: expand the assessment (+{N} areas)`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "{message}"
```

→ Return to caller.
