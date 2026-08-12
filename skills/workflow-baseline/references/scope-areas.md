# Scope the Assessment

*Reference for **[workflow-baseline](../SKILL.md)***

---

Survey the codebase, propose the area list, and persist the approved scope. Two entry modes: a fresh assessment (from Step 0), or **expand** (from manage — `mode = expand`, adding or deepening areas on a completed baseline).

## A. Survey

#### If `mode` is `expand`

The user has named what to add or deepen — survey only that ground, then propose it as one or more new areas alongside the existing map (named like the rest: kebab-case, after the concern), skipping the fresh-assessment framing.

→ Proceed to **B. Confirm**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> I'll take a quick look at the codebase first — enough to propose a set of areas worth assessing, not a full audit. Then we shape the list together before any deeper research runs.
```

Survey briefly — README and docs, dependency manifests, top-level structure, route/entry files, the largest modules. Minutes of reads, not an audit; the goal is a defensible area list, nothing deeper.

Compose the proposed areas:

- **The fixed spine** — always present: `overview` (what the product is, who uses it, its verdict), `glossary` (the domain vocabulary and the code that backs it), `boundaries` (modules, surfaces, and the integration map).
- **Concern areas** — 3–8 more, sized to the codebase: one per load-bearing concern — an entity and its lifecycle, a pipeline, a subsystem, a seam to an external system. Name each in kebab-case after the concern, not the directory.

→ Proceed to **B. Confirm**.

## B. Confirm

Present the proposed areas as markdown — nothing is persisted yet, so this is a proposal, not a state display: one bolded kebab-case area name per line, each with a one-line clause on what it covers and why it earns a doc.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Assess these areas?`**

**`a/approve`** → Lock the list and start the research
**Adjust**     → Tell me what to add, drop, rename, or merge
```

**STOP.** Wait for user response.

**If the user adjusts:**

Apply the changes, re-render the proposed list and the menu above.

**STOP.** Wait for user response.

**If `approve`:**

→ Proceed to **C. Persist**.

## C. Persist

Set the baseline in progress and register each approved area (one call per field):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.status in-progress
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.areas.{area} pending
```

Hold each area's one-line coverage description in context — the research dispatch passes it to the area's researcher.

Commit with the message matching the mode — `baseline: open the assessment ({N} areas)`, or for expand `baseline: expand the assessment (+{N} areas)`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "{message}"
```

→ Return to caller.
