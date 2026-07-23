# Write Tasks

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Write 1-2 task files directly using the chosen output format. No planning agents, no review cycles.

## A. Create Plan Structure

Create the planning file at `.workflows/{work_unit}/planning/{topic}/planning.md`:

```markdown
# Plan: {Topic:(titlecase)}

## Phase 1: Apply Change

{One-line goal — e.g., "Replace all occurrences of interface{} with any across Go source files"}

#### Tasks
status: approved

| Internal ID | Name | Edge Cases |
|-------------|------|------------|
| {topic}-1-1 | {task name} | {edge cases or "none"} |
```

If a second task is needed (e.g., separate pass for config files, test file updates, or documentation), add it:

```
| {topic}-1-2 | {second task name} | {edge cases or "none"} |
```

**Maximum 2 tasks.** If the change genuinely needs more, re-evaluate — it may not be a quick-fix.

## B. Write Task Files

Load the chosen format's **[authoring.md](../../workflow-planning-process/references/output-formats/{format}/authoring.md)** and follow its task storage instructions.

**Task content** — each task file includes:

```markdown
# {Task Name}

**Goal**: {What this task accomplishes}

**Implementation Steps**:
- {Step-by-step mechanical instructions}
- {Be explicit about patterns, files, and transformations}

**Verification**:
- All existing tests pass after the change
- No occurrences of the old pattern remain in scope
- {Any additional verification specific to this task}

**Edge Cases**: {Edge cases to watch for, or "None"}

**Spec Reference**: `.workflows/{work_unit}/specification/{topic}/specification.md`
```

**Do not include acceptance criteria.** Mechanical changes are verified by test baselines and completeness checks, not acceptance criteria.

## C. Register Plan in Manifest

Capture the current git commit hash: `git rev-parse HEAD`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} planning {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.defaults.plan_format {chosen-format}
```

Then register everything — settings, position, and the whole task map — in ONE batched set (one lock, one write): the fixed fields, the phase mapping (`task_map.{topic}-1` = the phase's external ID), and one `task_map.{internal_id}={external_id}` pair per task:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} format={chosen-format} spec_commit={commit-hash} task_list_gate_mode=auto author_gate_mode=auto finding_gate_mode=auto review_cycle=0 phase=1 task='~' external_id={plan_external_id} task_map.{topic}-1={phase_external_id} task_map.{internal_id}={external_id} storage_paths='{format storage pathspecs}'
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} planning {topic}
```

The plan-level `external_id`, the phase external ID, and per-task external IDs are all determined by the format's authoring instructions (see the Plan Structure, Phase Structure, and Task Storage sections).

## D. Mark Scoping Complete

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} scoping {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} scoping {topic}
```

Commit all scoping artifacts — `--plan` stages the work unit, the project manifest, and the plan's declared storage in one scoped call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "scoping({work_unit}): specification and plan" --plan {topic}
```

→ Return to caller.
