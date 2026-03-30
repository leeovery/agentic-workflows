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

Load the chosen format's **authoring.md** from `skills/workflow-planning-process/references/output-formats/{format}/authoring.md` and follow its task storage instructions.

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
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.planning.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} format {chosen-format}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set project.defaults.plan_format {chosen-format}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} spec_commit {commit-hash}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} task_list_gate_mode auto
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} author_gate_mode auto
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} finding_gate_mode auto
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} review_cycle 0
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} phase 1
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} task '~'
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} task_map '{}'
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} status completed
```

Register the task_map entries. For each task, map internal_id to external_id:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} task_map.{internal_id} {external_id}
```

The external_id is determined by the format's authoring instructions.

## D. Mark Scoping Complete

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.scoping.{topic}
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.scoping.{topic} status completed
```

Commit all scoping artifacts:

```
scoping({work_unit}): specification and plan
```

→ Return to caller.
