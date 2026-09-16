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

Fetch and emit the receipt's `DISPLAY: confirmation` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline
```

**STOP.** Do not proceed — terminal condition.

#### If `outcome` is `paused`

A paused phase revisits nothing — the pipeline continues at what it waits on. Set `target_phase` = `next_phase`.

→ Proceed to **D. Enter Plan Mode**.

#### Otherwise

Set `target_phase` = `next_phase`.

→ Proceed to **B. Offer Next Phase**.

## B. Offer Next Phase

The engine derives the offer from manifest state — the skip-review row on the review hop, the revisit row where an earlier phase is completed. An empty response means continuing is the only way forward:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render next-phase-gate {work_unit} --prev {completed_phase} --next {next_phase}
```

#### If the response is empty

→ Proceed to **D. Enter Plan Mode**.

#### If the response carried `MENU: next phase gate`

Emit the section verbatim.

**STOP.** Wait for user response.

**If user chose `y/yes`:**

→ Proceed to **D. Enter Plan Mode**.

**If user chose `d/done`:**

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete feature pipeline (review skipped)"
```

Fetch and emit the receipt's `DISPLAY: confirmation` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline --skipped-review
```

**STOP.** Do not proceed — terminal condition.

**If user chose `r/revisit`:**

→ Proceed to **C. Select Phase**.

## C. Select Phase

Fetch and emit the `MENU: revisit phases` section (its numbering follows `revisitable_phases` order):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render revisit-phases {work_unit}
```

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **B. Offer Next Phase**.

#### If user chose a phase

Set `target_phase` = the number's phase in `revisitable_phases`.

→ Proceed to **D. Enter Plan Mode**.

## D. Enter Plan Mode

#### If `outcome` is `paused`

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file — resolve the placeholders, then output the result **verbatim: it is the complete plan**. Plan mode's usual job does not apply here: nothing to investigate, verify, or design, and nothing learned this session is added — the next context is designed to start empty, and additions bias it. The one sanctioned addition: anything the user explicitly asked to carry forward goes under a final `## User instructions` heading, after the template:

```
# Continue Feature: {work_unit}

The previous phase paused on a wait — the pipeline continues at what it waits on.

## Next Step

Invoke `/workflow-{target_phase}-entry feature {work_unit}`

Arguments: work_type = feature, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

**To the human**: approve with **"Clear context and continue"** — this project's setup keeps that plan-mode option enabled. A fresh context will follow the Next Step above.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

#### Otherwise

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file — resolve the conditionals and placeholders, then output the result **verbatim: it is the complete plan**. Plan mode's usual job does not apply here: nothing to investigate, verify, or design, and nothing learned this session is added — the next context is designed to start empty, and additions bias it. The one sanctioned addition: anything the user explicitly asked to carry forward goes under a final `## User instructions` heading, after the template:

```
# Continue Feature: {work_unit}

@if(target_phase == next_phase) The previous phase has completed. Continue the pipeline. @else Revisiting an earlier phase. @endif

## Next Step

Invoke `/workflow-{target_phase}-entry feature {work_unit}`

Arguments: work_type = feature, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

**To the human**: approve with **"Clear context and continue"** — this project's setup keeps that plan-mode option enabled. A fresh context will follow the Next Step above.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.
