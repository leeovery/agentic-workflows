---
name: link-dependencies
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

Link cross-topic dependencies within an epic work unit.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

## Important

Use simple, individual commands. Never combine multiple operations into bash loops or one-liners. Execute commands one at a time.

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/workflow-migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

---

## Step 1: Select Work Unit

Cross-topic dependency linking is only relevant to epic work units (feature and bugfix have a single plan with no cross-topic dependencies).

1. **List epic work units**: Run `node .claude/skills/workflow-manifest/scripts/manifest.js list --work-type epic --status in-progress`

#### If no epic work units exist

> *Output the next fenced block as a code block:*

```
Dependency Linking

No active epic work units found.

Cross-topic dependency linking requires an epic work unit
with multiple plans. Feature and bugfix work units have a
single plan with no cross-topic dependencies.
```

**STOP.** Do not proceed — terminal condition.

#### If one epic work unit exists

Auto-select it:

> *Output the next fenced block as a code block:*

```
Automatically proceeding with "{work_unit:(titlecase)}".
```

#### If multiple epic work units exist

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which epic work unit?

1. {work_unit_1}
2. {work_unit_2}
3. ...

Select an option (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

---

## Step 2: Discover Plans

Scan the selected work unit for existing plans:

1. **Find topics with plans**: Look in `.workflows/{work_unit}/planning/`
   - Each subdirectory is a topic that may contain a `planning.md` file

2. **Extract plan metadata**: For each topic with a plan
   - Read the format via manifest CLI: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} format`
   - Note the format used by each plan

#### If no plans exist

> *Output the next fenced block as a code block:*

```
Dependency Linking

No plans found in .workflows/{work_unit}/planning/

There are no plans to link. Create plans first.
```

**STOP.** Do not proceed — terminal condition.

#### If only one plan exists

> *Output the next fenced block as a code block:*

```
Dependency Linking

Only one plan found: {topic}

Cross-topic dependency linking requires at least two plans.
```

**STOP.** Do not proceed — terminal condition.

## Step 3: Check Output Format Consistency

Compare the `format:` field across all discovered plans.

#### If plans use different output formats

> *Output the next fenced block as a code block:*

```
Dependency Linking

Mixed output formats detected:

  • {topic} ({format})
  • ...

Cross-topic dependencies can only be wired within the same output
format. Consolidate your plans to a single format before linking.
```

**STOP.** Do not proceed — terminal condition.

## Step 4: Extract External Dependencies

For each plan, read the `external_dependencies` from the manifest:

1. **Read `external_dependencies`** via manifest CLI: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} external_dependencies`
2. **Categorize each dependency** by iterating the object's entries. Each key is a topic, each value has a `state` field:
   - **Unresolved**: `state: unresolved` (no task linked)
   - **Resolved**: `state: resolved` (has `task_id`)
   - **Satisfied externally**: `state: satisfied_externally`

3. **Build a summary**:

> *Output the next fenced block as a code block:*

```
Dependency Summary

{N} plans found. {M} unresolved dependencies.

Plan: {topic:(titlecase)} (format: {format})
  • {dependency}: {description} ({state:[unresolved|resolved|satisfied externally]})

Plan: ...
```

> *Output the next fenced block as a code block:*

```
Key:

  Dependency state:
    unresolved           — no task linked yet
    resolved             — linked to a task in another plan
    satisfied externally — implemented outside this workflow
```

## Step 5: Match Dependencies to Plans

For each unresolved dependency:

1. **Search for matching plan**: Does `.workflows/{work_unit}/planning/{dependency-topic}/planning.md` exist?
   - If no match: Mark as "no plan exists" - cannot resolve yet

2. **If plan exists**: Load the format's reading reference
   - Read `format` from the dependency plan's manifest
   - Load `../workflow-planning-process/references/output-formats/{format}/reading.md`
   - Use the task extraction instructions to search for matching tasks

3. **Handle ambiguous matches**:
   - If multiple tasks could satisfy the dependency, present options to user
   - Allow selecting multiple if the dependency requires multiple tasks

## Step 6: Wire Up Dependencies

For each resolved match:

1. **Update the dependency in the manifest** via dot-path set:
   - Set `state` to `resolved`: `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} external_dependencies.{dep-topic}.state resolved`
   - Set `task_id`: `node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase planning --topic {topic} external_dependencies.{dep-topic}.task_id {internal_id}`

2. **Create dependency in output format**:
   - Load `../workflow-planning-process/references/output-formats/{format}/graph.md`
   - Follow the "Adding a Dependency" section to create the blocking relationship

## Step 7: Bidirectional Check

For each plan that was a dependency target (i.e., other plans depend on it):

1. **Check reverse dependencies**: Are there other plans that should have this wired up?
2. **Offer to update**: "Plan X depends on tasks you just linked. Update its `external_dependencies` in the manifest?"

## Step 8: Report Results

Present a summary:

> *Output the next fenced block as a code block:*

```
Dependency Linking Complete

Resolved (newly linked):
  • {source} → {target}: {internal_id} ({description})

Already resolved (no action needed):
  • {source} → {target}: {internal_id}

Satisfied externally (no action needed):
  • {source} → {target}

Unresolved (no matching plan exists):
  • {source} → {target}: {description}

Updated files:
  • .workflows/{work_unit}/planning/{topic}/planning.md
```

If any dependencies remain unresolved:

> *Output the next fenced block as a code block:*

```
Unresolved dependencies have no corresponding plan. Either:
  • Create a plan for the topic
  • Mark as "satisfied externally" if already implemented
```

## Step 9: Commit Changes

If any files were updated:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Shall I commit these dependency updates?
- **`y`/`yes`** — Commit the changes
- **`n`/`no`** — Skip
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

If yes, commit with message:
```
Link cross-topic dependencies

- {summary of what was linked}
```
