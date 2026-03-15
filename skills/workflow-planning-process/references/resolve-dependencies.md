# Resolve External Dependencies

*Reference for **[workflow-planning-process](../SKILL.md)***

---

#### If work_type is not `epic`

Set external dependencies to empty object:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies '{}'
```

→ Return to **[the skill](../SKILL.md)**.

#### If work_type is `epic`

> *Output the next fenced block as a code block:*

```
All phases and tasks are written. Now I'll check for external
dependencies — things this plan needs from other topics or systems.
```

Handle external dependencies — things this plan needs from other topics or systems.

Dependencies are stored in the **manifest** as `external_dependencies` (under `planning.{topic}`). See [dependencies.md](dependencies.md) for the format and states.

#### If the specification has no Dependencies section

Set the manifest field to an empty object:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies '{}'
```

This makes it clear that dependencies were considered and none exist — not that they were overlooked.

→ Proceed to the approval gate below.

#### If the specification has a Dependencies section

## A. Build Dependencies from Spec

1. Read existing `external_dependencies` from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} external_dependencies
```

2. Read the specification's Dependencies section.

3. For each dependency in the specification:
   - If an existing manifest entry for that topic has `state: satisfied_externally` → preserve it as-is
   - Otherwise → set `state: unresolved`

4. Remove any manifest dependency entries that are not in the specification (the spec is the source of truth).

5. Write each dependency via manifest CLI:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.description "{description}"
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state unresolved
```

→ Proceed to **B. Resolve Current Plan's Dependencies**.

## B. Resolve Current Plan's Dependencies

For each unresolved dependency:

1. Check if `.workflows/{work_unit}/planning/{dep_topic}/planning.md` exists.
2. If yes: read the plan's task table, match a task by name against the dependency description.
3. If a match is found: update the dependency:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.state resolved
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} external_dependencies.{dep_topic}.internal_id {matched_id}
```

4. If ambiguous (multiple potential matches): ask the user which task satisfies the dependency.
5. If no plan exists for that topic: leave the dependency as `state: unresolved`.

→ Proceed to **C. Reverse Check and Stale Reference Validation**.

## C. Reverse Check and Stale Reference Validation

For each other topic with a planning phase in the same work unit:

1. Read their external dependencies from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{other_topic} external_dependencies
```

2. **Unresolved deps matching current topic** → find the satisfying task in the current plan, resolve:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{other_topic} external_dependencies.{topic}.state resolved
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{other_topic} external_dependencies.{topic}.internal_id {matched_id}
```

3. **Resolved deps pointing at current plan's tasks** → validate that the `internal_id` still refers to a task that semantically matches the dependency description. If the task name no longer matches (stale reference): re-resolve by finding the correct task. If ambiguous: ask the user.

4. **`satisfied_externally` deps** → skip.

→ Proceed to **D. Summary and Approval**.

## D. Summary and Approval

Present a summary of the dependency state: what was documented, what was resolved, what remains unresolved, and any reverse resolutions made.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve the dependency resolution?

- **`y`/`yes`** — Proceed
- **Tell me what to change** — Adjust resolutions or add missing links
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user provides feedback

Incorporate feedback, re-present the updated dependency state, and ask again. Repeat until approved.

#### If `approved`

Commit: `planning({work_unit}): resolve external dependencies`
