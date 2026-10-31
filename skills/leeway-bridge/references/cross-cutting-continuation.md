# Cross-Cutting Continuation

*Reference for **[leeway-bridge](../SKILL.md)***

---

Route a cross-cutting concern to its next pipeline phase.

Cross-cutting pipeline: (Experiment) → Discussion → Specification (terminal)

## A. Check Terminal

#### If `next_phase` is `done`

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete cross-cutting pipeline"
```

Fetch and emit the receipt's `DISPLAY: confirmation` section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Set `route` = `next_route`.

→ Proceed to **B. Hand Off**.

## B. Hand Off

→ Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `{route}`.
