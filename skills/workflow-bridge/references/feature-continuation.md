# Feature Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a feature to its next pipeline phase, with an option to revisit earlier phases.

Feature pipeline: (Research) → (Experiment) → Discussion → Specification → Planning → Implementation → Review

## A. Check Terminal

#### If `next_phase` is `done`

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete feature pipeline"
```

Fetch and emit the receipt's `DISPLAY: confirmation` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline
```

**STOP.** Do not proceed — terminal condition.

#### If `outcome` is `paused`

A paused phase revisits nothing — the pipeline continues at what it waits on. Set `target_phase` = `next_phase`.

→ Proceed to **D. Hand Off**.

#### Otherwise

Set `target_phase` = `next_phase`.

→ Proceed to **B. Offer Next Phase**.

## B. Offer Next Phase

The engine derives the offer from manifest state — the skip-review row on the review hop, the revisit row where an earlier phase is completed. An empty response means continuing is the only way forward:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render next-phase-gate {work_unit} --prev {completed_phase} --next {next_phase}
```

#### If the response is empty

→ Proceed to **D. Hand Off**.

#### If the response carried `MENU: next phase gate`

Emit the section verbatim per its marker.

**STOP.** Wait for user response.

**If user chose `y/yes`:**

→ Proceed to **D. Hand Off**.

**If user chose `d/done`:**

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete feature pipeline (review skipped)"
```

Fetch and emit the receipt's `DISPLAY: confirmation` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline --skipped-review
```

**STOP.** Do not proceed — terminal condition.

**If user chose `r/revisit`:**

→ Proceed to **C. Select Phase**.

## C. Select Phase

Fetch and emit the `MENU: revisit phases` section verbatim per its marker (its numbering follows `revisitable_phases` order):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render revisit-phases {work_unit}
```

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **B. Offer Next Phase**.

#### If user chose a phase

Set `target_phase` = the number's phase in `revisitable_phases`.

→ Proceed to **D. Hand Off**.

## D. Hand Off

→ Load **[handing-off.md](../../workflow-shared/references/handing-off.md)** with skill = `workflow-{target_phase}-entry`, args = `feature {work_unit}`.
